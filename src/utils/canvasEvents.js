import { useSolarStore } from "../stores/solarStore";
import { supabase } from "../lib/supabase";
import { screenToWorld, getObjectAtScreenPoint, calculateOrthogonalPath, getResizeHandleAtPoint, getWireAtScreenPoint } from "./canvas";
import { createRectangle, createPolygon, closePath, simplifyPath, createPanelArray, sortVerticesClockwise } from "./drawingTools";

/**
 * Canvas Event Handler for Solar Architect
 * Manages all user interactions with the design canvas
 */
export const handleCanvasEvents = {
  // State tracking
  _isDragging: false,
  _dragStartPos: { x: 0, y: 0 },
  _dragStartObjPos: { x: 0, y: 0 },
  _wireCreationMode: false,
  _wireStartObj: null,
  _measureStart: null,
  _drawingStartPos: null,
  _isResizing: false,
  _resizeHandle: null,
  _resizeStartObj: null,

  /**
   * Mouse down - Start selection, drawing, or other operations
   */
  onMouseDown(e, canvas) {
    const store = useSolarStore.getState();
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY, store.offsetX, store.offsetY, store.scale);

    // Check AI Import Mode
    if (store.aiImportMode && store.mapSettings?.mapImage && store.mapSettings.mapOverlayActive) {
      const zoom = store.mapSettings.zoom || 20;
      const lat = store.latitude;
      const lng = store.longitude;
      const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);

      const mapWidthMeters = 800 * metersPerPixel;
      const mapHeightMeters = 800 * metersPerPixel;

      // Check if click is within map bounds
      if (worldPos.x >= -mapWidthMeters / 2 && worldPos.x <= mapWidthMeters / 2 &&
        worldPos.y >= -mapHeightMeters / 2 && worldPos.y <= mapHeightMeters / 2) {

        // Calculate clicked lat/lng
        // 1 meter approx 1/111320 degrees
        const metersPerDegreeLat = 111320;
        const metersPerDegreeLng = 111320 * Math.cos(lat * Math.PI / 180);

        // Canvas Y is down (positive), so +Y means South (decreasing Lat)
        const clickedLat = lat - (worldPos.y / metersPerDegreeLat);
        const clickedLng = lng + (worldPos.x / metersPerDegreeLng);

        handleAiImport({ lat: clickedLat, lng: clickedLng }, store);
        return;
      }
    }

    // Check drawing modes FIRST (highest priority)
    if (store.drawingMode === "rectangle") {
      // Start drawing - will complete on mouse up after drag
      this._isDragging = true;
      this._drawingStartPos = worldPos;
      store.setDrawingPoints([worldPos]);
      return;
    } else if (store.drawingMode === "polygon") {
      // Add point to polygon
      const currentPoints = store.drawingPoints || [];
      const newPoints = [...currentPoints, worldPos];
      store.setDrawingPoints(newPoints);

      // Check for double-click to complete polygon
      const now = Date.now();
      const timeSinceLastClick = now - (this._lastClickTime || 0);

      if (currentPoints.length > 0 && timeSinceLastClick < 300) {
        // Double click detected, complete polygon
        if (newPoints.length >= 3) {
          const polygon = createPolygon(newPoints, store.drawingType, store.drawingHeight);
          if (polygon) {
            store.addObject(polygon);
            store.saveState();
            store.clearDrawing();
            this._lastClickTime = 0;
            return;
          }
        }
      }
      this._lastClickTime = now;
      return;
    } else if (store.drawingMode === "freehand") {
      // Start freehand drawing
      this._isDragging = true;
      this._drawingStartPos = worldPos;
      store.setDrawingPoints([worldPos]);
      return;
    }

    // Now handle mode-based interactions
    switch (store.mode) {
      case "pan": {
        this._isDragging = true;
        this._dragStartPos = { screenX, screenY };
        break;
      }

      case "select": {
        // First check if clicking on a resize handle of the selected object
        if (store.selectedObjectId) {
          const selectedObj = store.objects.find(o => o.id === store.selectedObjectId);
          if (selectedObj) {
            const handleType = getResizeHandleAtPoint(worldPos.x, worldPos.y, selectedObj);
            if (handleType) {
              // Start resizing
              this._isResizing = true;
              this._resizeHandle = handleType;
              this._dragStartPos = worldPos;
              this._resizeStartObj = {
                x: selectedObj.x,
                y: selectedObj.y,
                w: selectedObj.w,
                h: selectedObj.h
              };
              return;
            }
          }
        }

        // Not clicking on a handle, check for object selection
        const obj = getObjectAtScreenPoint(
          screenX,
          screenY,
          store.objects,
          store.offsetX,
          store.offsetY,
          store.scale
        );

        if (obj) {
          // Check for Grouping
          // If object is part of a group, select all group members
          let groupPeers = [];
          if (obj.groupId) {
            groupPeers = store.objects
              .filter(o => o.groupId === obj.groupId && o.id !== obj.id)
              .map(o => o.id);
          }

          // Update selection
          store.setSelectedObject(obj.id);
          // Manually update additional selection for grouping
          useSolarStore.setState({ additionalSelectedIds: groupPeers });

          // Refresh store state for drag logic
          const updatedStore = useSolarStore.getState();
          const isAlreadySelected = obj.id === updatedStore.selectedObjectId || (updatedStore.additionalSelectedIds || []).includes(obj.id);

          // Drag Init
          this._isDragging = true;
          this._dragStartPos = worldPos;

          // Store start positions for all selected objects (Group + Multi-select)
          const allSelectedIds = [updatedStore.selectedObjectId, ...(updatedStore.additionalSelectedIds || [])].filter(Boolean);

          this._dragStartPositions = {};
          allSelectedIds.forEach(id => {
            const o = updatedStore.objects.find(obj => obj.id === id);
            if (o) this._dragStartPositions[id] = { x: o.x, y: o.y };
          });

          // Identify children (objects on top of the selected object)
          this._dragChildrenIds = [];

          const children = store.objects.filter(other => {
            if (other.id === obj.id) return false;
            if (allSelectedIds.includes(other.id)) return false; // Already selected

            // Removed Z-height check to allow 2D visual containment to drive dragging
            // if ((other.h_z || 0) < (obj.h_z || 0)) return false;

            // Intersection Area Check (More robust than center point)
            const overlapW = Math.max(0, Math.min(obj.x + obj.w, other.x + other.w) - Math.max(obj.x, other.x));
            const overlapH = Math.max(0, Math.min(obj.y + obj.h, other.y + other.h) - Math.max(obj.y, other.y));
            const overlapArea = overlapW * overlapH;
            const otherArea = other.w * other.h;

            // Size Check: Passenger (other) cannot be bigger than Driver (obj)
            // This prevents a small Panel (Top) from dragging a large Roof (Bottom)
            if (otherArea > (obj.w * obj.h)) return false;

            // Containment Check: Passenger must be mostly inside the Overlap
            // Threshold 0.9 means 90% of the child must be covered by the parent
            return overlapArea > (otherArea * 0.9);
          });

          // Add children to the selection so they visually highlight and move logically
          const childIds = children.map(c => c.id);
          const newSelection = [...new Set([...groupPeers, ...childIds])];
          useSolarStore.setState({ additionalSelectedIds: newSelection });

          // Legacy: still track them for internal drag logic if needed, but selection handles most now
          this._dragChildrenIds = childIds;

          // No need to store separate dragStartPositions for children here, 
          // as the "allSelectedIds" block below will now catch them since we updated proper state!

          // RE-Calculate allSelectedIds with the new additions
          const finalSelectedIds = [updatedStore.selectedObjectId, ...newSelection].filter(Boolean);

          this._dragStartPositions = {};
          finalSelectedIds.forEach(id => {
            const o = store.objects.find(obj => obj.id === id); // Use base store to get latest before drag params
            if (o) this._dragStartPositions[id] = { x: o.x, y: o.y };
          });

          this._dragStartObjPos = { x: obj.x, y: obj.y }; // Keep for legacy/primary alignment
        } else {
          // Check for Wire Selection
          const wire = getWireAtScreenPoint(
            screenX,
            screenY,
            store.wires,
            store.objects,
            store.offsetX,
            store.offsetY,
            store.scale,
            store.cableMode
          );

          if (wire) {
            store.setSelectedWire(wire.id);
            store.setSelectedObject(null); // Deselect objects
            return;
          }

          // Start Selection Box (Multi-select)
          store.setSelectedObject(null);
          store.setSelectedWire(null);
          this._isSelecting = true;
          this._selectionStart = worldPos;
          store.setSelectionBox({ x: worldPos.x, y: worldPos.y, w: 0, h: 0 });
        }
        break;
      }

      case "place": {
        if (!store.selectedPreset) return;
        const equipment = store.selectedPreset;
        if (!equipment) return;

        const typeName = equipment.equipment_types?.name || equipment.type;

        // For solar panels, support dragging to create array
        if (typeName === "Solar Panel") {
          this._isDragging = true;
          this._dragStartPos = worldPos;
          this._placeStartPos = worldPos;
          return;
        }

        // For other equipment, place single object at click location
        let objType = equipment.equipment_types?.name || equipment.type || "custom";
        if (objType === "Solar Panel") objType = "panel";
        if (objType === "Inverter") objType = "inverter";
        if (objType === "Battery") objType = "battery";

        const newObject = {
          id: Math.random().toString(36).slice(2),
          type: objType,
          x: worldPos.x - (equipment.width || 1) / 2,
          y: worldPos.y - (equipment.height || 1) / 2,
          w: equipment.width || 1,
          h: equipment.height || 1,
          h_z: equipment.h_z || 0.5,
          rotation: store.placementRotation || 0,
          cost: parseFloat(equipment.cost) || 0,
          color: equipment.color || "#1e3a8a",
          label: equipment.name,
          equipment_id: equipment.id,
          specifications: equipment.specifications || {},
        };

        // Type-specific properties
        if (objType === "inverter") {
          newObject.capKw = equipment.specifications?.capacity_kw || 3;
          newObject.subtype = equipment.specifications?.inverter_type || "string";
          newObject.specifications = {
            ...newObject.specifications,
            inverter_type: equipment.specifications?.inverter_type || "on_grid",
            output_voltage: equipment.specifications?.output_voltage || 230,
            efficiency: equipment.specifications?.efficiency || 97.5,
            max_dc_input: equipment.specifications?.max_dc_input || 600
          };
          newObject.relative_h = 0.5; // Wall mounted
        } else if (objType === "battery") {
          newObject.capKwh = equipment.specifications?.capacity_kwh || 5;
          newObject.relative_h = 0; // Floor
        } else if (objType === "panel") {
          // Explicitly grab watts from the preset, ensuring we capture the 720W or similar values
          // Clean parser to handle standard numbers or strings
          const rawWatts = equipment.watts || (equipment.specifications && equipment.specifications.watts) || 550;
          const panelWatts = parseFloat(rawWatts);

          newObject.watts = panelWatts;
          // Sync to specifications for consistency
          newObject.specifications = {
            ...newObject.specifications,
            watts: panelWatts
          };
          newObject.relative_h = 0.1; // Surface
        } else if (objType === "vcb") {
          newObject.specifications = { voltage_rating: 11, current_rating: 630 };
          newObject.relative_h = 0;
        } else if (objType === "acb") {
          newObject.specifications = { voltage_rating: 0.415, current_rating: 800 };
          newObject.relative_h = 0;
        } else if (objType === "bess") {
          newObject.specifications = { pcs_rating: 100, sts_rating: 200, battery_capacity: 200, mppt_channels: 1 };
          newObject.relative_h = 0;
        } else if (objType === "pss") {
          newObject.specifications = { rating_amps: 100, voltage_rating: 415, switching_time_ms: 20, logic: "auto" };
          newObject.relative_h = 0;
        } else if (objType === "grid") {
          newObject.specifications = { voltage: 11000 };
          newObject.relative_h = 0;
        } else if (objType === "transformer") {
          newObject.specifications = { rating_kva: 500, primary_voltage: 11000, secondary_voltage: 415, vector_group: "Dyn11" };
          newObject.relative_h = 0;
        } else if (objType === "master_plc") {
          newObject.specifications = { custom_logic: [] };
          newObject.relative_h = 0;
        } else {
          newObject.relative_h = 0;
        }

        store.addObject(newObject);
        // Auto-layering (place on top of building if needed)
        adjustObjectLayering(useSolarStore.getState(), newObject.id);
        store.saveState();
        return;
      }

      case "measure": {
        if (!this._measureStart) {
          this._measureStart = worldPos;
        } else {
          const distance = Math.sqrt(
            Math.pow(worldPos.x - this._measureStart.x, 2) +
            Math.pow(worldPos.y - this._measureStart.y, 2)
          );
          // Store measurement in state for display
          this._measureStart = null;
        }
        break;
      }

      case "delete": {
        const obj = getObjectAtScreenPoint(
          screenX,
          screenY,
          store.objects,
          store.offsetX,
          store.offsetY,
          store.scale
        );
        if (obj) {
          store.deleteObject(obj.id);
          store.saveState();
        }
        break;
      }

      case "wire_dc":
      case "wire_ac":
      case "earthing": {
        const obj = getObjectAtScreenPoint(
          screenX,
          screenY,
          store.objects,
          store.offsetX,
          store.offsetY,
          store.scale
        );
        if (obj) {
          this._wireCreationMode = true;
          this._wireStartObj = obj;
        }
        break;
      }

      case "draw_rect": {
        this._isDragging = true;
        this._dragStartPos = worldPos;
        break;
      }

      // Unknown mode - do nothing
      default: {
        break;
      }
    }
  },

  /**
   * Mouse move - Handle dragging, wire preview, etc.
   */
  onMouseMove(e, canvas) {
    const store = useSolarStore.getState();
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY, store.offsetX, store.offsetY, store.scale);

    // Update Hovered Object State
    const hoveredObj = getObjectAtScreenPoint(
      screenX,
      screenY,
      store.objects,
      store.offsetX,
      store.offsetY,
      store.scale
    );
    if (store.hoveredObjectId !== (hoveredObj?.id || null)) {
      store.setHoveredObject(hoveredObj?.id || null);
    }

    // Update cursor
    this._updateCursor(canvas, screenX, screenY);

    // Handle rectangle drawing preview (priority - check before other dragging)
    if (this._isDragging && store.drawingMode === "rectangle" && this._drawingStartPos) {
      store.setDrawingPoints([this._drawingStartPos, worldPos]);
      store.setDrawingPreview(null);
      return;
    }

    // Handle freehand drawing
    if (this._isDragging && store.drawingMode === "freehand" && this._drawingStartPos) {
      const currentPoints = store.drawingPoints || [];
      const newPoints = [...currentPoints, worldPos];
      store.setDrawingPoints(newPoints);
      return;
    }

    // Show preview for polygon next point
    if (store.drawingMode === "polygon" && store.drawingPoints && store.drawingPoints.length > 0) {
      store.setDrawingPreview(worldPos);
      if (this._isDragging) return;
    }

    // Handle solar panel array placement drag preview
    if (this._isDragging && store.mode === "place" && this._placeStartPos) {
      // Update the current drag position for use in onMouseUp
      this._dragStartPos = worldPos;
      // Draw preview rectangle showing where panels will be placed
      store.setDrawingPoints([this._placeStartPos, worldPos]);
      return;
    }

    // Handle object resizing
    if (this._isResizing && store.selectedObjectId && this._resizeHandle && this._resizeStartObj) {
      const deltaX = worldPos.x - this._dragStartPos.x;
      const deltaY = worldPos.y - this._dragStartPos.y;

      let newX = this._resizeStartObj.x;
      let newY = this._resizeStartObj.y;
      let newW = this._resizeStartObj.w;
      let newH = this._resizeStartObj.h;

      const minSize = 0.5; // Minimum size in meters

      // Calculate new dimensions based on handle type
      switch (this._resizeHandle) {
        case 'nw': // Top-left
          newX = this._resizeStartObj.x + deltaX;
          newY = this._resizeStartObj.y + deltaY;
          newW = this._resizeStartObj.w - deltaX;
          newH = this._resizeStartObj.h - deltaY;
          break;
        case 'n': // Top-center
          newY = this._resizeStartObj.y + deltaY;
          newH = this._resizeStartObj.h - deltaY;
          break;
        case 'ne': // Top-right
          newY = this._resizeStartObj.y + deltaY;
          newW = this._resizeStartObj.w + deltaX;
          newH = this._resizeStartObj.h - deltaY;
          break;
        case 'e': // Middle-right
          newW = this._resizeStartObj.w + deltaX;
          break;
        case 'se': // Bottom-right
          newW = this._resizeStartObj.w + deltaX;
          newH = this._resizeStartObj.h + deltaY;
          break;
        case 's': // Bottom-center
          newH = this._resizeStartObj.h + deltaY;
          break;
        case 'sw': // Bottom-left
          newX = this._resizeStartObj.x + deltaX;
          newW = this._resizeStartObj.w - deltaX;
          newH = this._resizeStartObj.h + deltaY;
          break;
        case 'w': // Middle-left
          newX = this._resizeStartObj.x + deltaX;
          newW = this._resizeStartObj.w - deltaX;
          break;
      }

      // Enforce minimum size
      if (newW < minSize) {
        newW = minSize;
        if (this._resizeHandle.includes('w')) {
          newX = this._resizeStartObj.x + this._resizeStartObj.w - minSize;
        }
      }
      if (newH < minSize) {
        newH = minSize;
        if (this._resizeHandle.includes('n')) {
          newY = this._resizeStartObj.y + this._resizeStartObj.h - minSize;
        }
      }

      // Update object
      store.updateObject(store.selectedObjectId, {
        x: newX,
        y: newY,
        w: newW,
        h: newH
      });
      return;
    }

    // Handle object dragging
    if (this._isDragging && store.selectedObjectId && store.mode === "select") {
      const deltaX = worldPos.x - this._dragStartPos.x;
      const deltaY = worldPos.y - this._dragStartPos.y;

      let newX = this._dragStartObjPos.x + deltaX;
      let newY = this._dragStartObjPos.y + deltaY;

      // Dynamic Alignment
      const selectedObj = store.objects.find(o => o.id === store.selectedObjectId);
      if (selectedObj) {
        const { x, y, guides } = calculateAlignment(newX, newY, selectedObj.w, selectedObj.h, store.objects, store.selectedObjectId);
        newX = x;
        newY = y;
        store.setAlignmentGuides(guides);

        // precise distance guides
        const distanceGuides = calculateDistanceGuides(newX, newY, selectedObj.w, selectedObj.h, store.objects, store.selectedObjectId);
        store.setDistanceGuides(distanceGuides);
      }

      const appliedDeltaX = newX - this._dragStartObjPos.x;
      const appliedDeltaY = newY - this._dragStartObjPos.y;

      store.updateObject(store.selectedObjectId, {
        x: newX,
        y: newY,
      });

      // Move additional objects
      if (this._dragStartPositions) {
        const idsToMove = [...(store.additionalSelectedIds || []), ...(this._dragChildrenIds || [])];
        const uniqueIds = [...new Set(idsToMove)];

        uniqueIds.forEach(id => {
          const startPos = this._dragStartPositions[id];
          if (startPos) {
            store.updateObject(id, {
              x: startPos.x + appliedDeltaX,
              y: startPos.y + appliedDeltaY
            });
          }
        });
      }

      // Check layering with FRESH state
      const freshStore = useSolarStore.getState();

      const allMovingIds = [...(store.additionalSelectedIds || []), ...(this._dragChildrenIds || [])];
      if (store.selectedObjectId) allMovingIds.push(store.selectedObjectId);
      const uniqueMovingIds = [...new Set(allMovingIds)];

      // Update layering for the primary object
      adjustObjectLayering(freshStore, store.selectedObjectId, uniqueMovingIds);

      // Update layering for all other moving objects
      uniqueMovingIds.forEach(id => {
        if (id !== store.selectedObjectId) {
          adjustObjectLayering(freshStore, id, uniqueMovingIds);
        }
      });

      return;
    }

    // Handle canvas panning - ONLY in pan mode
    if (this._isDragging && store.mode === "pan" && this._dragStartPos.screenX !== undefined) {
      const deltaScreenX = screenX - this._dragStartPos.screenX;
      const deltaScreenY = screenY - this._dragStartPos.screenY;

      store.setOffset(
        store.offsetX + deltaScreenX,
        store.offsetY + deltaScreenY
      );

      this._dragStartPos = { screenX, screenY };
      return;
    }

    // Handle selection box
    if (this._isSelecting && this._selectionStart) {
      const x = Math.min(this._selectionStart.x, worldPos.x);
      const y = Math.min(this._selectionStart.y, worldPos.y);
      const w = Math.abs(this._selectionStart.x - worldPos.x);
      const h = Math.abs(this._selectionStart.y - worldPos.y);
      store.setSelectionBox({ x, y, w, h });
      return;
    }

    // Preview wire connection
    if (this._wireCreationMode && this._wireStartObj) {
      // Visual preview
      const startX = this._wireStartObj.x + this._wireStartObj.w / 2;
      const startY = this._wireStartObj.y + this._wireStartObj.h / 2;
      store.setDrawingPoints([{ x: startX, y: startY }, worldPos]);
    }

    // Preview Placement Ghost
    if (store.mode === "place" && store.selectedPreset) {
      store.setDrawingPreview({
        ...store.selectedPreset,
        type: store.selectedPreset.equipment_types?.name || store.selectedPreset.type || "custom",
        x: worldPos.x - (store.selectedPreset.width || 1) / 2, // Center it
        y: worldPos.y - (store.selectedPreset.height || 1) / 2,
        w: store.selectedPreset.width || 1,
        h: store.selectedPreset.height || 1,
        rotation: store.placementRotation || 0,
        isGhost: true
      });
    } else if (store.mode !== "place" && store.drawingPreview?.isGhost) {
      store.setDrawingPreview(null);
    }

    // Preview measurement
    if (this._measureStart) {
      const distance = Math.sqrt(
        Math.pow(worldPos.x - this._measureStart.x, 2) +
        Math.pow(worldPos.y - this._measureStart.y, 2)
      );
      // Update visual preview
    }
  },

  /**
   * Mouse up - End dragging or other operations
   */
  async onMouseUp(e, canvas) {
    const store = useSolarStore.getState();

    // Handle selection box end
    if (this._isSelecting) {
      this._isSelecting = false;
      this._selectionStart = null;

      // Find objects in selection box
      if (store.selectionBox) {
        const { x, y, w, h } = store.selectionBox;
        // Simple AABB check
        const selected = store.objects.filter(obj =>
          obj.x >= x && obj.x + obj.w <= x + w &&
          obj.y >= y && obj.y + obj.h <= y + h
        );

        if (selected.length > 0) {
          store.setSelectedObject(selected[0].id);
          if (selected.length > 1) {
            const additionalIds = selected.slice(1).map(o => o.id);
            store.setAdditionalSelectedIds(additionalIds);
          }
        }
      }

      store.setSelectionBox(null);
      return;
    }

    // Complete wire creation
    if (this._wireCreationMode && this._wireStartObj) {
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const endObj = getObjectAtScreenPoint(
        screenX,
        screenY,
        store.objects,
        store.offsetX,
        store.offsetY,
        store.scale
      );

      if (endObj && endObj.id !== this._wireStartObj.id) {
        const wireType =
          store.mode === "wire_dc" ? "dc" : store.mode === "wire_ac" ? "ac" : "earth";

        // Validate Connection
        const { validateConnection } = await import("./simulation");
        const validationError = validateConnection(this._wireStartObj, endObj, wireType);

        if (validationError) {
          // alert(`${validationError.type.toUpperCase()}: ${validationError.message}`);
          store.showToast(`${validationError.type.toUpperCase()}: ${validationError.message}`, validationError.type);

          // If it's an error, prevent connection. If warning, maybe allow?
          // User said "immediately flag". Let's prevent on error, allow on warning but show alert.
          if (validationError.type === 'error') {
            this._wireCreationMode = false;
            this._wireStartObj = null;
            store.setDrawingPoints([]);
            return;
          }
        }

        let path = null;
        if (store.cableMode === "ortho") {
          path = calculateOrthogonalPath(this._wireStartObj, endObj);
        }

        const newWireId = Math.random().toString(36).slice(2);
        store.addWire({
          from: this._wireStartObj.id,
          to: endObj.id,
          type: wireType,
          path,
          id: newWireId,
          specifications: {
            size_sqmm: 4,
            length_m: 10, // Default placeholder, should be calculated
            material: "Copper"
          }
        });

        store.setSelectedWire(newWireId);

        store.saveState();
      }

      this._wireCreationMode = false;
      this._wireStartObj = null;
      store.setDrawingPoints([]); // Clear preview
      return;
    }

    // Handle resize end
    if (this._isResizing) {
      this._isResizing = false;
      this._resizeHandle = null;
      this._resizeStartObj = null;
      store.saveState();
      return;
    }

    if (this._isDragging) {
      this._isDragging = false;
      store.setAlignmentGuides([]); // Clear alignment guides
      store.setDistanceGuides([]); // Clear distance guides

      // Complete rectangle drawing
      if (store.drawingMode === "rectangle" && this._drawingStartPos && store.drawingPoints.length === 2) {
        const start = store.drawingPoints[0];
        const end = store.drawingPoints[1];

        if (store.drawingType === 'panel_array') {
          // Create array of panels
          // Find base object height (if drawing on top of a structure)
          const centerX = (start.x + end.x) / 2;
          const centerY = (start.y + end.y) / 2;
          let baseHeight = 0;

          // Check if there's a structure underneath
          for (const obj of store.objects) {
            if (obj.type === 'structure' || obj.type === 'tinshed') {
              // Simple point-in-rect check
              if (centerX >= obj.x && centerX <= obj.x + obj.w &&
                centerY >= obj.y && centerY <= obj.y + obj.h) {
                baseHeight = obj.h_z || 0;
                break;
              }
            }
          }

          // Create panel array with obstruction avoidance
          const panels = createPanelArray(start, end, baseHeight, store.selectedPanelType, store.objects);
          panels.forEach(panel => store.addObject(panel));
          store.saveState();
        } else {
          const rectangle = createRectangle(start, end, store.drawingType, store.drawingHeight);
          if (rectangle) {
            store.addObject(rectangle);
            store.saveState();
          }
        }
        store.clearDrawing();
        this._drawingStartPos = null;
      }

      // Complete freehand drawing
      if (store.drawingMode === "freehand" && store.drawingPoints.length > 2) {
        const simplified = simplifyPath(store.drawingPoints, 0.5);
        const closed = closePath(simplified);
        const freehand = createPolygon(closed, store.drawingType, store.drawingHeight);
        if (freehand) {
          store.addObject(freehand);
          store.saveState();
          store.clearDrawing();
          this._drawingStartPos = null;
        }
      }

      if (store.mode === "select" && store.selectedObjectId) {
        store.saveState();
      }

      // Handle solar panel array placement from place mode
      if (store.mode === "place" && this._placeStartPos && this._dragStartPos) {
        const startX = this._placeStartPos.x;
        const startY = this._placeStartPos.y;
        const endX = this._dragStartPos.x;
        const endY = this._dragStartPos.y;

        // Only create array if drag distance is significant (> 0.5 meters)
        const dragDistance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
        if (dragDistance > 0.5) {
          const equipment = store.selectedPreset;

          // Find base height and rotation if placing on structure
          const centerX = (startX + endX) / 2;
          const centerY = (startY + endY) / 2;
          let baseHeight = 0;
          let baseRotation = 0;
          let mountingType = "ground";

          for (const obj of store.objects) {
            if (obj.type === 'structure' || obj.type === 'tinshed') {
              if (centerX >= obj.x && centerX <= obj.x + obj.w &&
                centerY >= obj.y && centerY <= obj.y + obj.h) {
                baseHeight = obj.h_z || 0;
                baseRotation = obj.rotation || 0;
                mountingType = obj.type === 'tinshed' ? 'tinshed' : 'rcc';
                break;
              }
            }
          }

          // Create panel type from equipment
          const panelType = {
            w: equipment.width || equipment.specifications?.width || 1.134,
            h: equipment.height || equipment.specifications?.height || 2.278,
            watts: equipment.watts || equipment.specifications?.watts || 550,
            cost: parseFloat(equipment.cost) || 15000,
            label: equipment.name || "Panel"
          };

          // Combine structure rotation with manual placement rotation
          const manualRotation = store.placementRotation || 0;
          const finalRotation = (baseRotation + manualRotation) % 360;

          // Create panel array with obstruction avoidance
          const panels = createPanelArray(
            { x: startX, y: startY },
            { x: endX, y: endY },
            baseHeight,
            panelType,
            store.objects,
            finalRotation
          );

          // Add all panels to canvas
          panels.forEach(panel => {
            panel.mountingType = mountingType;
            store.addObject(panel);
          });
          store.saveState();
          store.setDrawingPoints([]); // Clear preview
        } else {
          // If drag distance is too small, just place a single panel
          const equipment = store.selectedPreset;
          const newObject = {
            id: Math.random().toString(36).slice(2),
            type: equipment.equipment_types?.name || equipment.type || "custom",
            x: startX,
            y: startY,
            w: equipment.width || 1.134,
            h: equipment.height || 2.278,
            h_z: 0.5,
            rotation: 0,
            cost: parseFloat(equipment.cost) || 0,
            color: equipment.color || "#1e3a8a",
            label: equipment.name,
            equipment_id: equipment.id,
            specifications: equipment.specifications || {},
            watts: equipment.watts || equipment.specifications?.watts || 550,
          };
          store.addObject(newObject);
          store.saveState();
          store.setDrawingPoints([]); // Clear preview
        }

        this._placeStartPos = null;
        this._dragStartPos = null;
      }
    }


  },

  /**
   * Wheel - Zoom in/out
   */
  onWheel(e, canvas) {
    e.preventDefault();
    const store = useSolarStore.getState();

    // Magnitude-based zoom sensitivity
    // Standard mouse wheel is ~100, trackpad is ~1-10
    const sensitivity = 0.001;
    const zoomFactor = Math.exp(-e.deltaY * sensitivity);

    // Clamp zoom speed to avoid jumps
    const safeZoomFactor = Math.max(0.8, Math.min(1.2, zoomFactor));

    const newScale = Math.max(0.5, Math.min(500, store.scale * safeZoomFactor));

    const rect = canvas.getBoundingClientRect();

    // Zoom to Center of Canvas (User requested "keep it same")
    const mouseX = rect.width / 2;
    const mouseY = rect.height / 2;

    const worldPosBeforeZoom = screenToWorld(mouseX, mouseY, store.offsetX, store.offsetY, store.scale);
    const worldPosAfterZoom = screenToWorld(mouseX, mouseY, store.offsetX, store.offsetY, newScale);

    const offsetX = store.offsetX + (worldPosBeforeZoom.x - worldPosAfterZoom.x) * newScale;
    const offsetY = store.offsetY + (worldPosBeforeZoom.y - worldPosAfterZoom.y) * newScale;

    store.setScale(newScale);
    store.setOffset(offsetX, offsetY);
  },

  /**
   * Key down - Handle shortcuts
   */
  onKeyDown(e) {
    const store = useSolarStore.getState();

    // Prevent deletion if active element is an input
    if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA" || document.activeElement.tagName === "SELECT")) {
      return;
    }

    // Toggle Shortcuts Modal
    if (e.key === "?" || (e.shiftKey && e.key === "/")) {
      store.setShortcutsOpen(!store.isShortcutsOpen);
      return;
    }

    // Undo/Redo
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      if (e.shiftKey) {
        store.redo();
      } else {
        store.undo();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "y") {
      e.preventDefault();
      store.redo();
      return;
    }

    // Copy (Ctrl+C)
    if ((e.ctrlKey || e.metaKey) && e.key === "c") {
      const selectedIds = [store.selectedObjectId, ...(store.additionalSelectedIds || [])].filter(Boolean);

      if (selectedIds.length > 0) {
        const objectsToCopy = store.objects.filter(o => selectedIds.includes(o.id));
        if (objectsToCopy.length > 0) {
          // Deep copy to clipboard to avoid reference issues
          store.setClipboard(JSON.parse(JSON.stringify(objectsToCopy)));
          store.showToast(`Copied ${objectsToCopy.length} object(s)`, "info");
        }
      }
      return;
    }

    // Paste (Ctrl+V)
    if ((e.ctrlKey || e.metaKey) && e.key === "v") {
      if (store.clipboard && store.clipboard.length > 0) {
        const pastedObjects = [];
        const newIds = [];

        // Calculate offset (e.g. 1 meter or 20px)
        // We'll use 1.0 meter offset
        const offset = 1.0;

        store.clipboard.forEach(item => {
          const newId = crypto.randomUUID();
          newIds.push(newId);

          const newObj = {
            ...item,
            id: newId,
            x: item.x + offset,
            y: item.y + offset,
            groupId: undefined // Ungroup pasted items for now to avoid ID conflicts
          };

          store.addObject(newObj);
          pastedObjects.push(newObj);
        });

        // Select the newly pasted objects
        if (newIds.length > 0) {
          store.setSelectedObject(newIds[0]);
          store.setAdditionalSelectedIds(newIds.slice(1));
          store.saveState();
          store.showToast(`Pasted ${newIds.length} object(s)`, "success");
        }
      }
      return;
    }

    // Delete
    if (e.key === "Delete" || e.key === "Backspace") {
      if (store.selectedObjectId) {
        store.deleteObject(store.selectedObjectId);
        store.setSelectedObject(null);
      }
      if (store.selectedWireId) {
        store.deleteWire(store.selectedWireId);
        store.setSelectedWire(null);
      }
      if (store.additionalSelectedIds && store.additionalSelectedIds.length > 0) {
        store.additionalSelectedIds.forEach(id => store.deleteObject(id));
        store.setAdditionalSelectedIds([]);
      }
      store.saveState();
      return;
    }

    // Escape
    if (e.key === "Escape") {
      if (store.drawingMode) {
        store.clearDrawing();
      } else if (store.selectedObjectId || store.selectedWireId) {
        store.setSelectedObject(null);
        store.setSelectedWire(null);
      } else if (store.mode !== "select") {
        store.setMode("select");
      }
      return;
    }

    // Mode Shortcuts
    switch (e.key.toLowerCase()) {
      case "s":
        store.setMode("select");
        break;
      case "p":
        store.setMode("pan");
        break;
      case "m":
        store.setMode("measure");
        break;
      case "d":
        store.setMode("delete");
        break;
      case "r":
        if (store.mode === "place" && store.selectedPreset) {
          // Rotate placement preview/logic
          const currentRot = store.placementRotation || 0;
          const newRot = (currentRot + 90) % 360;
          store.setPlacementRotation(newRot);
          store.showToast(`Placement Rotation: ${newRot}°`, 'info');
        } else if (store.selectedObjectId) {
          const obj = store.objects.find(o => o.id === store.selectedObjectId);
          if (obj) {
            const newRotation = ((obj.rotation || 0) + 90) % 360;
            store.updateObject(obj.id, { rotation: newRotation });
          }
        } else {
          store.setDrawingMode("rectangle");
          store.setDrawingType("structure");
        }
        break;
      case "l":
        store.setMode("wire_dc");
        break;
    }

    // Keyboard Movement (Arrow Keys)
    if (e.key.startsWith("Arrow") && (store.selectedObjectId || (store.additionalSelectedIds && store.additionalSelectedIds.length > 0))) {
      e.preventDefault();
      const step = e.shiftKey ? 1.0 : 0.05; // 5cm fine, 1m coarse
      let dx = 0;
      let dy = 0;

      switch (e.key) {
        case "ArrowUp": dy = -step; break;
        case "ArrowDown": dy = step; break;
        case "ArrowLeft": dx = -step; break;
        case "ArrowRight": dx = step; break;
      }

      const selectedIds = [store.selectedObjectId, ...(store.additionalSelectedIds || [])].filter(Boolean);

      selectedIds.forEach(id => {
        const obj = store.objects.find(o => o.id === id);
        if (obj) {
          store.updateObject(id, {
            x: obj.x + dx,
            y: obj.y + dy
          });
        }
      });
      return;
    }
  },

  // ... (rest of file)

  _updateCursor(canvas, screenX, screenY) {
    const store = useSolarStore.getState();

    if (store.aiImportMode) {
      canvas.style.cursor = "crosshair";
      return;
    }

    switch (store.mode) {
      // ... existing cases ...
      case "pan":
        canvas.style.cursor = this._isDragging ? "grabbing" : "grab";
        break;
      // ... (rest of _updateCursor)


      case "select": {
        // Check if hovering over a resize handle first
        if (store.selectedObjectId) {
          const selectedObj = store.objects.find(o => o.id === store.selectedObjectId);
          if (selectedObj) {
            const worldPos = screenToWorld(screenX, screenY, store.offsetX, store.offsetY, store.scale);
            const handleType = getResizeHandleAtPoint(worldPos.x, worldPos.y, selectedObj);
            if (handleType) {
              // Set cursor based on handle type
              const cursorMap = {
                'nw': 'nw-resize',
                'n': 'n-resize',
                'ne': 'ne-resize',
                'e': 'e-resize',
                'se': 'se-resize',
                's': 's-resize',
                'sw': 'sw-resize',
                'w': 'w-resize'
              };
              canvas.style.cursor = cursorMap[handleType] || 'default';
              return;
            }
          }
        }

        // Not hovering over handle, check for object
        const obj = getObjectAtScreenPoint(
          screenX,
          screenY,
          store.objects,
          store.offsetX,
          store.offsetY,
          store.scale
        );
        canvas.style.cursor = obj ? "grab" : "default";
        break;
      }

      case "measure":
        canvas.style.cursor = "crosshair";
        break;

      case "delete":
        canvas.style.cursor = "not-allowed";
        break;

      case "place":
        canvas.style.cursor = "copy";
        break;

      case "wire_dc":
      case "wire_ac":
      case "earthing":
        canvas.style.cursor = "pointer";
        break;

      case "draw_rect":
        canvas.style.cursor = "crosshair";
        break;

      default:
        canvas.style.cursor = "default";
    }
  },
};

