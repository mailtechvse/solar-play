# Shadow and Alignment Fixes

## Objective
Address user feedback regarding shadow overlap issues and panel alignment.

## Fixes Implemented

### 1. Shadow Overlap Fix
- **Issue**: "shadow of the objects should not come on each other" for objects of the same height.
- **Fix**: Modified `src/utils/canvas.js` to change the rendering order.
  - **Before**: Objects drawn first, then shadows drawn on top (causing shadows to cover neighboring objects).
  - **After**: Shadows drawn first (on the "ground"), then objects drawn on top.
  - **Result**: Shadows of an object will be hidden by neighboring objects of the same or greater height, preventing the visual artifact of a shadow appearing on top of a same-height neighbor.

### 2. Panel Snapping (Alignment)
- **Issue**: "click and drag to align the panels".
- **Fix**: Enhanced `calculateAlignment` in `src/utils/canvasEvents.js`.
  - **Added Edge Snapping**: Implemented logic to snap the edges of the dragged object to the edges of nearby objects (e.g., Right edge of A snaps to Left edge of B).
  - **Refined Threshold**: Reduced snap threshold to `0.2m` for tighter precision suitable for solar panels.
  - **Visual Guides**: Updated guide drawing to be more localized (shorter lines) to reduce clutter.
  - **Result**: Users can now easily drag panels next to each other, and they will "snap" perfectly into alignment, facilitating the creation of neat arrays.

## Verification
- **Shadows**: Place two objects side-by-side. The shadow of one should NOT be visible on the top face of the other.
- **Alignment**: Drag an object near another. It should snap to align edges (side-by-side or top-to-bottom), showing a guide line.
