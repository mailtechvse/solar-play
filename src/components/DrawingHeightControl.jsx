import React, { useEffect, useState } from "react";
import { useSolarStore } from "../stores/solarStore";

export default function DrawingHeightControl() {
  const drawingMode = useSolarStore((state) => state.drawingMode);
  const drawingHeight = useSolarStore((state) => state.drawingHeight);
  const setDrawingHeight = useSolarStore((state) => state.setDrawingHeight);

  const selectedObjectId = useSolarStore((state) => state.selectedObjectId);
  const objects = useSolarStore((state) => state.objects);
  const updateObject = useSolarStore((state) => state.updateObject);

  const [localHeight, setLocalHeight] = useState(drawingHeight);

  // Determine if we are editing a selected object or setting drawing height
  const selectedObject = selectedObjectId ? objects.find(o => o.id === selectedObjectId) : null;
  const isEditingSelection = !!selectedObject;

  // Sync local state with store
  useEffect(() => {
    if (isEditingSelection) {
      setLocalHeight(selectedObject.h_z || 0);
    } else {
      setLocalHeight(drawingHeight);
    }
  }, [isEditingSelection, selectedObject?.h_z, drawingHeight]);

  const handleHeightChange = (val) => {
    const newHeight = parseFloat(val);
    setLocalHeight(newHeight);

    if (isEditingSelection) {
      updateObject(selectedObjectId, { h_z: newHeight });
    } else {
      setDrawingHeight(newHeight);
    }
  };

  // Show if drawing or if an object is selected
  if (!drawingMode && !isEditingSelection) return null;

  const title = isEditingSelection
    ? `Edit ${selectedObject.label || selectedObject.type} Height`
    : "Structure Height (New)";

  return (
    <div className="absolute top-6 left-6 bg-gray-900 bg-opacity-95 p-4 rounded-lg border border-gray-600 w-72 backdrop-blur-sm shadow-xl z-30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <i className="fas fa-cube text-yellow-400"></i>
          <span className="text-sm font-bold text-gray-300 uppercase truncate max-w-[200px]">{title}</span>
        </div>
      </div>

      <div className="space-y-3">
        {/* Height Slider */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-2">
            Height (meters): {localHeight.toFixed(2)} m
          </label>
          <input
            type="range"
            min="0"
            max="50"
            step="0.1"
            value={localHeight}
            onChange={(e) => handleHeightChange(e.target.value)}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-gray-500 mt-1">
            <span>0m</span>
            <span>25m</span>
            <span>50m</span>
          </div>
        </div>

        {/* Quick Height Buttons */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-2">
            Quick Set
          </label>
          <div className="grid grid-cols-4 gap-1">
            {[2, 3, 5, 10].map((h) => (
              <button
                key={h}
                onClick={() => handleHeightChange(h)}
                className={`py-1 rounded text-[10px] font-bold transition ${Math.abs(localHeight - h) < 0.1
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
              >
                {h}m
              </button>
            ))}
          </div>
        </div>

        {/* Info Text */}
        <div className="bg-gray-800 p-2 rounded border border-gray-700">
          <p className="text-[10px] text-gray-400">
            💡 <span className="text-gray-300">
              {isEditingSelection ? "Adjusting selected object height." : "Set height before drawing."}
            </span>
            {" "}Height affects shadow casting.
          </p>
        </div>
      </div>
    </div>
  );
}