/**
 * Calculate alignment guides and snapped position
 */
function calculateAlignment(x, y, w, h, objects, excludeId) {
  const guides = [];
  const threshold = 0.2; // Snap threshold in meters (tighter for panels)

  let newX = x;
  let newY = y;

  const centerX = x + w / 2;
  const centerY = y + h / 2;
  const rightX = x + w;
  const bottomY = y + h;

  // Snap X
  let snappedX = false;
  for (const obj of objects) {
    if (obj.id === excludeId) continue;

    const objCenterX = obj.x + obj.w / 2;
    const objRightX = obj.x + obj.w;

    // Left align (My Left to Obj Left)
    if (Math.abs(x - obj.x) < threshold) {
      newX = obj.x;
      guides.push({ x1: obj.x, y1: Math.min(y, obj.y) - 2, x2: obj.x, y2: Math.max(bottomY, obj.y + obj.h) + 2 });
      snappedX = true;
    }
    // Right align (My Right to Obj Right)
    else if (Math.abs(rightX - objRightX) < threshold) {
      newX = objRightX - w;
      guides.push({ x1: objRightX, y1: Math.min(y, obj.y) - 2, x2: objRightX, y2: Math.max(bottomY, obj.y + obj.h) + 2 });
      snappedX = true;
    }
    // Center align
    else if (Math.abs(centerX - objCenterX) < threshold) {
      newX = objCenterX - w / 2;
      guides.push({ x1: objCenterX, y1: Math.min(y, obj.y) - 2, x2: objCenterX, y2: Math.max(bottomY, obj.y + obj.h) + 2 });
      snappedX = true;
    }
    // Edge Snap: My Left to Obj Right
    else if (Math.abs(x - objRightX) < threshold) {
      newX = objRightX;
      guides.push({ x1: objRightX, y1: Math.min(y, obj.y) - 2, x2: objRightX, y2: Math.max(bottomY, obj.y + obj.h) + 2 });
      snappedX = true;
    }
    // Edge Snap: My Right to Obj Left
    else if (Math.abs(rightX - obj.x) < threshold) {
      newX = obj.x - w;
      guides.push({ x1: obj.x, y1: Math.min(y, obj.y) - 2, x2: obj.x, y2: Math.max(bottomY, obj.y + obj.h) + 2 });
      snappedX = true;
    }

    if (snappedX) break; // Only snap to one object for X
  }

  // Snap Y
  let snappedY = false;
  for (const obj of objects) {
    if (obj.id === excludeId) continue;

    const objCenterY = obj.y + obj.h / 2;
    const objBottomY = obj.y + obj.h;

    // Top align (My Top to Obj Top)
    if (Math.abs(y - obj.y) < threshold) {
      newY = obj.y;
      guides.push({ x1: Math.min(x, obj.x) - 2, y1: obj.y, x2: Math.max(rightX, obj.x + obj.w) + 2, y2: obj.y });
      snappedY = true;
    }
    // Bottom align (My Bottom to Obj Bottom)
    else if (Math.abs(bottomY - objBottomY) < threshold) {
      newY = objBottomY - h;
      guides.push({ x1: Math.min(x, obj.x) - 2, y1: objBottomY, x2: Math.max(rightX, obj.x + obj.w) + 2, y2: objBottomY });
      snappedY = true;
    }
    // Center align
    else if (Math.abs(centerY - objCenterY) < threshold) {
      newY = objCenterY - h / 2;
      guides.push({ x1: Math.min(x, obj.x) - 2, y1: objCenterY, x2: Math.max(rightX, obj.x + obj.w) + 2, y2: objCenterY });
      snappedY = true;
    }
    // Edge Snap: My Top to Obj Bottom
    else if (Math.abs(y - objBottomY) < threshold) {
      newY = objBottomY;
      guides.push({ x1: Math.min(x, obj.x) - 2, y1: objBottomY, x2: Math.max(rightX, obj.x + obj.w) + 2, y2: objBottomY });
      snappedY = true;
    }
    // Edge Snap: My Bottom to Obj Top
    else if (Math.abs(bottomY - obj.y) < threshold) {
      newY = obj.y - h;
      guides.push({ x1: Math.min(x, obj.x) - 2, y1: obj.y, x2: Math.max(rightX, obj.x + obj.w) + 2, y2: obj.y });
      snappedY = true;
    }

    if (snappedY) break;
  }

  return { x: newX, y: newY, guides };
}

