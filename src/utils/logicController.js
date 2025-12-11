import { calculateFlows } from './powerFlow';

/**
 * Live Logic Controller (PLC)
 * Evaluates rules in real-time and updates component states.
 */
export async function runLiveLogic(store) {
    // Simulate processing delay (Plant Controller "thinking" time)
    await new Promise(resolve => setTimeout(resolve, 500));

    const objects = store.objects;
    const updateObject = store.updateObject;
    const sunTime = store.sunTime; // 0-24 hour format
    let stateChanged = false;

    // Calculate flows to detect trips (using current state)
    const flows = calculateFlows(objects, store.wires);

    objects.forEach(obj => {
        // 0. Auto-Trip/Reset Logic (VCB/ACB/Panels)
        if (['vcb', 'acb', 'ht_panel', 'lt_panel', 'acdb'].includes(obj.type)) {
            const flowData = flows.get(obj.id);
            if (flowData) {
                // Auto-Trip: If connected to outage grid, turn OFF
                if (flowData.isTripped && obj.isOn !== false) {
                    updateObject(obj.id, { isOn: false });
                    stateChanged = true;
                }
                // Auto-Reset: If NOT tripped (grid healthy) and is connected to Healthy Grid, turn ON
                else if (!flowData.isTripped && obj.isOn === false && flowData.canReset) {
                    updateObject(obj.id, { isOn: true });
                    stateChanged = true;
                }
            }
        }

        if (obj.type === 'master_plc' && obj.specifications?.custom_logic) {
            obj.specifications.custom_logic.forEach(rule => {

                // 1. Interlock Logic
                if (rule.type === 'Interlock' && rule.targetId && rule.sourceId) {
                    const source = objects.find(o => o.id === rule.sourceId);
                    const target = objects.find(o => o.id === rule.targetId);

                    if (source && target) {
                        const sourceIsOn = source.isOn !== false; // Default is ON
                        const conditionMet = (rule.val === 'ON' && sourceIsOn) || (rule.val === 'OFF' && !sourceIsOn);

                        if (conditionMet) {
                            if (rule.action === 'Trip' && target.isOn !== false) {
                                updateObject(target.id, { isOn: false });
                                stateChanged = true;
                            } else if (rule.action === 'Close' && target.isOn === false) {
                                updateObject(target.id, { isOn: true });
                                stateChanged = true;
                            }
                        }
                    }
                }

                // 2. Time Logic (based on Sun Position Slider)
                if (rule.type === 'Time' && rule.targetId) {
                    const target = objects.find(o => o.id === rule.targetId);
                    if (target) {
                        const start = rule.val;
                        const end = rule.val2;

                        let inRange = false;
                        if (start < end) {
                            inRange = sunTime >= start && sunTime < end;
                        } else {
                            // Crosses midnight (e.g. 18 to 6)
                            inRange = sunTime >= start || sunTime < end;
                        }

                        if (inRange) {
                            if (rule.action === 'Trip' && target.isOn !== false) {
                                updateObject(target.id, { isOn: false });
                                stateChanged = true;
                            } else if (rule.action === 'Close' && target.isOn === false) {
                                updateObject(target.id, { isOn: true });
                                stateChanged = true;
                            }
                        }
                    }
                }

            });
        }
    });

    return stateChanged;
}
