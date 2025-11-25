import { useSolarStore } from "../stores/solarStore";
import { supabase } from "../lib/supabase";
import { screenToWorld, getObjectAtScreenPoint, calculateOrthogonalPath, getResizeHandleAtPoint } from "./canvas";
import { createRectangle, createPolygon, closePath, simplifyPath, createPanelArray } from "./drawingTools";

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
      const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);

      const mapWidthMeters = 800 * metersPerPixel;
      const mapHeightMeters = 800 * metersPerPixel;

      // Check if click is within map bounds
      if (worldPos.x >= -mapWidthMeters / 2 && worldPos.x <= mapWidthMeters / 2 &&
        worldPos.y >= -mapHeightMeters / 2 && worldPos.y <= mapHeightMeters / 2) {

        // Convert to pixel coordinates (0-800)
        const pixelX = (worldPos.x + mapWidthMeters / 2) / metersPerPixel;
        const pixelY = (worldPos.y + mapHeightMeters / 2) / metersPerPixel;

        handleAiImport(pixelX, pixelY, store);
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
          const isAlreadySelected = obj.id === store.selectedObjectId || (store.additionalSelectedIds || []).includes(obj.id);

          if (!isAlreadySelected) {
            store.setSelectedObject(obj.id);
          }

          this._isDragging = true;
          this._dragStartPos = worldPos;

          // Store start positions for all selected objects
          const allSelectedIds = [store.selectedObjectId, ...(store.additionalSelectedIds || [])].filter(Boolean);
          // If we just selected a new object (isAlreadySelected is false), the store update might not be reflected in store.selectedObjectId yet if it's async? 
          // Zustand is synchronous. So store.setSelectedObject(obj.id) updates state immediately.
          // But wait, if !isAlreadySelected, we called setSelectedObject(obj.id), which clears additionalSelectedIds.
          // So allSelectedIds will just be [obj.id]. Correct.

          // Re-fetch state to be sure? No, store variable is const reference to state at start of function?
          // No, useSolarStore.getState() returns current state object.
          // But I assigned `const store = useSolarStore.getState()` at top of function.
          // That object is a snapshot? No, it's the state object.
          // But if I call `store.setSelectedObject`, does `store` variable update? 
          // `store` is the return value of `getState()`. It's the state object AT THAT MOMENT.
          // It does NOT update automatically.
          // So I need to call `useSolarStore.getState()` again or manually construct the list.

          let currentSelectedIds = [];
          if (!isAlreadySelected) {
            currentSelectedIds = [obj.id];
          } else {
            currentSelectedIds = [store.selectedObjectId, ...(store.additionalSelectedIds || [])].filter(Boolean);
          }

          this._dragStartPositions = {};
          currentSelectedIds.forEach(id => {
            const o = store.objects.find(obj => obj.id === id);
            if (o) this._dragStartPositions[id] = { x: o.x, y: o.y };
          });

          this._dragStartObjPos = { x: obj.x, y: obj.y }; // Keep for legacy/primary alignment
        } else {
          // Start Selection Box (Multi-select)
          store.setSelectedObject(null);
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
          x: worldPos.x,
          y: worldPos.y,
          w: equipment.width || 1,
          h: equipment.height || 1,
          h_z: equipment.h_z || 0.5,
          rotation: 0,
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
        } else if (objType === "battery") {
          newObject.capKwh = equipment.specifications?.capacity_kwh || 5;
        } else if (objType === "panel") {
          newObject.watts = equipment.specifications?.watts || 550;
        }

        store.addObject(newObject);
        break;
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
      }

      const appliedDeltaX = newX - this._dragStartObjPos.x;
      const appliedDeltaY = newY - this._dragStartObjPos.y;

      store.updateObject(store.selectedObjectId, {
        x: newX,
        y: newY,
      });

      // Move additional objects
      if (this._dragStartPositions) {
        (store.additionalSelectedIds || []).forEach(id => {
          const startPos = this._dragStartPositions[id];
          if (startPos) {
            store.updateObject(id, {
              x: startPos.x + appliedDeltaX,
              y: startPos.y + appliedDeltaY
            });
          }
        });
      }
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
  onMouseUp(e, canvas) {
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

        let path = null;
        if (store.cableMode === "ortho") {
          path = calculateOrthogonalPath(this._wireStartObj, endObj);
        }

        store.addWire({
          from: this._wireStartObj.id,
          to: endObj.id,
          type: wireType,
          path,
          id: Math.random().toString(36).slice(2),
        });

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

          // Find base height if placing on structure
          const centerX = (startX + endX) / 2;
          const centerY = (startY + endY) / 2;
          let baseHeight = 0;
          let mountingType = "ground";

          for (const obj of store.objects) {
            if (obj.type === 'structure' || obj.type === 'tinshed') {
              if (centerX >= obj.x && centerX <= obj.x + obj.w &&
                centerY >= obj.y && centerY <= obj.y + obj.h) {
                baseHeight = obj.h_z || 0;
                mountingType = obj.type === 'tinshed' ? 'tinshed' : 'rcc';
                break;
              }
            }
          }

          // Create panel type from equipment
          const panelType = {
            w: equipment.width || equipment.specifications?.width || 1.134,
            h: equipment.height || equipment.specifications?.height || 2.278,
            watts: equipment.specifications?.watts || 550,
            cost: parseFloat(equipment.cost) || 15000,
            label: equipment.name || "Panel"
          };

          // Create panel array with obstruction avoidance
          const panels = createPanelArray(
            { x: startX, y: startY },
            { x: endX, y: endY },
            baseHeight,
            panelType,
            store.objects
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
            watts: equipment.specifications?.watts || 550,
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

    // Smoother zoom sensitivity (Reduced further)
    const zoomFactor = e.deltaY > 0 ? 0.98 : 1.02;
    const newScale = Math.max(5, Math.min(100, store.scale * zoomFactor));

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

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
    if (e.key === "Delete" || e.key === "Backspace") {
      if (store.selectedObjectId) {
        store.deleteObject(store.selectedObjectId);
        store.setSelectedObject(null);
      }
      if (store.additionalSelectedIds && store.additionalSelectedIds.length > 0) {
        store.additionalSelectedIds.forEach(id => store.deleteObject(id));
        store.setAdditionalSelectedIds([]);
      }
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

      if (data.feature && data.feature.vertices) {
        const zoom = 20;
        const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);

        const vertices = data.feature.vertices.map(v => ({
          x: (v.x - 400) * metersPerPixel,
          y: (v.y - 400) * metersPerPixel
        }));

        // Use estimated height if available, default to 3.0
        const height = data.feature.height || 3.0;

        const polygon = createPolygon(vertices, "structure", height);
        if (polygon) {
          // Adjust polygon position relative to the first point?
          // No, each polygon is created relative to its own center (lat,lng).
          // But we need to place them on the canvas relative to the canvas origin.
          // The canvas origin (0,0) corresponds to `store.latitude, store.longitude`?
          // Wait, `Canvas.jsx` renders map centered at `latitude, longitude`.
          // If the user panned the map, `latitude` and `longitude` in store might be different from the import points.
          // Actually, `MapOverlay` uses `latitude` and `longitude` from store as center.
          // When user clicks, `lat, lng` are absolute.
          // We need to convert absolute `lat, lng` to canvas coordinates relative to `store.latitude, store.longitude`.

          // Canvas (0,0) is at `store.latitude, store.longitude`.
          // Offset of point:
          // dx = (point.lng - store.longitude) * metersPerDegreeLng
          // dy = (store.latitude - point.lat) * metersPerDegreeLat (y is down)

          // Wait, `metersPerPixel` calculation above is for the *static map image* fetched for that specific point.
          // The vertices returned are relative to that point.
          // So `polygon` vertices are relative to `point`.
          // We need to add `point`'s offset from canvas origin.

          const originLat = store.latitude;
          const originLng = store.longitude;

          const metersPerLat = 111320; // Approx
          const metersPerLng = 111320 * Math.cos(originLat * Math.PI / 180);

          const latDiff = lat - originLat;
          const lngDiff = lng - originLng;

          const offsetX = lngDiff * metersPerLng;
          const offsetY = -latDiff * metersPerLat; // Y is down, Lat increases up

          // Shift polygon vertices
          polygon.x += offsetX;
          polygon.y += offsetY;
          polygon.vertices = polygon.vertices.map(v => ({
            x: v.x + offsetX,
            y: v.y + offsetY
          }));

          // Re-calculate bbox? createPolygon already did it.
          // But we shifted x/y.
          // createPolygon returns x,y as minX, minY.
          // So just shifting x,y and vertices is enough.

          store.addObject(polygon);
          successCount++;

          // Center view on the imported polygon (using the last one if multiple)
          if (store.canvas) {
            const canvas = store.canvas;
            const scale = store.scale;
            const centerX = polygon.x + polygon.w / 2;
            const centerY = polygon.y + polygon.h / 2;

            const newOffsetX = (canvas.width / 2) - (centerX * scale);
            const newOffsetY = (canvas.height / 2) - (centerY * scale);

            store.setOffset(newOffsetX, newOffsetY);
          }
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

