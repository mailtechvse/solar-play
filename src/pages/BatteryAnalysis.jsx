import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sun, Home, Battery, Zap, Settings, Play, Pause, Table, AlertTriangle, Clock, TrendingUp, DollarSign, Fuel, Sparkles, X, Loader } from 'lucide-react';
import { useSolarStore } from '../stores/solarStore';
import { operationsService, supabase } from '../lib/supabase';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const Card = ({ children, className = "" }) => (
    <div className={`bg-white rounded-xl shadow-lg p-6 border border-slate-200 ${className}`}>
        {children}
    </div>
);

// Standard normalized profile for Solar only (Load is dynamic)
const DEFAULT_SOLAR_PROFILE = [
    0, 0, 0, 0, 0, 0.05, 0.2, 0.4, 0.6, 0.8, 0.95, 1.0,
    1.0, 0.95, 0.8, 0.6, 0.3, 0.1, 0.05, 0, 0, 0, 0, 0
];

// Helper to determine if an hour falls within a start/duration window
const isHourInWindow = (hour, start, duration) => {
    if (duration === 0) return false;
    const end = (start + duration) % 24;
    if (start < end) {
        return hour >= start && hour < end;
    } else {
        // Wrap range (e.g. 22 to 02)
        return hour >= start || hour < end;
    }
};

