import React, { useState } from "react";
import { useSolarStore } from "../stores/solarStore";
import { equipmentService, supabase } from "../lib/supabase";
import { Loader2, Sparkles, X, FileMinus, Upload, Trash2, Plus } from 'lucide-react';

export default function CustomComponentModal() {
  const isOpen = useSolarStore((state) => state.isCustomComponentOpen);
  const setOpen = useSolarStore((state) => state.setCustomComponentOpen);
  const equipmentTypes = useSolarStore((state) => state.equipmentTypes);
  const addObject = useSolarStore((state) => state.addObject);

  const [formData, setFormData] = useState({
    name: "",
    typeId: "",
    manufacturer: "",
    modelNumber: "",
    cost: 0,
    width: 1,
    height: 1,
    color: "#1e3a8a",
  });
  const [specs, setSpecs] = useState({});
  const [newSpecKey, setNewSpecKey] = useState("");
  const [newSpecValue, setNewSpecValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Bulk Import State
  const [importCandidates, setImportCandidates] = useState([]);
  const [showModelSelector, setShowModelSelector] = useState(false);

  const handleAddSpec = () => {
    if (newSpecKey && newSpecValue) {
      setSpecs({ ...specs, [newSpecKey]: newSpecValue });
      setNewSpecKey("");
      setNewSpecValue("");
    }
  };

  const fillFormWithModel = (data) => {
    setFormData(prev => ({
      ...prev,
      name: `${data.manufacturer || ''} ${data.model_number || ''}`.trim() || prev.name,
      manufacturer: data.manufacturer || prev.manufacturer,
      modelNumber: data.model_number || prev.modelNumber,
      width: data.width_mm ? data.width_mm / 1000 : prev.width,
      height: data.height_mm ? data.height_mm / 1000 : prev.height,
      cost: prev.cost
    }));

    const newSpecs = { ...specs };
    if (data.watts) newSpecs.watts = data.watts;
    if (data.voc) newSpecs.voc = data.voc;
    if (data.isc) newSpecs.isc = data.isc;
    if (data.efficiency) newSpecs.efficiency = data.efficiency;
    if (data.capacity_kw) newSpecs.capacity_kw = data.capacity_kw;
    if (data.capacity_kwh) newSpecs.capacity_kwh = data.capacity_kwh;
    if (data.voltage) newSpecs.voltage = data.voltage;
    if (data.ah) newSpecs.ah = data.ah;
    if (data.dod) newSpecs.dod = data.dod;
    if (data.mppt_channels) newSpecs.mppt_channels = data.mppt_channels;
    if (data.max_dc_input) newSpecs.max_dc_input = data.max_dc_input;
    if (data.weight_kg) newSpecs.weight = data.weight_kg;

    setSpecs(newSpecs);

    if (data.type) {
      const typeObj = equipmentTypes.find(t => t.name.toLowerCase().includes(data.type.toLowerCase()) || data.type.toLowerCase().includes(t.name.toLowerCase()));
      if (typeObj) {
        setFormData(prev => ({ ...prev, typeId: typeObj.id }));
      }
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setImportCandidates([]);
    setShowModelSelector(false);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1];

        const { data, error } = await supabase.functions.invoke('parse-datasheet', {
          body: { file: base64Data, mimeType: file.type }
        });

        if (error) throw error;

        if (data) {
          if (data.models && data.models.length > 0) {
            // Prepare candidates for table view
            const candidates = data.models.map((m, i) => ({
              ...m,
              _id: i,
              cost: 0,
              selected: true,
              typeId: equipmentTypes.find(t => t.name.toLowerCase().includes(m.type?.toLowerCase()) || m.type?.toLowerCase().includes(t.name.toLowerCase()))?.id || ''
            }));
            setImportCandidates(candidates);
            setShowModelSelector(true);
          } else if (!data.models) {
            // Fallback for single object response
            fillFormWithModel(data);
          }
        }
      };
    } catch (err) {
      console.error("Error parsing datasheet:", err);
      alert("Failed to parse datasheet: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleBulkImport = async () => {
    const toImport = importCandidates.filter(c => c.selected);
    if (toImport.length === 0) {
      alert("Please select at least one model to import.");
      return;
    }

    setLoading(true);
    try {
      let count = 0;
      for (const item of toImport) {
        if (!item.typeId) continue; // Skip if type missing

        const itemSpecs = {
          watts: item.watts,
          voc: item.voc,
          isc: item.isc,
          efficiency: item.efficiency,
          capacity_kw: item.capacity_kw,
          capacity_kwh: item.capacity_kwh,
          voltage: item.voltage,
          ah: item.ah,
          dod: item.dod,
          mppt_channels: item.mppt_channels,
          max_dc_input: item.max_dc_input,
          weight: item.weight_kg
        };
        // Remove undefined/null
        Object.keys(itemSpecs).forEach(key => (itemSpecs[key] === undefined || itemSpecs[key] === null) && delete itemSpecs[key]);

        await equipmentService.createEquipment({
          type_id: item.typeId,
          name: `${item.manufacturer || ''} ${item.model_number || ''}`.trim(),
          manufacturer: item.manufacturer,
          model_number: item.model_number,
          specifications: itemSpecs,
          cost: parseFloat(item.cost) || 0,
          width: item.width_mm ? item.width_mm / 1000 : 1,
          height: item.height_mm ? item.height_mm / 1000 : 1,
          color: "#1e3a8a",
          is_custom: true,
        });
        count++;
      }

      alert(`Successfully imported ${count} components to the library.`);
      setOpen(false);
      // Reset
      setImportCandidates([]);
      setShowModelSelector(false);

    } catch (e) {
      console.error(e);
      alert("Error importing components: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!formData.name || !formData.typeId) {
      alert("Please fill in name and type");
      return;
    }

    setLoading(true);
    try {
      // Create equipment in Supabase
      const equipment = await equipmentService.createEquipment({
        type_id: formData.typeId,
        name: formData.name,
        manufacturer: formData.manufacturer,
        model_number: formData.modelNumber,
        specifications: specs,
        cost: parseFloat(formData.cost),
        width: parseFloat(formData.width),
        height: parseFloat(formData.height),
        color: formData.color,
        is_custom: true,
      });

      // Add to canvas
      const selectedType = equipmentTypes.find(
        (t) => t.id === formData.typeId
      );
      const newObject = {
        id: equipment.id,
        type: selectedType?.name || "custom",
        x: 10,
        y: 10,
        w: parseFloat(formData.width),
        h: parseFloat(formData.height),
        h_z: 0.5,
        rotation: 0,
        cost: parseFloat(formData.cost),
        color: formData.color,
        label: formData.name,
        equipment_id: equipment.id,
        specifications: specs,
      };

      addObject(newObject);
      setOpen(false);

      // Reset form
      setFormData({
        name: "",
        typeId: "",
        manufacturer: "",
        modelNumber: "",
        cost: 0,
        width: 1,
        height: 1,
        color: "#1e3a8a",
      });
      setSpecs({});
    } catch (error) {
      console.error("Error creating equipment:", error);
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className={`bg-gray-800 rounded-lg p-6 w-full mx-4 max-h-[90vh] overflow-y-auto transition-all duration-300 ${showModelSelector ? 'max-w-6xl' : 'max-w-lg'} relative`}>

        {/* Loader Overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-gray-900 bg-opacity-80 flex flex-col items-center justify-center z-10 rounded-lg">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-3" />
            <p className="text-white font-medium">Analyzing Datasheet...</p>
            <p className="text-gray-400 text-xs mt-1">Extracting specifications with Gemini AI</p>
          </div>
        )}

        {showModelSelector ? (
          // TABLE VIEW FOR BULK IMPORT
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Batch Import Models</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>

            <p className="text-gray-300 text-sm mb-4">
              Review and select the models to import. You can edit the cost for each model.
            </p>

            <div className="overflow-x-auto border border-gray-600 rounded mb-4">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-gray-700 text-gray-100 uppercase font-bold">
                  <tr>
                    <th className="p-3 w-10">
                      <input type="checkbox"
                        onChange={(e) => setImportCandidates(importCandidates.map(c => ({ ...c, selected: e.target.checked })))}
                        checked={importCandidates.every(c => c.selected)}
                      />
                    </th>
                    <th className="p-3">Model</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Specs</th>
                    <th className="p-3">Dimensions (mm)</th>
                    <th className="p-3 w-32">Cost (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {importCandidates.map((candidate, idx) => (
                    <tr key={idx} className={`hover:bg-gray-700 ${candidate.selected ? 'bg-gray-700/30' : ''}`}>
                      <td className="p-3">
                        <input type="checkbox"
                          checked={candidate.selected}
                          onChange={(e) => {
                            const newCandidates = [...importCandidates];
                            newCandidates[idx].selected = e.target.checked;
                            setImportCandidates(newCandidates);
                          }}
                        />
                      </td>
                      <td className="p-3 font-medium text-white">
                        {candidate.model_number}
                        <div className="text-gray-500 text-[10px]">{candidate.manufacturer}</div>
                      </td>
                      <td className="p-3">
                        <select
                          value={candidate.typeId}
                          onChange={(e) => {
                            const newCandidates = [...importCandidates];
                            newCandidates[idx].typeId = e.target.value;
                            setImportCandidates(newCandidates);
                          }}
                          className="bg-gray-600 border border-gray-500 rounded px-1 py-0.5 text-xs text-white"
                        >
                          <option value="">Select Type</option>
                          {equipmentTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </td>
                      <td className="p-3">
                        <div className="space-y-0.5">
                          {candidate.watts && <div>{candidate.watts}W</div>}
                          {candidate.efficiency && <div>{candidate.efficiency}% Eff</div>}
                          {candidate.voc && <div>Voc: {candidate.voc}V</div>}
                        </div>
                      </td>
                      <td className="p-3">
                        {candidate.width_mm} x {candidate.height_mm}
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          value={candidate.cost}
                          onChange={(e) => {
                            const newCandidates = [...importCandidates];
                            newCandidates[idx].cost = e.target.value;
                            setImportCandidates(newCandidates);
                          }}
                          className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white focus:border-blue-500 focus:outline-none"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModelSelector(false);
                  setImportCandidates([]);
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkImport}
                disabled={loading || importCandidates.filter(c => c.selected).length === 0}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold rounded transition shadow-lg flex items-center"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                Import {importCandidates.filter(c => c.selected).length} Models
              </button>
            </div>
          </div>
        ) : (
          // STANDARD FORM VIEW
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Add Custom Component</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* File Upload for Auto-fill */}
              <div className="mb-6 p-4 bg-gray-700 rounded border border-gray-600">
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  <Sparkles className="w-4 h-4 text-yellow-400 mr-2" />
                  Auto-fill from Datasheet (Gemini AI)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="block w-full text-xs text-gray-400
                          file:mr-4 file:py-2 file:px-4
                          file:rounded file:border-0
                          file:text-xs file:font-semibold
                          file:bg-blue-600 file:text-white
                          hover:file:bg-blue-700
                          cursor-pointer"
                  />

                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Upload a PDF or Image of the spec sheet. Gemini will extract details automatically.
                </p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Component Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Custom Solar Panel"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Equipment Type *
                </label>
                <select
                  value={formData.typeId}
                  onChange={(e) =>
                    setFormData({ ...formData, typeId: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select type...</option>
                  {equipmentTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Manufacturer & Model */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Manufacturer
                  </label>
                  <input
                    type="text"
                    value={formData.manufacturer}
                    onChange={(e) =>
                      setFormData({ ...formData, manufacturer: e.target.value })
                    }
                    placeholder="Company name"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Model Number
                  </label>
                  <input
                    type="text"
                    value={formData.modelNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, modelNumber: e.target.value })
                    }
                    placeholder="Model"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Cost */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Cost (₹)
                </label>
                <input
                  type="number"
                  value={formData.cost}
                  onChange={(e) =>
                    setFormData({ ...formData, cost: e.target.value })
                  }
                  placeholder="0"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Dimensions */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-300 text-xs font-medium mb-2">
                    Width (m)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.width}
                    onChange={(e) =>
                      setFormData({ ...formData, width: e.target.value })
                    }
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 text-white rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-xs font-medium mb-2">
                    Height (m)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.height}
                    onChange={(e) =>
                      setFormData({ ...formData, height: e.target.value })
                    }
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 text-white rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-xs font-medium mb-2">
                    Color
                  </label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                    className="w-full px-2 py-1 h-8 bg-gray-700 border border-gray-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Specifications */}
              <div className="bg-gray-700 p-3 rounded">
                <h4 className="text-white font-bold text-sm mb-3">
                  Technical Specifications
                </h4>

                {/* Predefined Fields based on Type */}
                {equipmentTypes.find(t => t.id === formData.typeId)?.name === 'Solar Panel' && (
                  <div className="grid grid-cols-2 gap-2 mb-3 border-b border-gray-600 pb-3">
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">Power (Watts)</label>
                      <input
                        type="number"
                        value={specs.watts || ''}
                        onChange={(e) => setSpecs({ ...specs, watts: parseFloat(e.target.value) })}
                        className="w-full px-2 py-1 bg-gray-600 border border-gray-500 text-white text-xs rounded focus:border-blue-500 focus:outline-none"
                        placeholder="e.g. 550"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">Voc (V)</label>
                      <input
                        type="number"
                        value={specs.voc || ''}
                        onChange={(e) => setSpecs({ ...specs, voc: parseFloat(e.target.value) })}
                        className="w-full px-2 py-1 bg-gray-600 border border-gray-500 text-white text-xs rounded focus:border-blue-500 focus:outline-none"
                        placeholder="Open Circuit Voltage"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">Isc (A)</label>
                      <input
                        type="number"
                        value={specs.isc || ''}
                        onChange={(e) => setSpecs({ ...specs, isc: parseFloat(e.target.value) })}
                        className="w-full px-2 py-1 bg-gray-600 border border-gray-500 text-white text-xs rounded focus:border-blue-500 focus:outline-none"
                        placeholder="Short Circuit Current"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">Efficiency (%)</label>
                      <input
                        type="number"
                        value={specs.efficiency || ''}
                        onChange={(e) => setSpecs({ ...specs, efficiency: parseFloat(e.target.value) })}
                        className="w-full px-2 py-1 bg-gray-600 border border-gray-500 text-white text-xs rounded focus:border-blue-500 focus:outline-none"
                        placeholder="Module Efficiency"
                      />
                    </div>
                  </div>
                )}

                {equipmentTypes.find(t => t.id === formData.typeId)?.name === 'Inverter' && (
                  <div className="grid grid-cols-2 gap-2 mb-3 border-b border-gray-600 pb-3">
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">Capacity (kW)</label>
                      <input
                        type="number"
                        value={specs.capacity_kw || ''}
                        onChange={(e) => setSpecs({ ...specs, capacity_kw: parseFloat(e.target.value) })}
                        className="w-full px-2 py-1 bg-gray-600 border border-gray-500 text-white text-xs rounded focus:border-blue-500 focus:outline-none"
                        placeholder="AC Output Power"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">Efficiency (%)</label>
                      <input
                        type="number"
                        value={specs.efficiency || ''}
                        onChange={(e) => setSpecs({ ...specs, efficiency: parseFloat(e.target.value) })}
                        className="w-full px-2 py-1 bg-gray-600 border border-gray-500 text-white text-xs rounded focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">Max DC Input (V)</label>
                      <input
                        type="number"
                        value={specs.max_dc_input || ''}
                        onChange={(e) => setSpecs({ ...specs, max_dc_input: parseFloat(e.target.value) })}
                        className="w-full px-2 py-1 bg-gray-600 border border-gray-500 text-white text-xs rounded focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">MPPT Channels</label>
                      <input
                        type="number"
                        value={specs.mppt_channels || ''}
                        onChange={(e) => setSpecs({ ...specs, mppt_channels: parseFloat(e.target.value) })}
                        className="w-full px-2 py-1 bg-gray-600 border border-gray-500 text-white text-xs rounded focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {equipmentTypes.find(t => t.id === formData.typeId)?.name === 'Battery' && (
                  <div className="grid grid-cols-2 gap-2 mb-3 border-b border-gray-600 pb-3">
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">Capacity (kWh)</label>
                      <input
                        type="number"
                        value={specs.capacity_kwh || ''}
                        onChange={(e) => setSpecs({ ...specs, capacity_kwh: parseFloat(e.target.value) })}
                        className="w-full px-2 py-1 bg-gray-600 border border-gray-500 text-white text-xs rounded focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">Voltage (V)</label>
                      <input
                        type="number"
                        value={specs.voltage || ''}
                        onChange={(e) => setSpecs({ ...specs, voltage: parseFloat(e.target.value) })}
                        className="w-full px-2 py-1 bg-gray-600 border border-gray-500 text-white text-xs rounded focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">Capacity (Ah)</label>
                      <input
                        type="number"
                        value={specs.ah || ''}
                        onChange={(e) => setSpecs({ ...specs, ah: parseFloat(e.target.value) })}
                        className="w-full px-2 py-1 bg-gray-600 border border-gray-500 text-white text-xs rounded focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">DoD (%)</label>
                      <input
                        type="number"
                        value={specs.dod || ''}
                        onChange={(e) => setSpecs({ ...specs, dod: parseFloat(e.target.value) })}
                        className="w-full px-2 py-1 bg-gray-600 border border-gray-500 text-white text-xs rounded focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2 mb-3">
                  {Object.entries(specs).map(([key, value]) => {
                    // Skip predefined keys in the list to avoid duplication
                    if (['watts', 'voc', 'isc', 'efficiency', 'capacity_kw', 'max_dc_input', 'mppt_channels', 'capacity_kwh', 'voltage', 'ah', 'dod'].includes(key)) return null;
                    return (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <span className="text-gray-300">
                          {key}: <span className="text-green-400">{value}</span>
                        </span>
                        <button
                          onClick={() => {
                            const newSpecs = { ...specs };
                            delete newSpecs[key];
                            setSpecs(newSpecs);
                          }}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSpecKey}
                    onChange={(e) => setNewSpecKey(e.target.value)}
                    placeholder="Key (e.g., color_temp)"
                    className="flex-1 px-2 py-1 bg-gray-600 border border-gray-500 text-white text-xs rounded focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newSpecValue}
                    onChange={(e) => setNewSpecValue(e.target.value)}
                    placeholder="Value"
                    className="flex-1 px-2 py-1 bg-gray-600 border border-gray-500 text-white text-xs rounded focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={handleAddSpec}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleCreateAndAdd}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded transition"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Create & Add
                    </>
                  )}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-medium rounded transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