/**
 * Helper to adjust object height and render order based on parent structure
 */
function adjustObjectLayering(store, objectId, movingIds = []) {
  const objects = store.objects;
  const obj = objects.find(o => o.id === objectId);
  if (!obj) return;

  // Find parent structure
  let parent = null;
  let maxHz = -1;

  for (const other of objects) {
    if (other.id === obj.id) continue;

    // Prevent cyclic stacking
    if (movingIds.includes(other.id)) {
      if ((obj.h_z || 0) <= (other.h_z || 0)) continue;
    }

    // Only consider structures as parents
    if (other.type !== 'structure' && other.type !== 'tinshed' && other.type !== 'polygon') continue;

    // Check overlap
    const overlapW = Math.max(0, Math.min(obj.x + obj.w, other.x + other.w) - Math.max(obj.x, other.x));
    const overlapH = Math.max(0, Math.min(obj.y + obj.h, other.y + other.h) - Math.max(obj.y, other.y));
    const overlapArea = overlapW * overlapH;
    const objArea = obj.w * obj.h;

    if (overlapArea > (objArea * 0.01)) {
      if ((other.h_z || 0) > maxHz) {
        maxHz = other.h_z || 0;
        parent = other;
      }
    }
  }

  // Determine intrinsic height of the object (e.g. structure height)
  let myHeight = obj.height;
  if (myHeight === undefined) {
    // Fallback for objects that don't have height property yet
    if (obj.type === 'structure' || obj.type === 'tinshed' || obj.type === 'polygon') {
      myHeight = 3.0;
    } else {
      myHeight = 0;
    }
  }

  // Determine spacing/offset (e.g. panel on hook)
  const offset = obj.relative_h !== undefined ? obj.relative_h : (obj.type === 'panel' ? 0.1 : 0);

  let newHz;
  if (parent) {
    // Stack on top of parent (Parent Top + My Height + Offset)
    // parent.h_z represents the top elevation of the parent
    newHz = (parent.h_z || 0) + myHeight + offset;

    // If we are stacking a structure (offset 0) on another, newHz = ParentTop + 3.0.
    // If we are stacking a panel (myHeight 0) on structure, newHz = ParentTop + 0.1.
  } else {
    // On ground
    newHz = myHeight + offset;
  }

  // If height changed, update it
  if (Math.abs((obj.h_z || 0) - newHz) > 0.001) {
    // console.log(`[Layering] Updating ${obj.label || obj.id}: z ${obj.h_z?.toFixed(2)} -> ${newHz.toFixed(2)}`);
    store.updateObject(obj.id, { h_z: newHz });
  }
}

