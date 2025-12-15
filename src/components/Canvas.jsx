import React, { useEffect, useRef } from "react";
import { useSolarStore } from "../stores/solarStore";
import { renderCanvas, setColorTheme } from "../utils/canvas";
import { handleCanvasEvents, handleAiImport } from "../utils/canvasEvents";
import SimulationControls from "./SimulationControls";
import MapOverlay from './MapOverlay';
import ShortcutsModal from "./ShortcutsModal";
import ToastNotification from "./ToastNotification";
import { runLiveLogic } from "../utils/logicController";

export default function Canvas() {
  const canvasRef = useRef(null);
  const setCanvas = useSolarStore((state) => state.setCanvas);
  const scale = useSolarStore((state) => state.scale);
  const offsetX = useSolarStore((state) => state.offsetX);
  const offsetY = useSolarStore((state) => state.offsetY);
  const showGrid = useSolarStore((state) => state.showGrid);
  const showLabels = useSolarStore((state) => state.showLabels);
  const objects = useSolarStore((state) => state.objects);
  const wires = useSolarStore((state) => state.wires);
  const selectedObjectId = useSolarStore((state) => state.selectedObjectId);
  const additionalSelectedIds = useSolarStore((state) => state.additionalSelectedIds);
  const orientation = useSolarStore((state) => state.orientation);
  const theme = useSolarStore((state) => state.theme);
  const sunTime = useSolarStore((state) => state.sunTime);
  const latitude = useSolarStore((state) => state.latitude);
  const longitude = useSolarStore((state) => state.longitude);
  const cableMode = useSolarStore((state) => state.cableMode);
  const drawingMode = useSolarStore((state) => state.drawingMode);
  const drawingPoints = useSolarStore((state) => state.drawingPoints);
  const drawingPreview = useSolarStore((state) => state.drawingPreview);
  const mapSettings = useSolarStore((state) => state.mapSettings);
  const selectionBox = useSolarStore((state) => state.selectionBox);
  const aiImportMode = useSolarStore((state) => state.aiImportMode);
  const isShortcutsOpen = useSolarStore((state) => state.isShortcutsOpen);
  const setShortcutsOpen = useSolarStore((state) => state.setShortcutsOpen);
  const isAnimating = useSolarStore((state) => state.isAnimating);
  const setIsLogicProcessing = useSolarStore((state) => state.setIsLogicProcessing);
  const store = useSolarStore(); // Get the entire store for actions/state access

  const flowOffset = useRef(0);
  const [loadedMapImage, setLoadedMapImage] = React.useState(null);

  // Load map image when URL changes
  useEffect(() => {
    if (mapSettings?.mapImage && mapSettings.mapOverlayActive) {
      const img = new Image();
      img.src = mapSettings.mapImage;
      img.onload = () => setLoadedMapImage(img);
      img.onerror = (e) => {
        console.error("Failed to load map image:", mapSettings.mapImage, e);
        setLoadedMapImage(null);
      };
    } else {
      setLoadedMapImage(null);
    }
  }, [mapSettings?.mapImage, mapSettings?.mapOverlayActive]);

  // Apply theme when it changes
  useEffect(() => {
    setColorTheme(theme);
  }, [theme]);


  // Animation Loop
  useEffect(() => {
    let animationFrameId;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      // Update flow offset ONLY if logic is not processing (simulating pause)
      if (!useSolarStore.getState().isLogicProcessing) {
        flowOffset.current = (performance.now() / 50) % 100;
      }

      // Get latest state
      const state = useSolarStore.getState();

      // Calculate meters per pixel (replicated logic)
      const metersPerPixel = state.mapSettings?.zoom
        ? 156543.03392 * Math.cos(state.latitude * Math.PI / 180) / Math.pow(2, state.mapSettings.zoom)
        : 0.5;

      renderCanvas(canvas, ctx, {
        ...state,
        mapImage: loadedMapImage,
        mapMetersPerPixel: metersPerPixel,
        flowOffset: flowOffset.current
      });

      animationFrameId = requestAnimationFrame(render);
    };

    if (isAnimating) {
      render();
    } else {
      flowOffset.current = 0;
      // Trigger a re-render to clear animation state
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        const state = useSolarStore.getState();
        const metersPerPixel = state.mapSettings?.zoom
          ? 156543.03392 * Math.cos(state.latitude * Math.PI / 180) / Math.pow(2, state.mapSettings.zoom)
          : 0.5;
        renderCanvas(canvas, ctx, {
          ...state,
          mapImage: loadedMapImage,
          mapMetersPerPixel: metersPerPixel,
          flowOffset: 0
        });
      }
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isAnimating, loadedMapImage]);

  // Main Render Effect (Static updates and event listeners)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    setCanvas(canvas, ctx);

    // Calculate meters per pixel for map
    const metersPerPixel = mapSettings?.zoom
      ? 156543.03392 * Math.cos(latitude * Math.PI / 180) / Math.pow(2, mapSettings.zoom)
      : 0.5;

    // Render initial frame
    renderCanvas(canvas, ctx, {
      scale,
      offsetX,
      offsetY,
      showGrid,
      showLabels,
      objects,
      wires,
      selectedObjectId,
      additionalSelectedIds,
      sunTime,
      orientation,
      cableMode,
      lat: latitude,
      lon: longitude,
      drawingMode,
      drawingPoints,
      drawingPreview,
      selectionBox,
      alignmentGuides: store.alignmentGuides,
      measureStart: store.measureStart,
      measureEnd: store.measureEnd,
      mapImage: loadedMapImage,
      mapMetersPerPixel: metersPerPixel,
      flowOffset: flowOffset.current // Pass current offset
    });

    // Event listeners
    // These are handled by the onMouseDown etc. props on the canvas element now
    // The handleCanvasEvents utility function takes care of dispatching actions
    // based on the event type and current store state.
    // No need to add/remove event listeners here explicitly for mouse/touch events.
    // Only window-level events like keydown need to be managed here.

    const handleKeyDown = (e) => {
      // Handle global shortcuts here or delegate
      if (e.key === 'r' || e.key === 'R') {
        const store = useSolarStore.getState();
        // 1. Rotate Placement Preview
        const currentRot = store.placementRotation || 0;
        store.setPlacementRotation((currentRot + 90) % 360);

        // 2. Rotate Selected Object(s)
        if (store.selectedObjectId) {
          const obj = store.objects.find(o => o.id === store.selectedObjectId);
          if (obj) {
            store.updateObject(obj.id, { rotation: ((obj.rotation || 0) + 90) % 360 });
          }
        }
      }

      if (handleCanvasEvents.onKeyDown) {
        handleCanvasEvents.onKeyDown(e);
      }
    };
    window.addEventListener("keydown", handleKeyDown, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { passive: false });
    };
  }, [
    setCanvas,
    scale,
    offsetX,
    offsetY,
    showGrid,
    showLabels,
    objects,
    wires,
    selectedObjectId,
    additionalSelectedIds,
    sunTime,
    orientation,
    cableMode,
    latitude,
    longitude,
    drawingMode,
    drawingPoints,
    drawingPreview,
    selectionBox,
    store.alignmentGuides, // Depend on store parts if they trigger a re-render
    store.measureStart,
    store.measureEnd,
    loadedMapImage,
    mapSettings,
    // isAnimating is NOT here to avoid conflict, handled by separate effect
  ]);

  return (
    <div className="relative w-full h-full bg-gray-900 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block w-full h-full cursor-crosshair touch-none"
        onMouseDown={(e) => handleCanvasEvents.onMouseDown(e, canvasRef.current)}
        onMouseMove={(e) => handleCanvasEvents.onMouseMove(e, canvasRef.current)}
        onMouseUp={(e) => handleCanvasEvents.onMouseUp(e, canvasRef.current)}
        onWheel={(e) => handleCanvasEvents.onWheel(e, canvasRef.current)}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Overlays */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <h1 className="text-xl font-bold text-white drop-shadow-md">
          Solar Architect <span className="text-xs font-normal opacity-70">Grid Master v1.2</span>
        </h1>
      </div>

      <SimulationControls />

      {mapSettings.mapOverlayActive && (
        <MapOverlay />
      )}

      {/* Shortcuts Modal */}
      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Toast Notifications */}
      <ToastNotification />

      {/* AI Import Modal */}
      {aiImportMode && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-6 rounded-lg shadow-xl max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">AI Building Import</h2>
            <p className="text-gray-300 mb-4">
              Click on the map to select a location to import building data.
            </p>
            <button
              onClick={() => store.setAiImportMode(false)}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
