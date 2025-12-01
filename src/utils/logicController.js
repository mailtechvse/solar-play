
/**
 * Live Logic Controller (PLC)
 * Evaluates rules in real-time and updates component states.
 */
export function runLiveLogic(store) {
    const objects = store.objects;
    const updateObject = store.updateObject;
    const sunTime = store.sunTime; // 0-24 hour format
    let stateChanged = false;
    let toastMessage = null;

    objects.forEach(obj => {
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
                                toastMessage = { type: 'warning', message: `Interlock: ${target.label || 'Breaker'} TRIPPED because ${source.label || 'Source'} is ${rule.val}` };
                            } else if (rule.action === 'Close' && target.isOn === false) {
                                updateObject(target.id, { isOn: true });
                                stateChanged = true;
                                toastMessage = { type: 'info', message: `Interlock: ${target.label || 'Breaker'} CLOSED because ${source.label || 'Source'} is ${rule.val}` };
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
                                toastMessage = { type: 'warning', message: `Time Rule: ${target.label || 'Breaker'} TRIPPED (Time: ${Math.floor(sunTime)}:00)` };
                            } else if (rule.action === 'Close' && target.isOn === false) {
                                updateObject(target.id, { isOn: true });
                                stateChanged = true;
                                toastMessage = { type: 'info', message: `Time Rule: ${target.label || 'Breaker'} CLOSED (Time: ${Math.floor(sunTime)}:00)` };
                            }
                        }
                    }
                }

            });
        }
    });

    if (toastMessage && store.showToast) {
        store.showToast(toastMessage.message, toastMessage.type);
    }

    return stateChanged;
}
