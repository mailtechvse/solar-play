# Shortcuts Bar Implementation

## Objective
Add a keyboard shortcuts reference bar to the application UI, matching the `solar-board.html` design.

## Changes Implemented

### 1. TopBar Component (`src/components/TopBar.jsx`)
- **Structure**: Wrapped the existing TopBar content in a `flex-col` container.
- **Added**: Inserted a new `div` below the main toolbar containing the shortcuts list.
- **Styling**: Applied dark theme styling (`bg-gray-800`, `text-gray-400`) with monospace font and horizontal scrolling support (`overflow-x-auto`) to match the reference.
- **Shortcuts Listed**:
  - `[V]` Select
  - `[M]` Measure
  - `[D]` Delete
  - `[W]` DC Wire
  - `[A]` AC Wire
  - `[G]` Earthing
  - `[R]` Rotate
  - `[Ctrl+S]` Save
  - `[Del]` Remove Item

## Verification
- The shortcuts bar should appear immediately below the main top toolbar.
- It should be visible on all screen sizes (scrollable on small screens).
- The styling should match the dark theme of the application.