/**
 * Extract polygon vertices from an image using OpenCV-style approach:
 * 1. Convert to grayscale
 * 2. Threshold (invert so building is white on black)
 * 3. Find contours
 * 4. Approximate polygon with epsilon based on arc length
 */
async function extractPolygonFromImage(base64Image) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Step 1: Convert to grayscale
      const gray = new Uint8Array(width * height);
      for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        // Standard grayscale conversion
        gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
        // If pixel is transparent, treat as white (background)
        if (data[idx + 3] < 128) {
          gray[i] = 255;
        }
      }

      // Step 2: Threshold with auto-detection
      // We want to find the object.
      // Try assuming object is Dark (Mask: Black on White)
      // Invert: dark pixels (< 128) become white (255)
      const binary = new Uint8Array(width * height);
      for (let i = 0; i < gray.length; i++) {
        binary[i] = gray[i] < 128 ? 255 : 0;
      }

      // Step 3: Find external contour
      let contour = findExternalContour(binary, width, height);

      // Check if contour is the frame (bounding box is full image)
      let checkMinX = width, checkMinY = height, checkMaxX = 0, checkMaxY = 0;
      for (const p of contour) {
        checkMinX = Math.min(checkMinX, p.x);
        checkMinY = Math.min(checkMinY, p.y);
        checkMaxX = Math.max(checkMaxX, p.x);
        checkMaxY = Math.max(checkMaxY, p.y);
      }
      const bboxW = checkMaxX - checkMinX;
      const bboxH = checkMaxY - checkMinY;
      const isFrame = bboxW > width * 0.95 && bboxH > height * 0.95;

      if (isFrame || contour.length < 3) {
        console.log("extractPolygonFromImage: Contour is frame/invalid, inverting threshold...");
        // Try assuming object is Light (Mask: White on Black)
        for (let i = 0; i < gray.length; i++) {
          binary[i] = gray[i] > 128 ? 255 : 0;
        }
        contour = findExternalContour(binary, width, height);
      }

      console.log("extractPolygonFromImage: raw contour points=", contour.length);

      if (contour.length < 3) {
        console.warn("extractPolygonFromImage: No valid contour found");
        resolve({ vertices: [], boundingBox: null });
        return;
      }

      // Step 4: Approximate polygon (like cv2.approxPolyDP)
      // epsilon = 0.005 * arcLength
      const arcLength = calculateArcLength(contour);
      const epsilon = 0.005 * arcLength;
      const approx = approxPolyDP(contour, epsilon);
      console.log("extractPolygonFromImage: simplified to", approx.length, "vertices (epsilon=", epsilon.toFixed(2), ")");

      // Calculate bounding box
      let minX = width, minY = height, maxX = 0, maxY = 0;
      for (const p of approx) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }

      resolve({
        vertices: approx,
        boundingBox: { minX, minY, maxX, maxY },
        width,
        height
      });
    };

    img.onerror = (err) => {
      console.error('Failed to load image for polygon extraction:', err);
      reject(err);
    };

    if (base64Image.startsWith('data:')) {
      img.src = base64Image;
    } else {
      img.src = `data:image/png;base64,${base64Image}`;
    }
  });
}

