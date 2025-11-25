# Implementation Plan: Production-Ready Fixes

## 1. Panel Selection for Array Drawing
**Goal**: Allow users to select a panel type before drawing an array

**Changes**:
- Add `selectedPanelType` state to solarStore
- Modify LeftSidebar to highlight selected panel
- Update createPanelArray to use selected panel specs
- Default to 550W panel if none selected

## 2. Shadow Logic from solar-board.html
**Goal**: Copy exact shadow implementation

**Key differences found**:
```javascript
// solar-board.html getShadowVector:
const len = Math.min(3.0, (1 / Math.max(0.15, elevation)) * 0.7);
return { x: -Math.cos(angle) * len, y: -Math.sin(angle) * len };

// Current implementation:
const shadowRatio = Math.max(0, (1 / Math.max(0.15, elevation)) - 1);
return { x: -Math.cos(angle) * shadowRatio, y: -Math.sin(angle) * shadowRatio };
```

**Changes**:
- Update `getShadowVector` in canvas.js to match solar-board.html exactly
- Use `len = Math.min(3.0, (1 / Math.max(0.15, elevation)) * 0.7)`

## 3. Remove DrawingHeightControl
**Goal**: Height editing only in RightPanel

**Changes**:
- Delete `src/components/DrawingHeightControl.jsx`
- Remove import from `App.jsx`
- Remove `<DrawingHeightControl />` from App.jsx
- Verify RightPanel has h_z control (it does - line 123-139)

## 4. Resize Handles
**Goal**: Add corner/edge handles for resizing selected objects

**Implementation**:
- Add `drawResizeHandles` function to canvas.js
- Draw 8 handles (4 corners + 4 edges) for selected object
- Add mouse event handling in canvasEvents.js
- Detect handle hover/click
- Implement resize dragging logic
- Update object dimensions during drag

**Handle positions**:
- Top-left, Top-center, Top-right
- Middle-left, Middle-right
- Bottom-left, Bottom-center, Bottom-right

---

**Priority Order**:
1. Shadow logic (quick fix)
2. Remove DrawingHeightControl (quick fix)
3. Panel selection for array
4. Resize handles (most complex)
