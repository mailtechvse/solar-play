import { SunCalc } from "./suncalc";

/**
 * Solar System Simulation Engine
 * Calculates generation, efficiency, and 25-year ROI projections
 * Ported from solar-board.html with Supabase integration
 */

/**
 * Run complete system simulation
 * @param {Array} objects - All canvas objects
 * @param {Array} wires - All wire connections
 * @param {Object} params - Simulation parameters
 * @returns {Object} Simulation results
 */
export function runSimulation(objects, wires, params) {
  let {
    baseLoad = 500, // units/month
    gridRate = 8.5, // ₹/unit
    exportRate = 3.0, // ₹/unit (Grid Input Rate)
    systemCost = 0, // ₹
    isCommercial = false,
    extraCostItems = [],
    boqOverrides = {},
    latitude = 28.6,
    longitude = 77.2,
  } = params;

  // Extract equipment from objects
  const panels = objects.filter(o => o.type === 'panel' || o.type === 'Solar Panel');
  const inverters = objects.filter(o => o.type === 'inverter' || o.type === 'Inverter');
  const batteries = objects.filter(o => o.type === 'battery' || o.type === 'Battery');
  const loadBoxes = objects.filter(o => o.type === 'load');

  // Calculate system size
  const dcCapacityKwp = panels.reduce((sum, p) => sum + (p.watts || 0), 0) / 1000;
  const acCapacityKw = inverters.reduce((sum, i) => sum + (i.capKw || 0), 0);
  const batteryCapacityKwh = batteries.reduce((sum, b) => sum + (b.capKwh || 0), 0);

  // Calculate weighted average inverter efficiency
  let inverterEfficiency = 0.975; // Default 97.5%
  if (inverters.length > 0) {
    let totalInvCapacity = 0;
    let weightedEff = 0;
    inverters.forEach(inv => {
      const specs = typeof inv.specifications === 'string' ? JSON.parse(inv.specifications) : (inv.specifications || {});
      const eff = specs.efficiency !== undefined ? specs.efficiency : 97.5;
      const cap = inv.capKw || 0;
      weightedEff += eff * cap;
      totalInvCapacity += cap;
    });
    if (totalInvCapacity > 0) {
      inverterEfficiency = (weightedEff / totalInvCapacity) / 100;
    }
  }

  // Check if system exists (removed early return to allow load calculation)
  // if (dcCapacityKwp === 0) { ... }

  // Total load (base + load boxes)
  const totalMonthlyLoad = baseLoad + loadBoxes.reduce((sum, b) => sum + (b.units || 0), 0);

  // Validation checks
  const { issues, validations } = validateSystem(objects, wires);

  // Calculate yearly shadow loss
  const shadowLossPct = calculateYearlyShadowLoss(objects, latitude, longitude);
  const shadowLossFactor = 1 - shadowLossPct;

  // Monthly simulation with seasonality and hourly granularity
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const seasonality = [0.8, 0.9, 1.1, 1.2, 1.25, 1.1, 1.0, 0.95, 0.95, 1.0, 0.9, 0.8];

  const monthlyData = [];
  let totalAnnualGen = 0;
  let totalAnnualSavings = 0;
  const monthlyGenData = [];
  const monthlyLossData = [];

  // Battery State
  let currentBatteryKwh = 0; // Start empty or full? Let's say 0 for now
  const batteryMaxKwh = batteryCapacityKwh;
  const batteryEfficiency = 0.95;

  months.forEach((month, monthIdx) => {
    let monthGen = 0;
    let monthLoad = 0;
    let monthExport = 0;
    let monthImport = 0;
    let monthShadowLoss = 0;

    // Simulate a typical day (24 hours) for this month
    for (let hour = 0; hour < 24; hour++) {
      // 1. Calculate Solar Generation for this hour
      // Simple bell curve for solar generation between 6am and 6pm
      let hourlyGen = 0;
      if (hour >= 6 && hour <= 18) {
        const peakHour = 12;
        const sigma = 2.5;
        const normalizedGen = Math.exp(-Math.pow(hour - peakHour, 2) / (2 * Math.pow(sigma, 2)));
        // Scale by capacity and seasonality
        // Peak generation is roughly capacity * efficiency
        hourlyGen = dcCapacityKwp * normalizedGen * seasonality[monthIdx] * shadowLossFactor * inverterEfficiency;
      }

      // 2. Calculate Load for this hour
      // Simple load profile: Peak in evening (6-10pm) and morning (7-9am)
      const dailyLoad = totalMonthlyLoad / 30;
      let hourlyLoad = dailyLoad / 24; // Base load
      if ((hour >= 7 && hour <= 9) || (hour >= 18 && hour <= 22)) {
        hourlyLoad *= 1.5; // Peak hours
      } else if (hour >= 1 && hour <= 5) {
        hourlyLoad *= 0.5; // Night hours
      }

      // 3. Execute PLC Logic (Time & Interlock)
      // This is a simulation, so we can't change the actual object state in the store,
      // but we can simulate the effect on power flow.
      // For now, we'll check if any critical breakers are tripped by logic.
      let gridAvailable = true;

      // Check Master PLC Rules
      const masterPlc = objects.find(o => o.type === 'master_plc');
      if (masterPlc && masterPlc.specifications?.custom_logic) {
        masterPlc.specifications.custom_logic.forEach(rule => {
          if (rule.type === 'Time') {
            const start = rule.val;
            const end = rule.val2;
            // Check if current hour is in range
            let inRange = false;
            if (start < end) {
              inRange = hour >= start && hour < end;
            } else {
              // Crosses midnight (e.g. 18 to 6)
              inRange = hour >= start || hour < end;
            }

            if (inRange && rule.action === 'Close') {
              // Simulate device closing (if it was the grid breaker, grid becomes available)
              // For simulation purposes, we assume logic works as intended
            } else if (inRange && rule.action === 'Trip') {
              // Simulate device tripping
              if (rule.targetId) {
                const target = objects.find(o => o.id === rule.targetId);
                if (target && target.type === 'grid') gridAvailable = false;
              }
            }
          }
        });
      }

      // 4. Power Balance & Battery Logic
      let availableGen = hourlyGen;
      let netPower = availableGen - hourlyLoad;

      if (netPower > 0) {
        // Excess Generation: Charge Battery first
        if (currentBatteryKwh < batteryMaxKwh) {
          const chargeSpace = batteryMaxKwh - currentBatteryKwh;
          const chargeAmount = Math.min(netPower, chargeSpace);
          currentBatteryKwh += chargeAmount * batteryEfficiency;
          netPower -= chargeAmount; // Remaining goes to grid
        }
        monthExport += netPower;
      } else {
        // Deficit: Discharge Battery first
        const deficit = -netPower;
        if (currentBatteryKwh > 0) {
          const dischargeAmount = Math.min(deficit, currentBatteryKwh);
          currentBatteryKwh -= dischargeAmount; // Discharge
          const coveredLoad = dischargeAmount * batteryEfficiency;
          netPower += coveredLoad; // Reduce deficit
        }

        // Remaining deficit comes from grid (if available)
        if (netPower < 0) {
          if (gridAvailable) {
            monthImport += -netPower;
          } else {
            // Blackout / Unmet Load
            // We could track this statistic
          }
        }
      }

      monthGen += hourlyGen;
      monthLoad += hourlyLoad;
      monthShadowLoss += (hourlyGen / shadowLossFactor) - hourlyGen;
    }

    // Scale daily simulation to month (30 days)
    const actualGen = monthGen * 30;
    const totalLoad = monthLoad * 30;
    const netExport = monthExport * 30;
    const netImport = monthImport * 30;
    const shadowLoss = monthShadowLoss * 30;

    monthlyGenData.push(actualGen);
    monthlyLossData.push(shadowLoss);
    totalAnnualGen += actualGen;

    // Financials
    // Net Metering: (Export * ExportRate) - (Import * GridRate)
    // If Export > Import (in terms of value? No, usually units are netted first or monetary value)
    // Let's assume monetary netting:
    const exportValue = netExport * exportRate;
    const importCost = netImport * gridRate;
    const netMeteringBenefit = exportValue - importCost;

    // Gross Metering: All Gen * ExportRate
    const grossMeteringIncome = actualGen * exportRate;

    // Savings = Cost of Load (if no solar) - Actual Cost (Import - Export)
    // Cost without solar = Total Load * GridRate
    // Actual Cost = Import * GridRate - Export * ExportRate
    // Savings = (Total Load * GridRate) - (Import * GridRate - Export * ExportRate)
    const savings = (totalLoad * gridRate) - (importCost - exportValue);

    monthlyData.push({
      month,
      generation: actualGen,
      load: totalLoad,
      netExport,
      netMeteringIncome: savings, // Using savings as the benefit metric
      grossMeteringIncome,
      shadowLoss,
    });

    totalAnnualSavings += savings;
  });

  // 25-year projection
  const yearlyData = [];
  let cumulativeSavings = 0;
  let breakEvenYear = null;
  let breakEvenMonth = 0;

  // Calculate performance score
  const issueCount = issues.filter(i => i.startsWith('ERROR')).length;
  const checklistScore = Math.max(0, 100 - (issueCount * 20));
  const efficiencyScore = Math.round(checklistScore * shadowLossFactor);

  // Optimization Suggestions
  const suggestions = [];
  if (shadowLossPct > 0.05) suggestions.push("High shadow loss detected (>5%). Consider relocating panels to reduce shading.");
  if (acCapacityKw > 0 && dcCapacityKwp / acCapacityKw > 1.5) suggestions.push("Inverter undersized (DC:AC > 1.5). Consider upgrading inverter to avoid clipping.");
  if (acCapacityKw > 0 && dcCapacityKwp / acCapacityKw < 1.0) suggestions.push("Inverter oversized (DC:AC < 1.0). You can add more panels to maximize inverter utilization.");
  if (batteryCapacityKwh === 0 && !isCommercial) suggestions.push("Consider adding a battery for backup during power outages.");
  if (efficiencyScore < 50) suggestions.push("System efficiency is low. Check connections and potential shading issues.");
  if (dcCapacityKwp > 0 && acCapacityKw === 0) suggestions.push("No Inverter detected. System will not function.");

  // Generate BOQ
  const boq = {};
  objects.forEach(o => {
    // Skip grid/ground objects if needed, but usually we want everything
    if (o.type === 'grid') return;
    const key = o.label || o.type;
    if (!boq[key]) boq[key] = { count: 0, cost: 0, type: o.type };
    boq[key].count++;
    boq[key].cost += (o.cost || 0);
  });

  // Add structure cost to BOQ
  if (panels.length > 0) {
    const rccCount = panels.filter(p => p.mountingType === 'rcc').length;
    const tinCount = panels.filter(p => p.mountingType === 'tinshed').length;
    const groundCount = panels.filter(p => !p.mountingType || p.mountingType === 'ground').length;

    if (rccCount > 0) boq['Structure (RCC)'] = { count: rccCount, cost: rccCount * 1000, type: 'structure' };
    if (tinCount > 0) boq['Structure (Tin Shed)'] = { count: tinCount, cost: tinCount * 1500, type: 'structure' };
    if (groundCount > 0) boq['Structure (Ground)'] = { count: groundCount, cost: groundCount * 2000, type: 'structure' };
  }

  // Add extra items to BOQ
  extraCostItems.forEach(item => {
    boq[item.label] = { count: 1, cost: item.cost, type: 'extra' };
  });

  if (wires.length > 0) {
    boq['DC/AC Wires'] = { count: wires.length, cost: wires.length * 500, type: 'wire' };
  }

  // Apply BOQ Overrides
  if (boqOverrides) {
    Object.entries(boqOverrides).forEach(([key, val]) => {
      boq[key] = { ...(boq[key] || { type: 'custom' }), ...val };
    });
  }

  // Calculate system cost from BOQ
  if (!systemCost || systemCost === 0) {
    let calculatedCost = 0;
    Object.values(boq).forEach(item => {
      calculatedCost += (item.cost || 0);
    });

    // If component cost is low (e.g. no costs assigned), use benchmark
    if (calculatedCost < 1000 && dcCapacityKwp > 0) {
      systemCost = dcCapacityKwp * 45000; // Fallback ₹45k/kWp
    } else {
      systemCost = calculatedCost;
    }
  }

  // Battery Backup Estimation (assuming 50% depth of discharge for lead-acid or 80% for Li-ion, using 80% generic)
  // Load is monthly. Avg hourly load = (TotalMonthlyLoad / 30 / 24) kW.
  // Backup Hours = (Battery kWh * 0.8) / Avg Load kW
  const avgLoadKw = totalMonthlyLoad > 0 ? (totalMonthlyLoad / 720) : 0;
  const batteryBackupHours = (avgLoadKw > 0 && batteryCapacityKwh > 0) ? (batteryCapacityKwh * 0.8) / avgLoadKw : 0;

  let bookValue = systemCost;

  // Get panel degradation specs (use first panel or average)
  const firstPanel = panels[0] || {};
  const panelSpecs = typeof firstPanel.specifications === 'string' ? JSON.parse(firstPanel.specifications) : (firstPanel.specifications || {});
  const degYear1 = (panelSpecs.degradation_year1 !== undefined ? panelSpecs.degradation_year1 : 2.0) / 100;
  const degAnnual = (panelSpecs.degradation_annual !== undefined ? panelSpecs.degradation_annual : 0.4) / 100;

  for (let y = 1; y <= 25; y++) {
    // Calculate degradation factor
    // ...
    let degradationFactor;
    if (y === 1) {
      degradationFactor = 1 - degYear1;
    } else {
      degradationFactor = 1 - degYear1 - ((y - 1) * degAnnual);
    }
    degradationFactor = Math.max(0, degradationFactor);

    const yearlyGen = totalAnnualGen * degradationFactor;

    // Scale savings by degradation factor (approximate)
    let yearlySavings = totalAnnualSavings * degradationFactor;
    let adBenefit = 0;

    // Accelerated depreciation benefit for commercial
    // User Requirement: 60% in first year, 40% in following years (WDV method)
    if (isCommercial) {
      const taxRate = 0.30; // Assuming 30% corporate tax bracket
      let depreciation = 0;

      if (y === 1) {
        depreciation = bookValue * 0.60;
      } else {
        depreciation = bookValue * 0.40;
      }

      bookValue -= depreciation;
      adBenefit = depreciation * taxRate;
      yearlySavings += adBenefit;
    }

    const prevCumulative = cumulativeSavings;
    cumulativeSavings += yearlySavings;

    // Determine ROI status & Payback
    let roiStatus = 'Recovering';
    if (!breakEvenYear && cumulativeSavings >= systemCost) {
      roiStatus = 'Break Even';
      breakEvenYear = y;

      // Calculate specific month
      const needed = systemCost - prevCumulative;
      const fraction = needed / yearlySavings;
      breakEvenMonth = Math.ceil(fraction * 12);
    } else if (breakEvenYear && y > breakEvenYear) {
      roiStatus = 'Profitable';
    }

    yearlyData.push({
      year: y,
      generation: yearlyGen,
      savings: yearlySavings, // Total savings (Energy + AD)
      energySavings: yearlySavings - adBenefit, // Pure energy savings
      adBenefit,
      cumulative: cumulativeSavings,
      roiStatus,
    });
  }

  // Determine verdict
  let verdict = 'Critical Issues';
  if (efficiencyScore > 80) {
    verdict = 'System Optimized';
  } else if (efficiencyScore > 50) {
    verdict = 'Needs Improvement';
  }

  return {
    valid: issueCount === 0,
    verdict,
    score: efficiencyScore,
    dcCapacity: dcCapacityKwp,
    acCapacity: acCapacityKw,
    batteryCapacity: batteryCapacityKwh,
    batteryBackupHours,
    annualGeneration: totalAnnualGen,
    systemCost,
    monthlyData,
    yearlyData,
    boq,
    shadowLoss: shadowLossPct,
    issues,
    validations,
    suggestions,
    breakEvenYear,
    breakEvenMonth,
    monthlyGenData,
    monthlyLossData,
    months,
  };
}

