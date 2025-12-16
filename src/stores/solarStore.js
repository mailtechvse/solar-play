import { create } from "zustand";
import { runSimulation, calculateSystemMetrics } from "../utils/simulation";
import { projectService } from "../lib/supabase";
import { calculateFlows } from "../utils/powerFlow";

export const useSolarStore = create((set, get) => ({
  // Canvas state
  canvas: null,
  ctx: null,
  scale: 25,
  offsetX: 0,
  offsetY: 0,
  showGrid: true,
  showCompass: true,
  showDimensions: false,
  distanceGuides: [], // Guides showing distance between objects {x1, y1, x2, y2, label}


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
  placementRotation: 0, // Rotation for new objects being placed
  showLabels: true,
  showDimensions: false,
  distanceGuides: [],
  hoveredObjectId: null,
  setHoveredObject: (id) => set({ hoveredObjectId: id }),


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
  setPlacementRotation: (rotation) => set({ placementRotation: rotation }),

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
  selectedWireId: null,
  additionalSelectedIds: [], // For multi-select
  additionalSelectedIds: [], // For multi-select
  selectionBox: null, // {x, y, w, h}
  clipboard: null,

  setSelectionBox: (box) => set({ selectionBox: box }),
  setClipboard: (data) => set({ clipboard: data }),

  // History
  history: [],
  historyStep: -1,

  // Simulation
  sunTime: 10,
  showSun: true,
  isAnimating: false,
  isLogicProcessing: false,
  animationSpeed: 1, // 0.5x, 1x, 2x, 4x
  simMonth: 0,
  simDayGen: 0,
  simTotalGen: 0,
  simTotalImport: 0,
  simTotalExport: 0,

  setShowSun: (show) => set({ showSun: show }),
  setIsLogicProcessing: (isProcessing) => set({ isLogicProcessing: isProcessing }),

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
  isShortcutsOpen: false,
  evaluationData: null,

  // Map State
  mapSettings: {
    googleApiKey: "",
    geminiApiKey: "",
    zoom: 20,
    mapImage: null,
    mapOverlayActive: false,
  },

  // Clean up duplicate mapImage key from previous state if present
  // mapImage: null, (removed)

  // Customer Management
  activeCustomerId: null,
  activeCustomer: null,
  customers: [],
  isLoadingCustomers: false,

  setActiveCustomer: (customer) => set({
    activeCustomerId: customer ? customer.id : null,
    activeCustomer: customer,
    // When switching customer, clear current project or load default?
    // For now, let's just clear the project to avoid confusion
    objects: [],
    wires: [],
    currentProjectId: null
  }),

  setCustomers: (customers) => set({ customers }),

  fetchCustomers: async () => {
    try {
      set({ isLoadingCustomers: true });
      // Use operationsService provided by Supabase lib (imported above)
      // We need to dynamic import or use standard import.
      // Assuming operationsService is exported from '../lib/supabase' - YES it is.
      const { operationsService } = await import("../lib/supabase");
      // However, typical user might only see THEIR customers.
      // operationsService.getCustomers currently does simple select *. RLS will filter it.
      // But we might need 'getCustomerUsers' approach if RLS isn't perfect or if we want logic.
      // Let's rely on operationsService.getCustomers() respecting RLS.
      const data = await operationsService.getCustomers();

      set({ customers: data, isLoadingCustomers: false });

      // Select first customer if none selected
      const state = get();
      if (!state.activeCustomerId && data.length > 0) {
        set({ activeCustomerId: data[0].id, activeCustomer: data[0] });
        // Automatically load this customer's project
        state.loadCustomerProject(data[0].id);
      }
      return data;
    } catch (e) {
      console.error("Failed to fetch customers", e);
      set({ isLoadingCustomers: false });
    }
  },

  // Toast Notification
  toast: { message: "", type: "info", visible: false },
  showToast: (message, type = "info") => set({ toast: { message, type, visible: true } }),
  hideToast: () => set((state) => ({ toast: { ...state.toast, visible: false } })),

  setMapSetupOpen: (isOpen) => set({ isMapSetupOpen: isOpen }),
  setShortcutsOpen: (isOpen) => set({ isShortcutsOpen: isOpen }),
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
  setShowLabels: (show) => set({ showLabels: show }),

  // Grouping Actions
  groupObjects: (ids) => {
    const groupId = crypto.randomUUID();
    set((state) => ({
      objects: state.objects.map(obj =>
        ids.includes(obj.id) ? { ...obj, groupId } : obj
      )
    }));
    return groupId;
  },

  ungroupObjects: (ids) => {
    set((state) => ({
      objects: state.objects.map(obj =>
        ids.includes(obj.id) ? { ...obj, groupId: undefined } : obj
      )
    }));
  },

  // Drawing tools
  setDrawingMode: (mode) => set({ drawingMode: mode }),
  setDrawingType: (type) => set({ drawingType: type }),
  setDistanceGuides: (guides) => set({ distanceGuides: guides }),
  setShowDimensions: (show) => set({ showDimensions: show }),
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
  addObject: (object) =>
    set((state) => {
      // 1. Calculate height (h_z) based on underlying objects
      let baseZ = 0;
      const obj = object;

      // Simple Overlap Check
      state.objects.forEach(other => {
        const overlapW = Math.max(0, Math.min(obj.x + obj.w, other.x + other.w) - Math.max(obj.x, other.x));
        const overlapH = Math.max(0, Math.min(obj.y + obj.h, other.y + other.h) - Math.max(obj.y, other.y));
        const overlapArea = overlapW * overlapH;

        if (overlapArea > (obj.w * obj.h) * 0.1) { // 10% overlap sufficient for base detection
          const top = (other.h_z || 0);
          if (top > baseZ) baseZ = top;
        }
      });

      const h_z = baseZ + (obj.relative_h || 0);
      const newObject = { ...obj, h_z };

      const newObjects = [...state.objects, newObject];
      const flows = calculateFlows(newObjects, state.wires, { sunTime: state.sunTime });

      // Update Metrics (DC Capacity etc)
      const metrics = calculateSystemMetrics(newObjects);
      const newEvaluationData = state.evaluationData ? { ...state.evaluationData, ...metrics } : metrics;

      const finalObjects = newObjects.map(obj => {
        const flow = flows.get(obj.id);
        return flow ? { ...obj, isEnergized: flow.isEnergized, isTripped: flow.isTripped, canReset: flow.canReset } : obj;
      });
      return { objects: finalObjects, evaluationData: newEvaluationData };
    }),

  addObjects: (objectsToAdd) =>
    set((state) => {
      // Batch processing
      const processedObjects = objectsToAdd.map(obj => {
        let baseZ = 0;
        state.objects.forEach(other => {
          // Overlap with EXISTING objects (not newly added ones in this batch - simpler)
          const overlapW = Math.max(0, Math.min(obj.x + obj.w, other.x + other.w) - Math.max(obj.x, other.x));
          const overlapH = Math.max(0, Math.min(obj.y + obj.h, other.y + other.h) - Math.max(obj.y, other.y));
          if ((overlapW * overlapH) > (obj.w * obj.h) * 0.1) {
            const top = (other.h_z || 0);
            if (top > baseZ) baseZ = top;
          }
        });
        const h_z = baseZ + (obj.relative_h || 0);
        return { ...obj, h_z };
      });

      const newObjects = [...state.objects, ...processedObjects];
      const flows = calculateFlows(newObjects, state.wires, { sunTime: state.sunTime });

      const metrics = calculateSystemMetrics(newObjects);
      const newEvaluationData = state.evaluationData ? { ...state.evaluationData, ...metrics } : metrics;

      const finalObjects = newObjects.map(obj => {
        const flow = flows.get(obj.id);
        return flow ? { ...obj, isEnergized: flow.isEnergized, isTripped: flow.isTripped, canReset: flow.canReset } : obj;
      });

      return { objects: finalObjects, evaluationData: newEvaluationData };
    }),

  updateObject: (id, updates) =>
    set((state) => {
      const oldObj = state.objects.find(o => o.id === id);
      const dependentUpdates = new Map();

      // Vertical Propagation: If height (h_z) changes, move items "on top"
      if (oldObj && typeof updates.h_z === 'number' && Math.abs(updates.h_z - (oldObj.h_z || 0)) > 0.001) {
        const delta = updates.h_z - (oldObj.h_z || 0);
        const driver = { ...oldObj, ...updates };

        state.objects.forEach(other => {
          if (other.id === id) return;

          // 1. Must be physically above or at same level as the driver's OLD height
          const otherHz = other.h_z || 0;
          if (otherHz < (oldObj.h_z || 0) - 0.1) return; // Allow small tolerance

          // 2. 2D Overlap Check
          const driverW = driver.w;
          const driverH = driver.h;
          const otherW = other.w;
          const otherH = other.h;

          const overlapW = Math.max(0, Math.min(driver.x + driverW, other.x + otherW) - Math.max(driver.x, other.x));
          const overlapH = Math.max(0, Math.min(driver.y + driverH, other.y + otherH) - Math.max(driver.y, other.y));
          const overlapArea = overlapW * overlapH;
          const otherArea = otherW * otherH;

          // 3. Containment: Passenger must be >50% inside the Driver
          // And Driver must be larger than Passenger (optional, but good for "Base" logic)
          if (overlapArea > otherArea * 0.5) {
            dependentUpdates.set(other.id, { h_z: otherHz + delta });
          }
        });
      }

      const newObjects = state.objects.map((obj) => {
        if (obj.id === id) return { ...obj, ...updates };
        if (dependentUpdates.has(obj.id)) return { ...obj, ...dependentUpdates.get(obj.id) };
        return obj;
      });

      const flows = calculateFlows(newObjects, state.wires, { sunTime: state.sunTime });
      const finalObjects = newObjects.map(obj => {
        const flow = flows.get(obj.id);
        return flow ? { ...obj, isEnergized: flow.isEnergized, isTripped: flow.isTripped, canReset: flow.canReset } : obj;
      });
      return { objects: finalObjects };
    }),

  deleteObject: (id) =>
    set((state) => {
      const newObjects = state.objects.filter((obj) => obj.id !== id);
      const newWires = state.wires.filter(
        (wire) => wire.from !== id && wire.to !== id
      );
      const flows = calculateFlows(newObjects, newWires, { sunTime: state.sunTime });

      const metrics = calculateSystemMetrics(newObjects);
      const newEvaluationData = state.evaluationData ? { ...state.evaluationData, ...metrics } : metrics;

      const finalObjects = newObjects.map(obj => {
        const flow = flows.get(obj.id);
        return flow ? { ...obj, isEnergized: flow.isEnergized, isTripped: flow.isTripped, canReset: flow.canReset } : obj;
      });
      return { objects: finalObjects, wires: newWires, evaluationData: newEvaluationData };
    }),

  addWire: (wire) =>
    set((state) => {
      const newWires = [...state.wires, wire];
      const flows = calculateFlows(state.objects, newWires, { sunTime: state.sunTime });
      const finalObjects = state.objects.map(obj => {
        const flow = flows.get(obj.id);
        return flow ? { ...obj, isEnergized: flow.isEnergized, isTripped: flow.isTripped, canReset: flow.canReset } : obj;
      });
      return { objects: finalObjects, wires: newWires };
    }),

  deleteWire: (id) =>
    set((state) => {
      const newWires = state.wires.filter((wire) => wire.id !== id);
      const flows = calculateFlows(state.objects, newWires, { sunTime: state.sunTime });
      const finalObjects = state.objects.map(obj => {
        const flow = flows.get(obj.id);
        return flow ? { ...obj, isEnergized: flow.isEnergized, isTripped: flow.isTripped, canReset: flow.canReset } : obj;
      });
      return { objects: finalObjects, wires: newWires };
    }),

  updateWire: (id, updates) =>
    set((state) => {
      const newWires = state.wires.map((wire) =>
        wire.id === id ? { ...wire, ...updates } : wire
      );
      const flows = calculateFlows(state.objects, newWires, { sunTime: state.sunTime });
      const finalObjects = state.objects.map(obj => {
        const flow = flows.get(obj.id);
        return flow ? { ...obj, isEnergized: flow.isEnergized, isTripped: flow.isTripped, canReset: flow.canReset } : obj;
      });
      return { objects: finalObjects, wires: newWires };
    }),

  setSelectedObject: (id) => set({ selectedObjectId: id, selectedWireId: null, additionalSelectedIds: [] }),
  setSelectedWire: (id) => set({ selectedWireId: id, selectedObjectId: null, additionalSelectedIds: [] }),
  setAdditionalSelectedIds: (ids) => set({ additionalSelectedIds: ids }),

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
  setSunTime: (sunTime) => set((state) => {
    const flows = calculateFlows(state.objects, state.wires, { sunTime });
    const finalObjects = state.objects.map(obj => {
      const flow = flows.get(obj.id);
      return flow ? { ...obj, isEnergized: flow.isEnergized, isTripped: flow.isTripped, canReset: flow.canReset } : obj;
    });
    return { sunTime, objects: finalObjects };
  }),
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
      latitude: state.latitude,
      longitude: state.longitude,
      orientation: state.orientation,
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

      // Pass active customer ID
      const activeCustomerId = state.activeCustomerId;
      const result = await projectService.saveProject(projectName, projectData, activeCustomerId);
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

  // Load Customer Project (Find most recent or specific)
  loadCustomerProject: async (customerId) => {
    try {
      set({ isLoadingProjects: true });

      // 1. Try to fetch projects from Supabase for this customer
      const projects = await projectService.listCustomerProjects(customerId);
      set({ projects });

      // 2. If projects exist, load the most recent one
      if (projects.length > 0) {
        const mostRecent = projects[0]; // Ordered by updated_at desc
        const fullProject = await projectService.loadProject(mostRecent.id);
        const state = get();

        // Reuse load logic
        state.loadFromSupabase(fullProject.id);
        state.showToast(`Loaded existing customer project: ${mostRecent.name}`, "success");
        return;
      }

      // 3. Fallback: Load from LocalStorage for this customer if no cloud project exists
      const saved = localStorage.getItem(`solar_project_autosave_${customerId}`);
      if (saved) {
        const projectData = JSON.parse(saved);
        const state = get();
        state.loadProject(projectData);
        set({ isLoadingProjects: false });
        state.showToast("Restored from local autosave", "info");
        return;
      }

      // 4. Reset if nothing found
      set({ objects: [], wires: [], currentProjectId: null, isLoadingProjects: false });
    } catch (e) {
      console.error(e);
      set({ isLoadingProjects: false });
    }
  },
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

  // List projects
  loadProjectsList: async () => {
    try {
      set({ isLoadingProjects: true });
      const state = get();
      // List projects for active customer
      const projects = await projectService.listCustomerProjects(state.activeCustomerId);
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
