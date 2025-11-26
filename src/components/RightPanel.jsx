import React, { useState, useEffect } from "react";
import { useSolarStore } from "../stores/solarStore";

export default function RightPanel() {
  const selectedObjectId = useSolarStore((state) => state.selectedObjectId);
  const setSelectedObjectStore = useSolarStore((state) => state.setSelectedObject);
  const objects = useSolarStore((state) => state.objects);
  const updateObject = useSolarStore((state) => state.updateObject);
  const deleteObject = useSolarStore((state) => state.deleteObject);

  const [selectedObject, setSelectedObjectLocal] = useState(null);

  useEffect(() => {
    if (selectedObjectId) {
      const obj = objects.find((o) => o.id === selectedObjectId);
      setSelectedObjectLocal(obj);
    } else {
      setSelectedObjectLocal(null);
    }
  }, [selectedObjectId, objects]);

  if (!selectedObject) return null;

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
          <div className="flex items-center justify-between">
            <h3 className="text-gray-800 font-bold text-sm">{selectedObject.label || selectedObject.type}</h3>
            <button
              onClick={() => deleteObject(selectedObject.id)}
              className="px-2 py-1 text-xs bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded transition"
            >
              <i className="fas fa-trash"></i>
            </button>
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

          {/* Power Switch for Panels */}
          {(selectedObject.type === 'lt_panel' || selectedObject.type === 'ht_panel' || selectedObject.type === 'acdb') && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between">
                <label className="text-gray-500 font-medium text-xs">Power Status</label>
                <button
                  onClick={() => updateObject(selectedObject.id, { isOn: selectedObject.isOn === false ? true : false })}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition ${selectedObject.isOn !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                >
                  {selectedObject.isOn !== false ? 'ON' : 'OFF'}
                </button>
              </div>
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