/**
 * Validate electrical connections and system design
 * @param {Array} objects
 * @param {Array} wires
 * @returns {Object} Validation results
 */
export function validateSystem(objects, wires) {
  const issues = [];
  const validations = [];

  // Build adjacency list from wires
  const adj = {};

  // 1. Add Explicit Wires
  wires.forEach(w => {
    const startObj = objects.find(o => o.id === w.from);
    const endObj = objects.find(o => o.id === w.to);

    // Skip if ACDB or LT/HT Panel is OFF
    if (startObj && (startObj.subtype === 'acdb' || startObj.subtype === 'lt_panel' || startObj.type === 'lt_panel' || startObj.type === 'ht_panel') && startObj.isOn === false) return;
    if (endObj && (endObj.subtype === 'acdb' || endObj.subtype === 'lt_panel' || endObj.type === 'lt_panel' || endObj.type === 'ht_panel') && endObj.isOn === false) return;

    if (!adj[w.from]) adj[w.from] = [];
    adj[w.from].push(w.to);
    if (!adj[w.to]) adj[w.to] = [];
    adj[w.to].push(w.from);
  });

  // 2. Add Implicit Wires (Touching Panels)
  const panelObjs = objects.filter(o => o.type === 'panel');
  for (let i = 0; i < panelObjs.length; i++) {
    for (let j = i + 1; j < panelObjs.length; j++) {
      const p1 = panelObjs[i];
      const p2 = panelObjs[j];
      const margin = 0.2; // Match powerFlow.js margin
      const intersect = !(p2.x > p1.x + p1.w + margin ||
        p2.x + p2.w + margin < p1.x ||
        p2.y > p1.y + p1.h + margin ||
        p2.y + p2.h + margin < p1.y);

      if (intersect) {
        if (!adj[p1.id]) adj[p1.id] = [];
        if (!adj[p2.id]) adj[p2.id] = [];
        adj[p1.id].push(p2.id);
        adj[p2.id].push(p1.id);
      }
    }
  }

  // Check 1: Panels connected to inverter
  const panels = objects.filter(o => o.type === 'panel');
  const inverters = objects.filter(o => o.type === 'inverter');

  let allPanelsConnected = true;
  if (panels.length > 0) {
    panels.forEach(panel => {
      const visited = new Set([panel.id]);
      const queue = [panel.id];
      let foundInverter = false;

      while (queue.length > 0 && !foundInverter) {
        const current = queue.shift();
        const obj = objects.find(o => o.id === current);

        if (obj && obj.type === 'inverter') {
          foundInverter = true;
          break;
        }

        if (adj[current]) {
          adj[current].forEach(neighbor => {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          });
        }
      }

      if (!foundInverter) {
        allPanelsConnected = false;
      }
    });

    if (!allPanelsConnected) {
      issues.push('ERROR: Some panels not connected to Inverter');
    } else {
      validations.push('✓ All panels connected to Inverter');
    }
  }

  // Check 2: Inverter connected to grid
  let invToGrid = true;
  if (inverters.length > 0) {
    inverters.forEach(inverter => {
      const visited = new Set([inverter.id]);
      const queue = [inverter.id];
      let foundGrid = false;

      while (queue.length > 0 && !foundGrid) {
        const current = queue.shift();
        const obj = objects.find(o => o.id === current);

        if (obj && (obj.type === 'grid' || obj.subtype?.includes('meter'))) {
          foundGrid = true;
          break;
        }

        if (adj[current]) {
          adj[current].forEach(neighbor => {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          });
        }
      }

      if (!foundGrid) {
        invToGrid = false;
      }
    });

    if (!invToGrid) {
      issues.push('ERROR: Inverter not connected to Meter/Grid');
    } else {
      validations.push('✓ Inverter connected to Grid');
    }
  }

  // Check 3: Load box connections
  const loadBoxes = objects.filter(o => o.type === 'load');
  if (loadBoxes.length > 0) {
    let allLoadsConnected = true;
    loadBoxes.forEach(load => {
      const visited = new Set([load.id]);
      const queue = [load.id];
      let foundSource = false;

      while (queue.length > 0 && !foundSource) {
        const current = queue.shift();
        const obj = objects.find(o => o.id === current);

        if (obj && (obj.type === 'grid' || obj.type === 'inverter')) {
          foundSource = true;
          break;
        }

        if (adj[current]) {
          adj[current].forEach(neighbor => {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          });
        }
      }

      if (!foundSource) {
        allLoadsConnected = false;
      }
    });

    if (!allLoadsConnected) {
      issues.push('WARNING: Some Load Boxes not connected to Power Source');
    }
  }

  // Check 4: Safety components
  const hasSafety = {
    earthing: objects.some(o => o.subtype === 'earth'),
    lightning: objects.some(o => o.subtype === 'la'),
  };

  if (!hasSafety.earthing) {
    issues.push('WARNING: No earthing pit present');
  } else {
    validations.push('✓ Earthing pit present');
  }

  if (!hasSafety.lightning) {
    issues.push('WARNING: No lightning arrestor present');
  } else {
    validations.push('✓ Lightning arrestor present');
  }

  // Check 5: Battery connections
  const batteries = objects.filter(o => o.type === 'battery');
  if (batteries.length > 0) {
    batteries.forEach(battery => {
      // Find connected inverter
      let connectedInverter = null;
      if (adj[battery.id]) {
        adj[battery.id].forEach(neighborId => {
          const neighbor = objects.find(o => o.id === neighborId);
          if (neighbor && neighbor.type === 'inverter') {
            connectedInverter = neighbor;
          }
        });
      }

      if (connectedInverter) {
        const invType = connectedInverter.specifications?.inverter_type || 'on_grid';
        if (invType !== 'hybrid') {
          issues.push(`ERROR: Battery connected to non-hybrid inverter (${connectedInverter.label || 'Inverter'}). Use a Hybrid Inverter.`);
        } else {
          validations.push('✓ Battery connected to Hybrid Inverter');
        }
      }
    });
  }

  // Advanced Power Flow & Safety Checks
  const powerFlowIssues = validatePowerFlow(objects, adj);
  issues.push(...powerFlowIssues);

  return { issues, validations };
}