/**
 * Find external contour from binary image (white object on black background)
 * Simplified version of Suzuki-Abe border following algorithm
 */
function findExternalContour(binary, width, height) {
  const contour = [];

  // Find first white pixel (top-left most)
  let startX = -1, startY = -1;
  outer: for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (binary[y * width + x] === 255) {
        startX = x;
        startY = y;
        break outer;
      }
    }
  }

  if (startX === -1) return contour;

  // Helper to check if pixel is foreground
  const isFg = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    return binary[y * width + x] === 255;
  };

  // Moore-Neighbor tracing with proper backtrack direction
  // Direction: 0=E, 1=SE, 2=S, 3=SW, 4=W, 5=NW, 6=N, 7=NE
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  let x = startX, y = startY;
  let dir = 7; // Start by looking NE (came from W)

  const maxIter = width * height * 2;
  let iter = 0;

  do {
    contour.push({ x, y });

    // Find next boundary pixel
    let found = false;
    const startDir = (dir + 5) % 8; // Backtrack and go clockwise

    for (let i = 0; i < 8; i++) {
      const checkDir = (startDir + i) % 8;
      const nx = x + dx[checkDir];
      const ny = y + dy[checkDir];

      if (isFg(nx, ny)) {
        x = nx;
        y = ny;
        dir = checkDir;
        found = true;
        break;
      }
    }

    if (!found) break;
    iter++;
  } while ((x !== startX || y !== startY) && iter < maxIter);

  // Sample if too many points
  if (contour.length > 1000) {
    const step = Math.ceil(contour.length / 500);
    const sampled = [];
    for (let i = 0; i < contour.length; i += step) {
      sampled.push(contour[i]);
    }
    return sampled;
  }

  return contour;
}