// Flow Line Component (Reused for visualization)
const FlowLine = ({ active, speed = 1, color = "bg-slate-300", direction = "right", vertical = false, label = null }) => {
    if (!active) return <div className={`absolute ${vertical ? 'w-1 h-full left-1/2 -translate-x-1/2' : 'h-1 w-full top-1/2 -translate-y-1/2'} bg-slate-100 rounded-full`} />;

    return (
        <>
            <div className={`absolute inset-0 ${color} opacity-30`} />
            <div className={`absolute inset-0 flex ${vertical ? 'flex-col items-center' : 'flex-row items-center'} justify-around overflow-hidden`}>
                {[...Array(5)].map((_, i) => (
                    <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${color} shadow-[0_0_8px_currentColor]`}
                        style={{
                            animation: `flow-${vertical ? (direction === 'up' ? 'up' : 'down') : (direction === 'left' ? 'left' : 'right')} ${2 / speed}s linear infinite`,
                            animationDelay: `${i * 0.4}s`
                        }}
                    />
                ))}
            </div>
            {label && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/90 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm whitespace-nowrap z-10 border border-slate-100 text-slate-700">
                    {label} kW
                </div>
            )}
            <style>
                {`
          @keyframes flow-right { from { transform: translateX(-100%); } to { transform: translateX(400%); } }
          @keyframes flow-left { from { transform: translateX(400%); } to { transform: translateX(-100%); } }
          @keyframes flow-down { from { transform: translateY(-100%); } to { transform: translateY(400%); } }
          @keyframes flow-up { from { transform: translateY(400%); } to { transform: translateY(-100%); } }
        `}
            </style>
        </>
    );
};

export default function AcCoupledSimulation24H() {
    const activeCustomer = useSolarStore(state => state.activeCustomer);
    const showToast = useSolarStore(state => state.showToast);

    // --- STATES ---
    const [scenarios, setScenarios] = useState([]);
    const [activeScenarioId, setActiveScenarioId] = useState(null);
    const [isSimPlaying, setIsSimPlaying] = useState(false);
    const [simulationData, setSimulationData] = useState([]);
    const [selectedHour, setSelectedHour] = useState(12);
    const [isSaving, setIsSaving] = useState(false);
    const [outageHours, setOutageHours] = useState(new Set());
    const [idleHours, setIdleHours] = useState(new Set());
    const isFirstRender = useRef(true);

    const [config, setConfig] = useState({
        solarPeakKw: 10,
        batteryCapacityKwh: 20,
        pcsMaxPowerKw: 5,
        initialSoc: 50,
        gridChargeThresholdSoc: 20, // Grid charge when below this

        // Load Profile
        baseLoadKw: 2.0,
        peakLoadKw: 6.0,
        peakStartHour: 17,
        peakDuration: 5,

        // Grid Export Priority
        exportStartHour: 10, // 10 AM
        exportDuration: 4,   // 4 Hours
        exportMinSoc: 90,    // Only export if battery is above this during priority time

        // Factory Operating Hours
        factoryStartHour: 9,
        factoryDuration: 8,
        offHoursLoadKw: 0.5,
        enableOffHoursExport: true,

        // Financials (INR)
        gridImportPrice: 8.0, // ₹/kWh
        gridExportPrice: 3.5, // ₹/kWh
        dieselPrice: 28.0,    // ₹/kWh (Effective cost of generation)

        // System Constraints
        allowGrid: true,
        allowDg: true
    });

    // Load Config and Scenarios from Customer
    useEffect(() => {
        const loadInitialData = async () => {
            if (!activeCustomer) return;

            // 1. Load default config from customer object
            if (activeCustomer.battery_config && Object.keys(activeCustomer.battery_config).length > 0) {
                const loadedConfig = { ...config, ...activeCustomer.battery_config };
                delete loadedConfig.outageHours;
                delete loadedConfig.idleHours;
                setConfig(loadedConfig);

                if (activeCustomer.battery_config.outageHours) {
                    setOutageHours(new Set(activeCustomer.battery_config.outageHours));
                }
                if (activeCustomer.battery_config.idleHours) {
                    setIdleHours(new Set(activeCustomer.battery_config.idleHours));
                }
            }

            // 2. Load scenarios from database
            try {
                const { data, error } = await supabase
                    .from('battery_scenarios')
                    .select('*')
                    .eq('customer_id', activeCustomer.id)
                    .order('created_at', { ascending: false });

                if (!error) setScenarios(data || []);
            } catch (err) {
                console.error("Failed to load scenarios", err);
            }
        };

        loadInitialData();
    }, [activeCustomer]);

    // Save Active State (Auto-save)
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (!activeCustomer) return;

        const timeoutId = setTimeout(async () => {
            const savePayload = {
                ...config,
                outageHours: Array.from(outageHours),
                idleHours: Array.from(idleHours)
            };

            try {
                if (activeScenarioId) {
                    // Update specific scenario
                    await supabase
                        .from('battery_scenarios')
                        .update({ config: savePayload })
                        .eq('id', activeScenarioId);
                } else {
                    // Update main customer default config
                    await operationsService.updateCustomer(activeCustomer.id, {
                        battery_config: savePayload
                    });
                }
            } catch (e) {
                console.error("Auto-save failed", e);
            }
        }, 3000);

        return () => clearTimeout(timeoutId);
    }, [config, outageHours, idleHours, activeCustomer, activeScenarioId]);

    const saveAsNewScenario = async () => {
        if (!activeCustomer) return;
        const name = prompt("Enter scenario name:", `Scenario ${scenarios.length + 1}`);
        if (!name) return;

        setIsSaving(true);
        try {
            const savePayload = {
                ...config,
                outageHours: Array.from(outageHours),
                idleHours: Array.from(idleHours)
            };

            const { data, error } = await supabase
                .from('battery_scenarios')
                .insert([{
                    customer_id: activeCustomer.id,
                    name,
                    config: savePayload,
                    created_by: (await supabase.auth.getUser()).data.user?.id
                }])
                .select()
                .single();

            if (error) throw error;
            setScenarios([data, ...scenarios]);
            setActiveScenarioId(data.id);
            showToast("Scenario saved successfully", "success");
        } catch (err) {
            console.error("Save scenario failed", err);
            showToast("Failed to save scenario", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const loadScenario = (id) => {
        if (id === 'default') {
            setActiveScenarioId(null);
            // Re-trigger the customer config load would be best, but we can also just keep current state as it will auto-save to default
            return;
        }
        const scenario = scenarios.find(s => s.id === id);
        if (scenario) {
            const sConfig = scenario.config;
            const newConfig = { ...sConfig };
            delete newConfig.outageHours;
            delete newConfig.idleHours;

            setConfig(prev => ({ ...prev, ...newConfig }));
            if (sConfig.outageHours) setOutageHours(new Set(sConfig.outageHours));
            if (sConfig.idleHours) setIdleHours(new Set(sConfig.idleHours));
            setActiveScenarioId(id);
            showToast(`Loaded scenario: ${scenario.name}`, "success");
        }
    };

    const deleteScenario = async (id, e) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this scenario?")) return;

        try {
            const { error } = await supabase.from('battery_scenarios').delete().eq('id', id);
            if (error) throw error;
            setScenarios(scenarios.filter(s => s.id !== id));
            if (activeScenarioId === id) setActiveScenarioId(null);
            showToast("Scenario deleted", "info");
        } catch (err) {
            showToast("Failed to delete", "error");
        }
    };

    // --- AI STATE ---
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiResponse, setAiResponse] = useState(null);

    // Helper function to handle input changes for number fields
    const handleInputChange = (field, value, isInt = false) => {
        let numericValue = isInt ? parseInt(value) : parseFloat(value);
        if (isNaN(numericValue) || numericValue < 0) numericValue = 0;
        setConfig(prev => ({ ...prev, [field]: numericValue }));
    };

    // --- RUN SIMULATION ENGINE ---
    useEffect(() => {
        runSimulation();
    }, [config, outageHours]);

    const runSimulation = () => {
        let currentSoc = config.initialSoc;
        const newSimData = [];

        for (let h = 0; h < 24; h++) {
            // 1. Determine Inputs for this hour
            // Solar
            const solarKw = DEFAULT_SOLAR_PROFILE[h] * config.solarPeakKw;

            // Factory Operating logic
            const isFactoryOperating = isHourInWindow(h, config.factoryStartHour, config.factoryDuration);

            // Dynamic Load Logic
            let loadKw = isFactoryOperating ? config.baseLoadKw : config.offHoursLoadKw;
            const isPeak = isHourInWindow(h, config.peakStartHour, config.peakDuration);
            if (isPeak && isFactoryOperating) loadKw = config.peakLoadKw;

            const isOutage = outageHours.has(h);
            const isIdle = idleHours.has(h);
            const isExportPriority = isHourInWindow(h, config.exportStartHour, config.exportDuration);

            // 2. Initialize Flow Variables
            let flows = {
                solarToLoad: 0,
                solarToBattery: 0,
                solarToGrid: 0,
                gridToLoad: 0,
                gridToBattery: 0,
                batteryToLoad: 0,
                dgToLoad: 0, // NEW: Diesel Generator to Load
                curtailedSolar: 0
            };
            let batteryStatus = 'IDLE';
            let gridStatus = isOutage ? 'OUTAGE' : 'IDLE';
            let message = "";

            // 3. Logic Execution
            if (isIdle) {
                batteryStatus = 'IDLE';
                gridStatus = 'IDLE';
                flows.curtailedSolar = solarKw;
                message = "SYSTEM IDLE (Scheduled maintenance/OFF)";
                // Skip further processing
            } else {
                // Step A: Solar Logic
                // Solar covers Load first
                const solarDirectlyToLoad = Math.min(solarKw, loadKw);
                flows.solarToLoad = solarDirectlyToLoad;
                let remainingSolar = Math.max(0, solarKw - loadKw);
                let remainingLoad = Math.max(0, loadKw - solarKw);

                // Step B: Grid Charge Logic (Force Charge - Highest Priority)
                const shouldGridCharge = currentSoc < config.gridChargeThresholdSoc && !isOutage && config.allowGrid;

                if (shouldGridCharge) {
                    message = "Low Battery - Force Grid Charge";
                    // Use remaining solar first to charge
                    const solarCharge = Math.min(remainingSolar, config.pcsMaxPowerKw);
                    flows.solarToBattery = solarCharge;
                    remainingSolar -= solarCharge;

                    // Top up with grid power if PCS has capacity
                    const gridCharge = Math.min(
                        config.pcsMaxPowerKw - solarCharge,
                        config.batteryCapacityKwh * (100 - currentSoc) / 100
                    );
                    flows.gridToBattery = gridCharge;
                    batteryStatus = 'CHARGING';
                    gridStatus = 'IMPORT';
                }
                // Step C: Normal Operation (Excess Solar Management)
                else if (remainingSolar > 0) {
                    // Check if we should prioritize export
                    const prioritizeExport = isExportPriority && currentSoc >= config.exportMinSoc;

                    if (prioritizeExport && !isOutage) {
                        // Priority: Export max, charge min

                        // Charge the small remaining room (e.g., up to 100%)
                        const kwhRoom = (config.batteryCapacityKwh * (100 - currentSoc)) / 100;
                        const chargeAmt = Math.min(remainingSolar, kwhRoom, 0.5); // Charge min 0.5kW trickle if available

                        flows.solarToBattery = chargeAmt;
                        remainingSolar -= chargeAmt;

                        // Export the rest up to PCS max (or all of it)
                        const exportAmt = Math.min(remainingSolar, config.pcsMaxPowerKw - chargeAmt);
                        flows.solarToGrid = exportAmt;
                        remainingSolar -= exportAmt;

                        gridStatus = 'EXPORT';
                        message = "Export Priority Active: Sending excess to Grid";
                    } else {
                        // Standard Self-Consumption: Charge Battery first
                        if (currentSoc < 100) {
                            const maxChargeRate = config.pcsMaxPowerKw;
                            const kwhRoom = (config.batteryCapacityKwh * (100 - currentSoc)) / 100;
                            const actualCharge = Math.min(remainingSolar, maxChargeRate, kwhRoom);

                            flows.solarToBattery = actualCharge;
                            remainingSolar -= actualCharge;
                            batteryStatus = 'CHARGING';
                            message = "Charging from Excess Solar (Self-Consumption)";
                        }

                        // Export rest to Grid (if not outage and export allowed)
                        if (remainingSolar > 0) {
                            if (!isOutage) {
                                const canExport = isFactoryOperating || config.enableOffHoursExport;
                                if (canExport) {
                                    flows.solarToGrid = remainingSolar;
                                    gridStatus = 'EXPORT';
                                } else {
                                    flows.curtailedSolar = remainingSolar;
                                    message += " (Off-Hours: Export Disabled)";
                                }
                            } else {
                                flows.curtailedSolar = remainingSolar;
                                message += " (Grid Down: Solar Curtailed)";
                            }
                        }
                    }
                }

                // Step D: Normal Operation (Load Deficit Management)
                if (remainingLoad > 0) {
                    // Discharge Battery?
                    if (currentSoc > 0) {
                        const maxDischargeRate = config.pcsMaxPowerKw;
                        const kwhAvailable = (config.batteryCapacityKwh * currentSoc) / 100;

                        const dischargeNeeded = remainingLoad;
                        const actualDischarge = Math.min(dischargeNeeded, maxDischargeRate, kwhAvailable);

                        flows.batteryToLoad = actualDischarge;
                        remainingLoad -= actualDischarge;
                        batteryStatus = 'DISCHARGING';

                        if (!message) message = "Discharging Battery for Load";
                    }

                    // Still need power?
                    if (remainingLoad > 0) {
                        if (!isOutage && config.allowGrid) {
                            // Grid available
                            flows.gridToLoad = remainingLoad;
                            gridStatus = gridStatus === 'EXPORT' ? 'NET_METER' : 'IMPORT';
                            if (!message) message = "Importing from Grid for Load";
                        } else if (config.allowDg) {
                            // Grid Outage or Disabled -> Use Diesel Generator
                            flows.dgToLoad = remainingLoad;
                            message = isOutage ? "OUTAGE: Diesel Generator Running" : "Grid Disabled: Diesel Generator Running";
                            // remainingLoad is covered by DG
                        } else {
                            message = "NO POWER: Load Unmet";
                        }
                    }
                }
            }

            // 4. Update SoC for next hour
            const energyIntoBatt = flows.solarToBattery + flows.gridToBattery;
            const energyOutBatt = flows.batteryToLoad;
            const netEnergy = energyIntoBatt - energyOutBatt;

            const socChange = (netEnergy / config.batteryCapacityKwh) * 100;
            let nextSoc = Math.min(100, Math.max(0, currentSoc + socChange));

            // 5. Financials for this hour
            const totalImportKw = flows.gridToLoad + flows.gridToBattery;
            const totalExportKw = flows.solarToGrid;
            const totalDgKw = flows.dgToLoad;

            // Baseline: If no system, we pay for full load from grid. If outage, we pay full load from DG.
            const costRawLoad = isOutage
                ? loadKw * config.dieselPrice // Cost if running purely on DG during outage
                : loadKw * config.gridImportPrice; // Cost if running on Grid normally

            const costGrid = (totalImportKw * config.gridImportPrice) - (totalExportKw * config.gridExportPrice);
            const costDg = totalDgKw * config.dieselPrice;
            const costActual = costGrid + costDg;

            // Scenario Analysis:
            // 1. Grid Only (No Solar, No Battery, No DG, Grid always on)
            const costGridOnly = loadKw * config.gridImportPrice;
            // 2. DG Only (No Solar, No Battery, No Grid, DG always on)
            const costDgOnly = loadKw * config.dieselPrice;
            // 3. Status Quo (Grid + DG during outages, No Solar/Battery)
            const costGridAndDg = isOutage ? (loadKw * config.dieselPrice) : (loadKw * config.gridImportPrice);

            // Store Data
            newSimData.push({
                hour: h,
                solarKw,
                loadKw,
                socStart: currentSoc,
                socEnd: nextSoc,
                gridStatus,
                batteryStatus,
                flows,
                message,
                isOutage,
                isIdle,
                isPeak,
                isFactoryOperating,
                isExportPriority: isExportPriority,
                financials: {
                    costRawLoad,
                    costActual,
                    savings: costRawLoad - costActual,
                    costDg,
                    costGridOnly,
                    costDgOnly,
                    costGridAndDg
                }
            });

            currentSoc = nextSoc;
        }
        setSimulationData(newSimData);
    };

    // --- PLAYBACK CONTROLS ---
    useEffect(() => {
        let interval;
        if (isSimPlaying) {
            interval = setInterval(() => {
                setSelectedHour(prev => (prev + 1) % 24);
            }, 1500);
        }
        return () => clearInterval(interval);
    }, [isSimPlaying]);

    const toggleOutage = (hour) => {
        const newSet = new Set(outageHours);
        if (newSet.has(hour)) newSet.delete(hour);
        else newSet.add(hour);
        setOutageHours(newSet);
    };

    const toggleIdle = (hour) => {
        const newSet = new Set(idleHours);
        if (newSet.has(hour)) newSet.delete(hour);
        else newSet.add(hour);
        setIdleHours(newSet);
    };

    const cycleHourState = (hour) => {
        const isOutage = outageHours.has(hour);
        const isIdle = idleHours.has(hour);

        if (!isOutage && !isIdle) {
            // OK -> Outage
            setOutageHours(prev => new Set(prev).add(hour));
        } else if (isOutage) {
            // Outage -> Idle
            setOutageHours(prev => {
                const ns = new Set(prev);
                ns.delete(hour);
                return ns;
            });
            setIdleHours(prev => new Set(prev).add(hour));
        } else {
            // Idle -> OK
            setIdleHours(prev => {
                const ns = new Set(prev);
                ns.delete(hour);
                return ns;
            });
        }
    };

    // Get current frame data
    const currentData = simulationData[selectedHour] || {
        flows: { gridToLoad: 0, gridToBattery: 0, solarToGrid: 0, solarToLoad: 0, solarToBattery: 0, batteryToLoad: 0, dgToLoad: 0 },
        gridStatus: 'IDLE',
        batteryStatus: 'IDLE',
        socStart: 0,
        solarKw: 0,
        loadKw: 0,
        isIdle: false,
        isPeak: false,
        isFactoryOperating: true,
        isExportPriority: false,
        financials: { costRawLoad: 0, costActual: 0, savings: 0, costDg: 0 }
    };

    // Calculate Daily Totals
    const dailyTotals = useMemo(() => {
        return simulationData.reduce((acc, curr) => ({
            costRawLoad: acc.costRawLoad + curr.financials.costRawLoad,
            costActual: acc.costActual + curr.financials.costActual,
            savings: acc.savings + curr.financials.savings,
            costDg: acc.costDg + curr.financials.costDg,
            importKwh: acc.importKwh + curr.flows.gridToLoad + curr.flows.gridToBattery,
            exportKwh: acc.exportKwh + curr.flows.solarToGrid,
            dgKwh: acc.dgKwh + curr.flows.dgToLoad,
            solarUsedKwh: acc.solarUsedKwh + curr.flows.solarToLoad + curr.flows.solarToBattery,
            costGridOnly: acc.costGridOnly + curr.financials.costGridOnly,
            costDgOnly: acc.costDgOnly + curr.financials.costDgOnly,
            costGridAndDg: acc.costGridAndDg + curr.financials.costGridAndDg
        }), { costRawLoad: 0, costActual: 0, savings: 0, costDg: 0, importKwh: 0, exportKwh: 0, dgKwh: 0, solarUsedKwh: 0, costGridOnly: 0, costDgOnly: 0, costGridAndDg: 0 });
    }, [simulationData]);

    const hourOptions = [...Array(24)].map((_, i) => ({
        value: i,
        label: `${i.toString().padStart(2, '0')}:00`
    }));

    // --- GEMINI AI INTEGRATION ---
    const generateInsights = async () => {
        setAiLoading(true);
        setShowAiModal(true);
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

        // Construct Prompt
        const prompt = `
      You are an expert Energy Consultant and Electrical Engineer.
      Analyze this home energy system simulation.
      
      Data:
      - Solar: ${config.solarPeakKw} kW
      - Battery: ${config.batteryCapacityKwh} kWh
      - Factory Hours: ${config.factoryStartHour}:00 for ${config.factoryDuration}h
      - Load: Base ${config.baseLoadKw} kW, Peak ${config.peakLoadKw} kW, Off-Hours ${config.offHoursLoadKw} kW
      - Outages Scheduled: ${outageHours.size} hours
      - Total Daily Savings: ₹${dailyTotals.savings.toFixed(2)}
      - Diesel Used: ₹${dailyTotals.costDg.toFixed(2)}
      - Grid Import: ${dailyTotals.importKwh.toFixed(1)} kWh
      - Solar Export: ${dailyTotals.exportKwh.toFixed(1)} kWh
      
      Goal: Maximize savings and ensure outage protection.
      
      Task: Provide 3 short, punchy, actionable recommendations to improve this setup. 
      Focus on ROI, battery sizing, or scheduling. 
      If diesel usage is high, suggest how to reduce it.
      Use emojis for bullet points. Keep total response under 150 words.
    `;

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                    }),
                }
            );

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to generate insights at this time.";
            setAiResponse(text);
        } catch (error) {
            console.error("Gemini API Error:", error);
            setAiResponse("Error connecting to the AI consultant. Please try again.");
        } finally {
            setAiLoading(false);
        }
    };

    // --- REPORT GENERATION ---
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [reportProgress, setReportProgress] = useState(0);
    const visualizerRef = useRef(null);

    const generateReport = async () => {
        setIsGeneratingReport(true);
        setReportProgress(0);
        setIsSimPlaying(false);

        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            let yPos = 20;

            // 1. Executive Summary & Configuration Page
            pdf.setFontSize(24);
            pdf.setTextColor(15, 23, 42); // slate-900
            pdf.text('Comprehensive Battery Analysis Report', pageWidth / 2, yPos, { align: 'center' });
            yPos += 15;

            pdf.setFontSize(10);
            pdf.setTextColor(100);
            pdf.text(`Project: ${activeCustomer?.name || 'Standard Analysis'} | Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' });
            yPos += 20;

            // System Summary Section
            pdf.setFontSize(16);
            pdf.setTextColor(15, 23, 42);
            pdf.text('System Configuration', 20, yPos);
            yPos += 10;

            pdf.setFontSize(10);
            pdf.setTextColor(50);
            const specs = [
                `Solar PV Size: ${config.solarPeakKw} kW`,
                `Battery Capacity: ${config.batteryCapacityKwh} kWh`,
                `PCS Power: ${config.pcsMaxPowerKw} kW`,
                `Base Load: ${config.baseLoadKw} kW`,
                `Peak Load: ${config.peakLoadKw} kW`,
                `Off-Hours Load: ${config.offHoursLoadKw} kW`,
                `Factory Operating Hours: ${config.factoryStartHour}:00 - ${(config.factoryStartHour + config.factoryDuration) % 24}:00`,
                `Daily Estimated Savings: ₹${dailyTotals.savings.toFixed(2)}`
            ];

            // Print specs in two columns
            specs.forEach((spec, idx) => {
                const xPos = idx % 2 === 0 ? 25 : 110;
                pdf.text(spec, xPos, yPos);
                if (idx % 2 !== 0) yPos += 7;
            });
            if (specs.length % 2 !== 0) yPos += 7;
            yPos += 10;

            // Financial Summary
            pdf.setFontSize(16);
            pdf.setTextColor(15, 23, 42);
            pdf.text('Financial & Energy Summary', 20, yPos);
            yPos += 10;

            const totalUsage = (dailyTotals.solarUsedKwh + dailyTotals.importKwh + dailyTotals.dgKwh);
            const energyMixData = [
                ['Energy Source', 'Usage (kWh)', 'Percentage (%)'],
                ['Solar (Used)', dailyTotals.solarUsedKwh.toFixed(1), totalUsage > 0 ? ((dailyTotals.solarUsedKwh / totalUsage) * 100).toFixed(1) : '0.0'],
                ['Electricity (Grid)', dailyTotals.importKwh.toFixed(1), totalUsage > 0 ? ((dailyTotals.importKwh / totalUsage) * 100).toFixed(1) : '0.0'],
                ['Diesel (DG)', dailyTotals.dgKwh.toFixed(1), totalUsage > 0 ? ((dailyTotals.dgKwh / totalUsage) * 100).toFixed(1) : '0.0'],
                ['Total Load', totalUsage.toFixed(1), '100%']
            ];

            const colWidthsMix = [60, 40, 40];
            pdf.setFontSize(9);
            energyMixData.forEach((row, rowIndex) => {
                let xPos = 25;
                if (rowIndex === 0) pdf.setFont('helvetica', 'bold');
                else pdf.setFont('helvetica', 'normal');
                row.forEach((cell, cellIndex) => {
                    pdf.rect(xPos, yPos, colWidthsMix[cellIndex], 8);
                    pdf.text(cell, xPos + 2, yPos + 6);
                    xPos += colWidthsMix[cellIndex];
                });
                yPos += 8;
            });

            yPos += 15;
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Scenario Savings Comparison (Daily)', 20, yPos);
            yPos += 8;

            const savingsScenarios = [
                ['Scenario', 'Est. Daily Cost (INR)', 'Daily Savings (INR)'],
                ['Current BESS System', '₹' + dailyTotals.costActual.toFixed(2), '-'],
                ['Grid Only Source', '₹' + dailyTotals.costGridOnly.toFixed(2), '₹' + (dailyTotals.costGridOnly - dailyTotals.costActual).toFixed(2)],
                ['DG Only Source', '₹' + dailyTotals.costDgOnly.toFixed(2), '₹' + (dailyTotals.costDgOnly - dailyTotals.costActual).toFixed(2)],
                ['Grid + DG (Status Quo)', '₹' + dailyTotals.costGridAndDg.toFixed(2), '₹' + (dailyTotals.costGridAndDg - dailyTotals.costActual).toFixed(2)]
            ];

            savingsScenarios.forEach((row, rowIndex) => {
                let xPos = 25;
                if (rowIndex === 0) pdf.setFont('helvetica', 'bold');
                else pdf.setFont('helvetica', 'normal');
                row.forEach((cell, cellIndex) => {
                    pdf.rect(xPos, yPos, colWidthsMix[cellIndex], 8);
                    pdf.text(cell, xPos + 2, yPos + 6);
                    xPos += colWidthsMix[cellIndex];
                });
                yPos += 8;
            });

            // 2. Table Hour by Hour Page
            pdf.addPage();
            yPos = 20;
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Detailed Hourly Analysis Table', pageWidth / 2, yPos, { align: 'center' });
            yPos += 15;

            pdf.setFontSize(8);
            const tableCols = [15, 25, 25, 25, 25, 25, 25, 25];
            const tableHeaders = ['Hour', 'Solar (kW)', 'Load (kW)', 'Source', 'Batt SOC', 'Grid (kWh)', 'DG (kWh)', 'Net Cost'];

            // Render Headers
            let xPos = 15;
            pdf.setFont('helvetica', 'bold');
            tableHeaders.forEach((header, idx) => {
                pdf.rect(xPos, yPos, tableCols[idx], 8);
                pdf.text(header, xPos + 2, yPos + 5);
                xPos += tableCols[idx];
            });
            yPos += 8;

            // Render Rows
            pdf.setFont('helvetica', 'normal');
            simulationData.forEach((row, i) => {
                xPos = 15;
                const status = row.isIdle ? 'IDLE' : (row.isOutage ? (row.flows.dgToLoad > 0 ? 'DG ON' : 'BATT') : 'GRID');
                const rowData = [
                    `${row.hour}:00`,
                    row.solarKw.toFixed(1),
                    row.loadKw.toFixed(1),
                    status,
                    `${row.socStart.toFixed(0)}%`,
                    (row.flows.gridToLoad + row.flows.gridToBattery).toFixed(1),
                    row.flows.dgToLoad.toFixed(1),
                    `₹${row.financials.costActual.toFixed(2)}`
                ];

                rowData.forEach((cell, idx) => {
                    pdf.rect(xPos, yPos, tableCols[idx], 7);
                    pdf.text(cell, xPos + 2, yPos + 5);
                    xPos += tableCols[idx];
                });
                yPos += 7;
            });

            // 3. Images Hour by Hour
            const originalHour = selectedHour;

            pdf.addPage();
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Hourly Simulation Visualization', pageWidth / 2, 20, { align: 'center' });

            // We'll put 2-3 hours per page to keep it readable
            for (let h = 0; h < 24; h++) {
                setReportProgress(Math.round((h / 24) * 100));
                setSelectedHour(h);

                // Wait for React to render
                await new Promise(resolve => setTimeout(resolve, 350));

                const canvas = await html2canvas(visualizerRef.current, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#f8fafc'
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.7);
                const imgWidth = pageWidth - 40;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;

                // Move to next page every 2 frames
                if (h % 2 === 0 && h !== 0) {
                    pdf.addPage();
                    yPos = 20;
                } else if (h === 0) {
                    yPos = 35;
                }

                // Header for the hour
                pdf.setFontSize(11);
                pdf.setTextColor(15, 23, 42);
                pdf.text(`Simulation State - Hour ${h.toString().padStart(2, '0')}:00`, 20, yPos);

                const hourData = simulationData[h];
                pdf.setFontSize(7);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Solar: ${hourData.solarKw.toFixed(1)}kW | Load: ${hourData.loadKw.toFixed(1)}kW | SoC: ${hourData.socStart.toFixed(0)}% | Msg: ${hourData.message}`, 80, yPos);
                yPos += 5;

                pdf.addImage(imgData, 'JPEG', 20, yPos, imgWidth, imgHeight);
                yPos += imgHeight + 15;
            }

            setSelectedHour(originalHour);
            pdf.save(`Comprehensive_BESS_Report_${activeCustomer?.name || 'Standard'}.pdf`);
            showToast("Comprehensive report generated successfully!", "success");
        } catch (err) {
            console.error("Report generation failed", err);
            showToast("Failed to generate report", "error");
        } finally {
            setIsGeneratingReport(false);
            setReportProgress(0);
        }
    };


    return (
        <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-800">

            {/* HEADER */}
            <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                        <Zap className="text-yellow-500 fill-yellow-500" />
                        24H BESS Analysis Tool
                    </h1>
                    <p className="text-slate-500 text-sm">Simulate Grid, Solar, Battery & Diesel Generator interactions</p>
                </div>
                <div className="flex gap-2">
                    {/* Scenario Management */}
                    <div className="flex bg-white rounded-lg border border-slate-200 shadow-sm p-1 gap-1">
                        <select
                            value={activeScenarioId || 'default'}
                            onChange={(e) => loadScenario(e.target.value)}
                            className="bg-transparent border-none text-xs font-bold text-slate-600 focus:ring-0 cursor-pointer min-w-[140px]"
                        >
                            <option value="default">Current Default</option>
                            {scenarios.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={saveAsNewScenario}
                            className="p-1 px-2 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 transition-colors border border-emerald-200"
                        >
                            Save As
                        </button>
                    </div>

                    <button
                        onClick={generateReport}
                        disabled={isGeneratingReport}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border shadow-md ${isGeneratingReport ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'}`}
                    >
                        {isGeneratingReport ? (
                            <><Loader size={16} className="animate-spin" /> Generating {reportProgress}%</>
                        ) : (
                            <><Table size={16} /> Export Report</>
                        )}
                    </button>
                    <button
                        onClick={generateInsights}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-purple-600 text-white shadow-md hover:bg-purple-700 transition-all border border-purple-500"
                    >
                        <Sparkles size={16} className="text-yellow-200" /> AI Insights
                    </button>
                    <button
                        onClick={() => setIsSimPlaying(!isSimPlaying)}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${isSimPlaying ? 'bg-red-100 text-red-700' : 'bg-blue-600 text-white shadow-md hover:bg-blue-700'}`}
                    >
                        {isSimPlaying ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Run Simulation</>}
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* --- LEFT SIDE: CONFIGURATION (3 cols) --- */}
                <div className="xl:col-span-3 space-y-4">
                    <Card className="bg-white sticky top-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                            <Settings className="text-slate-400" size={18} />
                            <h2 className="font-bold text-slate-700">System Specs</h2>
                        </div>

                        <div className="space-y-4">

                            {/* 1. System Sizing */}
                            <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-100">
                                <InputField
                                    label="Solar PV Size (kW)"
                                    icon={Sun}
                                    value={config.solarPeakKw}
                                    onChange={(v) => handleInputChange('solarPeakKw', v)}
                                    color="text-yellow-500"
                                />
                                <InputField
                                    label="Battery Capacity (kWh)"
                                    icon={Battery}
                                    value={config.batteryCapacityKwh}
                                    onChange={(v) => handleInputChange('batteryCapacityKwh', v)}
                                    color="text-emerald-500"
                                />
                                <InputField
                                    label="PCS / Inverter (kW)"
                                    icon={Zap}
                                    value={config.pcsMaxPowerKw}
                                    onChange={(v) => handleInputChange('pcsMaxPowerKw', v)}
                                    color="text-blue-500"
                                />
                            </div>

                            {/* 2. Load Profile Configuration */}
                            <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                                <label className="text-xs font-bold text-indigo-800 uppercase flex items-center gap-2 mb-3">
                                    <Home size={14} /> Load Profile Settings
                                </label>

                                <div className="space-y-3">
                                    <InputField
                                        label="Base Load (kW)"
                                        value={config.baseLoadKw}
                                        onChange={(v) => handleInputChange('baseLoadKw', v)}
                                        helper="Average load outside peak hours."
                                    />
                                    <InputField
                                        label="Peak Load (kW)"
                                        value={config.peakLoadKw}
                                        onChange={(v) => handleInputChange('peakLoadKw', v)}
                                        color="text-red-600"
                                        helper="Load during the peak window."
                                    />

                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-indigo-200">
                                        <SelectField
                                            label="Peak Start Time"
                                            value={config.peakStartHour}
                                            options={hourOptions}
                                            onChange={(v) => handleInputChange('peakStartHour', v, true)}
                                        />
                                        <InputField
                                            label="Duration (Hrs)"
                                            value={config.peakDuration}
                                            onChange={(v) => handleInputChange('peakDuration', v, true)}
                                            isInt={true}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 3. Grid Export Priority */}
                            <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                                <label className="text-xs font-bold text-purple-800 uppercase flex items-center gap-2 mb-3">
                                    <TrendingUp size={14} /> Grid Export Priority Window
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <SelectField
                                        label="Start Hour"
                                        value={config.exportStartHour}
                                        options={hourOptions}
                                        onChange={(v) => handleInputChange('exportStartHour', v, true)}
                                    />
                                    <InputField
                                        label="Duration (Hrs)"
                                        value={config.exportDuration}
                                        onChange={(v) => handleInputChange('exportDuration', v, true)}
                                        isInt={true}
                                    />
                                </div>
                                <InputField
                                    label="Min SoC for Export (%)"
                                    value={config.exportMinSoc}
                                    onChange={(v) => handleInputChange('exportMinSoc', v, true)}
                                    isInt={true}
                                    helper="Excess solar is exported only if SoC is above this."
                                />
                            </div>

                            {/* Factory Operating Hours */}
                            <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                                <label className="text-xs font-bold text-amber-800 uppercase flex items-center gap-2 mb-3">
                                    <Clock size={14} /> Factory Operations
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <SelectField
                                        label="Start Hour"
                                        value={config.factoryStartHour}
                                        options={hourOptions}
                                        onChange={(v) => handleInputChange('factoryStartHour', v, true)}
                                    />
                                    <InputField
                                        label="Duration (Hrs)"
                                        value={config.factoryDuration}
                                        onChange={(v) => handleInputChange('factoryDuration', v, true)}
                                        isInt={true}
                                    />
                                </div>
                                <div className="mt-3 space-y-3">
                                    <InputField
                                        label="Off-Hours Load (kW)"
                                        value={config.offHoursLoadKw}
                                        onChange={(v) => handleInputChange('offHoursLoadKw', v)}
                                        helper="Load when factory is CLOSED."
                                    />
                                    <div className="flex items-center justify-between bg-white/50 p-2 rounded border border-amber-200">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-amber-900 uppercase">Off-Hours Export</span>
                                            <span className="text-[9px] text-amber-700">Export surplus when closed</span>
                                        </div>
                                        <button
                                            onClick={() => setConfig(prev => ({ ...prev, enableOffHoursExport: !prev.enableOffHoursExport }))}
                                            className={`w-10 h-5 rounded-full transition-colors relative ${config.enableOffHoursExport ? 'bg-amber-500' : 'bg-slate-300'}`}
                                        >
                                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all left-0.5 ${config.enableOffHoursExport ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 4. Economics */}
                            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                                <label className="text-xs font-bold text-emerald-800 uppercase flex items-center gap-2 mb-3">
                                    <DollarSign size={14} /> Economics (INR ₹)
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <InputField
                                        label="Import Rate (₹/kWh)"
                                        value={config.gridImportPrice}
                                        onChange={(v) => handleInputChange('gridImportPrice', v)}
                                        color="text-red-600"
                                    />
                                    <InputField
                                        label="Export Rate (₹/kWh)"
                                        value={config.gridExportPrice}
                                        onChange={(v) => handleInputChange('gridExportPrice', v)}
                                        color="text-emerald-600"
                                    />
                                    <InputField
                                        label="Diesel Rate (₹/kWh)"
                                        value={config.dieselPrice}
                                        onChange={(v) => handleInputChange('dieselPrice', v)}
                                        color="text-slate-700"
                                    />
                                </div>
                            </div>

                            {/* 5. Battery Control */}
                            <div className="pt-2 border-t border-slate-100 space-y-4">
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Zap size={14} className="text-blue-500" />
                                            <span className="text-xs font-bold text-slate-700">Allow Grid Use</span>
                                        </div>
                                        <button
                                            onClick={() => setConfig(prev => ({ ...prev, allowGrid: !prev.allowGrid }))}
                                            className={`w-10 h-5 rounded-full transition-colors relative ${config.allowGrid ? 'bg-blue-500' : 'bg-slate-300'}`}
                                        >
                                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all left-0.5 ${config.allowGrid ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Fuel size={14} className="text-amber-500" />
                                            <span className="text-xs font-bold text-slate-700">Allow DG Use</span>
                                        </div>
                                        <button
                                            onClick={() => setConfig(prev => ({ ...prev, allowDg: !prev.allowDg }))}
                                            className={`w-10 h-5 rounded-full transition-colors relative ${config.allowDg ? 'bg-amber-500' : 'bg-slate-300'}`}
                                        >
                                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all left-0.5 ${config.allowDg ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                </div>

                                <InputField
                                    label="Initial SoC (%)"
                                    value={config.initialSoc}
                                    onChange={(v) => handleInputChange('initialSoc', v, true)}
                                    isInt={true}
                                    color="text-slate-500"
                                />
                                <InputField
                                    label="Grid Charge Threshold (%)"
                                    value={config.gridChargeThresholdSoc}
                                    onChange={(v) => handleInputChange('gridChargeThresholdSoc', v, true)}
                                    isInt={true}
                                    helper="Grid is used to charge battery when SoC drops below this."
                                    color="text-red-500"
                                />
                            </div>
                        </div>
                    </Card>
                </div>

                {/* --- CENTER/RIGHT: VISUALIZATION & DATA (9 cols) --- */}
                <div className="xl:col-span-9 space-y-6">

                    {/* 1. VISUALIZER (The "Digital Twin") */}
                    <div ref={visualizerRef} className="relative h-[450px] bg-slate-100 rounded-xl border border-slate-200 shadow-inner overflow-hidden select-none">
                        {/* Hour Indicator */}
                        <div className="absolute top-4 left-4 z-40 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-sm border border-slate-200">
                            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Time of Day</div>
                            <div className="flex items-center gap-2">
                                <Clock size={20} className="text-slate-600" />
                                <div className="text-2xl font-mono font-bold text-slate-800">{selectedHour.toString().padStart(2, '0')}:00</div>
                            </div>
                            {currentData.isPeak && <div className="mt-1 text-center text-[10px] bg-red-100 text-red-600 font-bold rounded px-1">PEAK LOAD TIME</div>}
                            {!currentData.isFactoryOperating && <div className="mt-1 text-center text-[10px] bg-amber-100 text-amber-700 font-bold rounded px-1">FACTORY CLOSED</div>}
                            {currentData.isIdle && <div className="mt-1 text-center text-[10px] bg-slate-100 text-slate-500 font-bold rounded px-1">SYSTEM IDLE</div>}
                            {currentData.isExportPriority && !currentData.isOutage && <div className="mt-1 text-center text-[10px] bg-purple-100 text-purple-600 font-bold rounded px-1">EXPORT PRIORITY</div>}
                        </div>

                        {/* Idle/Maintenance Banner */}
                        {currentData.isIdle && (
                            <div className="absolute top-0 left-0 right-0 bg-slate-500 text-white text-center py-1 text-xs font-bold uppercase z-50">
                                ⚙️ System Scheduled Idle / Maintenance
                            </div>
                        )}

                        {/* Outage Warning Banner */}
                        {currentData.isOutage && (
                            <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-center py-1 text-xs font-bold uppercase z-50 animate-pulse">
                                ⚠️ Grid Power Outage Active
                            </div>
                        )}

                        {/* --- COMPONENTS --- */}

                        {/* AC BUS */}
                        <div className="absolute top-1/2 left-[15%] right-[15%] h-3 bg-slate-800 rounded -translate-y-1/2 shadow-xl z-20 flex items-center justify-center">
                            <span className="text-[9px] text-slate-500 font-mono tracking-[0.2em] -mt-5">AC BUS 230V</span>
                        </div>

                        {/* GRID (Top Left) */}
                        <div className="absolute left-[5%] top-[25%] flex flex-col items-center gap-2 z-30">
                            <div className={`w-14 h-14 rounded-full shadow-lg border-2 flex items-center justify-center transition-colors ${currentData.isOutage ? 'bg-red-100 border-red-500 grayscale' : 'bg-white border-slate-300'}`}>
                                <span className="text-2xl">🗼</span>
                            </div>
                            <div className={`text-xs font-bold bg-white/80 px-2 rounded mt-1 min-w-[60px] text-center shadow-sm border border-slate-100
                ${currentData.gridStatus === 'IMPORT' ? 'text-red-600' : currentData.gridStatus === 'EXPORT' ? 'text-purple-600' : 'text-slate-600'}
              `}>
                                {currentData.gridStatus === 'IMPORT' ? `${(currentData.flows.gridToLoad + currentData.flows.gridToBattery).toFixed(1)} kW` :
                                    currentData.gridStatus === 'EXPORT' ? `${currentData.flows.solarToGrid.toFixed(1)} kW` :
                                        '0.0 kW'}
                            </div>
                        </div>

                        {/* DIESEL GENERATOR (Bottom Left) */}
                        <div className="absolute left-[5%] bottom-[25%] flex flex-col items-center gap-2 z-30">
                            <div className={`w-14 h-14 rounded-full shadow-lg border-2 flex items-center justify-center transition-all ${currentData.flows.dgToLoad > 0 ? 'bg-amber-100 border-amber-500 animate-pulse' : 'bg-slate-50 border-slate-200'}`}>
                                <Fuel className={currentData.flows.dgToLoad > 0 ? 'text-amber-700' : 'text-slate-300'} size={24} />
                            </div>
                            <div className={`text-xs font-bold bg-white/80 px-2 rounded mt-1 min-w-[60px] text-center shadow-sm border border-slate-100 ${currentData.flows.dgToLoad > 0 ? 'text-amber-700' : 'text-slate-300'}`}>
                                {currentData.flows.dgToLoad > 0 ? `${currentData.flows.dgToLoad.toFixed(1)} kW` : 'OFF'}
                            </div>
                        </div>


                        {/* SOLAR (Top Center) */}
                        <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-30">
                            <div className="w-16 h-16 bg-white rounded-xl shadow-lg border-2 border-yellow-400 flex flex-col items-center justify-center p-1">
                                <Sun className={`text-yellow-500 ${currentData.solarKw > 0 ? 'animate-spin-slow' : 'opacity-40'}`} size={28} />
                                <div className="text-[10px] font-mono font-bold">
                                    {config.solarPeakKw}kW * {DEFAULT_SOLAR_PROFILE[selectedHour].toFixed(2)} = {currentData.solarKw.toFixed(1)}kW
                                </div>
                            </div>
                        </div>

                        {/* LOAD (Right Center) */}
                        <div className="absolute right-10 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-30">
                            <div className={`w-14 h-14 bg-white rounded-full shadow-lg border-2 flex items-center justify-center transition-all ${currentData.isPeak ? 'border-red-400 shadow-red-200' : 'border-indigo-300'}`}>
                                <Home className={currentData.isPeak ? 'text-red-600' : 'text-indigo-600'} size={24} />
                            </div>
                            <div className={`text-xs font-bold bg-white/80 px-2 rounded ${currentData.isPeak ? 'text-red-600' : 'text-indigo-700'}`}>
                                {currentData.loadKw.toFixed(1)} kW
                            </div>
                        </div>

                        {/* BATTERY (Bottom Center) */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-40 z-30">
                            <div className="bg-white rounded-lg shadow-lg border border-emerald-500 p-2">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] font-bold text-slate-500">BESS ({config.pcsMaxPowerKw}kW)</span>
                                    <span className={`text-xs font-mono font-bold ${currentData.socStart < config.gridChargeThresholdSoc ? 'text-red-500' : 'text-emerald-600'}`}>
                                        {currentData.socStart.toFixed(0)}%
                                    </span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 transition-all duration-300"
                                        style={{ width: `${currentData.socStart}%` }}
                                    />
                                </div>
                                {/* Status Badge */}
                                <div className="mt-2 text-center">
                                    {currentData.batteryStatus === 'CHARGING' && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold animate-pulse">CHARGING</span>}
                                    {currentData.batteryStatus === 'DISCHARGING' && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold animate-pulse">DISCHARGING</span>}
                                    {currentData.batteryStatus === 'IDLE' && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold">IDLE</span>}
                                </div>
                            </div>
                        </div>

                        {/* --- CONNECTIONS & FLOWS --- */}
                        {/* Lines */}
                        {/* Grid to Bus */}
                        <div className="absolute top-[33%] left-[10%] w-[10%] h-1 bg-slate-300 rotate-45 origin-left" />
                        {/* DG to Bus */}
                        <div className="absolute bottom-[33%] left-[10%] w-[10%] h-1 bg-slate-300 -rotate-45 origin-left" />

                        {/* Main H-Bus */}
                        <div className="absolute top-1/2 left-[15%] w-[70%] h-1 bg-slate-300 -translate-y-1/2" />

                        {/* Vertical Bus to Solar */}
                        <div className="absolute top-[80px] left-1/2 w-1 h-[calc(50%-80px)] bg-slate-300 -translate-x-1/2" />
                        {/* Vertical Bus to Battery */}
                        <div className="absolute bottom-[80px] left-1/2 w-1 h-[calc(50%-80px)] bg-slate-300 -translate-x-1/2" />


                        {/* Animations */}
                        {/* Solar -> Load */}
                        <FlowLine active={currentData.flows.solarToLoad > 0} vertical={true} direction="down" color="bg-yellow-400" />
                        <div className="absolute top-1/2 left-1/2 w-[35%] h-full -translate-y-1/2 pointer-events-none">
                            <FlowLine active={currentData.flows.solarToLoad > 0} direction="right" color="bg-yellow-400" label={currentData.flows.solarToLoad > 0 ? `${currentData.flows.solarToLoad.toFixed(1)}` : null} />
                        </div>

                        {/* Solar -> Grid */}
                        <div className="absolute top-1/2 right-[60%] w-[25%] h-full -translate-y-1/2 pointer-events-none rotate-180">
                            <FlowLine active={currentData.flows.solarToGrid > 0} direction="right" color="bg-purple-400" label={currentData.flows.solarToGrid > 0 ? `${currentData.flows.solarToGrid.toFixed(1)}` : null} />
                        </div>

                        {/* Solar -> Battery */}
                        <div className="absolute top-1/2 left-1/2 w-full h-[35%] -translate-x-1/2 pointer-events-none mt-2">
                            <FlowLine active={currentData.flows.solarToBattery > 0} vertical={true} direction="down" color="bg-emerald-400" label={currentData.flows.solarToBattery > 0 ? `${currentData.flows.solarToBattery.toFixed(1)}` : null} />
                        </div>

                        {/* Grid -> Battery */}
                        <div className="absolute top-1/2 left-[15%] w-[35%] h-full -translate-y-1/2 pointer-events-none">
                            <FlowLine active={currentData.flows.gridToBattery > 0} direction="right" color="bg-red-400" />
                        </div>
                        <div className="absolute top-1/2 left-1/2 w-full h-[35%] -translate-x-1/2 pointer-events-none mt-2">
                            <FlowLine active={currentData.flows.gridToBattery > 0} vertical={true} direction="down" color="bg-red-400" label={currentData.flows.gridToBattery > 0 ? `${currentData.flows.gridToBattery.toFixed(1)}` : null} />
                        </div>

                        {/* Grid -> Load */}
                        <div className="absolute top-1/2 left-[15%] w-[70%] h-full -translate-y-1/2 pointer-events-none">
                            <FlowLine active={currentData.flows.gridToLoad > 0} direction="right" color="bg-red-400" label={currentData.flows.gridToLoad > 0 ? `${currentData.flows.gridToLoad.toFixed(1)}` : null} />
                        </div>

                        {/* DG -> Load */}
                        <div className="absolute top-1/2 left-[15%] w-[70%] h-full -translate-y-1/2 pointer-events-none pt-4">
                            <FlowLine active={currentData.flows.dgToLoad > 0} direction="right" color="bg-amber-600" label={currentData.flows.dgToLoad > 0 ? `${currentData.flows.dgToLoad.toFixed(1)}` : null} />
                        </div>


                        {/* Battery -> Load */}
                        <div className="absolute bottom-[80px] left-1/2 w-full h-[calc(50%-80px)] -translate-x-1/2 pointer-events-none mb-2">
                            <FlowLine active={currentData.flows.batteryToLoad > 0} vertical={true} direction="up" color="bg-blue-400" label={currentData.flows.batteryToLoad > 0 ? `${currentData.flows.batteryToLoad.toFixed(1)}` : null} />
                        </div>
                        <div className="absolute top-1/2 left-1/2 w-[35%] h-full -translate-y-1/2 pointer-events-none ml-2">
                            <FlowLine active={currentData.flows.batteryToLoad > 0} direction="right" color="bg-blue-400" />
                        </div>
                    </div>

                    {/* 1.5 FINANCIAL SUMMARY BANNER */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 text-white border-none flex flex-col justify-between">
                            <div className="flex items-center gap-2 opacity-80 text-sm">
                                <Home size={16} /> Grid/DG Cost (No Solar)
                            </div>
                            <div className="text-2xl font-mono font-bold mt-1">
                                ₹{dailyTotals.costRawLoad.toFixed(2)}
                            </div>
                            <div className="text-xs opacity-50">Daily estimated cost</div>
                        </Card>

                        <Card className="p-4 bg-white border-slate-200 flex flex-col justify-between">
                            <div className="flex items-center gap-2 text-slate-500 text-sm font-bold">
                                <Zap size={16} className="text-blue-500" /> Net System Cost
                            </div>
                            <div className="text-2xl font-mono font-bold mt-1 text-slate-800">
                                ₹{dailyTotals.costActual.toFixed(2)}
                            </div>
                            <div className="flex justify-between items-center text-xs text-slate-400 mt-1">
                                <span>Diesel Spent: ₹{dailyTotals.costDg.toFixed(2)}</span>
                                <span>Exports: {dailyTotals.exportKwh.toFixed(1)}kWh</span>
                            </div>
                        </Card>

                        <Card className="p-4 bg-emerald-50 border-emerald-100 flex flex-col justify-between">
                            <div className="flex items-center gap-2 text-emerald-700 text-sm font-bold">
                                <DollarSign size={16} /> Total Daily Savings
                            </div>
                            <div className="text-2xl font-mono font-bold mt-1 text-emerald-600">
                                ₹{dailyTotals.savings.toFixed(2)}
                            </div>
                            <div className="text-xs text-emerald-600/70 font-medium">
                                {dailyTotals.costRawLoad > 0 ? ((dailyTotals.savings / dailyTotals.costRawLoad) * 100).toFixed(0) : 0}% reduction in bill
                            </div>
                        </Card>
                    </div>

                    {/* 2. TIMELINE & OUTAGE SCHEDULER */}
                    <Card>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <AlertTriangle className="text-slate-400" size={18} />
                                Timeline & System Status
                            </h3>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                    <div className="w-2 h-2 rounded-full bg-emerald-300" /> Grid OK
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                    <div className="w-2 h-2 rounded-full bg-red-300" /> Outage
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                    <div className="w-2 h-2 rounded-full bg-slate-300" /> Idle
                                </div>
                                <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded ml-2">Click bar to cycle states</span>
                            </div>
                        </div>

                        <div className="relative pt-6 pb-2">
                            {/* Hour Bars */}
                            <div className="flex justify-between gap-1 h-12">
                                {simulationData.map((hourData, j) => {
                                    const isOutage = outageHours.has(j);
                                    const isIdle = idleHours.has(j);
                                    return (
                                        <button
                                            key={j}
                                            onClick={() => cycleHourState(j)}
                                            className={`flex-1 rounded-sm relative group transition-all hover:scale-110 ${isIdle ? 'bg-slate-200 hover:bg-slate-300' :
                                                isOutage ? 'bg-red-200 hover:bg-red-300' :
                                                    'bg-emerald-100 hover:bg-emerald-200'
                                                } ${selectedHour === j ? 'ring-2 ring-blue-500 z-10' : ''}`}
                                        >
                                            {/* Tooltip */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-50">
                                                {j}:00 - {isIdle ? 'Idle' : isOutage ? 'Outage' : 'Grid OK'}
                                                <div className="opacity-70">Load: {hourData.loadKw.toFixed(1)}kW</div>
                                                <div className="text-emerald-300 mt-1">Saved: ₹{hourData.financials.savings.toFixed(2)}</div>
                                            </div>

                                            {/* Status Dot */}
                                            {isOutage && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                                </div>
                                            )}
                                            {isIdle && (
                                                <div className="absolute inset-0 flex items-center justify-center rotate-45">
                                                    <div className="w-2 h-0.5 bg-slate-400 rounded-full" />
                                                </div>
                                            )}

                                            {/* Time Window Indicator Line */}
                                            {hourData.isPeak && <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-400/50" />}
                                            {!hourData.isFactoryOperating && <div className="absolute bottom-1 left-0 right-0 h-1 bg-amber-400/30" />}
                                            {hourData.isExportPriority && <div className="absolute top-0 left-0 right-0 h-1 bg-purple-400/50" />}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Slider Scrubber */}
                            <input
                                type="range"
                                min="0"
                                max="23"
                                step="1"
                                value={selectedHour}
                                onChange={(e) => {
                                    setSelectedHour(parseInt(e.target.value));
                                    setIsSimPlaying(false);
                                }}
                                className="w-full absolute top-1/2 -translate-y-1/2 opacity-0 cursor-pointer h-12"
                            />

                            {/* Labels */}
                            <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-mono">
                                <span>00:00</span>
                                <span>06:00</span>
                                <span>12:00</span>
                                <span>18:00</span>
                                <span>23:00</span>
                            </div>
                        </div>
                    </Card>

                    {/* 3. DATA TABLE */}
                    <Card className="overflow-hidden">
                        <div className="flex items-center gap-2 mb-4">
                            <Table className="text-slate-400" size={18} />
                            <h3 className="font-bold text-slate-700">Hourly Analysis</h3>
                        </div>
                        <div className="overflow-x-auto max-h-[300px]">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 text-slate-500 uppercase font-bold sticky top-0 z-10">
                                    <tr>
                                        <th className="p-2 text-center">Hour</th>
                                        <th className="p-2 text-right">Solar (kW)</th>
                                        <th className="p-2 text-right">Load (kW)</th>
                                        <th className="p-2 text-center">Source</th>
                                        <th className="p-2 text-right text-emerald-600">Batt SOC</th>
                                        <th className="p-2 text-right text-red-600">Grid (kWh)</th>
                                        <th className="p-2 text-right text-amber-600">DG (kWh)</th>
                                        <th className="p-2 text-right text-blue-600">Net Cost (₹)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {simulationData.map((row, i) => (
                                        <tr
                                            key={i}
                                            className={`hover:bg-slate-50 transition-colors ${selectedHour === i ? 'bg-blue-50' : ''}`}
                                            onClick={() => { setSelectedHour(i); setIsSimPlaying(false); }}
                                        >
                                            <td className="p-2 font-mono text-center font-bold text-slate-400">{row.hour}:00</td>
                                            <td className="p-2 text-right font-mono">{row.solarKw.toFixed(1)}</td>
                                            <td className={`p-2 text-right font-mono ${row.isPeak ? 'font-bold text-red-600' : ''}`}>{row.loadKw.toFixed(1)}</td>
                                            <td className="p-2 text-center">
                                                {row.isIdle
                                                    ? <span className="bg-slate-100 text-slate-500 px-1 rounded font-bold">IDLE</span>
                                                    : (row.isOutage
                                                        ? (row.flows.dgToLoad > 0
                                                            ? <span className="bg-amber-100 text-amber-700 px-1 rounded font-bold">DG ON</span>
                                                            : (row.flows.batteryToLoad > 0
                                                                ? <span className="bg-red-100 text-red-700 px-1 rounded font-bold">BATT</span>
                                                                : <span className="bg-slate-100 text-slate-500 px-1 rounded">OFF</span>))
                                                        : (row.isExportPriority
                                                            ? <span className="bg-purple-100 text-purple-700 px-1 rounded font-bold">EXP</span>
                                                            : (!row.isFactoryOperating
                                                                ? <span className="bg-amber-50 text-amber-700 px-1 rounded">CLOSED</span>
                                                                : <span className="bg-emerald-50 text-emerald-600 px-1 rounded">GRID</span>)
                                                        )
                                                    )
                                                }
                                            </td>
                                            <td className="p-2 text-right font-mono font-bold">{row.socStart.toFixed(0)}%</td>
                                            <td className="p-2 text-right font-mono">{(row.flows.gridToLoad + row.flows.gridToBattery).toFixed(1)}</td>
                                            <td className="p-2 text-right font-mono text-amber-700 font-bold">{row.flows.dgToLoad > 0 ? row.flows.dgToLoad.toFixed(1) : '-'}</td>
                                            <td className="p-2 text-right font-mono font-bold text-blue-600">₹{row.financials.costActual.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                </div>
            </div>

            {/* AI INSIGHTS MODAL */}
            {showAiModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 flex justify-between items-center text-white">
                            <h3 className="font-bold flex items-center gap-2">
                                <Sparkles size={18} className="text-yellow-300" />
                                AI Energy Consultant
                            </h3>
                            <button onClick={() => setShowAiModal(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 min-h-[200px]">
                            {aiLoading ? (
                                <div className="flex flex-col items-center justify-center h-48 gap-4 text-slate-400">
                                    <Loader size={32} className="animate-spin text-purple-600" />
                                    <p className="text-sm font-medium animate-pulse">Analyzing system efficiency...</p>
                                </div>
                            ) : (
                                <div className="prose prose-sm prose-slate max-w-none">
                                    <div className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                                        {aiResponse}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {!aiLoading && (
                            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end">
                                <button
                                    onClick={() => setShowAiModal(false)}
                                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-bold transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div>
    );
}

// Reusable Input Field Component
const InputField = ({ label, icon: Icon, value, onChange, isInt = false, color = "text-slate-500", helper = null }) => (
    <div>
        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
            {Icon && <Icon size={12} className={color} />}
            {label}
        </label>
        <div className="mt-1">
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-slate-100 border-none rounded p-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500"
                step={isInt ? "1" : "0.01"}
            />
        </div>
        {helper && <p className={`text-[10px] mt-1 text-slate-500`}>{helper}</p>}
    </div>
);

// Reusable Select Field Component
const SelectField = ({ label, value, options, onChange }) => (
    <div>
        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
            {label}
        </label>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full text-sm bg-slate-100 border-none rounded p-2 focus:ring-2 focus:ring-blue-500"
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>
    </div>
);