/**
 * Advanced Power Flow Validation
 * Checks for voltage mismatches, overloading, and logic errors
 */
function validatePowerFlow(objects, adj) {
  const issues = [];

  // 1. Check Voltage Mismatches
  // Simple traversal: If two objects are connected, their voltage ratings should match (unless one is a transformer)
  objects.forEach(obj => {
    if (!adj[obj.id]) return;

    const objVoltage = getVoltageRating(obj);
    if (!objVoltage) return; // Skip if unknown

    adj[obj.id].forEach(neighborId => {
      const neighbor = objects.find(o => o.id === neighborId);
      if (!neighbor) return;

      // Transformers change voltage, so don't check equality across them directly here
      if (obj.type === 'transformer' || neighbor.type === 'transformer') return;

      const neighborVoltage = getVoltageRating(neighbor);
      if (neighborVoltage && Math.abs(objVoltage - neighborVoltage) > (objVoltage * 0.1)) {
        // Allow 10% tolerance
        issues.push(`CRITICAL: Voltage Mismatch between ${obj.label || obj.type} (${objVoltage}V) and ${neighbor.label || neighbor.type} (${neighborVoltage}V). This will cause failure.`);
      }
    });
  });

  // 2. Check Power Switching System (PSS) Logic
  const pssObjects = objects.filter(o => o.type === 'pss');
  pssObjects.forEach(pss => {
    // PSS should have at least 2 inputs (Grid, Battery/Gen) and 1 output (Load)
    const neighbors = adj[pss.id] || [];
    if (neighbors.length < 2) {
      issues.push(`WARNING: Power Switching System (${pss.label}) has insufficient connections. Needs Source and Load.`);
    }

    // Check availability of sources
    let hasGrid = false;
    let hasBattery = false;

    // BFS to find sources
    const visited = new Set([pss.id]);
    const queue = [pss.id];

    while (queue.length > 0) {
      const curr = queue.shift();
      const obj = objects.find(o => o.id === curr);

      if (obj.type === 'grid') {
        if (obj.isOn !== false) hasGrid = true; // Grid is available
      }
      if (obj.type === 'battery') hasBattery = true;

      if (adj[curr]) {
        adj[curr].forEach(n => {
          if (!visited.has(n)) {
            visited.add(n);
            queue.push(n);
          }
        });
      }
    }

    if (pss.specifications?.logic === 'manual_grid' && !hasGrid) {
      issues.push(`CRITICAL: PSS set to 'Manual (Grid Only)' but Grid is unavailable (Outage or Disconnected). System will fail.`);
    }

    if (!hasGrid && !hasBattery) {
      issues.push(`CRITICAL: No power source available for PSS. Grid is down and no Battery backup found.`);
    }
  });

  // 3. Transformer Back-feed Check (Simplified)
  // If a battery is connected to the secondary of a transformer without a PSS/Inverter isolation
  // This requires graph traversal to find path from Battery -> Transformer

  // 4. Validate Custom Logic (PLC)
  objects.forEach(obj => {
    if ((obj.type === 'vcb' || obj.type === 'acb') && obj.specifications?.custom_logic) {
      obj.specifications.custom_logic.forEach(rule => {
        // Check if rule triggers immediately based on static specs
        if (rule.param === 'Voltage') {
          const rating = obj.specifications.voltage_rating * 1000; // kV to V
          if (rule.op === '>' && rating > rule.val && rule.action === 'Trip') {
            issues.push(`WARNING: Logic Rule for ${obj.label || obj.type} (Voltage > ${rule.val}) will TRIP immediately because rated voltage is ${rating}V.`);
          }
          if (rule.op === '<' && rating < rule.val && rule.action === 'Trip') {
            issues.push(`WARNING: Logic Rule for ${obj.label || obj.type} (Voltage < ${rule.val}) will TRIP immediately because rated voltage is ${rating}V.`);
          }
        }
      });
    }
  });

  return issues;
}

