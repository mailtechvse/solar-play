import React, { useState, useEffect } from "react";
import { useSolarStore } from "../stores/solarStore";

export default function RightPanel() {
  const selectedObjectId = useSolarStore((state) => state.selectedObjectId);
  const setSelectedObjectStore = useSolarStore((state) => state.setSelectedObject);
  const objects = useSolarStore((state) => state.objects);
  const updateObject = useSolarStore((state) => state.updateObject);
  const deleteObject = useSolarStore((state) => state.deleteObject);

  const selectedWireId = useSolarStore((state) => state.selectedWireId);
  const setSelectedWireStore = useSolarStore((state) => state.setSelectedWire);
  const wires = useSolarStore((state) => state.wires);
  const updateWire = useSolarStore((state) => state.updateWire);
  const deleteWire = useSolarStore((state) => state.deleteWire);

  const [selectedObject, setSelectedObjectLocal] = useState(null);
  const [selectedWire, setSelectedWireLocal] = useState(null);

  const orientation = useSolarStore((state) => state.orientation);
  const setOrientation = useSolarStore((state) => state.setOrientation);
  const showDimensions = useSolarStore((state) => state.showDimensions);
  const setShowDimensions = useSolarStore((state) => state.setShowDimensions);
  const showLabels = useSolarStore((state) => state.showLabels);
  const setShowLabels = useSolarStore((state) => state.setShowLabels);
  const groupObjects = useSolarStore((state) => state.groupObjects);
  const ungroupObjects = useSolarStore((state) => state.ungroupObjects);
  const additionalSelectedIds = useSolarStore((state) => state.additionalSelectedIds);

  useEffect(() => {
    if (selectedObjectId) {
      const obj = objects.find((o) => o.id === selectedObjectId);
      setSelectedObjectLocal(obj);
      setSelectedWireLocal(null);
    } else if (selectedWireId) {
      const wire = wires.find((w) => w.id === selectedWireId);
      setSelectedWireLocal(wire);
      setSelectedObjectLocal(null);
    } else {
      setSelectedObjectLocal(null);
      setSelectedWireLocal(null);
    }
  }, [selectedObjectId, selectedWireId, objects, wires]);

  if (selectedWire) {
    return (
      <div className="absolute top-0 right-0 h-full w-64 bg-white border-l border-gray-200 shadow-2xl z-20 flex flex-col font-sans animate-slide-in-right">
        <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-bold text-gray-700 uppercase text-xs tracking-wider">Wire Details</h3>
          <button
            onClick={() => setSelectedWireStore(null)}
            className="text-gray-400 hover:text-gray-600"
          >
            <i className="fas fa-xmark"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-white">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-gray-800 font-bold text-sm uppercase">{selectedWire.type} Cable</h3>
              <button
                onClick={() => deleteWire(selectedWire.id)}
                className="px-2 py-1 text-xs bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded transition"
              >
                <i className="fas fa-trash"></i>
              </button>
            </div>

            <div className="bg-yellow-50 border border-yellow-100 p-3 rounded text-xs text-yellow-800">
              <h4 className="font-bold mb-1 flex items-center gap-1">
                <i className="fas fa-info-circle"></i> Connection Info
              </h4>
              <p className="leading-relaxed opacity-90">
                Connecting two components. Ensure cable size is sufficient for the current rating.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-gray-500 font-medium">Cable Type</label>
                <select
                  value={selectedWire.type}
                  onChange={(e) => updateWire(selectedWire.id, { type: e.target.value })}
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                >
                  <option value="dc">DC Cable (Solar)</option>
                  <option value="ac">AC Cable (Grid/Load)</option>
                  <option value="earth">Earthing Strip</option>
                </select>
              </div>

              <div>
                <label className="text-gray-500 font-medium">Size (sqmm)</label>
                <select
                  value={selectedWire.specifications?.size_sqmm || 4}
                  onChange={(e) => updateWire(selectedWire.id, { specifications: { ...selectedWire.specifications, size_sqmm: parseFloat(e.target.value) } })}
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                >
                  <option value={2.5}>2.5 sqmm</option>
                  <option value={4}>4 sqmm</option>
                  <option value={6}>6 sqmm</option>
                  <option value={10}>10 sqmm</option>
                  <option value={16}>16 sqmm</option>
                  <option value={25}>25 sqmm</option>
                  <option value={35}>35 sqmm</option>
                  <option value={50}>50 sqmm</option>
                  <option value={70}>70 sqmm</option>
                  <option value={95}>95 sqmm</option>
                  <option value={120}>120 sqmm</option>
                </select>
              </div>

              <div>
                <label className="text-gray-500 font-medium">Material</label>
                <select
                  value={selectedWire.specifications?.material || "Copper"}
                  onChange={(e) => updateWire(selectedWire.id, { specifications: { ...selectedWire.specifications, material: e.target.value } })}
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                >
                  <option value="Copper">Copper</option>
                  <option value="Aluminum">Aluminum</option>
                </select>
              </div>

              <div>
                <label className="text-gray-500 font-medium">Length (m)</label>
                <input
                  type="number"
                  value={selectedWire.specifications?.length_m || 10}
                  onChange={(e) => updateWire(selectedWire.id, { specifications: { ...selectedWire.specifications, length_m: parseFloat(e.target.value) } })}
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                />
                <p className="text-[10px] text-gray-400 mt-1">Estimated length based on path + vertical drops.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedObject && !selectedWire) {
    return (
      <div className="absolute top-0 right-0 h-full w-64 bg-white border-l border-gray-200 shadow-2xl z-20 flex flex-col font-sans animate-slide-in-right">
        <div className="p-3 bg-gray-50 border-b border-gray-200">
          <h3 className="font-bold text-gray-700 uppercase text-xs tracking-wider">Project Settings</h3>
        </div>
        <div className="p-4 space-y-6">
          <div>
            <label className="text-gray-500 font-bold text-xs uppercase mb-2 block">Map Settings</label>

            <div className="mb-4">
              <label className="text-gray-500 font-medium text-xs mb-1 block">Orientation (Azimuth)</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0" max="360"
                  step="1"
                  value={orientation || 0}
                  onChange={e => setOrientation(parseFloat(e.target.value))}
                  className="flex-1 h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                />
                <input
                  type="number"
                  min="0"
                  max="360"
                  value={orientation || 0}
                  onChange={e => setOrientation(parseFloat(e.target.value))}
                  className="w-12 text-xs font-mono font-bold text-gray-700 text-right border rounded px-1 py-0.5"
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>N</span>
                <span>E</span>
                <span>S</span>
                <span>W</span>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <label className="text-gray-500 font-medium text-xs">Show Dimensions</label>
              <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                <input type="checkbox" name="toggle" id="toggle-dimensions"
                  className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-300 checked:right-0 checked:border-green-400"
                  checked={showDimensions || false}
                  onChange={(e) => setShowDimensions(e.target.checked)}
                />
                <label htmlFor="toggle-dimensions" className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${showDimensions ? 'bg-green-400' : 'bg-gray-300'}`}></label>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <label className="text-gray-500 font-medium text-xs">Show Labels</label>
              <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                <input type="checkbox" name="toggle-labels" id="toggle-labels"
                  className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-300 checked:right-0 checked:border-green-400"
                  checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                />
                <label htmlFor="toggle-labels" className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${showLabels ? 'bg-green-400' : 'bg-gray-300'}`}></label>
              </div>
            </div>

            <div className="text-xs text-gray-400 italic">
              <i className="fas fa-info-circle mr-1"></i>
              Adjust north direction to align shadows correctly with the satellite map.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-0 right-0 h-full w-64 bg-white border-l border-gray-200 shadow-2xl z-20 flex flex-col font-sans animate-slide-in-right">
      <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-bold text-gray-700 uppercase text-xs tracking-wider">Object Details</h3>
        <button
          onClick={() => setSelectedObjectStore(null)}
          className="text-gray-400 hover:text-gray-600"
        >
          <i className="fas fa-xmark"></i>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-white">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-gray-400 font-bold uppercase">Name</label>
              <input
                type="text"
                value={selectedObject.label || selectedObject.type}
                onChange={(e) => updateObject(selectedObject.id, { label: e.target.value })}
                className="w-full text-sm font-bold text-gray-800 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent px-0 py-0.5"
                placeholder="Component Name"
              />
            </div>
            <button
              onClick={() => deleteObject(selectedObject.id)}
              className="px-2 py-1 text-xs bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded transition shrink-0"
              title="Delete Component"
            >
              <i className="fas fa-trash"></i>
            </button>
          </div>

          {/* Grouping Controls */}
          <div className="flex gap-2">
            {(additionalSelectedIds?.length > 0) && (
              <button
                onClick={() => groupObjects([selectedObject.id, ...additionalSelectedIds])}
                className="flex-1 py-1.5 px-2 text-xs bg-gray-50 hover:bg-gray-100 text-gray-700 rounded border border-gray-300 font-medium transition"
              >
                <i className="fas fa-object-group mr-1"></i> Group Selected
              </button>
            )}
            {selectedObject.groupId && (
              <button
                onClick={() => ungroupObjects([selectedObject.id])}
                className="flex-1 py-1.5 px-2 text-xs bg-gray-50 hover:bg-gray-100 text-gray-700 rounded border border-gray-300 font-medium transition"
              >
                <i className="fas fa-object-ungroup mr-1"></i> Ungroup
              </button>
            )}
          </div>

          {/* Component Know-How / Description */}
          <div className="bg-blue-50 border border-blue-100 p-3 rounded text-xs text-blue-800">
            <h4 className="font-bold mb-1 flex items-center gap-1">
              <i className="fas fa-info-circle"></i> What is this?
            </h4>
            <p className="leading-relaxed opacity-90">
              {getComponentDescription(selectedObject)}
            </p>
          </div>

          {/* Basic Properties */}
          <div className="space-y-2 text-xs">
            <div>
              <label className="text-gray-500 font-medium">Type</label>
              <input
                type="text"
                value={selectedObject.type}
                disabled
                className="w-full mt-1 px-2 py-1 bg-gray-100 border border-gray-300 text-gray-600 rounded"
              />
            </div>

            {/* Grid Outage Settings */}
            {selectedObject.type === 'grid' && (
              <div className="mt-4 bg-red-50 p-2 rounded border border-red-100">
                <label className="text-[10px] text-red-500 font-bold uppercase mb-2 block">Grid Outage Plan</label>

                <div className="mb-2">
                  <label className="text-[10px] text-gray-500 font-bold">Type</label>
                  <select
                    value={selectedObject.specifications?.outage_type || 'None'}
                    onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, outage_type: e.target.value } })}
                    className="w-full mt-0.5 px-1 py-1 border rounded text-xs"
                  >
                    <option value="None">None (Always ON)</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Random">Random (Unreliable)</option>
                  </select>
                </div>

                {selectedObject.specifications?.outage_type === 'Scheduled' && (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 font-bold">Start (Hr)</label>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        value={selectedObject.specifications?.outage_start || 16}
                        onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, outage_start: parseFloat(e.target.value) } })}
                        className="w-full mt-0.5 px-1 py-1 border rounded text-xs"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 font-bold">End (Hr)</label>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        value={selectedObject.specifications?.outage_end || 18}
                        onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, outage_end: parseFloat(e.target.value) } })}
                        className="w-full mt-0.5 px-1 py-1 border rounded text-xs"
                      />
                    </div>
                  </div>
                )}

                {selectedObject.specifications?.outage_type === 'Random' && (
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold">Max Duration (Hrs)</label>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={selectedObject.specifications?.outage_duration || 5}
                      onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, outage_duration: parseFloat(e.target.value) } })}
                      className="w-full mt-0.5 px-1 py-1 border rounded text-xs"
                    />
                    <p className="text-[9px] text-gray-400 mt-1">Will randomly fail for up to {selectedObject.specifications?.outage_duration || 5} hours.</p>
                  </div>
                )}
              </div>
            )}

            {/* Battery Settings */}
            {(selectedObject.type === 'battery' || selectedObject.type === 'bess') && (
              <div className="mt-4 bg-green-50 p-2 rounded border border-green-100">
                <label className="text-[10px] text-green-600 font-bold uppercase mb-2 block">Battery Settings</label>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold">Capacity (kWh)</label>
                    <input
                      type="number"
                      min="1"
                      value={selectedObject.specifications?.battery_capacity || 5}
                      onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, battery_capacity: parseFloat(e.target.value) } })}
                      className="w-full mt-0.5 px-1 py-1 border rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold">Initial SoC (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={selectedObject.specifications?.initial_soc !== undefined ? selectedObject.specifications.initial_soc : 20}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        updateObject(selectedObject.id, {
                          soc: val,
                          specifications: { ...selectedObject.specifications, initial_soc: val }
                        });
                      }}
                      className="w-full mt-0.5 px-1 py-1 border rounded text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold">DoD (%)</label>
                    <input
                      type="number"
                      min="10"
                      max="100"
                      value={selectedObject.specifications?.dod || 80}
                      onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, dod: parseFloat(e.target.value) } })}
                      className="w-full mt-0.5 px-1 py-1 border rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold">Max Power (kW)</label>
                    <input
                      type="number"
                      min="0.1"
                      value={selectedObject.specifications?.max_charge_kw || 2.5}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, max_charge_kw: val, max_discharge_kw: val } });
                      }}
                      className="w-full mt-0.5 px-1 py-1 border rounded text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-gray-500 font-medium">X (m)</label>
                <input
                  type="number"
                  value={selectedObject.x.toFixed(1)}
                  onChange={(e) =>
                    updateObject(selectedObject.id, {
                      x: parseFloat(e.target.value),
                    })
                  }
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-gray-500 font-medium">Y (m)</label>
                <input
                  type="number"
                  value={selectedObject.y.toFixed(1)}
                  onChange={(e) =>
                    updateObject(selectedObject.id, {
                      y: parseFloat(e.target.value),
                    })
                  }
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-gray-500 font-medium">Width (m)</label>
                <input
                  type="number"
                  step="0.1"
                  value={selectedObject.w.toFixed(1)}
                  onChange={(e) =>
                    updateObject(selectedObject.id, {
                      w: parseFloat(e.target.value),
                    })
                  }
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-gray-500 font-medium">Height (m)</label>
                <input
                  type="number"
                  step="0.1"
                  value={selectedObject.h.toFixed(1)}
                  onChange={(e) =>
                    updateObject(selectedObject.id, {
                      h: parseFloat(e.target.value),
                    })
                  }
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-gray-500 font-medium">Object Height (Relative)</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={selectedObject.relative_h || 0.1}
                    onChange={(e) => {
                      let newRelH = parseFloat(e.target.value);
                      if (newRelH < 0) newRelH = 0; // Prevent negative height
                      const oldRelH = selectedObject.relative_h || 0.1;
                      const baseH = (selectedObject.h_z || 0) - oldRelH;
                      updateObject(selectedObject.id, {
                        relative_h: newRelH,
                        h_z: baseH + newRelH
                      });
                    }}
                    className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded text-right"
                  />
                  <span className="text-xs text-gray-500">m</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={selectedObject.relative_h || 0.1}
                onChange={(e) => {
                  const newRelH = parseFloat(e.target.value);
                  const oldRelH = selectedObject.relative_h || 0.1;
                  const baseH = (selectedObject.h_z || 0) - oldRelH;
                  updateObject(selectedObject.id, {
                    relative_h: newRelH,
                    h_z: baseH + newRelH
                  });
                }}
                className="w-full mt-2 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex items-center justify-between mt-1">
                <label className="text-gray-400 text-xs">Absolute Height (Ground)</label>
                <span className="text-xs text-gray-700 font-bold">{selectedObject.h_z?.toFixed(2) || "0.00"}m</span>
              </div>
            </div>

            <div>
              <label className="text-gray-500 font-medium">Rotation (°)</label>
              <input
                type="number"
                value={selectedObject.rotation?.toFixed(0) || "0"}
                onChange={(e) =>
                  updateObject(selectedObject.id, {
                    rotation: parseFloat(e.target.value),
                  })
                }
                className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded focus:border-blue-500 focus:outline-none"
              />
            </div>

            {['panel', 'inverter', 'battery', 'lt_panel', 'ht_panel', 'acdb', 'net_meter', 'gross_meter'].includes(selectedObject.type) && (
              <div>
                <label className="text-gray-500 font-medium">Cost (₹)</label>
                <input
                  type="number"
                  value={selectedObject.cost?.toFixed(0) || "0"}
                  onChange={(e) =>
                    updateObject(selectedObject.id, {
                      cost: parseFloat(e.target.value),
                    })
                  }
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="text-gray-500 font-medium">Color</label>
              <input
                type="color"
                value={selectedObject.color || "#1e3a8a"}
                onChange={(e) =>
                  updateObject(selectedObject.id, { color: e.target.value })
                }
                className="w-full mt-1 h-8 px-1 bg-white border border-gray-300 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Type-Specific Properties */}
          {selectedObject.watts && (
            <div className="border-t border-gray-200 pt-4">
              <label className="text-gray-500 font-medium text-xs">Power (W)</label>
              <input
                type="number"
                value={selectedObject.watts?.toFixed(0) || "0"}
                onChange={(e) =>
                  updateObject(selectedObject.id, {
                    watts: parseFloat(e.target.value),
                  })
                }
                className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {selectedObject.capKw && (
            <div className="border-t border-gray-200 pt-4">
              <label className="text-gray-500 font-medium text-xs">Capacity (kW)</label>
              <input
                type="number"
                step="0.1"
                value={selectedObject.capKw?.toFixed(1) || "0"}
                onChange={(e) =>
                  updateObject(selectedObject.id, {
                    capKw: parseFloat(e.target.value),
                  })
                }
                className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {selectedObject.capKwh && (
            <div className="border-t border-gray-200 pt-4">
              <label className="text-gray-500 font-medium text-xs">Capacity (kWh)</label>
              <input
                type="number"
                step="0.1"
                value={selectedObject.capKwh?.toFixed(1) || "0"}
                onChange={(e) =>
                  updateObject(selectedObject.id, {
                    capKwh: parseFloat(e.target.value),
                  })
                }
                className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {(selectedObject.type === 'battery' || selectedObject.type === 'bess') && (
            <div className="border-t border-gray-200 pt-4">
              <label className="text-gray-500 font-medium text-xs">State of Charge (SOC)</label>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden border border-gray-300">
                  <div
                    className={`h-full transition-all duration-300 ${(selectedObject.soc || 0) < 20 ? 'bg-red-500' :
                      (selectedObject.soc || 0) < 50 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                    style={{ width: `${selectedObject.soc || 0}%` }}
                  ></div>
                </div>
                <span className="text-xs font-bold text-gray-700 w-10 text-right">
                  {(selectedObject.soc || 0).toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          {selectedObject.type === "load" && (
            <div className="border-t border-gray-200 pt-4">
              <label className="text-gray-500 font-medium text-xs">Monthly Consumption (Units)</label>
              <input
                type="number"
                value={selectedObject.units?.toFixed(0) || "0"}
                onChange={(e) =>
                  updateObject(selectedObject.id, {
                    units: parseFloat(e.target.value),
                  })
                }
                className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded focus:border-blue-500 focus:outline-none"
              />
              <p className="text-gray-400 text-xs mt-2">
                This load consumption is added to the base load in calculations
              </p>
            </div>
          )}

          {/* Power Switch for Panels and Grid */}
          {(selectedObject.type === 'lt_panel' || selectedObject.type === 'ht_panel' || selectedObject.type === 'acdb' || selectedObject.type === 'grid' || selectedObject.type === 'vcb' || selectedObject.type === 'acb') && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between">
                <label className="text-gray-500 font-medium text-xs">
                  {selectedObject.type === 'grid' ? 'Grid Availability' : 'Power Status'}
                </label>
                <button
                  onClick={() => updateObject(selectedObject.id, { isOn: selectedObject.isOn === false ? true : false })}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition ${selectedObject.isOn !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                >
                  {selectedObject.isOn !== false ? (selectedObject.type === 'grid' ? 'AVAILABLE' : 'ON') : (selectedObject.type === 'grid' ? 'OUTAGE' : 'OFF')}
                </button>
              </div>

              {selectedObject.type === 'grid' && (
                <div className="mt-3">
                  <label className="text-gray-500 font-medium text-xs">Grid Voltage</label>
                  <select
                    value={selectedObject.specifications?.voltage || 11000}
                    onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, voltage: parseInt(e.target.value) } })}
                    className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                  >
                    <option value={230}>230 V (1-Phase)</option>
                    <option value={415}>415 V (3-Phase)</option>
                    <option value={11000}>11 kV</option>
                    <option value={33000}>33 kV</option>
                    <option value={66000}>66 kV</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Meter Reading */}
          {(selectedObject.type === 'net_meter' || selectedObject.type === 'gross_meter') && (
            <div className="border-t border-gray-200 pt-4">
              <label className="text-gray-500 font-medium text-xs">Cumulative Generation</label>
              <div className="text-lg font-mono font-bold text-green-600">
                {(selectedObject.reading || 0).toFixed(2)} kWh
              </div>
              <button
                onClick={() => updateObject(selectedObject.id, { reading: 0 })}
                className="text-[10px] text-blue-500 hover:underline mt-1"
              >
                Reset Reading
              </button>
            </div>
          )}

          {/* VCB/ACB Specs & Logic */}
          {(selectedObject.type === 'vcb' || selectedObject.type === 'acb') && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-gray-600 font-bold text-xs mb-2">Breaker Specs</h4>
              <div>
                <label className="text-gray-500 font-medium text-xs">Voltage Rating (kV)</label>
                <input
                  type="number"
                  value={selectedObject.specifications?.voltage_rating || (selectedObject.type === 'vcb' ? 11 : 0.415)}
                  onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, voltage_rating: parseFloat(e.target.value) } })}
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                />
              </div>
              <div className="mt-2">
                <label className="text-gray-500 font-medium text-xs">Current Rating (A)</label>
                <input
                  type="number"
                  value={selectedObject.specifications?.current_rating || (selectedObject.type === 'vcb' ? 630 : 800)}
                  onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, current_rating: parseFloat(e.target.value) } })}
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                />
              </div>

              {/* Logic Builder */}
              <div className="mt-4 border-t border-gray-100 pt-2">
                <h4 className="text-gray-600 font-bold text-xs mb-2 flex items-center justify-between">
                  <span>Programmable Logic (PLC)</span>
                  <button
                    onClick={() => {
                      const currentLogic = selectedObject.specifications?.custom_logic || [];
                      updateObject(selectedObject.id, {
                        specifications: {
                          ...selectedObject.specifications,
                          custom_logic: [...currentLogic, { param: 'Voltage', op: '>', val: 0, action: 'Trip' }]
                        }
                      });
                    }}
                    className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100"
                  >
                    + Add Rule
                  </button>
                </h4>

                <div className="space-y-2">
                  {(selectedObject.specifications?.custom_logic || []).map((rule, idx) => (
                    <div key={idx} className="bg-gray-50 p-2 rounded border border-gray-200 text-xs">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="font-bold text-gray-500">IF</span>
                        <select
                          value={rule.param}
                          onChange={(e) => {
                            const newLogic = [...selectedObject.specifications.custom_logic];
                            newLogic[idx].param = e.target.value;
                            updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, custom_logic: newLogic } });
                          }}
                          className="w-20 px-1 py-0.5 border rounded"
                        >
                          <option value="Voltage">Voltage</option>
                          <option value="Current">Current</option>
                          <option value="Frequency">Freq</option>
                        </select>
                        <select
                          value={rule.op}
                          onChange={(e) => {
                            const newLogic = [...selectedObject.specifications.custom_logic];
                            newLogic[idx].op = e.target.value;
                            updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, custom_logic: newLogic } });
                          }}
                          className="w-10 px-1 py-0.5 border rounded"
                        >
                          <option value=">">&gt;</option>
                          <option value="<">&lt;</option>
                          <option value="=">=</option>
                        </select>
                        <input
                          type="number"
                          value={rule.val}
                          onChange={(e) => {
                            const newLogic = [...selectedObject.specifications.custom_logic];
                            newLogic[idx].val = parseFloat(e.target.value);
                            updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, custom_logic: newLogic } });
                          }}
                          className="w-16 px-1 py-0.5 border rounded"
                        />
                      </div>
                      <div className="flex items-center gap-1 justify-between">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-gray-500">THEN</span>
                          <select
                            value={rule.action}
                            onChange={(e) => {
                              const newLogic = [...selectedObject.specifications.custom_logic];
                              newLogic[idx].action = e.target.value;
                              updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, custom_logic: newLogic } });
                            }}
                            className="w-20 px-1 py-0.5 border rounded text-red-600 font-medium"
                          >
                            <option value="Trip">Trip</option>
                            <option value="Close">Close</option>
                            <option value="Alarm">Alarm</option>
                          </select>
                        </div>
                        <button
                          onClick={() => {
                            const newLogic = selectedObject.specifications.custom_logic.filter((_, i) => i !== idx);
                            updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, custom_logic: newLogic } });
                          }}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                  {(!selectedObject.specifications?.custom_logic || selectedObject.specifications.custom_logic.length === 0) && (
                    <p className="text-gray-400 italic text-[10px] text-center py-2">No logic rules defined.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Master PLC Specs */}
          {selectedObject.type === 'master_plc' && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-gray-600 font-bold text-xs mb-2">Plant Controller Logic</h4>

              <div className="mt-2 border-t border-gray-100 pt-2">
                <button
                  onClick={() => {
                    const currentLogic = selectedObject.specifications?.custom_logic || [];
                    updateObject(selectedObject.id, {
                      specifications: {
                        ...selectedObject.specifications,
                        custom_logic: [...currentLogic, { targetId: '', param: 'GridVoltage', op: '<', val: 0, action: 'Trip' }]
                      }
                    });
                  }}
                  className="w-full text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100 mb-2"
                >
                  + Add Global Rule
                </button>

                {/* Source Priority Control */}
                <div className="mb-4 bg-gray-50 p-2 rounded border border-gray-200">
                  <label className="text-[10px] text-gray-500 font-bold uppercase mb-2 block">Source Priority</label>
                  <div className="space-y-1">
                    {(selectedObject.specifications?.source_priority || ['Solar', 'Battery', 'Grid']).map((source, idx, arr) => (
                      <div key={source} className="flex items-center justify-between bg-white px-2 py-1 border rounded text-xs shadow-sm">
                        <span className="font-medium text-gray-700">{idx + 1}. {source}</span>
                        <div className="flex gap-1">
                          <button
                            disabled={idx === 0}
                            onClick={() => {
                              const newPriority = [...(selectedObject.specifications?.source_priority || ['Solar', 'Battery', 'Grid'])];
                              [newPriority[idx - 1], newPriority[idx]] = [newPriority[idx], newPriority[idx - 1]];
                              updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, source_priority: newPriority } });
                            }}
                            className={`text-[10px] px-1 rounded ${idx === 0 ? 'text-gray-300' : 'text-blue-500 hover:bg-blue-50'}`}
                          >
                            ▲
                          </button>
                          <button
                            disabled={idx === arr.length - 1}
                            onClick={() => {
                              const newPriority = [...(selectedObject.specifications?.source_priority || ['Solar', 'Battery', 'Grid'])];
                              [newPriority[idx + 1], newPriority[idx]] = [newPriority[idx], newPriority[idx + 1]];
                              updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, source_priority: newPriority } });
                            }}
                            className={`text-[10px] px-1 rounded ${idx === arr.length - 1 ? 'text-gray-300' : 'text-blue-500 hover:bg-blue-50'}`}
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {(selectedObject.specifications?.custom_logic || []).map((rule, idx) => (
                    <div key={idx} className="bg-gray-50 p-2 rounded border border-gray-200 text-xs">
                      <div className="mb-1">
                        <label className="text-[10px] text-gray-500 font-bold">Target Device:</label>
                        <select
                          value={rule.targetId}
                          onChange={(e) => {
                            const newLogic = [...selectedObject.specifications.custom_logic];
                            newLogic[idx].targetId = e.target.value;
                            updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, custom_logic: newLogic } });
                          }}
                          className="w-full mt-0.5 px-1 py-0.5 border rounded text-[10px]"
                        >
                          <option value="">Select Device...</option>
                          {objects.filter(o => o.type === 'vcb' || o.type === 'acb').map(o => (
                            <option key={o.id} value={o.id}>{o.label || o.type} ({o.id.slice(0, 4)})</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1 mb-1">
                        <select
                          value={rule.type || 'Threshold'}
                          onChange={(e) => {
                            const newLogic = [...selectedObject.specifications.custom_logic];
                            const updatedRule = { ...newLogic[idx], type: e.target.value };

                            // Reset params based on type
                            if (e.target.value === 'Time') {
                              updatedRule.param = 'Time';
                              updatedRule.op = 'Between';
                              updatedRule.val = 18; // Start hour
                              updatedRule.val2 = 6; // End hour
                            } else if (e.target.value === 'Interlock') {
                              updatedRule.param = 'DeviceStatus';
                              updatedRule.op = '=';
                              updatedRule.val = 'ON';
                            } else {
                              updatedRule.param = 'GridVoltage';
                              updatedRule.op = '<';
                              updatedRule.val = 0;
                            }

                            newLogic[idx] = updatedRule;
                            updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, custom_logic: newLogic } });
                          }}
                          className="w-20 px-1 py-0.5 border rounded text-[10px] font-bold bg-gray-100"
                        >
                          <option value="Threshold">Value</option>
                          <option value="Interlock">Interlock</option>
                          <option value="Time">Time</option>
                        </select>

                        {/* Threshold Inputs */}
                        {(rule.type === 'Threshold' || !rule.type) && (
                          <>
                            <select
                              value={rule.param}
                              onChange={(e) => {
                                const newLogic = [...selectedObject.specifications.custom_logic];
                                newLogic[idx].param = e.target.value;
                                updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, custom_logic: newLogic } });
                              }}
                              className="w-20 px-1 py-0.5 border rounded"
                            >
                              <option value="GridVoltage">Grid V</option>
                              <option value="GridFreq">Grid Hz</option>
                            </select>
                            <select
                              value={rule.op}
                              onChange={(e) => {
                                const newLogic = [...selectedObject.specifications.custom_logic];
                                newLogic[idx].op = e.target.value;
                                updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, custom_logic: newLogic } });
                              }}
                              className="w-10 px-1 py-0.5 border rounded"
                            >
                              <option value=">">&gt;</option>
                              <option value="<">&lt;</option>
                              <option value="=">=</option>
                            </select>
                            <input
                              type="number"
                              value={rule.val}
                              onChange={(e) => {
                                const newLogic = [...selectedObject.specifications.custom_logic];
                                newLogic[idx].val = parseFloat(e.target.value);
                                updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, custom_logic: newLogic } });
                              }}
                              className="w-14 px-1 py-0.5 border rounded"
                            />
                          </>
                        )}

                        {/* Interlock Inputs */}
                        {rule.type === 'Interlock' && (
                          <>
                            <select
                              value={rule.sourceId || ''}
                              onChange={(e) => {
                                const newLogic = [...selectedObject.specifications.custom_logic];
                                newLogic[idx].sourceId = e.target.value;
                                updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, custom_logic: newLogic } });
                              }}
                              className="w-24 px-1 py-0.5 border rounded text-[10px]"
                            >
                              <option value="">Check Device...</option>
                              {objects.filter(o => (o.type === 'vcb' || o.type === 'acb') && o.id !== rule.targetId).map(o => (
                                <option key={o.id} value={o.id}>{o.label || o.type} ({o.id.slice(0, 4)})</option>
                              ))}
                            </select>
                            <span className="text-[10px] text-gray-500">is</span>
                            <select
                              value={rule.val}
                              onChange={(e) => {
                                const newLogic = [...selectedObject.specifications.custom_logic];
                                newLogic[idx].val = e.target.value;
                                updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, custom_logic: newLogic } });
                              }}
                              className="w-14 px-1 py-0.5 border rounded"
                            >
                              <option value="ON">ON</option>
                              <option value="OFF">OFF</option>
                            </select>
                          </>
                        )}

                        {/* Time Inputs */}
                        {rule.type === 'Time' && (
                          <>
                            <span className="text-[10px] text-gray-500">Range:</span>
                            <input
                              type="number"
                              min="0" max="23"
                              value={rule.val}
                              onChange={(e) => {
                                const newLogic = [...selectedObject.specifications.custom_logic];
                                newLogic[idx].val = parseInt(e.target.value);
                                updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, custom_logic: newLogic } });
                              }}
                              className="w-10 px-1 py-0.5 border rounded"
                              placeholder="Start"
                            />
                            <span className="text-[10px] text-gray-500">-</span>
                            <input
                              type="number"
                              min="0" max="23"
                              value={rule.val2 || 0}
                              onChange={(e) => {
                                const newLogic = [...selectedObject.specifications.custom_logic];
                                newLogic[idx].val2 = parseInt(e.target.value);
                                updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, custom_logic: newLogic } });
                              }}
                              className="w-10 px-1 py-0.5 border rounded"
                              placeholder="End"
                            />
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1 justify-between">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-gray-500">THEN</span>
                          <select
                            value={rule.action}
                            onChange={(e) => {
                              const newLogic = [...selectedObject.specifications.custom_logic];
                              newLogic[idx].action = e.target.value;
                              updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, custom_logic: newLogic } });
                            }}
                            className="w-20 px-1 py-0.5 border rounded text-red-600 font-medium"
                          >
                            <option value="Trip">Trip</option>
                            <option value="Close">Close</option>
                          </select>
                        </div>
                        <button
                          onClick={() => {
                            const newLogic = selectedObject.specifications.custom_logic.filter((_, i) => i !== idx);
                            updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, custom_logic: newLogic } });
                          }}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                  {(!selectedObject.specifications?.custom_logic || selectedObject.specifications.custom_logic.length === 0) && (
                    <p className="text-gray-400 italic text-[10px] text-center py-2">No global rules defined.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* BESS Specs */}
          {selectedObject.type === 'bess' && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-gray-600 font-bold text-xs mb-2">BESS Configuration</h4>
              <div>
                <label className="text-gray-500 font-medium text-xs">PCS Rating (kW)</label>
                <input
                  type="number"
                  value={selectedObject.specifications?.pcs_rating || 100}
                  onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, pcs_rating: parseFloat(e.target.value) } })}
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                />
              </div>
              <div className="mt-2">
                <label className="text-gray-500 font-medium text-xs">STS Rating (A)</label>
                <input
                  type="number"
                  value={selectedObject.specifications?.sts_rating || 200}
                  onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, sts_rating: parseFloat(e.target.value) } })}
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                />
              </div>
              <div className="mt-2">
                <label className="text-gray-500 font-medium text-xs">Battery Capacity (kWh)</label>
                <input
                  type="number"
                  value={selectedObject.specifications?.battery_capacity || 200}
                  onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, battery_capacity: parseFloat(e.target.value) } })}
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                />
              </div>
              <div className="mt-2">
                <label className="text-gray-500 font-medium text-xs">MPPT Channels</label>
                <input
                  type="number"
                  value={selectedObject.specifications?.mppt_channels || 1}
                  onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, mppt_channels: parseFloat(e.target.value) } })}
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                />
              </div>
            </div>
          )}

          {/* PSS Specs */}
          {selectedObject.type === 'pss' && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-gray-600 font-bold text-xs mb-2">Power Switching System (PLC)</h4>
              <div>
                <label className="text-gray-500 font-medium text-xs">Rating (Amps)</label>
                <input
                  type="number"
                  value={selectedObject.specifications?.rating_amps || 100}
                  onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, rating_amps: parseFloat(e.target.value) } })}
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                />
              </div>
              <div className="mt-2">
                <label className="text-gray-500 font-medium text-xs">Voltage Rating (V)</label>
                <input
                  type="number"
                  value={selectedObject.specifications?.voltage_rating || 415}
                  onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, voltage_rating: parseFloat(e.target.value) } })}
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                />
              </div>
              <div className="mt-2">
                <label className="text-gray-500 font-medium text-xs">Switching Logic</label>
                <select
                  value={selectedObject.specifications?.logic || 'auto'}
                  onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, logic: e.target.value } })}
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                >
                  <option value="auto">Auto (Grid Priority)</option>
                  <option value="manual_grid">Manual (Grid Only)</option>
                  <option value="manual_battery">Manual (Battery Only)</option>
                </select>
              </div>
            </div>
          )}

          {/* Transformer Specs */}
          {selectedObject.type === 'transformer' && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-gray-600 font-bold text-xs mb-2">Transformer Specs</h4>
              <div>
                <label className="text-gray-500 font-medium text-xs">Rating (kVA)</label>
                <input
                  type="number"
                  value={selectedObject.specifications?.rating_kva || 500}
                  onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, rating_kva: parseFloat(e.target.value) } })}
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                />
              </div>
              <div className="mt-2">
                <label className="text-gray-500 font-medium text-xs">Primary Voltage (V)</label>
                <select
                  value={selectedObject.specifications?.primary_voltage || 11000}
                  onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, primary_voltage: parseInt(e.target.value) } })}
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                >
                  <option value={11000}>11 kV</option>
                  <option value={33000}>33 kV</option>
                </select>
              </div>
              <div className="mt-2">
                <label className="text-gray-500 font-medium text-xs">Secondary Voltage (V)</label>
                <input
                  type="number"
                  value={selectedObject.specifications?.secondary_voltage || 415}
                  onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, secondary_voltage: parseFloat(e.target.value) } })}
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                />
              </div>
              <div className="mt-2">
                <label className="text-gray-500 font-medium text-xs">Vector Group</label>
                <input
                  type="text"
                  value={selectedObject.specifications?.vector_group || "Dyn11"}
                  onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, vector_group: e.target.value } })}
                  className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                />
              </div>
            </div>
          )}

          {/* Technical Specifications (Editable) */}
          {(selectedObject.type === 'panel' || selectedObject.type === 'inverter' || selectedObject.type === 'battery') && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-gray-600 font-bold text-xs mb-2">Technical Specs</h4>
              <div className="space-y-2">
                {selectedObject.type === 'panel' && (
                  <>
                    <div>
                      <label className="text-gray-500 font-medium text-xs">Voc (V)</label>
                      <input
                        type="number"
                        value={selectedObject.specifications?.voc || ""}
                        onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, voc: parseFloat(e.target.value) } })}
                        className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                        placeholder="Open Circuit Voltage"
                      />
                    </div>
                    <div>
                      <label className="text-gray-500 font-medium text-xs">Isc (A)</label>
                      <input
                        type="number"
                        value={selectedObject.specifications?.isc || ""}
                        onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, isc: parseFloat(e.target.value) } })}
                        className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                        placeholder="Short Circuit Current"
                      />
                    </div>
                    <div>
                      <label className="text-gray-500 font-medium text-xs">Efficiency (%)</label>
                      <input
                        type="number"
                        value={selectedObject.specifications?.efficiency || ""}
                        onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, efficiency: parseFloat(e.target.value) } })}
                        className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                      />
                    </div>
                  </>
                )}
                {selectedObject.type === 'inverter' && (
                  <>
                    <div>
                      <label className="text-gray-500 font-medium text-xs">Inverter Type</label>
                      <select
                        value={selectedObject.specifications?.inverter_type || "on_grid"}
                        onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, inverter_type: e.target.value } })}
                        className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                      >
                        <option value="on_grid">On-Grid Tie</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-500 font-medium text-xs">Output Voltage (V)</label>
                      <input
                        type="number"
                        value={selectedObject.specifications?.output_voltage || 230}
                        onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, output_voltage: parseFloat(e.target.value) } })}
                        className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-gray-500 font-medium text-xs">Efficiency (%)</label>
                      <input
                        type="number"
                        value={selectedObject.specifications?.efficiency || ""}
                        onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, efficiency: parseFloat(e.target.value) } })}
                        className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-gray-500 font-medium text-xs">Max DC Input (V)</label>
                      <input
                        type="number"
                        value={selectedObject.specifications?.max_dc_input || ""}
                        onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, max_dc_input: parseFloat(e.target.value) } })}
                        className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                      />
                    </div>
                  </>
                )}
                {selectedObject.type === 'battery' && (
                  <>
                    <div>
                      <label className="text-gray-500 font-medium text-xs">Voltage (V)</label>
                      <input
                        type="number"
                        value={selectedObject.specifications?.voltage || ""}
                        onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, voltage: parseFloat(e.target.value) } })}
                        className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-gray-500 font-medium text-xs">DoD (%)</label>
                      <input
                        type="number"
                        value={selectedObject.specifications?.dod || ""}
                        onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, dod: parseFloat(e.target.value) } })}
                        className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                      />
                    </div>
                  </>
                )}

                {/* Other specs */}
                {selectedObject.specifications && Object.entries(selectedObject.specifications).map(([key, value]) => {
                  if (['voc', 'isc', 'efficiency', 'temp_coeff', 'max_dc_input', 'mppt_channels', 'voltage', 'ah', 'dod', 'watts', 'capacity_kw', 'capacity_kwh', 'inverter_type'].includes(key)) return null;
                  return (
                    <div key={key}>
                      <label className="text-gray-500 font-medium text-xs capitalize">{key.replace(/_/g, ' ')}</label>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => updateObject(selectedObject.id, { specifications: { ...selectedObject.specifications, [key]: e.target.value } })}
                        className="w-full mt-1 px-2 py-1 bg-white border border-gray-300 text-gray-800 rounded text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper to get component descriptions
function getComponentDescription(obj) {
  const type = obj.type;
  const subtype = obj.subtype;

  if (type === 'panel' || type === 'Solar Panel') return "Captures sunlight and converts it into DC electricity. Key specs: Wattage (W) and Efficiency (%).";
  if (type === 'inverter' || type === 'Inverter') return "Converts DC electricity from panels into AC electricity for home/grid use. Essential for powering appliances.";
  if (type === 'battery' || type === 'Battery') return "Stores excess energy for use during power outages or at night. Critical for off-grid or hybrid systems.";
  if (type === 'structure') return "Mounting system for solar panels. Can be Roof-mounted (RCC), Tin Shed, or Ground-mounted.";

  if (type === 'grid') return "Connection point to the utility grid (11kV/33kV). Acts as the main power source or sink for export.";
  if (type === 'transformer') return "Steps down high voltage (11kV) from grid to low voltage (415V) suitable for building use.";

  if (type === 'lt_panel' || subtype === 'lt_panel') return "Low Tension (LT) Panel. Distributes 415V power to various loads and sub-panels. Contains breakers and meters.";
  if (type === 'ht_panel' || subtype === 'ht_panel') return "High Tension (HT) Panel. Manages 11kV/33kV power before the transformer. Ensures safety at high voltage.";

  if (type === 'vcb') return "Vacuum Circuit Breaker (VCB). A robust switch for high voltage (11kV+) protection. Extinguishes arcs in a vacuum.";
  if (type === 'acb') return "Air Circuit Breaker (ACB). A heavy-duty switch for low voltage (415V) high-current protection. Prevents overloads.";

  if (type === 'bess') return "Battery Energy Storage System (BESS). Large-scale storage with integrated Power Conversion System (PCS) and Static Transfer Switch (STS).";
  if (type === 'pss') return "Power Switching System (PSS) with PLC. Intelligently switches between Grid, Generator, and Battery sources based on logic.";

  if (type === 'acdb' || subtype === 'acdb') return "AC Distribution Box. A smaller panel for distributing AC power to specific appliances or rooms.";
  if (subtype === 'la') return "Lightning Arrestor. Protects the system and structure from direct lightning strikes by grounding the surge.";
  if (subtype === 'earth') return "Earthing Pit. Provides a low-resistance path to ground for fault currents, ensuring safety for personnel and equipment.";

  if (type === 'load') return "Simulates electrical consumption (e.g., HVAC, Lights, Motors). Used to test if the system can meet demand.";

  return "Select a component to view its details and usage.";
}
