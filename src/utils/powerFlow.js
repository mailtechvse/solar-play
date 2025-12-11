
/**
 * Power Flow Engine
 * Calculates the flow of power (kW) through the system based on connectivity and switch states.
 * Implements Priority-Based Balancing: User defined priority.
 */

export function calculateFlows(objects, wires, options = {}) {
    const {
        generationMap = null,
        batteryLimits = new Map(),
        priority = ['Solar', 'Battery', 'Grid'],
        sunTime = 12
    } = options;

    // Calculate Generation if map not provided
    const genMap = generationMap || new Map();
    if (!generationMap) {
        objects.filter(o => o.type === 'panel').forEach(p => {
            let gen = 0;
            if (sunTime > 6 && sunTime < 18) {
                const peak = (p.watts || 550) / 1000; // kW
                const factor = Math.sin(((sunTime - 6) / 12) * Math.PI);
                gen = peak * factor * 0.85;
            }
            genMap.set(p.id, gen);
        });
    }

    const flows = new Map(); // Map<objectId, { activePower: number, gridFlow: number, loadFlow: number, batteryFlow: number, isEnergized: boolean }>
    const adj = new Map();

    // 1. Build Graph
    wires.forEach(w => {
        if (!adj.has(w.from)) adj.set(w.from, []);
        if (!adj.has(w.to)) adj.set(w.to, []);
        adj.get(w.from).push(w.to);
        adj.get(w.to).push(w.from);
    });

    // 1b. Implicit Connections for Touching Panels
    const panels = objects.filter(o => o.type === 'panel');
    // Simple O(N^2) check for touching panels. 
    // Optimization: Only check if they are close enough.
    // Panel dimensions are typically small, so we can check bounding box overlap.
    for (let i = 0; i < panels.length; i++) {
        for (let j = i + 1; j < panels.length; j++) {
            const p1 = panels[i];
            const p2 = panels[j];

            // Check for overlap/touching
            // Expand bounds slightly (e.g. 0.2m) to catch "touching" edges or small gaps
            const margin = 0.2;
            const intersect = !(p2.x > p1.x + p1.w + margin ||
                p2.x + p2.w + margin < p1.x ||
                p2.y > p1.y + p1.h + margin ||
                p2.y + p2.h + margin < p1.y);

            if (intersect) {
                if (!adj.has(p1.id)) adj.set(p1.id, []);
                if (!adj.has(p2.id)) adj.set(p2.id, []);
                adj.get(p1.id).push(p2.id);
                adj.get(p2.id).push(p1.id);
            }
        }
    }

    // Helper to get neighbors
    const getNeighbors = (id) => adj.get(id) || [];

    // Helper to check grid connection status (Deep Search)
    const findGridConnection = (startNodeId) => {
        const queue = [startNodeId];
        const visited = new Set([startNodeId]);
        let hasOutage = false;
        let hasHealthy = false;

        while (queue.length > 0) {
            const currId = queue.shift();
            const currObj = objects.find(o => o.id === currId);
            if (!currObj) continue;

            if (currObj.type === 'grid') {
                // Check for Outage OR Manual Off
                if (currObj.isOutage || currObj.isOn === false) {
                    hasOutage = true;
                } else {
                    hasHealthy = true;
                }
                if (hasOutage && hasHealthy) return { hasOutage, hasHealthy };
            }

            // Traverse neighbors
            const neighbors = getNeighbors(currId);
            for (const nid of neighbors) {
                if (visited.has(nid)) continue;

                const neighbor = objects.find(o => o.id === nid);
                if (!neighbor) continue;

                // Stop at OPEN switches (except the start node itself)
                let isBlocked = false;

                // Check neighbor switch state
                if (['vcb', 'acb', 'lt_panel', 'ht_panel', 'acdb'].includes(neighbor.type)) {
                    if (neighbor.id !== startNodeId && neighbor.isOn === false) isBlocked = true;
                }

                // Check current node switch state (if not start node)
                if (currId !== startNodeId && ['vcb', 'acb', 'lt_panel', 'ht_panel', 'acdb'].includes(currObj.type)) {
                    if (currObj.isOn === false) isBlocked = true;
                }

                if (!isBlocked) {
                    visited.add(nid);
                    queue.push(nid);
                }
            }
        }
        return { hasOutage, hasHealthy };
    };

    // 2. Find Connected Components (Islands)
    const visited = new Set();
    const islands = [];

    objects.forEach(obj => {
        if (visited.has(obj.id)) return;

        // Start new island
        const island = {
            nodes: [],
            hasGrid: false,
            totalLoad: 0,
            totalSolar: 0,
            batteryIds: [], // Track batteries in this island
            gridConnectionId: null
        };

        const queue = [obj.id];
        visited.add(obj.id);

        while (queue.length > 0) {
            const currId = queue.shift();
            const currObj = objects.find(o => o.id === currId);
            if (!currObj) continue;

            island.nodes.push(currObj);

            // Check properties
            if (currObj.type === 'grid') {
                // Check for Outage
                if (!currObj.isOutage) {
                    island.hasGrid = true;
                    island.gridConnectionId = currObj.id;
                }
            }
            if (currObj.type === 'load') {
                // Monthly units -> kW approx
                let loadKw = (currObj.units || 0) / 720;
                if (loadKw === 0) loadKw = 1.0;
                island.totalLoad += loadKw;
            }
            if (currObj.type === 'panel') {
                island.totalSolar += (genMap.get(currObj.id) || 0);
            }
            if (currObj.type === 'battery' || currObj.type === 'bess') {
                island.batteryIds.push(currObj.id);
            }

            // Traverse neighbors if switch/panel is CLOSED/ON
            // If switch is OPEN, we do NOT add neighbors to queue (effectively splitting the island)
            const isSwitch = ['vcb', 'acb', 'lt_panel', 'ht_panel', 'acdb'].includes(currObj.type);

            // Logic: If switch is OFF, break.
            // ALSO: If switch is connected to an OUTAGE GRID, treat as OPEN (Tripped).
            let isOpen = false;
            if (isSwitch) {
                if (currObj.isOn === false) isOpen = true;
                else if (findGridConnection(currObj.id).hasOutage) isOpen = true; // Auto-trip on outage
            }

            if (isOpen) {
                continue;
            }

            getNeighbors(currId).forEach(nextId => {
                if (!visited.has(nextId)) {
                    visited.add(nextId);
                    queue.push(nextId);
                }
            });
        }

        if (island.nodes.length > 0) {
            islands.push(island);
        }
    });

    // 3. Balance Power for each Island
    islands.forEach(island => {
        let remainingLoad = island.totalLoad;

        // Track usage
        let solarUsed = 0;
        let batteryDischarged = 0; // Total discharged from all batteries
        let gridImport = 0;

        // Map to track flow per battery in this island
        const islandBatteryFlows = new Map(); // id -> kw (+Discharge, -Charge)
        island.batteryIds.forEach(id => islandBatteryFlows.set(id, 0));

        // Iterate through Priority List
        priority.forEach(sourceType => {
            if (remainingLoad <= 0) return;

            if (sourceType === 'Solar') {
                const available = island.totalSolar;
                const used = Math.min(remainingLoad, available);
                solarUsed += used;
                remainingLoad -= used;
            } else if (sourceType === 'Battery') {
                // Distribute load among available batteries
                // Simple strategy: Proportional to maxDischarge or just greedy
                // Let's do greedy for now
                island.batteryIds.forEach(batId => {
                    if (remainingLoad <= 0) return;
                    const limits = batteryLimits.get(batId) || { maxDischarge: 0, maxCharge: 0 };
                    const available = limits.maxDischarge;
                    const used = Math.min(remainingLoad, available);

                    islandBatteryFlows.set(batId, islandBatteryFlows.get(batId) + used);
                    batteryDischarged += used;
                    remainingLoad -= used;
                });
            } else if (sourceType === 'Grid') {
                if (island.hasGrid) {
                    gridImport += remainingLoad;
                    remainingLoad = 0;
                }
            }
        });

        // Calculate Excess Solar (for Charging or Export)
        let solarExcess = island.totalSolar - solarUsed;

        // Try to Charge Batteries with Excess Solar
        if (solarExcess > 0) {
            island.batteryIds.forEach(batId => {
                if (solarExcess <= 0) return;
                const limits = batteryLimits.get(batId) || { maxDischarge: 0, maxCharge: 0 };
                // Can't charge if we already discharged in this step (simple model)
                // Actually, net flow matters. If we discharged 0, we can charge.
                if (islandBatteryFlows.get(batId) === 0) {
                    const canCharge = limits.maxCharge;
                    const chargeAmt = Math.min(solarExcess, canCharge);

                    islandBatteryFlows.set(batId, -chargeAmt); // Negative for Charging
                    solarExcess -= chargeAmt;
                }
            });
        }

        let gridExport = 0;
        if (island.hasGrid) {
            gridExport = solarExcess;
        }

        // Calculate Served Load (Total Demand - Unmet Demand)
        const servedLoad = island.totalLoad - remainingLoad;

        // 4. Assign Flows to Nodes in this Island
        island.nodes.forEach(node => {
            const flowData = {
                activePower: 0,
                gridFlow: 0,
                loadFlow: 0,
                batteryFlow: 0,
                isEnergized: (island.hasGrid || island.totalSolar > 0 || batteryDischarged > 0)
            };

            // If the island has potential power (Grid/Solar/Battery), we consider it energized
            // UNLESS it's a pure load island with no sources (handled by the check above).
            // Actually, isEnergized should be true if there is ANY voltage source.
            // Even if servedLoad is 0 (e.g. no load connected), the bus is energized if Grid is there.
            // Energized check: If battery is charging, it's a load, but bus is energized by solar.
            // If battery is discharging, it's a source.
            // If solar is generating, it's a source.
            // If grid is present, it's a source.
            flowData.isEnergized = (island.hasGrid || island.totalSolar > 0 || batteryDischarged > 0);

            // SPECIAL CASE: If this node is a VCB connected to an Outage Grid, force it to be de-energized (Tripped visual)
            if (['vcb', 'acb', 'ht_panel', 'lt_panel', 'acdb'].includes(node.type)) {
                const gridStatus = findGridConnection(node.id);
                if (gridStatus.hasOutage) {
                    flowData.isEnergized = false;
                    flowData.isTripped = true; // Signal to controller to turn OFF
                }
                if (gridStatus.hasHealthy) {
                    flowData.canReset = true; // Signal to controller to turn ON
                }
            }

            if (node.type === 'net_meter') {
                if (island.hasGrid) {
                    flowData.gridFlow = gridImport - gridExport;
                    flowData.netPower = flowData.gridFlow;
                }
            } else if (node.type === 'gross_meter') {
                // Gross Meter reads the load that is ACTUALLY flowing through it.
                // If we have a blackout (servedLoad < totalLoad), it reads less or 0.
                flowData.loadFlow = servedLoad;
                flowData.netPower = flowData.loadFlow;
            } else if (node.type === 'battery' || node.type === 'bess') {
                flowData.batteryFlow = islandBatteryFlows.get(node.id) || 0;
            }

            flows.set(node.id, flowData);
        });
    });

    return flows;
}