/**
 * Calculate arc length (perimeter) of a polygon
 */
function calculateArcLength(points) {
  let length = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    length += Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }
  return length;
}

/**
 * Douglas-Peucker polygon approximation (like cv2.approxPolyDP)
 */
function approxPolyDP(points, epsilon) {
  if (points.length <= 2) return points;

  // Find point with max distance from line between first and last
  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = pointToLineDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  // If max distance > epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = approxPolyDP(points.slice(0, maxIdx + 1), epsilon);
    const right = approxPolyDP(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

/**
 * Point to line segment distance
 */
function pointToLineDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  }

  let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}


/**
 * Create a masked image from the base64 source and polygon vertices
 * Vertices are in pixel coordinates relative to the original image
 * Adds buffer to polygon to account for Gemini's imperfect edge detection
 */
async function createMaskedImage(base64Image, vertices, bufferPixels = 5) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Use actual image dimensions
      const imgWidth = img.naturalWidth || img.width;
      const imgHeight = img.naturalHeight || img.height;

      const canvas = document.createElement('canvas');
      canvas.width = imgWidth;
      canvas.height = imgHeight;
      const ctx = canvas.getContext('2d');

      // Calculate centroid for expanding polygon outward
      let centroidX = 0, centroidY = 0;
      vertices.forEach(v => {
        centroidX += v.x;
        centroidY += v.y;
      });
      centroidX /= vertices.length;
      centroidY /= vertices.length;

      // Expand vertices outward from centroid by buffer amount
      const expandedVertices = vertices.map(v => {
        const dx = v.x - centroidX;
        const dy = v.y - centroidY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return { x: v.x, y: v.y };
        const scale = (dist + bufferPixels) / dist;
        return {
          x: centroidX + dx * scale,
          y: centroidY + dy * scale
        };
      });

      // 1. Draw expanded Polygon Path for clipping
      ctx.beginPath();
      if (expandedVertices.length > 0) {
        ctx.moveTo(expandedVertices[0].x, expandedVertices[0].y);
        for (let i = 1; i < expandedVertices.length; i++) {
          ctx.lineTo(expandedVertices[i].x, expandedVertices[i].y);
        }
      }
      ctx.closePath();

      // 2. Clip to path
      ctx.clip();

      // 3. Draw Image
      ctx.drawImage(img, 0, 0);

      // 4. Crop to bounding box with padding
      let minX = imgWidth, minY = imgHeight, maxX = 0, maxY = 0;
      expandedVertices.forEach(v => {
        minX = Math.min(minX, v.x);
        minY = Math.min(minY, v.y);
        maxX = Math.max(maxX, v.x);
        maxY = Math.max(maxY, v.y);
      });

      // Clamp to image bounds
      minX = Math.max(0, Math.floor(minX));
      minY = Math.max(0, Math.floor(minY));
      maxX = Math.min(imgWidth, Math.ceil(maxX));
      maxY = Math.min(imgHeight, Math.ceil(maxY));

      const w = Math.max(1, maxX - minX);
      const h = Math.max(1, maxY - minY);

      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = w;
      croppedCanvas.height = h;
      const croppedCtx = croppedCanvas.getContext('2d');

      croppedCtx.drawImage(canvas, minX, minY, w, h, 0, 0, w, h);

      resolve(croppedCanvas.toDataURL('image/png'));
    };
    img.onerror = (err) => {
      console.error('Failed to load image for masking:', err);
      reject(err);
    };
    // Handle both with and without data URL prefix
    if (base64Image.startsWith('data:')) {
      img.src = base64Image;
    } else {
      img.src = `data:image/png;base64,${base64Image}`;
    }
  });
}

