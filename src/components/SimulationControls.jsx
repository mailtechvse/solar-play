import React, { useEffect } from "react";
import { useSolarStore } from "../stores/solarStore";
import { calculateFlows } from "../utils/powerFlow";
import { runLiveLogic } from "../utils/logicController";

export default function SimulationControls() {
    const sunTime = useSolarStore((state) => state.sunTime);
    const setSunTime = useSolarStore((state) => state.setSunTime);
    const orientation = useSolarStore((state) => state.orientation);
    const setOrientation = useSolarStore((state) => state.setOrientation);
    const setMapSetupOpen = useSolarStore((state) => state.setMapSetupOpen);
    const mapSettings = useSolarStore((state) => state.mapSettings);

    const isAnimating = useSolarStore((state) => state.isAnimating);
    const setIsAnimating = useSolarStore((state) => state.setIsAnimating);
    const animationSpeed = useSolarStore((state) => state.animationSpeed);
    const setAnimationSpeed = useSolarStore((state) => state.setAnimationSpeed);
    const showSun = useSolarStore((state) => state.showSun);
    const setShowSun = useSolarStore((state) => state.setShowSun);

    const formatTime = (decimalTime) => {
        const hours = Math.floor(decimalTime);
        const minutes = Math.floor((decimalTime - hours) * 60);
        const ampm = hours >= 12 ? "PM" : "AM";
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
    };

    const [showSummary, setShowSummary] = React.useState(false);
    const [sessionStats, setSessionStats] = React.useState({
        gen: 0, load: 0, import: 0, export: 0, duration: 0,
        selfConsumed: 0, peakLoad: 0, peakGen: 0, co2Saved: 0
    });
    const statsRef = React.useRef({
        gen: 0, load: 0, import: 0, export: 0, duration: 0,
        selfConsumed: 0, peakLoad: 0, peakGen: 0
    });

    // Battery State & Logging
    const batteryStateRef = React.useRef(new Map()); // id -> { energy: kWh, soc: % }
    const simulationLogRef = React.useRef([]); // Array of hourly logs
    const lastLogHourRef = React.useRef(-1);

    const [simulationLog, setSimulationLog] = React.useState([]);

    const handleStop = () => {
        setIsAnimating(false);
        // Calculate derived stats
        const stats = { ...statsRef.current };
        stats.co2Saved = stats.gen * 0.7; // Approx 0.7 kg CO2 per kWh
        setSessionStats(stats);
        setSimulationLog([...simulationLogRef.current]); // Save log to state
        setShowSummary(true);
    };

    const handlePlay = () => {
        if (!isAnimating) {
            // If starting fresh (duration 0), reset stats
            if (statsRef.current.duration === 0) {
                statsRef.current = {
                    gen: 0, load: 0, import: 0, export: 0, duration: 0,
                    selfConsumed: 0, peakLoad: 0, peakGen: 0
                };
                simulationLogRef.current = [];
                lastLogHourRef.current = -1;
                batteryStateRef.current = new Map();
            }
            setIsAnimating(true);
            setShowSummary(false);
        } else {
            setIsAnimating(false);
        }
    };

    useEffect(() => {
        let isRunning = isAnimating;
        let timeoutId;

        const loop = async () => {
            if (!isRunning) return;

            const state = useSolarStore.getState();
            if (state.isLogicProcessing) return;

            // 1. Advance Time (Fixed 1 Hour Step)
            // Ensure we land on exact integer hours to avoid drift or double-stepping issues
            let nextTime = Math.floor(state.sunTime) + 1;

            if (nextTime >= 24) {
                nextTime = 0;
                statsRef.current.duration = 0;
            }

            state.setSunTime(nextTime);

            // 2. Run Physics (Power Flow, Battery, Stats)
            const hour = Math.floor(nextTime);

            // Calculate Generation
            let totalGenKw = 0;
            const generationMap = new Map();

            state.objects.filter(o => o.type === 'panel').forEach(p => {
                let gen = 0;
                if (hour > 6 && hour < 18) {
                    const peak = (p.watts || 550) / 1000; // kW
                    const factor = Math.sin(((hour - 6) / 12) * Math.PI);
                    gen = peak * factor * 0.85;
                }
                totalGenKw += gen;
                generationMap.set(p.id, gen);
            });

            // Initialize Battery State
            state.objects.filter(o => o.type === 'battery' || o.type === 'bess').forEach(bat => {
                if (!batteryStateRef.current.has(bat.id)) {
                    const cap = bat.capKwh || (bat.specifications?.battery_capacity || 5);
                    const initialSoc = bat.specifications?.initial_soc !== undefined ? bat.specifications.initial_soc : 20;
                    batteryStateRef.current.set(bat.id, { energy: cap * (initialSoc / 100), soc: initialSoc, cap: cap });
                }
            });

            // Calculate Battery Limits
            const batteryLimits = new Map();
            const dt = 1.0;

            state.objects.filter(o => o.type === 'battery' || o.type === 'bess').forEach(bat => {
                const bState = batteryStateRef.current.get(bat.id);
                const dod = bat.specifications?.dod || 80;
                const minSoc = 100 - dod;
                const maxDischargeRate = bat.specifications?.max_discharge_kw || (bState.cap * 0.5);
                const maxChargeRate = bat.specifications?.max_charge_kw || (bState.cap * 0.5);

                const energyAboveMin = Math.max(0, bState.energy - (bState.cap * minSoc / 100));
                let dischargeLimit = maxDischargeRate;
                if (energyAboveMin < (maxDischargeRate * dt)) {
                    dischargeLimit = energyAboveMin / dt;
                }

                const energySpace = bState.cap - bState.energy;
                let chargeLimit = maxChargeRate;
                if (energySpace < (maxChargeRate * dt)) {
                    chargeLimit = energySpace / dt;
                }

                batteryLimits.set(bat.id, { maxDischarge: dischargeLimit, maxCharge: chargeLimit });
            });

            // Get Priority
            const masterPlc = state.objects.find(o => o.type === 'master_plc');
            const priority = masterPlc?.specifications?.source_priority || ['Solar', 'Battery', 'Grid'];

            // Apply Grid Outage Logic
            let workingObjects = state.objects.map(obj => {
                if (obj.type === 'grid') {
                    let isOutage = false;
                    const type = obj.specifications?.outage_type || 'None';

                    if (type === 'Scheduled') {
                        const start = obj.specifications?.outage_start || 16;
                        const end = obj.specifications?.outage_end || 18;
                        if (start < end) {
                            if (hour >= start && hour < end) isOutage = true;
                        } else {
                            if (hour >= start || hour < end) isOutage = true;
                        }
                    } else if (type === 'Random') {
                        const duration = obj.specifications?.outage_duration || 5;
                        const seed = Math.floor(hour) * 17;
                        if ((seed % 24) < duration) isOutage = true;
                    }
                    return { ...obj, isOutage };
                }
                return obj;
            });

            // Sync Outage State
            workingObjects.forEach(wObj => {
                if (wObj.type === 'grid') {
                    const original = state.objects.find(o => o.id === wObj.id);
                    if (original && original.isOutage !== wObj.isOutage) {
                        state.updateObject(wObj.id, { isOutage: wObj.isOutage });
                    }
                }
            });

            // Calculate Flows
            const flows = calculateFlows(workingObjects, state.wires, generationMap, batteryLimits, priority);

            // Accumulate Stats & Update Battery
            statsRef.current.duration += dt;
            statsRef.current.gen += totalGenKw * dt;
            if (totalGenKw > statsRef.current.peakGen) statsRef.current.peakGen = totalGenKw;

            let currentStepImport = 0;
            let currentStepExport = 0;
            let currentStepLoad = 0;
            let currentStepBatteryFlow = 0;

            // Update Battery State
            state.objects.filter(o => o.type === 'battery' || o.type === 'bess').forEach(bat => {
                const flow = flows.get(bat.id);
                if (flow && flow.batteryFlow !== 0) {
                    const bState = batteryStateRef.current.get(bat.id);
                    // flow.batteryFlow is kW (+Discharge, -Charge)
                    const energyChange = flow.batteryFlow * dt; // kWh
                    let newEnergy = bState.energy - energyChange;
                    // Clamp
                    newEnergy = Math.max(0, Math.min(bState.cap, newEnergy));
                    const newSoc = (newEnergy / bState.cap) * 100;

                    batteryStateRef.current.set(bat.id, { ...bState, energy: newEnergy, soc: newSoc });

                    // Update Object for UI (SoC display)
                    const currentSoc = bat.soc || 0;
                    if (Math.abs(currentSoc - newSoc) > 0.1) {
                        state.updateObject(bat.id, { soc: newSoc });
                    }

                    currentStepBatteryFlow += flow.batteryFlow;
                }
            });

            // Update Meters & Stats & VCB Status
            state.objects.forEach(obj => {
                const flowData = flows.get(obj.id);
                if (!flowData) return;

                // Sync Energized State
                const isEnergized = flowData.isEnergized;
                if (obj.isEnergized !== isEnergized) {
                    state.updateObject(obj.id, { isEnergized });
                }

                if (obj.type === 'net_meter' || obj.type === 'gross_meter') {
                    if (!flowData.isEnergized) return;

                    const currentReading = obj.reading || 0;
                    const power = Math.abs(flowData.netPower || 0);
                    const energy = power * dt;

                    state.updateObject(obj.id, { reading: currentReading + energy });

                    if (obj.type === 'net_meter') {
                        if (flowData.netPower > 0) currentStepImport += power; // Consuming from grid
                        else currentStepExport += power; // Exporting to grid
                    } else {
                        currentStepLoad += power; // Gross meter usually measures load or gen
                    }
                }
            });

            statsRef.current.import += currentStepImport * dt;
            statsRef.current.export += currentStepExport * dt;
            statsRef.current.load += currentStepLoad * dt;

            setSessionStats({ ...statsRef.current });

            // Log Data
            if (hour !== lastLogHourRef.current) {
                const isOutage = workingObjects.some(o => o.type === 'grid' && o.isOutage);
                simulationLogRef.current.push({
                    hour: formatTime(hour),
                    gridStatus: isOutage ? 'OUTAGE' : 'ON',
                    gen: totalGenKw,
                    load: currentStepLoad,
                    batFlow: currentStepBatteryFlow,
                    netGrid: currentStepImport - currentStepExport,
                    batEnergy: 0,
                    batCap: 0,
                    batSoc: 0
                });
                lastLogHourRef.current = hour;
            }

            // 3. Run Logic Controller (Async, simulates delay)
            state.setIsLogicProcessing(true);
            try {
                await runLiveLogic(state);
            } catch (e) {
                console.error("Logic Error:", e);
            } finally {
                state.setIsLogicProcessing(false);
            }

            // 4. Wait for Speed Delay
            const delay = 2000 / (state.animationSpeed || 1);

            if (isRunning) {
                timeoutId = setTimeout(loop, delay);
            }
        };

        if (isAnimating) {
            loop();
        }

        return () => {
            isRunning = false;
            clearTimeout(timeoutId);
        };
    }, [isAnimating]);

    return (

        <>
            <div className="absolute bottom-4 left-4 bg-slate-900/90 p-4 rounded-lg border border-slate-700 text-white w-80 shadow-xl backdrop-blur-sm z-50">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Simulation
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={handlePlay}
                            className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-700 transition-colors ${isAnimating ? 'text-yellow-400' : 'text-green-400'}`}
                            title={isAnimating ? "Pause" : "Play"}
                        >
                            <i className={`fas fa-${isAnimating ? 'pause' : 'play'}`}></i>
                        </button>
                        <button
                            onClick={handleStop}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-700 text-red-400 transition-colors"
                            title="Stop & Report"
                        >
                            <i className="fas fa-stop"></i>
                        </button>
                        <button
                            onClick={() => {
                                const state = useSolarStore.getState();
                                state.setSunTime(0);
                                statsRef.current = { gen: 0, load: 0, import: 0, export: 0, duration: 0, selfConsumed: 0, peakLoad: 0, peakGen: 0, currentGen: 0, currentLoad: 0 };
                                setSessionStats(statsRef.current);
                                simulationLogRef.current = [];
                                lastLogHourRef.current = -1;
                                batteryStateRef.current = new Map();
                                setIsAnimating(false);
                                setShowSummary(false);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-700 text-slate-400 transition-colors"
                            title="Reset"
                        >
                            <i className="fas fa-undo"></i>
                        </button>
                    </div>
                </div >

                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Time</span>
                            <span>{formatTime(sunTime)}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="24"
                            step="0.1"
                            value={sunTime}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                useSolarStore.getState().setSunTime(val);
                            }}
                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                            <span>Sunrise</span>
                            <span>Noon</span>
                            <span>Sunset</span>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Orientation (Azimuth)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min="0"
                                max="360"
                                step="1"
                                value={orientation}
                                onChange={(e) => useSolarStore.getState().setOrientation(parseFloat(e.target.value))}
                                className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                            <input
                                type="number"
                                min="0"
                                max="360"
                                value={orientation}
                                onChange={(e) => useSolarStore.getState().setOrientation(parseFloat(e.target.value))}
                                className="w-12 bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-xs text-right text-white"
                            />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                            <span>N (0°)</span>
                            <span>S (180°)</span>
                            <span>N (360°)</span>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Speed</span>
                            <span>{animationSpeed}x</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="100"
                            value={animationSpeed}
                            onChange={(e) => useSolarStore.getState().setAnimationSpeed(parseInt(e.target.value))}
                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-800 p-2 rounded border border-slate-700">
                        <div className="text-slate-400">Generation</div>
                        <div className="text-green-400 font-mono text-sm">{sessionStats.gen.toFixed(1)} kWh</div>
                        <div className="text-green-600 font-mono text-[10px] mt-1">
                            {sessionStats.currentGen ? sessionStats.currentGen.toFixed(1) : '0.0'} kW
                        </div>
                    </div>
                    <div className="bg-slate-800 p-2 rounded border border-slate-700">
                        <div className="text-slate-400">Load</div>
                        <div className="text-orange-400 font-mono text-sm">{sessionStats.load.toFixed(1)} kWh</div>
                        <div className="text-orange-600 font-mono text-[10px] mt-1">
                            {sessionStats.currentLoad ? sessionStats.currentLoad.toFixed(1) : '0.0'} kW
                        </div>
                    </div>
                </div>

                {/* Map Overlay Button */}
                <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Map Overlay</span>
                        <button
                            onClick={() => setMapSetupOpen(true)}
                            className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition flex items-center gap-1"
                        >
                            <i className="fas fa-map"></i>
                            {mapSettings.mapOverlayActive ? "Configure" : "Setup"}
                        </button>
                    </div>

                    {/* Auto-Save Indicator */}
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            <i className="fas fa-save"></i> Auto-save ON
                        </span>
                        <span className="text-[10px] text-gray-600">
                            Local Storage
                        </span>
                    </div>
                </div>
            </div >

            {/* Full Page Report Modal */}
            {
                showSummary && (
                    <div className="fixed inset-0 bg-slate-900/95 z-[100] flex flex-col p-8 overflow-hidden animate-in fade-in duration-200">
                        <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
                            <div>
                                <h2 className="text-3xl font-bold text-white mb-2">Simulation Report</h2>
                                <p className="text-slate-400">Detailed analysis of system performance</p>
                            </div>
                            <button
                                onClick={() => setShowSummary(false)}
                                className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                                <i className="fas fa-times"></i> Close Report
                            </button>
                        </div>

                        <div className="grid grid-cols-4 gap-6 mb-8">
                            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                                <div className="text-slate-400 mb-1">Self Consumption</div>
                                <div className="text-3xl font-bold text-green-400">
                                    {sessionStats.gen > 0 ? ((sessionStats.selfConsumed / sessionStats.gen) * 100).toFixed(1) : 0}%
                                </div>
                                <div className="text-xs text-slate-500 mt-2">
                                    {sessionStats.selfConsumed.toFixed(1)} kWh used directly
                                </div>
                            </div>
                            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                                <div className="text-slate-400 mb-1">Self Sufficiency</div>
                                <div className="text-3xl font-bold text-blue-400">
                                    {sessionStats.load > 0 ? ((sessionStats.selfConsumed / sessionStats.load) * 100).toFixed(1) : 0}%
                                </div>
                                <div className="text-xs text-slate-500 mt-2">
                                    of total load met by solar/battery
                                </div>
                            </div>
                            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                                <div className="text-slate-400 mb-1">Grid Interaction</div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <div className="text-xl font-bold text-red-400">↓ {sessionStats.import.toFixed(1)}</div>
                                        <div className="text-xs text-slate-500">Import (kWh)</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-bold text-green-400">↑ {sessionStats.export.toFixed(1)}</div>
                                        <div className="text-xs text-slate-500">Export (kWh)</div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                                <div className="text-slate-400 mb-1">Environmental</div>
                                <div className="text-3xl font-bold text-emerald-400">
                                    {sessionStats.co2Saved.toFixed(1)} <span className="text-lg font-normal text-slate-400">kg</span>
                                </div>
                                <div className="text-xs text-slate-500 mt-2">CO₂ Emissions Avoided</div>
                            </div>
                        </div>

                        <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                                <h3 className="font-bold text-white">Hourly Analysis</h3>
                            </div>
                            <div className="overflow-auto flex-1">
                                <table className="w-full text-left text-sm text-slate-300">
                                    <thead className="bg-slate-900/50 text-slate-400 sticky top-0">
                                        <tr>
                                            <th className="p-4 font-medium">Hour</th>
                                            <th className="p-4 font-medium">Grid Status</th>
                                            <th className="p-4 font-medium text-right">Load (kW)</th>
                                            <th className="p-4 font-medium text-right">Solar Gen (kW)</th>
                                            <th className="p-4 font-medium text-right">Net Grid (kW)</th>
                                            <th className="p-4 font-medium text-right">Battery Flow</th>
                                            <th className="p-4 font-medium text-right">Battery SOC</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {simulationLog.map((log, i) => (
                                            <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                                                <td className="p-4 font-mono">{log.hour}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${log.gridStatus === 'OUTAGE' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                                                        }`}>
                                                        {log.gridStatus}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right font-mono">{log.load.toFixed(1)}</td>
                                                <td className="p-4 text-right font-mono text-yellow-400">{log.gen.toFixed(1)}</td>
                                                <td className="p-4 text-right font-mono">
                                                    <span className={log.netGrid > 0 ? 'text-red-400' : log.netGrid < 0 ? 'text-green-400' : 'text-slate-400'}>
                                                        {Math.abs(log.netGrid).toFixed(1)} {log.netGrid > 0 ? '(Imp)' : log.netGrid < 0 ? '(Exp)' : ''}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right font-mono">
                                                    <span className={log.batFlow > 0 ? 'text-orange-400' : log.batFlow < 0 ? 'text-blue-400' : 'text-slate-400'}>
                                                        {Math.abs(log.batFlow).toFixed(1)} {log.batFlow > 0 ? '(Dis)' : log.batFlow < 0 ? '(Chg)' : ''}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right font-mono">
                                                    {log.batEnergy.toFixed(1)} / {log.batCap.toFixed(1)} kWh
                                                    <span className={`ml-2 ${log.batSoc < 20 ? 'text-red-400' : 'text-green-400'}`}>
                                                        ({log.batSoc.toFixed(1)}%)
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {simulationLog.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-slate-500">
                                                    No data available. Run the simulation to generate a report.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
}
