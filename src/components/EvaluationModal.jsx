import React, { useMemo, useEffect, useRef, useState } from "react";
import { useSolarStore } from "../stores/solarStore";
import { formatCurrency, formatEnergy } from "../utils/simulation";
import Chart from "chart.js/auto";
import { adminService } from "../lib/supabase";
import { X, Lightbulb, Plus, BatteryFull, TriangleAlert, CloudSun, AlertCircle, CheckCircle2, Loader2, Bot, Download } from 'lucide-react';

export default function EvaluationModal() {
  const isOpen = useSolarStore((state) => state.isEvaluationOpen);
  const setOpen = useSolarStore((state) => state.setEvaluationOpen);
  const evaluationData = useSolarStore((state) => state.evaluationData);
  const objects = useSolarStore((state) => state.objects);
  const wires = useSolarStore((state) => state.wires);

  const setBoqOverride = useSolarStore((state) => state.setBoqOverride);
  const removeBoqOverride = useSolarStore((state) => state.removeBoqOverride);
  const runEvaluation = useSolarStore((state) => state.runEvaluation);

  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemCost, setNewItemCost] = useState(0);

  const [aiValidationResult, setAiValidationResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  const handleAiValidation = async () => {
    setIsValidating(true);
    // 1. Identify implicit connections (Touching Panels)
    const panels = objects.filter(o => o.type === 'panel');
    const implicitWires = [];

    for (let i = 0; i < panels.length; i++) {
      for (let j = i + 1; j < panels.length; j++) {
        const p1 = panels[i];
        const p2 = panels[j];
        const margin = 0.2; // Match powerFlow.js margin
        const intersect = !(p2.x > p1.x + p1.w + margin ||
          p2.x + p2.w + margin < p1.x ||
          p2.y > p1.y + p1.h + margin ||
          p2.y + p2.h + margin < p1.y);

        if (intersect) {
          implicitWires.push({ from: p1.id, to: p2.id, type: 'dc_wire', implicit: true });
        }
      }
    }

    const allWires = [...wires, ...implicitWires];

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-system`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          objects,
          wires: allWires,
          systemStats: {
            dcCapacity: evaluationData.dcCapacity,
            acCapacity: evaluationData.acCapacity,
            batteryCapacity: evaluationData.batteryCapacity,
            systemCost: evaluationData.systemCost
          }
        })
      });
      const data = await response.json();
      setAiValidationResult(data);
    } catch (error) {
      console.error("AI Validation failed:", error);
      alert("AI Validation failed. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  const [plans, setPlans] = useState([]);
  const [additionalItems, setAdditionalItems] = useState([]);
  const [addItemType, setAddItemType] = useState('custom'); // custom, item, plan
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadAdminData();
    }
  }, [isOpen]);

  const loadAdminData = async () => {
    try {
      const [plns, items] = await Promise.all([
        adminService.getPlans(),
        adminService.getAdditionalItems()
      ]);
      setPlans(plns || []);
      setAdditionalItems(items || []);
    } catch (e) {
      console.error("Failed to load admin data for BOQ", e);
    }
  };

  const handleAddItem = async () => {
    if (addItemType === 'custom') {
      if (!newItemName) return;
      setBoqOverride(newItemName, { count: parseFloat(newItemQty), cost: parseFloat(newItemCost), type: 'custom' });
    } else if (addItemType === 'item') {
      const item = additionalItems.find(i => i.id === selectedItemId);
      if (!item) return;
      // Calculate cost with margin only (Tax is applied on total BOQ)
      const finalCost = item.cost * (1 + (item.margin || 0) / 100);

      setBoqOverride(item.name, { count: parseFloat(newItemQty), cost: finalCost, type: 'extra' });
    } else if (addItemType === 'plan') {
      const plan = plans.find(p => p.id === selectedPlanId);
      if (!plan) return;

      const pItems = await adminService.getPlanItems(plan.id);
      const products = await adminService.getAllProducts();

      pItems.forEach(pItem => {
        let name = 'Unknown';
        let cost = 0;

        if (pItem.item_type === 'equipment') {
          const prod = products.find(p => p.id === pItem.item_id);
          if (prod) {
            name = prod.name;
            // Cost with margin only
            cost = prod.cost * (1 + (prod.margin || 0) / 100);
          }
        } else {
          const item = additionalItems.find(i => i.id === pItem.item_id);
          if (item) {
            name = item.name;
            // Cost with margin only
            cost = item.cost * (1 + (item.margin || 0) / 100);
          }
        }

        if (name !== 'Unknown') {
          setBoqOverride(name, { count: pItem.quantity, cost: cost, type: 'extra' });
        }
      });
    }

    setNewItemName("");
    setNewItemQty(1);
    setNewItemCost(0);
    setShowAddItem(false);
    setTimeout(() => runEvaluation(), 500);
  };

  const chartRefs = {
    generation: useRef(null),
    roi: useRef(null),
  };

  const chartInstances = useRef({
    generation: null,
    roi: null,
  });

  const handleUpdateItem = (key, field, value) => {
    if (!evaluationData?.boq) return;
    const currentItem = evaluationData.boq[key];
    const newItem = { ...currentItem, [field]: parseFloat(value) || 0 };
    setBoqOverride(key, newItem);
    setTimeout(() => runEvaluation(), 0);
  };



  const handleDeleteItem = (key) => {
    const item = evaluationData.boq[key];
    if (item.type === 'custom' || item.type === 'extra') {
      removeBoqOverride(key);
    } else {
      // For generated items, set to 0 to "delete" them from calculation
      setBoqOverride(key, { count: 0, cost: 0, type: item.type });
    }
    setTimeout(() => runEvaluation(), 0);
  };

  // Initialize charts when data changes
  useEffect(() => {
    if (!isOpen || !evaluationData) return;

    // Monthly Generation Chart
    if (chartRefs.generation.current && evaluationData.monthlyData?.length > 0) {
      if (chartInstances.current.generation) {
        chartInstances.current.generation.destroy();
      }

      const ctx = chartRefs.generation.current.getContext("2d");
      chartInstances.current.generation = new Chart(ctx, {
        type: "bar",
        data: {
          labels: evaluationData.months || [],
          datasets: [
            {
              label: "Generation (kWh)",
              data: evaluationData.monthlyGenData || [],
              backgroundColor: "rgba(59, 130, 246, 0.8)",
              borderColor: "rgba(59, 130, 246, 1)",
              borderWidth: 1,
            },
            {
              label: "Load (kWh)",
              data: evaluationData.monthlyData.map((m) => m.load) || [],
              backgroundColor: "rgba(239, 68, 68, 0.5)",
              borderColor: "rgba(239, 68, 68, 1)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              labels: { color: "#fff" },
            },
            title: {
              display: true,
              text: "Monthly Generation vs Load",
              color: "#fff",
            },
          },
          scales: {
            x: {
              ticks: { color: "#ccc" },
              grid: { color: "rgba(255,255,255,0.1)" },
            },
            y: {
              ticks: { color: "#ccc" },
              grid: { color: "rgba(255,255,255,0.1)" },
            },
          },
        },
      });
    }

    // 25-Year ROI Chart
    if (chartRefs.roi.current && evaluationData.yearlyData?.length > 0) {
      if (chartInstances.current.roi) {
        chartInstances.current.roi.destroy();
      }

      const ctx = chartRefs.roi.current.getContext("2d");
      chartInstances.current.roi = new Chart(ctx, {
        type: "line",
        data: {
          labels: evaluationData.yearlyData.map((d) => `Y${d.year}`),
          datasets: [
            {
              label: "Cumulative Savings (₹)",
              data: evaluationData.yearlyData.map((d) => d.cumulative),
              borderColor: "rgba(34, 197, 94, 1)",
              backgroundColor: "rgba(34, 197, 94, 0.1)",
              borderWidth: 2,
              tension: 0.3,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              labels: { color: "#fff" },
            },
            title: {
              display: true,
              text: "25-Year Cumulative ROI",
              color: "#fff",
            },
          },
          scales: {
            x: {
              ticks: { color: "#ccc" },
              grid: { color: "rgba(255,255,255,0.1)" },
            },
            y: {
              ticks: { color: "#ccc" },
              grid: { color: "rgba(255,255,255,0.1)" },
            },
          },
        },
      });
    }

    return () => {
      if (chartInstances.current.generation) {
        chartInstances.current.generation.destroy();
      }
      if (chartInstances.current.roi) {
        chartInstances.current.roi.destroy();
      }
    };
  }, [isOpen, evaluationData]);

  if (!isOpen || !evaluationData) return null;

  const scoreColor =
    evaluationData.score > 80
      ? "text-green-400"
      : evaluationData.score > 50
        ? "text-yellow-400"
        : "text-red-400";

  const downloadReport = () => {
    let reportText = "SOLAR SYSTEM EVALUATION REPORT\n";
    reportText += "=" + "=".repeat(70) + "\n\n";

    reportText += "SYSTEM OVERVIEW\n";
    reportText += "-" + "-".repeat(70) + "\n";
    reportText += `DC Capacity: ${evaluationData.dcCapacity?.toFixed(2) || 0} kWp\n`;
    reportText += `AC Capacity: ${evaluationData.acCapacity?.toFixed(2) || 0} kW\n`;
    reportText += `Battery Capacity: ${evaluationData.batteryCapacity?.toFixed(2) || 0} kWh\n`;
    if (evaluationData.batteryBackupHours > 0) {
      reportText += `Est. Battery Backup: ${evaluationData.batteryBackupHours.toFixed(1)} Hours\n`;
    }
    reportText += `Annual Generation: ${formatEnergy(evaluationData.annualGeneration || 0)}\n`;
    reportText += `System Cost: ${formatCurrency(evaluationData.systemCost || 0)}\n`;
    reportText += `Performance Score: ${evaluationData.score}% - ${evaluationData.verdict}\n`;
    if (evaluationData.breakEvenYear) {
      reportText += `Payback Period: ${evaluationData.breakEvenYear - 1} Years ${evaluationData.breakEvenMonth} Months\n`;
    }
    reportText += `\n`;

    reportText += "BILL OF QUANTITIES (BOQ)\n";
    reportText += "-" + "-".repeat(70) + "\n";
    if (evaluationData.boq) {
      Object.entries(evaluationData.boq).forEach(([key, val]) => {
        reportText += `${key.padEnd(40)} | Qty: ${val.count.toString().padEnd(5)} | Cost: ${formatCurrency(val.cost)}\n`;
      });
    }
    reportText += "\n";

    reportText += "OPTIMIZATION SUGGESTIONS\n";
    reportText += "-" + "-".repeat(70) + "\n";
    if (evaluationData.suggestions && evaluationData.suggestions.length > 0) {
      evaluationData.suggestions.forEach((s) => {
        reportText += `• ${s}\n`;
      });
    } else {
      reportText += "No specific suggestions. System looks good!\n";
    }
    reportText += "\n";

    reportText += "VALIDATION RESULTS\n";
    reportText += "-" + "-".repeat(70) + "\n";
    evaluationData.validations.forEach((v) => {
      reportText += `${v}\n`;
    });
    if (evaluationData.issues.length > 0) {
      reportText += "\nIssues:\n";
      evaluationData.issues.forEach((i) => {
        reportText += `${i}\n`;
      });
    }
    reportText += "\n";

    reportText += "MONTHLY BREAKDOWN\n";
    reportText += "-" + "-".repeat(70) + "\n";
    reportText += "Month | Generation | Load | Net Export | Net Savings\n";
    evaluationData.monthlyData?.forEach((m) => {
      reportText += `${m.month.padEnd(6)} | ${m.generation.toFixed(1).padEnd(11)} | ${m.load.toFixed(1).padEnd(5)} | ${m.netExport.toFixed(1).padEnd(10)} | ${formatCurrency(m.netMeteringIncome)}\n`;
    });
    reportText += "\n";

    reportText += "25-YEAR PROJECTION (5-Year Summary)\n";
    reportText += "-" + "-".repeat(70) + "\n";
    reportText += "Year | Generation | Savings | AD Benefit | Cumulative | ROI Status\n";
    evaluationData.yearlyData?.forEach((d) => {
      if (d.year % 5 === 0 || d.year === 1 || d.year === 2) {
        reportText += `${d.year.toString().padEnd(5)} | ${formatEnergy(d.generation).padEnd(11)} | ${formatCurrency(d.savings).padEnd(8)} | ${formatCurrency(d.adBenefit || 0).padEnd(10)} | ${formatCurrency(d.cumulative).padEnd(11)} | ${d.roiStatus}\n`;
      }
    });

    reportText += "\n" + "=" + "=".repeat(70);
    reportText += `\nGenerated: ${new Date().toLocaleString()}\n`;

    const blob = new Blob([reportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solar-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-white">System Evaluation</h2>
            <p className="text-gray-400 text-sm mt-1">{evaluationData.verdict}</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-white text-3xl"
          >
            <X className="w-8 h-8" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Performance Score */}
          <div className="bg-gradient-to-r from-gray-700 to-gray-800 p-6 rounded-lg">
            <div className="flex items-center gap-8">
              <div className="flex-1">
                <h3 className="text-white font-bold mb-4">Performance Score</h3>
                <div className="flex items-center gap-4">
                  <div className="text-6xl font-bold" style={{ color: scoreColor.split("-")[2].replace("400", "500") }}>
                    {evaluationData.score}%
                  </div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-600 rounded-full h-8 overflow-hidden">
                      <div
                        className={`h-full transition-all ${evaluationData.score > 80
                          ? "bg-green-500"
                          : evaluationData.score > 50
                            ? "bg-yellow-500"
                            : "bg-red-500"
                          }`}
                        style={{ width: `${evaluationData.score}%` }}
                      ></div>
                    </div>
                    <p className={`text-sm mt-2 font-semibold ${scoreColor}`}>
                      {evaluationData.verdict}
                    </p>
                  </div>
                </div>
              </div>
              <div className="border-l border-gray-600 pl-6">
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-gray-400">Shadow Loss</p>
                    <p className="text-white font-bold">
                      {(evaluationData.shadowLoss * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Payback Period</p>
                    <p className="text-white font-bold">
                      {evaluationData.breakEvenYear
                        ? `${evaluationData.breakEvenYear - 1} Years ${evaluationData.breakEvenMonth} Months`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">System Cost</p>
                    <p className="text-white font-bold">
                      {formatCurrency(evaluationData.systemCost || 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* System Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-700 p-4 rounded">
              <div className="text-gray-400 text-xs uppercase">DC Capacity</div>
              <div className="text-2xl font-bold text-blue-400 mt-2">
                {evaluationData.dcCapacity?.toFixed(2) || 0} kWp
              </div>
            </div>
            <div className="bg-gray-700 p-4 rounded">
              <div className="text-gray-400 text-xs uppercase">AC Capacity</div>
              <div className="text-2xl font-bold text-green-400 mt-2">
                {evaluationData.acCapacity?.toFixed(2) || 0} kW
              </div>
            </div>
            <div className="bg-gray-700 p-4 rounded">
              <div className="text-gray-400 text-xs uppercase">Battery Backup</div>
              <div className="text-2xl font-bold text-yellow-400 mt-2">
                {(evaluationData.batteryBackupHours || 0) > 0
                  ? `${evaluationData.batteryBackupHours.toFixed(1)} hrs`
                  : `${(evaluationData.batteryCapacity || 0).toFixed(1)} kWh`}
              </div>
            </div>
            <div className="bg-gray-700 p-4 rounded">
              <div className="text-gray-400 text-xs uppercase">Annual Generation</div>
              <div className="text-2xl font-bold text-purple-400 mt-2">
                {formatEnergy(evaluationData.annualGeneration || 0)}
              </div>
            </div>
          </div>

          {/* Optimization Suggestions */}
          {evaluationData.suggestions && evaluationData.suggestions.length > 0 && (
            <div className="bg-gray-700 p-4 rounded border-l-4 border-blue-500">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-400" /> Optimization Suggestions
              </h3>
              <ul className="space-y-2">
                {evaluationData.suggestions.map((suggestion, idx) => (
                  <li key={idx} className="text-gray-300 text-sm flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Bill of Quantities (BOQ) */}
          {evaluationData.boq && (
            <div className="bg-gray-700 p-4 rounded">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-white font-bold">Bill of Quantities (BOQ)</h3>
                <button
                  onClick={() => setShowAddItem(!showAddItem)}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition"
                >
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </div>

              {/* Simulation Status & Battery Meter */}
              {evaluationData.batteryCapacity > 0 && (
                <div className="bg-gray-800 p-3 rounded mb-4 border border-gray-600">
                  <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Battery Status</h4>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Capacity: {evaluationData.batteryCapacity} kWh</span>
                        <span>Backup: {evaluationData.batteryBackupHours.toFixed(1)} hrs</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div className="bg-green-500 h-2.5 rounded-full" style={{ width: '100%' }}></div>
                      </div>
                    </div>
                    <div className="text-center">
                      <BatteryFull className="w-8 h-8 text-green-500" />
                    </div>
                  </div>
                </div>
              )}

              {/* Simulation Logs / Issues */}
              {evaluationData.issues && evaluationData.issues.length > 0 && (
                <div className="bg-red-900/30 border border-red-700 p-3 rounded mb-4">
                  <h4 className="text-xs font-bold text-red-400 uppercase mb-2">Simulation Issues</h4>
                  <ul className="text-xs space-y-1 text-red-200">
                    {evaluationData.issues.map((issue, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <TriangleAlert className="w-3 h-3 mt-0.5" />
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}



              {/* Add Item Form */}
              {showAddItem && (
                <div className="bg-gray-800 p-3 rounded mb-3 flex flex-col gap-2 animate-fade-in border border-gray-600">
                  <div className="flex gap-2 mb-2">
                    <button onClick={() => setAddItemType('custom')} className={`text-xs px-2 py-1 rounded ${addItemType === 'custom' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>Custom</button>
                    <button onClick={() => setAddItemType('item')} className={`text-xs px-2 py-1 rounded ${addItemType === 'item' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>From List</button>
                    <button onClick={() => setAddItemType('plan')} className={`text-xs px-2 py-1 rounded ${addItemType === 'plan' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>Apply Plan</button>
                  </div>

                  <div className="flex gap-2 items-end">
                    {addItemType === 'custom' && (
                      <div className="flex-1">
                        <label className="text-xs text-gray-400 block mb-1">Item Name</label>
                        <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none" placeholder="e.g. Installation" />
                      </div>
                    )}

                    {addItemType === 'item' && (
                      <div className="flex-1">
                        <label className="text-xs text-gray-400 block mb-1">Select Item</label>
                        <select value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)} className="w-full bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none">
                          <option value="">-- Select --</option>
                          {additionalItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                      </div>
                    )}

                    {addItemType === 'plan' && (
                      <div className="flex-1">
                        <label className="text-xs text-gray-400 block mb-1">Select Plan</label>
                        <select value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)} className="w-full bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none">
                          <option value="">-- Select --</option>
                          {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    )}

                    {addItemType !== 'plan' && (
                      <>
                        <div className="w-20">
                          <label className="text-xs text-gray-400 block mb-1">Qty</label>
                          <input type="number" value={newItemQty} onChange={e => setNewItemQty(e.target.value)} className="w-full bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none" />
                        </div>
                        {addItemType === 'custom' && (
                          <div className="w-24">
                            <label className="text-xs text-gray-400 block mb-1">Cost (₹)</label>
                            <input type="number" value={newItemCost} onChange={e => setNewItemCost(e.target.value)} className="w-full bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none" />
                          </div>
                        )}
                      </>
                    )}

                    <button onClick={handleAddItem} className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded h-8 transition">Add</button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-600">
                      <th className="text-left py-2 px-2 text-gray-300">Item</th>
                      <th className="text-right py-2 px-2 text-gray-300">Quantity</th>
                      <th className="text-right py-2 px-2 text-gray-300">Est. Cost</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(evaluationData.boq).map(([key, val]) => (
                      <tr key={key} className="border-b border-gray-600 hover:bg-gray-600 group">
                        <td className="py-2 px-2 text-white">{key}</td>
                        <td className="text-right py-2 px-2">
                          <input
                            type="number"
                            value={val.count}
                            onChange={(e) => handleUpdateItem(key, 'count', e.target.value)}
                            className="w-16 bg-transparent text-right text-blue-400 border-b border-transparent hover:border-gray-500 focus:border-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="text-right py-2 px-2">
                          <input
                            type="number"
                            value={val.cost}
                            onChange={(e) => handleUpdateItem(key, 'cost', e.target.value)}
                            className="w-24 bg-transparent text-right text-green-400 border-b border-transparent hover:border-gray-500 focus:border-green-500 focus:outline-none"
                          />
                        </td>
                        <td className="text-center">
                          <button
                            onClick={() => handleDeleteItem(key)}
                            className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-300 transition"
                            title="Remove/Reset"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-600 font-bold">
                      <td className="py-2 px-2 text-white">Total</td>
                      <td className="text-right py-2 px-2"></td>
                      <td className="text-right py-2 px-2 text-green-400">{formatCurrency(evaluationData.systemCost || 0)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detailed Shadow Loss Analysis */}
          {evaluationData.panelLosses && evaluationData.panelLosses.length > 0 && (
            <div className="bg-gray-700 p-4 rounded overflow-x-auto">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <CloudSun className="w-5 h-5 text-yellow-400" /> Per-Panel Shadow Analysis
              </h3>
              <p className="text-xs text-gray-400 mb-2">
                Detailed shadow report simulating micro-inverter level monitoring.
                Shows estimated annual energy loss due to shading from nearby structures.
              </p>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-600 sticky top-0 bg-gray-700">
                      <th className="text-left py-2 px-2 text-gray-300">Panel ID/Label</th>
                      <th className="text-right py-2 px-2 text-gray-300">Shadow Loss</th>
                      <th className="text-right py-2 px-2 text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluationData.panelLosses.map((p) => (
                      <tr key={p.id} className="border-b border-gray-600 hover:bg-gray-600">
                        <td className="py-2 px-2 text-white font-mono">{p.label} <span className="text-gray-500 text-[10px] ml-1">({p.id.slice(-4)})</span></td>
                        <td className="text-right py-2 px-2">
                          <span className={`${p.lossPct > 0.05 ? 'text-red-400 font-bold' : 'text-green-400'}`}>
                            {(p.lossPct * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-right py-2 px-2">
                          {p.lossPct > 0.20 ? (
                            <span className="text-red-500 font-bold flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Critical</span>
                          ) : p.lossPct > 0.05 ? (
                            <span className="text-yellow-500 flex items-center gap-1"><TriangleAlert className="w-4 h-4" /> Warning</span>
                          ) : (
                            <span className="text-green-500 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Good</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Charts */}
          {evaluationData.monthlyData?.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-gray-700 p-4 rounded">
                <canvas ref={chartRefs.generation}></canvas>
              </div>
              <div className="bg-gray-700 p-4 rounded">
                <canvas ref={chartRefs.roi}></canvas>
              </div>
            </div>
          )}

          {/* Monthly Breakdown Table */}
          {evaluationData.monthlyData?.length > 0 && (
            <div className="bg-gray-700 p-4 rounded overflow-x-auto">
              <h3 className="text-white font-bold mb-3">Monthly Breakdown</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-600">
                    <th className="text-left py-2 px-2 text-gray-300">Month</th>
                    <th className="text-right py-2 px-2 text-gray-300">Gen (kWh)</th>
                    <th className="text-right py-2 px-2 text-gray-300">Load (kWh)</th>
                    <th className="text-right py-2 px-2 text-gray-300">Export (kWh)</th>
                    <th className="text-right py-2 px-2 text-gray-300">Savings (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluationData.monthlyData.map((month) => (
                    <tr key={month.month} className="border-b border-gray-600 hover:bg-gray-600">
                      <td className="py-2 px-2 text-white">{month.month}</td>
                      <td className="text-right py-2 px-2 text-blue-400">
                        {month.generation.toFixed(1)}
                      </td>
                      <td className="text-right py-2 px-2 text-red-400">
                        {month.load.toFixed(1)}
                      </td>
                      <td className="text-right py-2 px-2 text-green-400">
                        {month.netExport.toFixed(1)}
                      </td>
                      <td className="text-right py-2 px-2 text-yellow-400">
                        {formatCurrency(month.netMeteringIncome)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 25-Year Projection Table */}
          {evaluationData.yearlyData?.length > 0 && (
            <div className="bg-gray-700 p-4 rounded overflow-x-auto">
              <h3 className="text-white font-bold mb-3">25-Year Projection (5-Year Intervals)</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-600">
                    <th className="text-left py-2 px-2 text-gray-300">Year</th>
                    <th className="text-right py-2 px-2 text-gray-300">Generation</th>
                    <th className="text-right py-2 px-2 text-gray-300">Energy Savings</th>
                    <th className="text-right py-2 px-2 text-gray-300">AD Benefit</th>
                    <th className="text-right py-2 px-2 text-gray-300">Cumulative</th>
                    <th className="text-left py-2 px-2 text-gray-300">ROI Status</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluationData.yearlyData.map((year) => {
                    if (year.year % 5 === 0 || year.year === 1 || year.year === 2) {
                      return (
                        <tr key={year.year} className="border-b border-gray-600 hover:bg-gray-600">
                          <td className="py-2 px-2 text-white font-bold">Year {year.year}</td>
                          <td className="text-right py-2 px-2 text-blue-400">
                            {formatEnergy(year.generation)}
                          </td>
                          <td className="text-right py-2 px-2 text-green-400">
                            {formatCurrency(year.energySavings)}
                          </td>
                          <td className="text-right py-2 px-2 text-purple-400">
                            {year.adBenefit > 0 ? formatCurrency(year.adBenefit) : '-'}
                          </td>
                          <td className="text-right py-2 px-2 text-yellow-400 font-bold">
                            {formatCurrency(year.cumulative)}
                          </td>
                          <td className="py-2 px-2">
                            <span
                              className={`px-2 py-1 rounded text-xs font-bold ${year.roiStatus === "Break Even"
                                ? "bg-yellow-600 text-yellow-100"
                                : year.roiStatus === "Profitable"
                                  ? "bg-green-600 text-green-100"
                                  : "bg-red-600 text-red-100"
                                }`}
                            >
                              {year.roiStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    }
                    return null;
                  })}
                </tbody>
              </table>
              {evaluationData.breakEvenYear && (
                <p className="text-green-400 font-bold mt-3">
                  Break-Even achieved in {evaluationData.breakEvenYear - 1} Years {evaluationData.breakEvenMonth} Months
                </p>
              )}
            </div>
          )}

          {/* Validation Checks */}
          <div className="bg-gray-700 p-4 rounded">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-bold">Validation Checks</h3>
              <button
                onClick={handleAiValidation}
                disabled={isValidating}
                className={`text-xs px-3 py-1.5 rounded font-bold transition flex items-center gap-2 ${isValidating ? 'bg-gray-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Validating...
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4" /> Validate with AI
                  </>
                )}
              </button>
            </div>

            <div className="space-y-2">
              {evaluationData.validations?.map((v, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-green-400">✓</span>
                  <span className="text-gray-300">{v}</span>
                </div>
              ))}
              {evaluationData.issues?.map((issue, i) => (
                <div key={`issue-${i}`} className="flex items-center gap-2 text-sm">
                  <span className={issue.startsWith("ERROR") ? "text-red-400" : "text-yellow-400"}>
                    {issue.startsWith("ERROR") ? "✗" : "⚠"}
                  </span>
                  <span
                    className={
                      issue.startsWith("ERROR") ? "text-red-300" : "text-yellow-300"
                    }
                  >
                    {issue}
                  </span>
                </div>
              ))}
            </div>

            {/* AI Validation Result */}
            {aiValidationResult && (
              <div className="mt-4 border-t border-gray-600 pt-4 animate-fade-in">
                <h4 className="text-purple-300 font-bold mb-2 flex items-center gap-2">
                  <Bot className="w-5 h-5" /> AI Validation Report
                </h4>
                <div className="bg-gray-800 p-3 rounded border border-purple-500/30">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-sm font-bold ${aiValidationResult.valid ? 'text-green-400' : 'text-red-400'}`}>
                      {aiValidationResult.valid ? 'System Valid' : 'Issues Found'}
                    </span>
                    <span className="text-xs text-gray-400">Score: {aiValidationResult.score}/100</span>
                  </div>
                  <p className="text-sm text-gray-300 mb-3 italic">"{aiValidationResult.summary}"</p>

                  {aiValidationResult.issues?.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs font-bold text-red-400 uppercase mb-1">Critical Issues</div>
                      <ul className="list-disc list-inside text-xs text-red-300 space-y-1">
                        {aiValidationResult.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                      </ul>
                    </div>
                  )}

                  {aiValidationResult.recommendations?.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-blue-400 uppercase mb-1">Recommendations</div>
                      <ul className="list-disc list-inside text-xs text-blue-300 space-y-1">
                        {aiValidationResult.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={downloadReport}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold transition flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download Report
            </button>
            <button
              onClick={() => setOpen(false)}
              className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