/**
 * Handle AI Import Click
 */
export async function handleAiImport(points, store) {
  const pointsArray = Array.isArray(points) ? points : [points];
  console.log("Starting AI Import for", pointsArray.length, "points");

  let successCount = 0;

  // Process each point sequentially (or parallel if we want speed, but sequential is safer for rate limits)
  // Parallel is better for UX.
  const promises = pointsArray.map(async (point) => {
    try {
      const { lat, lng } = point;
      // Use the clicked location as the center for the static map
      const { data, error } = await supabase.functions.invoke('extract-map-feature', {
        body: {
          center: `${lat},${lng}`,
          zoom: 20, // High zoom for building detail
          size: '800x800',
          point: { x: 400, y: 400 }, // Center of the image
          maptype: 'satellite'
        }
      });

      if (error) throw error;

      // Handle new API format (data.building) or legacy format (data.feature)
      let building = null;

      if (data.building) {
        // New format: building object from backend
        console.log("AI Import: Using new building format", data.building.name);
        building = { ...data.building };

        // Check if we need to extract polygon from image (new approach)
        // Use mask if available. Do NOT fallback to texture as it produces garbage.
        const imageToExtract = data.maskImage;

        if (data.rawPolygon?.extractPolygonFromImage && imageToExtract) {
          console.log("AI Import: Extracting polygon from image/mask...");
          try {
            // Extract polygon vertices from the isolated building PNG or Mask
            const extractionResult = await extractPolygonFromImage(imageToExtract);

            if (extractionResult.vertices && extractionResult.vertices.length >= 3) {
              console.log("AI Import: Extracted", extractionResult.vertices.length, "vertices from PNG");

              // Get meters per pixel for coordinate conversion
              const zoom = data.building.metadata?.sourceZoom || 20;
              const metersPerPixel = data.building.metadata?.metersPerPixel ||
                (156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom));

              // Convert extracted pixel vertices to meters (relative to image center)
              const imageCenter = {
                x: extractionResult.width / 2,
                y: extractionResult.height / 2
              };

              const verticesInMeters = extractionResult.vertices.map(v => ({
                x: (v.x - imageCenter.x) * metersPerPixel,
                y: (v.y - imageCenter.y) * metersPerPixel
              }));

              // Sort vertices clockwise
              const sortedVertices = sortVerticesClockwise(verticesInMeters);

              // Calculate bounding box for w/h
              const xs = sortedVertices.map(v => v.x);
              const ys = sortedVertices.map(v => v.y);
              const minX = Math.min(...xs);
              const minY = Math.min(...ys);
              const maxX = Math.max(...xs);
              const maxY = Math.max(...ys);

              // Normalize vertices to start from 0,0
              const normalizedVertices = sortedVertices.map(v => ({
                x: v.x - minX,
                y: v.y - minY
              }));

              // Update building with extracted polygon
              building.vertices = normalizedVertices;
              building.w = maxX - minX;
              building.h = maxY - minY;
              building.isPolygon = true;

              // Crop the texture to just the building bounds
              try {
                const croppedTexture = await cropImageToBounds(
                  building.texture,
                  extractionResult.boundingBox
                );
                building.texture = croppedTexture;
              } catch (cropErr) {
                console.warn("Failed to crop texture:", cropErr);
              }

              console.log("AI Import: Building polygon extracted successfully", {
                vertices: building.vertices.length,
                w: building.w,
                h: building.h,
                isPolygon: building.isPolygon
              });
            } else {
              console.warn("AI Import: No valid polygon extracted from PNG, vertices:", extractionResult.vertices);
            }
          } catch (extractErr) {
            console.error("Failed to extract polygon from PNG:", extractErr);
            // Fall back to rectangle-based vertices
          }
        } else if (data.satelliteImage && data.rawPolygon?.vertices) {
          // Legacy: use raw polygon vertices to mask satellite image
          try {
            let base64Image = data.satelliteImage;
            if (base64Image.startsWith('data:')) {
              base64Image = base64Image.split(',')[1];
            }

            const maskedTexture = await createMaskedImage(base64Image, data.rawPolygon.vertices);
            building.texture = maskedTexture;
            console.log("AI Import: Created masked texture for building");
          } catch (maskError) {
            console.error("Failed to create masked texture:", maskError);
          }
        }

        // Calculate position offset from canvas origin
        const originLat = store.latitude;
        const originLng = store.longitude;
        const metersPerLat = 111320;
        const metersPerLng = 111320 * Math.cos(originLat * Math.PI / 180);

        const buildingLat = data.building.metadata?.coordinates?.lat || lat;
        const buildingLng = data.building.metadata?.coordinates?.lng || lng;

        const latDiff = buildingLat - originLat;
        const lngDiff = buildingLng - originLng;

        const offsetX = lngDiff * metersPerLng;
        const offsetY = -latDiff * metersPerLat;

        // Position building on canvas
        building.x = offsetX - building.w / 2;
        building.y = offsetY - building.h / 2;

      } else if (data.feature && data.feature.vertices) {
        // Legacy format: need to process vertices from pixels to meters
        const zoom = 20;
        const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);

        console.log("AI Import: Using legacy feature format", { lat, zoom, metersPerPixel });

        let texture = null;
        if (data.image) {
          texture = await createMaskedImage(data.image, data.feature.vertices);
        }

        let vertices = data.feature.vertices.map(v => ({
          x: (v.x - 400) * metersPerPixel,
          y: (v.y - 400) * metersPerPixel
        }));

        vertices = sortVerticesClockwise(vertices);
        const height = data.feature.height || 3.0;

        const polygon = createPolygon(vertices, "structure", height);
        if (polygon) {
          if (texture) {
            polygon.texture = texture;
          }

          const originLat = store.latitude;
          const originLng = store.longitude;
          const metersPerLat = 111320;
          const metersPerLng = 111320 * Math.cos(originLat * Math.PI / 180);

          const latDiff = lat - originLat;
          const lngDiff = lng - originLng;

          const offsetX = lngDiff * metersPerLng;
          const offsetY = -latDiff * metersPerLat;

          polygon.x += offsetX;
          polygon.y += offsetY;

          building = polygon;
        }
      }

      // Add building to canvas if successfully created
      if (building) {
        store.addObject(building);
        successCount++;

        // Center view on the imported building
        if (store.canvas) {
          const canvas = store.canvas;
          const scale = store.scale;
          const centerX = building.x + building.w / 2;
          const centerY = building.y + building.h / 2;

          const newOffsetX = (canvas.width / 2) - (centerX * scale);
          const newOffsetY = (canvas.height / 2) - (centerY * scale);

          store.setOffset(newOffsetX, newOffsetY);
        }
      }
    } catch (err) {
      console.error("AI Import failed for point:", point, err);
    }
  });

  await Promise.all(promises);

  if (successCount > 0) {
    store.saveState();
    console.log("AI Import successful for", successCount, "buildings");
    store.setAiImportMode(false);
  } else {
    alert("No buildings detected.");
  }
}

