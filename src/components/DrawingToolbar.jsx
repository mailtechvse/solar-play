import React from "react";
import { useSolarStore } from "../stores/solarStore";

export default function DrawingToolbar() {
  const drawingMode = useSolarStore((state) => state.drawingMode);
  const setDrawingMode = useSolarStore((state) => state.setDrawingMode);
  const clearDrawing = useSolarStore((state) => state.clearDrawing);

  const handleToolClick = (mode) => {
    if (drawingMode === mode) {
      // Deselect the tool
      clearDrawing();
    } else {
      // Select the tool
      setDrawingMode(mode);
    }
  };

  return (
    <div className="absolute top-20 left-6 flex flex-col gap-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-2 z-40">
      {/* Title */}
      <div className="text-gray-300 text-xs font-semibold px-2 pt-2">
        Drawing Tools
      </div>

      {/* Rectangle Tool */}
      <button
        onClick={() => handleToolClick("rectangle")}
        className={`px-3 py-2 rounded text-sm transition flex items-center gap-2 ${
          drawingMode === "rectangle"
            ? "bg-blue-600 text-white"
            : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
        }`}
        title="Draw Rectangle - Click and drag to create rectangular structures"
      >
        <i className="fas fa-square"></i>
        <span>Rectangle</span>
      </button>

      {/* Polygon Tool */}
      <button
        onClick={() => handleToolClick("polygon")}
        className={`px-3 py-2 rounded text-sm transition flex items-center gap-2 ${
          drawingMode === "polygon"
            ? "bg-blue-600 text-white"
            : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
        }`}
        title="Draw Polygon - Click to place points, double-click to finish"
      >
        <i className="fas fa-draw-polygon"></i>
        <span>Polygon</span>
      </button>

      {/* Freehand Tool */}
      <button
        onClick={() => handleToolClick("freehand")}
        className={`px-3 py-2 rounded text-sm transition flex items-center gap-2 ${
          drawingMode === "freehand"
            ? "bg-blue-600 text-white"
            : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
        }`}
        title="Draw Freehand - Click and drag to draw freely, release to finish"
      >
        <i className="fas fa-pen"></i>
        <span>Freehand</span>
      </button>

      {/* Info Text */}
      {drawingMode && (
        <div className="mt-2 pt-2 border-t border-gray-600">
          <div className="text-xs text-gray-400 px-2">
            {drawingMode === "rectangle" && (
              <div>
                <div className="font-semibold text-gray-300 mb-1">Rectangle</div>
                <div>Click and drag to create</div>
              </div>
            )}
            {drawingMode === "polygon" && (
              <div>
                <div className="font-semibold text-gray-300 mb-1">Polygon</div>
                <div>Click to add points</div>
                <div>Double-click to finish</div>
              </div>
            )}
            {drawingMode === "freehand" && (
              <div>
                <div className="font-semibold text-gray-300 mb-1">Freehand</div>
                <div>Click and drag to draw</div>
                <div>Release to finish</div>
              </div>
            )}
          </div>

          {/* Cancel Button */}
          <button
            onClick={clearDrawing}
            className="w-full mt-2 px-2 py-1 bg-red-700 hover:bg-red-800 text-white text-xs rounded transition"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
