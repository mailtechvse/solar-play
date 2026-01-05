import React, { useState } from "react";
import { useSolarStore } from "../stores/solarStore";
import EquipmentPalette from "./EquipmentPalette";
import {
  Plus,
  X,
  Link,
  Link2Off,
  MousePointer2,
  Hand,
  Ruler,
  Eraser,
  Spline,
  Zap,
  Leaf,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

export default function LeftSidebar() {
  // Financial & Project State
  const gridRate = useSolarStore((state) => state.gridRate);
  const exportRate = useSolarStore((state) => state.exportRate);
  const baseLoad = useSolarStore((state) => state.baseLoad);
  const systemCost = useSolarStore((state) => state.systemCost);
  const isCommercial = useSolarStore((state) => state.isCommercial);
  const extraCostItems = useSolarStore((state) => state.extraCostItems);
  const addExtraCostItem = useSolarStore((state) => state.addExtraCostItem);
  const removeExtraCostItem = useSolarStore((state) => state.removeExtraCostItem);

  // Actions
  const setGridRate = useSolarStore((state) => state.setGridRate);
  const setExportRate = useSolarStore((state) => state.setExportRate);
  const setBaseLoad = useSolarStore((state) => state.setBaseLoad);
  const setSystemCost = useSolarStore((state) => state.setSystemCost);
  const setIsCommercial = useSolarStore((state) => state.setIsCommercial);
  const setMode = useSolarStore((state) => state.setMode);
  const setDrawingMode = useSolarStore((state) => state.setDrawingMode);
  const setDrawingType = useSolarStore((state) => state.setDrawingType);
  const setCustomComponentOpen = useSolarStore((state) => state.setCustomComponentOpen);
  const addObject = useSolarStore((state) => state.addObject);
  const mode = useSolarStore((state) => state.mode);
  const setSelectedObject = useSolarStore((state) => state.setSelectedObject);
  const selectedObjectId = useSolarStore((state) => state.selectedObjectId);
  const objects = useSolarStore((state) => state.objects);
  const deleteObject = useSolarStore((state) => state.deleteObject);
  const setSelectedPreset = useSolarStore((state) => state.setSelectedPreset);

  // Equipment
  const equipmentLibrary = useSolarStore((state) => state.equipmentLibrary);

  // Drawing mode state
  const drawingMode = useSolarStore((state) => state.drawingMode);
  const drawingType = useSolarStore((state) => state.drawingType);
  const selectedPanelType = useSolarStore((state) => state.selectedPanelType);

  // Filter equipment
  const panels = equipmentLibrary['solar_panel'] || [];
  const inverters = equipmentLibrary['inverter'] || [];
  const batteries = equipmentLibrary['battery'] || [];
  const bos = equipmentLibrary['bos'] || [];

  const handleAddMeter = (type, label, color, cost = 5000) => {
    const preset = {
      type: type,
      name: label,
      cost: cost,
      color: color,
      width: 0.6,
      height: 0.8,
      h_z: 1.5,
      isOn: true,
      equipment_types: { name: type }
    };
    setMode("place");
    setSelectedPreset(preset);
  };

  const handleAddLoadBox = () => {
    const preset = {
      type: "load",
      name: "Load Box",
      cost: 0,
      color: "#f97316",
      width: 1,
      height: 1,
      h_z: 0,
      units: 100,
      equipment_types: { name: "load" }
    };
    setMode("place");
    setSelectedPreset(preset);
  };

  const handleSetDrawing = (mode, type) => {
    setDrawingMode(mode);
    setDrawingType(type);
  };

  // Accordion state
  const [sections, setSections] = useState({
    pvModules: true,
    inverters: true,
    batteries: true,
    grid: true,
    structures: true,
  });

  const toggleSection = (section) => {
    setSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="w-80 bg-white text-gray-800 flex flex-col border-r border-gray-300 shrink-0 z-10 shadow-xl font-sans h-full overflow-hidden">

      {/* Scenario & Load */}
      <div className="p-3 border-b border-gray-200 bg-gray-50 space-y-2">
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Project Scenario</label>
          <select
            className="w-full mt-1 p-1.5 border border-gray-300 rounded bg-white text-sm focus:outline-none focus:border-blue-500"
            onChange={(e) => setIsCommercial(e.target.value === 'commercial')}
            value={isCommercial ? 'commercial' : 'residential'}
          >
            <option value="residential">Residential Rooftop</option>
            <option value="commercial">Commercial Ground Mount</option>
          </select>
        </div>
      </div>

      {/* Financials */}
      <div className="p-3 border-b border-gray-200 bg-green-50 space-y-2">
        <label className="text-[10px] font-bold text-green-800 uppercase tracking-wider">Financials (INR)</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase">Grid Rate (₹/Unit)</label>
            <input
              type="number"
              value={gridRate}
              onChange={(e) => setGridRate(parseFloat(e.target.value))}
              step="0.1"
              className="w-full mt-1 p-1 border rounded text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase">Export Rate (₹/Unit)</label>
            <input
              type="number"
              value={exportRate}
              onChange={(e) => setExportRate(parseFloat(e.target.value))}
              step="0.1"
              className="w-full mt-1 p-1 border rounded text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase">Load (Units/Mo)</label>
            <input
              type="number"
              value={baseLoad}
              onChange={(e) => setBaseLoad(parseFloat(e.target.value))}
              className="w-full mt-1 p-1 border rounded text-xs"
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Plant Cost (₹)</label>
            <span className="text-[9px] text-gray-400 cursor-pointer underline">Auto</span>
          </div>
          <input
            type="number"
            value={systemCost}
            onChange={(e) => setSystemCost(parseFloat(e.target.value))}
            className="w-full mt-1 p-1 border rounded text-xs font-bold text-green-700"
            placeholder="Auto Calculated"
          />
        </div>
      </div>

      {/* Extras */}
      <div className="p-3 border-b border-gray-200 bg-yellow-50 space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-[10px] font-bold text-yellow-800 uppercase tracking-wider">Extra Costs</label>
          <button
            onClick={() => {
              const label = prompt("Item Name:");
              const cost = parseFloat(prompt("Cost (₹):"));
              if (label && !isNaN(cost)) {
                addExtraCostItem({ id: Math.random().toString(), label, cost });
              }
            }}
            className="text-[9px] bg-yellow-200 hover:bg-yellow-300 px-1.5 py-0.5 rounded border border-yellow-300 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        <div className="space-y-1 max-h-20 overflow-y-auto">
          {extraCostItems.map(item => (
            <div key={item.id} className="flex justify-between items-center text-[10px] bg-white p-1 rounded border border-yellow-200">
              <span className="truncate flex-1">{item.label}</span>
              <span className="font-mono mx-1">₹{item.cost}</span>
              <button onClick={() => removeExtraCostItem(item.id)} className="text-red-500 hover:text-red-700">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {extraCostItems.length === 0 && <div className="text-[9px] text-gray-400 italic">No extra items</div>}
        </div>
      </div>

      {/* Layers (Placeholder for now) */}
      <div className="flex-1 flex flex-col min-h-[100px] max-h-[150px] border-b border-gray-200">
        <div className="p-2 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Objects ({objects.length})</label>
          <div className="flex gap-1">
            <button className="text-[9px] bg-gray-200 hover:bg-gray-300 px-1.5 py-0.5 rounded border border-gray-300 flex items-center gap-1" title="Group Selected">
              <Link className="w-3 h-3" /> Group
            </button>
            <button className="text-[9px] bg-gray-200 hover:bg-gray-300 px-1.5 py-0.5 rounded border border-gray-300" title="Ungroup Selected">
              <Link2Off className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-white p-1">
          {objects.length === 0 ? (
            <p className="text-[10px] text-gray-400 italic text-center py-2">No objects</p>
          ) : (
            <div className="space-y-0.5">
              {objects.map((obj) => (
                <div
                  key={obj.id}
                  onClick={() => setSelectedObject(obj.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    deleteObject(obj.id);
                  }}
                  className={`p-1.5 rounded text-[10px] cursor-pointer truncate transition ${selectedObjectId === obj.id
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                    }`}
                  title={`${obj.label || obj.type} (Right-click to delete)`}
                >
                  <div className="flex items-center gap-1">
                    <div
                      className="w-2.5 h-2.5 rounded border border-gray-400"
                      style={{ backgroundColor: obj.color || '#1e3a8a' }}
                    ></div>
                    <span className="flex-1">{obj.label || obj.type}</span>
                    {obj.h_z > 0 && <span className="text-[9px] text-gray-500">{obj.h_z.toFixed(1)}m</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tools - Scrollable Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col p-2 space-y-4">

          {/* Main Tools */}
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-1">Main Tools</div>
            <div className="grid grid-cols-4 gap-1">
              <button
                onClick={() => setMode('select')}
                className={`p-2 rounded border flex flex-col items-center gap-1 text-[10px] font-medium transition ${mode === 'select' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <MousePointer2 className="w-4 h-4" /> Select
              </button>
              <button
                onClick={() => setMode('pan')}
                className={`p-2 rounded border flex flex-col items-center gap-1 text-[10px] font-medium transition ${mode === 'pan' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <Hand className="w-4 h-4" /> Pan
              </button>
              <button
                onClick={() => setMode('measure')}
                className={`p-2 rounded border flex flex-col items-center gap-1 text-[10px] font-medium transition ${mode === 'measure' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <Ruler className="w-4 h-4 text-blue-600" /> Measure
              </button>
              <button
                onClick={() => setMode('delete')}
                className={`p-2 rounded border flex flex-col items-center gap-1 text-[10px] font-medium transition ${mode === 'delete' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 hover:bg-red-50 hover:text-red-600'}`}
              >
                <Eraser className="w-4 h-4" /> Delete
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1 mt-1">
              <button
                onClick={() => setMode('wire_dc')}
                className={`p-2 rounded border flex flex-col items-center gap-1 text-[10px] font-medium transition ${mode === 'wire_dc' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <Spline className="w-4 h-4 text-red-500" /> DC Wire
              </button>
              <button
                onClick={() => setMode('wire_ac')}
                className={`p-2 rounded border flex flex-col items-center gap-1 text-[10px] font-medium transition ${mode === 'wire_ac' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <Zap className="w-4 h-4 text-yellow-500" /> AC Wire
              </button>
              <button
                onClick={() => setMode('earthing')}
                className={`p-2 rounded border flex flex-col items-center gap-1 text-[10px] font-medium transition ${mode === 'earthing' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <Leaf className="w-4 h-4 text-green-600" /> Earthing
              </button>
            </div>
          </div>

          {/* PV Modules */}
          <div>
            <div
              className="flex justify-between items-center px-1 mb-1 cursor-pointer hover:bg-gray-50 rounded"
              onClick={() => toggleSection('pvModules')}
            >
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                {sections.pvModules ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                PV Modules
              </span>
              <button onClick={(e) => { e.stopPropagation(); setCustomComponentOpen(true); }} className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded hover:bg-blue-200 flex items-center gap-1">
                <Plus className="w-3 h-3" />
              </button>
            </div>
            {sections.pvModules && (
              <div className="space-y-1 h-64 overflow-y-auto pr-1 border border-gray-100 rounded p-1">
                {panels.map((equipment) => (
                  <EquipmentPalette key={equipment.id} equipment={equipment} />
                ))}
                {panels.length === 0 && <div className="text-xs text-gray-400 text-center py-4">No panels available</div>}
              </div>
            )}
          </div>

          {/* Inverters */}
          <div>
            <div
              className="flex justify-between items-center px-1 mb-1 cursor-pointer hover:bg-gray-50 rounded"
              onClick={() => toggleSection('inverters')}
            >
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                {sections.inverters ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Inverters
              </span>
              <button onClick={(e) => { e.stopPropagation(); setCustomComponentOpen(true); }} className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded hover:bg-blue-200 flex items-center gap-1">
                <Plus className="w-3 h-3" />
              </button>
            </div>
            {sections.inverters && (
              <div className="space-y-1 h-40 overflow-y-auto pr-1 border border-gray-100 rounded p-1">
                {inverters.map((equipment) => (
                  <EquipmentPalette key={equipment.id} equipment={equipment} />
                ))}
                {inverters.length === 0 && <div className="text-xs text-gray-400 text-center py-4">No inverters available</div>}
              </div>
            )}
          </div>

          {/* Batteries */}
          <div>
            <div
              className="flex justify-between items-center px-1 mb-1 cursor-pointer hover:bg-gray-50 rounded"
              onClick={() => toggleSection('batteries')}
            >
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                {sections.batteries ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Batteries
              </span>
              <button onClick={(e) => { e.stopPropagation(); setCustomComponentOpen(true); }} className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded hover:bg-blue-200 flex items-center gap-1">
                <Plus className="w-3 h-3" />
              </button>
            </div>
            {sections.batteries && (
              <div className="space-y-1 h-40 overflow-y-auto pr-1 border border-gray-100 rounded p-1">
                {batteries.map((equipment) => (
                  <EquipmentPalette key={equipment.id} equipment={equipment} />
                ))}
                {batteries.length === 0 && <div className="text-xs text-gray-400 text-center py-4">No batteries available</div>}
              </div>
            )}
          </div>

          {/* Grid & Distribution */}
          <div>
            <div
              className="flex justify-between items-center px-1 mb-1 cursor-pointer hover:bg-gray-50 rounded"
              onClick={() => toggleSection('grid')}
            >
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                {sections.grid ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Grid & Distribution
              </span>
              <button onClick={(e) => { e.stopPropagation(); setCustomComponentOpen(true); }} className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded hover:bg-blue-200 flex items-center gap-1">
                <Plus className="w-3 h-3" />
              </button>
            </div>
            {sections.grid && (
              <div className="grid grid-cols-2 gap-1 h-64 overflow-y-auto pr-1 border border-gray-100 rounded p-1">
                {bos.map((equipment) => (
                  <EquipmentPalette key={equipment.id} equipment={equipment} />
                ))}
                <button
                  onClick={handleAddLoadBox}
                  className="p-2 rounded border border-gray-200 cursor-pointer text-center bg-orange-50 text-orange-900 hover:bg-orange-100"
                >
                  <div className="font-bold text-[10px]">Load (Consumer)</div>
                </button>
                <button
                  onClick={() => handleAddMeter("net_meter", "Net Meter", "#10b981", 15000)}
                  className="p-2 rounded border border-gray-200 cursor-pointer text-center bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                >
                  <div className="font-bold text-[10px]">Net Meter</div>
                </button>
                <button
                  onClick={() => handleAddMeter("gross_meter", "Gross Meter", "#0ea5e9", 12000)}
                  className="p-2 rounded border border-gray-200 cursor-pointer text-center bg-sky-50 text-sky-900 hover:bg-sky-100"
                >
                  <div className="font-bold text-[10px]">Gross Meter</div>
                </button>
                <button
                  onClick={() => handleAddMeter("grid", "Grid Connection", "#6366f1", 0)}
                  className="p-2 rounded border border-gray-200 cursor-pointer text-center bg-indigo-50 text-indigo-900 hover:bg-indigo-100"
                >
                  <div className="font-bold text-[10px]">Grid Point</div>
                </button>
                <button
                  onClick={() => handleAddMeter("transformer", "Transformer", "#f59e0b", 250000)}
                  className="p-2 rounded border border-gray-200 cursor-pointer text-center bg-amber-50 text-amber-900 hover:bg-amber-100"
                >
                  <div className="font-bold text-[10px]">Transformer</div>
                </button>
                <button
                  onClick={() => handleAddMeter("lt_panel", "LT Panel", "#475569", 50000)}
                  className="p-2 rounded border border-gray-200 cursor-pointer text-center bg-slate-50 text-slate-900 hover:bg-slate-100"
                >
                  <div className="font-bold text-[10px]">LT Panel</div>
                </button>
                <button
                  onClick={() => handleAddMeter("ht_panel", "HT Panel", "#dc2626", 200000)}
                  className="p-2 rounded border border-gray-200 cursor-pointer text-center bg-red-50 text-red-900 hover:bg-red-100"
                >
                  <div className="font-bold text-[10px]">HT Panel</div>
                </button>
                <button
                  onClick={() => handleAddMeter("acdb", "ACDB Box", "#64748b", 8000)}
                  className="p-2 rounded border border-gray-200 cursor-pointer text-center bg-slate-100 text-slate-800 hover:bg-slate-200"
                >
                  <div className="font-bold text-[10px]">ACDB Box</div>
                </button>
                <button
                  onClick={() => handleAddMeter("vcb", "VCB", "#7f1d1d", 150000)}
                  className="p-2 rounded border border-gray-200 cursor-pointer text-center bg-red-100 text-red-900 hover:bg-red-200"
                >
                  <div className="font-bold text-[10px]">VCB</div>
                </button>
                <button
                  onClick={() => handleAddMeter("acb", "ACB", "#334155", 80000)}
                  className="p-2 rounded border border-gray-200 cursor-pointer text-center bg-slate-200 text-slate-900 hover:bg-slate-300"
                >
                  <div className="font-bold text-[10px]">ACB</div>
                </button>
                <button
                  onClick={() => handleAddMeter("bess", "BESS System", "#059669", 500000)}
                  className="p-2 rounded border border-gray-200 cursor-pointer text-center bg-emerald-100 text-emerald-900 hover:bg-emerald-200 col-span-2"
                >
                  <div className="font-bold text-[10px]">BESS (PCS+STS+Batt)</div>
                </button>
                <button
                  onClick={() => handleAddMeter("pss", "Power Switching", "#d97706", 45000)}
                  className="p-2 rounded border border-gray-200 cursor-pointer text-center bg-amber-100 text-amber-900 hover:bg-amber-200 col-span-2"
                >
                  <div className="font-bold text-[10px]">Power Switching (PLC)</div>
                </button>
                <button
                  onClick={() => handleAddMeter("master_plc", "Plant Controller", "#4b5563", 150000)}
                  className="p-2 rounded border border-gray-200 cursor-pointer text-center bg-gray-100 text-gray-900 hover:bg-gray-200 col-span-2"
                >
                  <div className="font-bold text-[10px]">Plant Controller (SCADA)</div>
                </button>
              </div>
            )}
          </div>

          {/* Structures */}
          <div>
            <div
              className="flex justify-between items-center px-1 mb-1 cursor-pointer hover:bg-gray-50 rounded"
              onClick={() => toggleSection('structures')}
            >
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                {sections.structures ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Structures & Buildings
              </span>
            </div>
            {sections.structures && (
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => handleSetDrawing('rectangle', 'structure')}
                  className={`p-2 rounded border flex items-center gap-2 text-xs text-left transition ${drawingMode === 'rectangle' && drawingType === 'structure'
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  title="Draw rectangular roof (drag to draw)"
                >
                  <div className="w-3 h-3 bg-gray-600 rounded-sm"></div> RCC Roof
                </button>
                <button
                  onClick={() => handleSetDrawing('rectangle', 'tinshed')}
                  className={`p-2 rounded border flex items-center gap-2 text-xs text-left transition ${drawingMode === 'rectangle' && drawingType === 'tinshed'
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  title="Draw metal shed (drag to draw)"
                >
                  <div className="w-3 h-3 bg-blue-200 rounded-sm"></div> Tin Shed
                </button>
                <button
                  onClick={() => handleSetDrawing('rectangle', 'structure')}
                  className={`p-2 rounded border flex items-center gap-2 text-xs text-left transition ${drawingMode === 'rectangle' && drawingType === 'structure'
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  title="Draw building (drag to draw)"
                >
                  <div className="w-3 h-3 bg-gray-400 rounded-sm"></div> Building
                </button>
                <button
                  onClick={() => handleSetDrawing('freehand', 'tree')}
                  className={`p-2 rounded border flex items-center gap-2 text-xs text-left transition ${drawingMode === 'freehand' && drawingType === 'tree'
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  title="Draw tree area (drag to draw)"
                >
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div> Tree Area
                </button>
                <button
                  onClick={() => handleSetDrawing('rectangle', 'obstacle')}
                  className={`p-2 rounded border flex items-center gap-2 text-xs text-left col-span-2 transition ${drawingMode === 'rectangle' && drawingType === 'obstacle'
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  title="Draw chimney or obstruction (drag to draw)"
                >
                  <div className="w-3 h-3 bg-red-400 rounded-sm"></div> Chimney / Obstruction
                </button>
                <button
                  onClick={() => handleSetDrawing('rectangle', 'panel_array')}
                  className={`p-2 rounded border flex items-center gap-2 text-xs text-left col-span-2 transition ${drawingMode === 'rectangle' && drawingType === 'panel_array'
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  title="Draw solar panel array (drag to fill)"
                >
                  <div className="w-3 h-3 bg-blue-600 rounded-sm"></div> Draw Panel Array
                </button>
              </div>
            )}
            <div className="col-span-2">
              {selectedPanelType && (
                <div className="text-[9px] bg-blue-50 border border-blue-200 p-2 rounded text-blue-800">
                  <div className="font-bold">Selected Panel:</div>
                  <div className="text-blue-700">{selectedPanelType.label}</div>
                  <div className="text-[8px] text-blue-600">{selectedPanelType.watts}W • ₹{parseInt(selectedPanelType.cost).toLocaleString()}</div>
                  <div className="text-[8px] text-blue-600 mt-1 border-t border-blue-200 pt-1">
                    💡 Click & drag on canvas to place array
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div >
  );
}
