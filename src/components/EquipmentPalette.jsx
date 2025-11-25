import React, { useState } from "react";
import { useSolarStore } from "../stores/solarStore";

export default function EquipmentPalette({ equipment }) {
  const [showDetails, setShowDetails] = useState(false);
  const setMode = useSolarStore((state) => state.setMode);
  const setSelectedPreset = useSolarStore((state) => state.setSelectedPreset);
  const setSelectedPanelType = useSolarStore((state) => state.setSelectedPanelType);

  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("equipment", JSON.stringify(equipment));
  };

  const handleClick = () => {
    // Set place mode and select this equipment
    // User will now click/drag on canvas to place it
    setMode("place");
    setSelectedPreset(equipment);

    // Also set selectedPanelType for panel array placement
    if (equipment.equipment_types?.name === "Solar Panel" || equipment.type === "panel") {
      const panelType = {
        w: equipment.width || equipment.specifications?.width || 1.134,
        h: equipment.height || equipment.specifications?.height || 2.278,
        watts: equipment.specifications?.watts || 550,
        cost: parseFloat(equipment.cost) || 15000,
        label: equipment.name || "Panel"
      };
      setSelectedPanelType(panelType);
    }
  };

  return (
    <div className="border-b border-gray-200 p-3 hover:bg-gray-100 transition cursor-move"
      draggable
      onDragStart={handleDragStart}
    >
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={handleClick}
      >
        <div className="flex items-center gap-2 flex-1">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: equipment.color || "#1e3a8a" }}
          ></div>
          <div className="flex-1">
            <div className="text-gray-900 text-sm font-medium">
              {equipment.name}
            </div>
            <div className="text-gray-600 text-xs">
              {equipment.model_number}
            </div>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDetails(!showDetails);
          }}
          className="px-2 py-1 text-xs bg-gray-300 hover:bg-gray-400 text-gray-800 rounded transition"
        >
          <i className="fas fa-info-circle"></i>
        </button>
      </div>

      {showDetails && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
          {equipment.manufacturer && (
            <div className="text-xs text-gray-700">
              <span className="font-medium">Mfg:</span> {equipment.manufacturer}
            </div>
          )}
          <div className="text-xs text-green-700 font-medium">
            ₹{parseInt(equipment.cost).toLocaleString()}
          </div>
          {equipment.specifications && (
            <div className="bg-gray-100 p-2 rounded text-xs space-y-1">
              {Object.entries(equipment.specifications)
                .slice(0, 3)
                .map(([key, value]) => (
                  <div key={key} className="text-gray-700">
                    <span className="font-medium">{key}:</span> {String(value)}
                  </div>
                ))}
            </div>
          )}
          {equipment.spec_sheets && equipment.spec_sheets.length > 0 && (
            <div className="text-xs text-blue-700">
              <i className="fas fa-file-pdf mr-1"></i>
              {equipment.spec_sheets.length} spec sheet(s)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