/**
 * Crop an image to the specified bounding box and convert white to transparent
 */
async function cropImageToBounds(base64Image, bounds) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { minX, minY, maxX, maxY } = bounds;
      const w = maxX - minX;
      const h = maxY - minY;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(img, minX, minY, w, h, 0, 0, w, h);

      // Convert white/near-white pixels to transparent
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        // If pixel is white or near-white, make it transparent
        if (r > 245 && g > 245 && b > 245) {
          data[i + 3] = 0; // Set alpha to 0
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;

    if (base64Image.startsWith('data:')) {
      img.src = base64Image;
    } else {
      img.src = `data:image/png;base64,${base64Image}`;
    }
  });
}

/**
 * Calculate distance guides between the moving object and nearby objects
 */
function calculateDistanceGuides(x, y, w, h, objects, excludeId) {
  const guides = [];
  const maxDistance = 15.0; // Show guides for objects within 15 meters

  const myLeft = x;
  const myRight = x + w;
  const myTop = y;
  const myBottom = y + h;
  const myArea = w * h;

  // 1. Check for Encompassing Object (Parent)
  // We look for the smallest object that fully contains the moving object.
  let encompassingObj = null;
  let minEncompassingArea = Infinity;

  for (const obj of objects) {
    if (obj.id === excludeId) continue;
    // Don't measure against wires or non-physical items if possible, but structure/tinshed/polygon are good candidates.
    // Generally checking geometric containment is enough.

    const objLeft = obj.x;
    const objRight = obj.x + obj.w;
    const objTop = obj.y;
    const objBottom = obj.y + obj.h;

    // Check if 'obj' fully contains 'me'
    if (objLeft <= myLeft && objRight >= myRight && objTop <= myTop && objBottom >= myBottom) {
      const area = obj.w * obj.h;
      // We want the tightest fit (smallest area) that contains us (e.g. Room inside a Floor)
      if (area < minEncompassingArea && area > myArea) {
        minEncompassingArea = area;
        encompassingObj = obj;
      }
    }
  }

  // If found, return guides to the enclosing walls ONLY (as requested)
  if (encompassingObj) {
    const p = encompassingObj;
    // Left Wall
    guides.push({
      x1: myLeft, y1: myTop + h / 2,
      x2: p.x, y2: myTop + h / 2,
      label: `${(myLeft - p.x).toFixed(2)}m`
    });
    // Right Wall
    guides.push({
      x1: myRight, y1: myTop + h / 2,
      x2: p.x + p.w, y2: myTop + h / 2,
      label: `${((p.x + p.w) - myRight).toFixed(2)}m`
    });
    // Top Wall
    guides.push({
      x1: myLeft + w / 2, y1: myTop,
      x2: myLeft + w / 2, y2: p.y,
      label: `${(myTop - p.y).toFixed(2)}m`
    });
    // Bottom Wall
    guides.push({
      x1: myLeft + w / 2, y1: myBottom,
      x2: myLeft + w / 2, y2: p.y + p.h,
      label: `${((p.y + p.h) - myBottom).toFixed(2)}m`
    });

    return guides;
  }

  // 2. If NOT inside something, use existing Neighbor Logic
  // Find nearest object in each direction
  let minDiffLeft = Infinity, nearestLeft = null;
  let minDiffRight = Infinity, nearestRight = null;
  let minDiffTop = Infinity, nearestTop = null;
  let minDiffBottom = Infinity, nearestBottom = null;

  for (const obj of objects) {
    if (obj.id === excludeId) continue;

    const objLeft = obj.x;
    const objRight = obj.x + obj.w;
    const objTop = obj.y;
    const objBottom = obj.y + obj.h;

    // Check overlap in Y for X-distance
    const overlapY = Math.min(myBottom, objBottom) - Math.max(myTop, objTop);
    if (overlapY > 0) {
      // Object is to my left
      if (objRight <= myLeft) {
        const dist = myLeft - objRight;
        if (dist >= 0 && dist < maxDistance && dist < minDiffLeft) {
          minDiffLeft = dist;
          nearestLeft = obj;
        }
      }
      // Object is to my right
      if (objLeft >= myRight) {
        const dist = objLeft - myRight;
        if (dist >= 0 && dist < maxDistance && dist < minDiffRight) {
          minDiffRight = dist;
          nearestRight = obj;
        }
      }
    }

    // Check overlap in X for Y-distance
    const overlapX = Math.min(myRight, objRight) - Math.max(myLeft, objLeft);
    if (overlapX > 0) {
      // Object is above me
      if (objBottom <= myTop) {
        const dist = myTop - objBottom;
        if (dist >= 0 && dist < maxDistance && dist < minDiffTop) {
          minDiffTop = dist;
          nearestTop = obj;
        }
      }
      // Object is below me
      if (objTop >= myBottom) {
        const dist = objTop - myBottom;
        if (dist >= 0 && dist < maxDistance && dist < minDiffBottom) {
          minDiffBottom = dist;
          nearestBottom = obj;
        }
      }
    }
  }

  // Create guides
  if (nearestLeft) {
    const midY = (Math.max(myTop, nearestLeft.y) + Math.min(myBottom, nearestLeft.y + nearestLeft.h)) / 2;
    guides.push({
      x1: nearestLeft.x + nearestLeft.w, y1: midY,
      x2: myLeft, y2: midY,
      label: `${minDiffLeft.toFixed(2)}m`
    });
  }
  if (nearestRight) {
    const midY = (Math.max(myTop, nearestRight.y) + Math.min(myBottom, nearestRight.y + nearestRight.h)) / 2;
    guides.push({
      x1: myRight, y1: midY,
      x2: nearestRight.x, y2: midY,
      label: `${minDiffRight.toFixed(2)}m`
    });
  }
  if (nearestTop) {
    const midX = (Math.max(myLeft, nearestTop.x) + Math.min(myRight, nearestTop.x + nearestTop.w)) / 2;
    guides.push({
      x1: midX, y1: nearestTop.y + nearestTop.h,
      x2: midX, y2: myTop,
      label: `${minDiffTop.toFixed(2)}m`
    });
  }
  if (nearestBottom) {
    const midX = (Math.max(myLeft, nearestBottom.x) + Math.min(myRight, nearestBottom.x + nearestBottom.w)) / 2;
    guides.push({
      x1: midX, y1: myBottom,
      x2: midX, y2: nearestBottom.y,
      label: `${minDiffBottom.toFixed(2)}m`
    });
  }

  return guides;
}

