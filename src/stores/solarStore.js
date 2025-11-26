import { create } from "zustand";
import { runSimulation } from "../utils/simulation";
import { projectService } from "../lib/supabase";

export const useSolarStore = create((set, get) => ({
  // Canvas state
  canvas: null,
  ctx: null,
  scale: 25,
  offsetX: 0,
  offsetY: 0,
  showGrid: true,
  showCompass: true,

  // Mode and tools
  mode: "select", // select, measure, delete, wire_dc, wire_ac, earthing, structure, obstacle, draw_rect, draw_poly, draw_free
  cableMode: "straight", // straight or orthogonal
  drawingMode: null, // "rectangle", "polygon", "freehand"
  drawingType: "structure", // "structure", "tree", "obstacle", "custom"
  drawingPoints: [], // Points being drawn in polygon/freehand mode
  drawingPreview: null, // Preview of current drawing
  drawingHeight: 3.0, // Height of structure being drawn (in meters)
  alignmentGuides: [], // Array of lines {x1, y1, x2, y2} for dynamic alignment

  // Location & Orientation
  latitude: 28.6, // Default: Delhi
  longitude: 77.2,
  orientation: 0, // 0-360 degrees, 0=North, 90=East

  // Financial Parameters
  gridRate: 8.5,
  exportRate: 3.0,
  baseLoad: 500,
  systemCost: 0,
  isCommercial: false,
  extraCostItems: [],
  boqOverrides: {},

  // Location & Orientation setters
  setLatitude: (latitude) => set({ latitude }),
  setLongitude: (longitude) => set({ longitude }),
  setOrientation: (orientation) => set({ orientation }),

  // Financial setters
  setGridRate: (gridRate) => set({ gridRate }),
  setExportRate: (exportRate) => set({ exportRate }),
  setBaseLoad: (baseLoad) => set({ baseLoad }),
  setSystemCost: (systemCost) => set({ systemCost }),
  setIsCommercial: (isCommercial) => set({ isCommercial }),
  addExtraCostItem: (item) => set((state) => ({ extraCostItems: [...state.extraCostItems, item] })),
  removeExtraCostItem: (id) => set((state) => ({ extraCostItems: state.extraCostItems.filter(i => i.id !== id) })),
  setBoqOverride: (key, override) => set((state) => ({ boqOverrides: { ...state.boqOverrides, [key]: override } })),
  removeBoqOverride: (key) => set((state) => {
    const newOverrides = { ...state.boqOverrides };
    delete newOverrides[key];
    return { boqOverrides: newOverrides };
  }),

  // Objects and wires
  objects: [],
  wires: [],
  selectedObjectId: null,
  additionalSelectedIds: [], // For multi-select
  selectionBox: null, // {x, y, w, h}
  clipboard: null,

  setSelectionBox: (box) => set({ selectionBox: box }),

  // History
  history: [],
  historyStep: -1,

  // Simulation
  sunTime: 10,
  showSun: true,
  isAnimating: false,
  animationSpeed: 1, // 0.5x, 1x, 2x, 4x
  simMonth: 0,
  simDayGen: 0,
  simTotalGen: 0,
  simTotalImport: 0,
  simTotalExport: 0,

  setShowSun: (show) => set({ showSun: show }),

  // Equipment
  equipmentTypes: [],
  equipmentLibrary: {},
  selectedPreset: null,
  selectedPanelType: {
    watts: 550,
    w: 1.134,
    h: 2.278,
    cost: 15000,
    label: "550W Panel"
  },

  // Weather & Location
  weather: null,
  isLoadingWeather: false,
  showWeatherPanel: false,

  // UI State
  isEvaluationOpen: false,
  isCustomComponentOpen: false,
  isMapSetupOpen: false,
  evaluationData: null,

  // Map State
  mapSettings: {
    googleApiKey: "",
    geminiApiKey: "",
    zoom: 20,
    mapImage: null,
    mapOverlayActive: false,
  },
  setMapSetupOpen: (isOpen) => set({ isMapSetupOpen: isOpen }),
  setMapSettings: (settings) =>
    set((state) => ({ mapSettings: { ...state.mapSettings, ...settings } })),
  theme: "dark", // dark, light, sepia

  // Actions
  setCanvas: (canvas, ctx) => set({ canvas, ctx }),
  setMode: (mode) => set({ mode }),
  setCableMode: (cableMode) => set({ cableMode }),
  setAiImportMode: (aiImportMode) => set({ aiImportMode }),
  setScale: (scale) => set({ scale }),
  setOffset: (offsetX, offsetY) => set({ offsetX, offsetY }),
  setShowGrid: (showGrid) => set({ showGrid }),

  // Drawing tools
  setDrawingMode: (mode) => set({ drawingMode: mode }),
  setDrawingType: (type) => set({ drawingType: type }),
  setAlignmentGuides: (guides) => set({ alignmentGuides: guides }),
  setDrawingHeight: (height) => set({ drawingHeight: height }),
  addDrawingPoint: (point) =>
    set((state) => ({
      drawingPoints: [...state.drawingPoints, point],
    })),
  setDrawingPoints: (points) => set({ drawingPoints: points }),
  setDrawingPreview: (preview) => set({ drawingPreview: preview }),
  clearDrawing: () =>
    set({
      drawingMode: null,
      drawingType: "structure",
      drawingPoints: [],
      drawingPreview: null,
    }),

  // Object management
  addObject: (obj) =>
    set((state) => {
      const newObjects = [...state.objects, obj];
      return {
        objects: newObjects,
        history: [
          ...state.history.slice(0, state.historyStep + 1),
          JSON.stringify({
            objects: newObjects,
            wires: state.wires,
          }),
        ],
        historyStep: state.historyStep + 1,
      };
    }),

  updateObject: (id, updates) =>
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, ...updates } : obj
      ),
    })),

  deleteObject: (id) =>
    set((state) => ({
      objects: state.objects.filter((obj) => obj.id !== id),
      wires: state.wires.filter((wire) => wire.from !== id && wire.to !== id),
    })),

  setSelectedObject: (id) => set({ selectedObjectId: id, additionalSelectedIds: [] }),
  setAdditionalSelectedIds: (ids) => set({ additionalSelectedIds: ids }),

  // Wire management
  addWire: (wire) =>
    set((state) => ({
      wires: [...state.wires, wire],
    })),

  deleteWire: (id) =>
    set((state) => ({
      wires: state.wires.filter((wire) => wire.id !== id),
    })),

  // History management
  undo: () =>
    set((state) => {
      if (state.historyStep > 0) {
        const newStep = state.historyStep - 1;
        const snapshot = JSON.parse(state.history[newStep]);
        return {
          historyStep: newStep,
          objects: snapshot.objects,
          wires: snapshot.wires,
        };
      }
      return state;
    }),

  redo: () =>
    set((state) => {
      if (state.historyStep < state.history.length - 1) {
        const newStep = state.historyStep + 1;
        const snapshot = JSON.parse(state.history[newStep]);
        return {
          historyStep: newStep,
          objects: snapshot.objects,
          wires: snapshot.wires,
        };
      }
      return state;
    }),

  // Save current state to history (for undo/redo)
  saveState: () =>
    set((state) => ({
      history: [
        ...state.history.slice(0, state.historyStep + 1),
        JSON.stringify({
          objects: state.objects,
          wires: state.wires,
        }),
      ],
      historyStep: state.historyStep + 1,
    })),

  // Equipment
  setEquipmentTypes: (types) => set({ equipmentTypes: types }),
  setEquipmentLibrary: (library) => set({ equipmentLibrary: library }),
  setSelectedPreset: (preset) => set({ selectedPreset: preset }),

  // Simulation
  setSunTime: (sunTime) => set({ sunTime }),
  setIsAnimating: (isAnimating) => set({ isAnimating }),
  setAnimationSpeed: (speed) => set({ animationSpeed: speed }),
  setSimulationData: (data) => set({ ...data }),

  // UI
  setEvaluationOpen: (isOpen) => set({ isEvaluationOpen: isOpen }),
  setCustomComponentOpen: (isOpen) =>
    set({ isCustomComponentOpen: isOpen }),
  setEvaluationData: (data) => set({ evaluationData: data }),
  setTheme: (theme) => set({ theme }),

  // Panel selection for array drawing
  setSelectedPanelType: (panelType) => set({ selectedPanelType: panelType }),

  // Weather
  setWeather: (weather) => set({ weather }),
  setIsLoadingWeather: (isLoading) => set({ isLoadingWeather: isLoading }),
  setShowWeatherPanel: (show) => set({ showWeatherPanel: show }),

  // Load weather for current location
  loadWeather: async () => {
    const state = get();
    const { latitude, longitude } = state;

    // Import here to avoid circular dependencies
    const { weatherService } = await import("../utils/weatherService");

    set({ isLoadingWeather: true });
    try {
      const weatherData = await weatherService.getCurrentWeather(latitude, longitude);
      set({ weather: weatherData, isLoadingWeather: false });
      return weatherData;
    } catch (error) {
      console.error("Failed to load weather:", error);
      set({ isLoadingWeather: false });
      return null;
    }
  },

  // Project management
  saveProject: () => {
    const state = get();
    return {
      objects: state.objects,
      wires: state.wires,
      settings: {
        scale: state.scale,
        offsetX: state.offsetX,
        offsetY: state.offsetY,
        showGrid: state.showGrid,
        cableMode: state.cableMode,
      },
    };
  },

  loadProject: (project) =>
    set({
      objects: project.objects || [],
      wires: project.wires || [],
      scale: project.settings?.scale || 25,
      offsetX: project.settings?.offsetX || 0,
      offsetY: project.settings?.offsetY || 0,
      showGrid: project.settings?.showGrid !== false,
      cableMode: project.settings?.cableMode || "straight",
    }),

  clearProject: () =>
    set({
      objects: [],
      wires: [],
      history: [],
      historyStep: -1,
    }),

  // Evaluation
  runEvaluation: () => {
    const state = get();
    const results = runSimulation(state.objects, state.wires, {
      gridRate: state.gridRate,
      exportRate: state.exportRate,
      baseLoad: state.baseLoad,
      systemCost: state.systemCost,
      isCommercial: state.isCommercial,
      extraCostItems: state.extraCostItems,
      boqOverrides: state.boqOverrides,
    });
    set({
      evaluationData: results,
      isEvaluationOpen: true,
    });
    return results;
  },

  // Supabase projects
  currentProjectId: null,
  projects: [],
  isLoadingProjects: false,
  setCurrentProjectId: (id) => set({ currentProjectId: id }),
  setProjects: (projects) => set({ projects }),
  setIsLoadingProjects: (loading) => set({ isLoadingProjects: loading }),

  // Save project to Supabase
  saveToSupabase: async (projectName) => {
    try {
      set({ isLoadingProjects: true });
      const state = get();
      const projectData = {
        objects: state.objects,
        wires: state.wires,
        settings: {
          scale: state.scale,
          offsetX: state.offsetX,
          offsetY: state.offsetY,
          showGrid: state.showGrid,
          cableMode: state.cableMode,
        },
      };

      const result = await projectService.saveProject(projectName, projectData);
      set({ currentProjectId: result.id, isLoadingProjects: false });
      return result;
    } catch (error) {
      set({ isLoadingProjects: false });
      throw error;
    }
  },

  // Update project on Supabase
  updateSupabaseProject: async (projectId, projectName) => {
    try {
      set({ isLoadingProjects: true });
      const state = get();
      const projectData = {
        objects: state.objects,
        wires: state.wires,
        settings: {
          scale: state.scale,
          offsetX: state.offsetX,
          offsetY: state.offsetY,
          showGrid: state.showGrid,
          cableMode: state.cableMode,
        },
      };

      const result = await projectService.updateProject(projectId, projectData);
      set({ isLoadingProjects: false });
      return result;
    } catch (error) {
      set({ isLoadingProjects: false });
      throw error;
    }
  },

  // Load project from Supabase
  loadFromSupabase: async (projectId) => {
    try {
      set({ isLoadingProjects: true });
      const result = await projectService.loadProject(projectId);

      set({
        objects: result.canvas_data.objects || [],
        wires: result.canvas_data.wires || [],
        scale: result.canvas_data.settings?.scale || 25,
        offsetX: result.canvas_data.settings?.offsetX || 0,
        offsetY: result.canvas_data.settings?.offsetY || 0,
        showGrid: result.canvas_data.settings?.showGrid !== false,
        cableMode: result.canvas_data.settings?.cableMode || "straight",
        currentProjectId: projectId,
        isLoadingProjects: false,
      });

      return result;
    } catch (error) {
      set({ isLoadingProjects: false });
      throw error;
    }
  },

  // List user's projects
  loadProjectsList: async () => {
    try {
      set({ isLoadingProjects: true });
      const projects = await projectService.listUserProjects();
      set({ projects, isLoadingProjects: false });
      return projects;
    } catch (error) {
      set({ isLoadingProjects: false });
      throw error;
    }
  },

  // Delete project from Supabase
  deleteSupabaseProject: async (projectId) => {
    try {
      set({ isLoadingProjects: true });
      await projectService.deleteProject(projectId);
      const state = get();
      set({
        projects: state.projects.filter((p) => p.id !== projectId),
        currentProjectId: state.currentProjectId === projectId ? null : state.currentProjectId,
        isLoadingProjects: false,
      });
    } catch (error) {
      set({ isLoadingProjects: false });
      throw error;
    }
  },
}));