function getVoltageRating(obj) {
  // Extract voltage from specifications or defaults
  if (obj.type === 'grid') return obj.specifications?.voltage || 11000; // 11kV or 33kV
  if (obj.type === 'transformer') return null; // Has primary/secondary
  if (obj.type === 'panel') return 40; // Approx Vmp
  if (obj.type === 'inverter') return obj.specifications?.output_voltage || 230;
  if (obj.type === 'battery') return 48; // Default 48V system
  if (obj.type === 'load') return 230;
  if (obj.type === 'vcb') return (obj.specifications?.voltage_rating || 11) * 1000;
  if (obj.type === 'acb') return (obj.specifications?.voltage_rating || 0.415) * 1000;
  if (obj.type === 'pss') return obj.specifications?.voltage_rating || 415;

  return null;
  return null;
}

/**
 * Validate a single connection between two objects
 * @param {Object} fromObj
 * @param {Object} toObj
 * @param {string} wireType 'dc', 'ac', 'earth'
 * @returns {Object|null} Error object { type: 'error'|'warning', message: string } or null if valid
 */
export function validateConnection(fromObj, toObj, wireType) {
  if (!fromObj || !toObj) return null;

  // 1. Check AC/DC Mismatch
  const dcTypes = ['panel', 'battery'];
  const acTypes = ['grid', 'load', 'acdb', 'lt_panel', 'ht_panel', 'vcb', 'acb', 'transformer', 'pss'];
  const hybridTypes = ['inverter']; // Inverters have both DC (input) and AC (output) sides

  // Determine if objects are strictly AC or DC
  const isFromDC = dcTypes.includes(fromObj.type);
  const isFromAC = acTypes.includes(fromObj.type);
  const isToDC = dcTypes.includes(toObj.type);
  const isToAC = acTypes.includes(toObj.type);

  // Wire type check
  if (wireType === 'dc') {
    if (isFromAC || isToAC) {
      return { type: 'error', message: 'Cannot use DC cable for AC components.' };
    }
  } else if (wireType === 'ac') {
    if (isFromDC || isToDC) {
      return { type: 'error', message: 'Cannot use AC cable for DC components.' };
    }
  }

  // 2. Check Voltage Compatibility
  const v1 = getVoltageRating(fromObj);
  const v2 = getVoltageRating(toObj);

  // Handle Transformer logic (Primary/Secondary)
  if (fromObj.type === 'transformer' || toObj.type === 'transformer') {
    // Transformer connection logic is complex (depends on which side is connected)
    // For now, we skip strict voltage check if one is a transformer, 
    // assuming the user connects to the correct winding.
    // Ideally, we'd check if v_other matches primary or secondary.
    const transformer = fromObj.type === 'transformer' ? fromObj : toObj;
    const other = fromObj.type === 'transformer' ? toObj : fromObj;
    const otherV = getVoltageRating(other);

    if (otherV) {
      const pV = transformer.specifications?.primary_voltage || 11000;
      const sV = transformer.specifications?.secondary_voltage || 415;

      // Check if other voltage matches either primary or secondary (with 10% tolerance)
      const matchesPrimary = Math.abs(otherV - pV) < pV * 0.1;
      const matchesSecondary = Math.abs(otherV - sV) < sV * 0.1;

      if (!matchesPrimary && !matchesSecondary) {
        return { type: 'warning', message: `Voltage Mismatch: ${other.label} (${otherV}V) does not match Transformer Primary (${pV}V) or Secondary (${sV}V).` };
      }
    }
  } else if (v1 && v2) {
    // Direct connection check
    if (Math.abs(v1 - v2) > v1 * 0.1) {
      return { type: 'error', message: `Voltage Mismatch: ${fromObj.label} (${v1}V) vs ${toObj.label} (${v2}V).` };
    }
  }

  // 3. Check Inverter Connection Logic
  if (fromObj.type === 'panel' && toObj.type === 'inverter') {
    // Panel to Inverter is valid (DC)
  } else if (fromObj.type === 'inverter' && toObj.type === 'panel') {
    // Inverter to Panel is valid (DC)
  } else if (fromObj.type === 'inverter' && toObj.type === 'grid') {
    // Inverter to Grid is valid (AC)
  }

  return null;
}

/**
 * Calculate yearly shadow loss using Monte Carlo sampling
 * @param {Array} objects
 * @param {number} lat
 * @param {number} lon
 * @returns {number} Shadow loss percentage (0-1)
 */
export function calculateYearlyShadowLoss(objects, lat, lon) {
  const panels = objects.filter(o => o.type === 'panel');
  if (panels.length === 0) return 0;

  let totalPanelArea = 0;
  let totalShadowArea = 0;

  // Sample shadow loss across 12 months
  for (let month = 0; month < 12; month++) {
    // Use the 15th of each month
    const date = new Date(new Date().getFullYear(), month, 15);

    // Sample at 9am, 12pm, 3pm
    const times = [9, 12, 15];
    let monthShadowRatio = 0;

    // Accumulate shadow area for this month
    let monthTotalShadow = 0;
    let monthSamples = 0;

    times.forEach(hour => {
      // Calculate UTC hour for the given solar hour at the location
      // Solar Time = UTC + (lon / 15)
      // UTC = Solar Time - (lon / 15)
      const utcHour = hour - (lon / 15);
      date.setUTCHours(Math.floor(utcHour), Math.floor((utcHour % 1) * 60), 0, 0);

      const sunPos = SunCalc.getPosition(date, lat, lon);

      // If sun is below horizon, ignore
      if (sunPos.altitude <= 0) return;

      const shadowLen = 1 / Math.tan(sunPos.altitude);
      // Cap shadow length to avoid extreme values
      const cappedLen = Math.min(shadowLen, 10);

      // Calculate shadow vector
      const dx = -Math.sin(sunPos.azimuth) * cappedLen;
      const dy = Math.cos(sunPos.azimuth) * cappedLen;

      panels.forEach(panel => {
        // Monte Carlo sampling: random points on panel
        const samples = 5;
        let shadedPoints = 0;

        for (let i = 0; i < samples; i++) {
          const px = panel.x + Math.random() * panel.w;
          const py = panel.y + Math.random() * panel.h;

          // Check if in shadow from any object
          let inShadow = false;
          for (const obj of objects) {
            if (obj.id === panel.id) continue;
            if ((obj.h_z || 0) <= (panel.h_z || 0)) continue; // Only higher objects cast shadow

            const dh = (obj.h_z || 0) - (panel.h_z || 0);
            const shadowDx = dx * dh;
            const shadowDy = dy * dh;

            const sx = obj.x + shadowDx;
            const sy = obj.y + shadowDy;

            if (px >= sx && px <= sx + obj.w && py >= sy && py <= sy + obj.h) {
              inShadow = true;
              break;
            }
          }

          if (inShadow) shadedPoints++;
        }

        monthTotalShadow += (shadedPoints / samples) * (panel.w * panel.h);
      });
      monthSamples++;
    });

    if (monthSamples > 0) {
      totalShadowArea += monthTotalShadow / monthSamples;
    }

    panels.forEach(panel => {
      totalPanelArea += panel.w * panel.h;
    });
  }

  // Average over 12 months (totalPanelArea was added 12 times)
  return totalPanelArea > 0 ? totalShadowArea / totalPanelArea : 0;
}

/**
 * Calculate ROI metrics
 * @param {Object} simulationResult
 * @returns {Object} ROI metrics
 */
export function calculateROIMetrics(simulationResult) {
  const { yearlyData, systemCost } = simulationResult;

  const breakEven = yearlyData.find(d => d.roiStatus === 'Break Even');
  const totalSavings = yearlyData[yearlyData.length - 1]?.cumulative || 0;
  const roi = systemCost > 0 ? ((totalSavings - systemCost) / systemCost) * 100 : 0;

  return {
    breakEvenYear: breakEven?.year || null,
    totalSavings25Year: totalSavings,
    roi25Year: roi,
    paybackPeriod: yearlyData.find(d => d.cumulative >= systemCost)?.year || null,
  };
}

/**
 * Format currency with INR symbol
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Format energy with appropriate unit
 * @param {number} kwh
 * @returns {string}
 */
export function formatEnergy(kwh) {
  if (kwh >= 1000) {
    return `${(kwh / 1000).toFixed(1)} MWh`;
  }
  return `${Math.round(kwh)} kWh`;
}
