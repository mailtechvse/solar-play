# Canvas Engine Quick Start Guide

## Getting Started

The Solar Architect canvas is now fully functional with all the features from the original `solar-board.html` ported to React.

## Basic Operations

### 1. Placing Equipment

**Steps:**
1. Select equipment type from left sidebar (Panels, Inverters, BOS, etc.)
2. Click anywhere on the canvas to place it
3. Move the mouse to position, click to confirm

**Keyboard Shortcut:**
- Equipment tools automatically switch the mode to "place"

### 2. Moving Objects

**Steps:**
1. Press `V` to enter Select mode (or click Select button)
2. Click on an object to select it (blue outline appears)
3. Drag to move it anywhere on the canvas

**Alternative:**
- Click and drag empty space to pan the canvas view

### 3. Creating Electrical Connections

**DC Wire (Red):**
1. Press `W` or click DC Wire button
2. Click on starting component
3. Click on ending component
4. Wire appears between them

**AC Wire (Yellow):**
1. Press `A` or click AC Wire button
2. Same process as DC wire

**Earth Connection (Green):**
1. Press `G` or click Earthing button
2. Same process as DC wire

**Wire Routing:**
- **Straight Mode**: Direct diagonal lines (default)
- **Orthogonal Mode**: L-shaped paths with right angles
  - Toggle with "Cable Mode" button in top bar

### 4. Measuring Distances

**Steps:**
1. Press `M` or click Measure button
2. Click on starting point
3. Click on ending point
4. Distance appears in blue line

**Use Case:**
- Verify component spacing
- Plan cable runs
- Check clearance between objects

### 5. Deleting Objects

**Method 1 - Delete Mode:**
1. Press `D` or click Delete button
2. Click on object to delete

**Method 2 - Keyboard:**
1. Click to select object (blue outline)
2. Press `Delete` or `Backspace`

**Method 3 - Right-click:**
1. Right-click on object
2. Select "Delete" from context menu (coming soon)

### 6. Rotating Objects

**Steps:**
1. Click to select object
2. Press `R` to rotate 90°
3. Repeat to rotate further

**Note:** Mainly useful for solar panels to change orientation

## Viewing Controls

### Zoom In/Out
- **Scroll Wheel**: Up to zoom in, down to zoom out
- **Zoom Range**: 5x to 100x pixels per meter
- **Smart Zoom**: Zooms towards cursor position

### Pan Canvas
1. Hold left mouse button on empty space
2. Drag to move view in any direction
3. Or press spacebar and drag

### Reset View
- Click "Grid" button to toggle grid visibility
- Grid helps with alignment

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `V` | Select mode |
| `M` | Measure mode |
| `D` | Delete mode |
| `W` | DC wire |
| `A` | AC wire |
| `G` | Earthing |
| `R` | Rotate selected |
| `Ctrl+Z` | Undo last action |
| `Ctrl+Y` | Redo last action |
| `Ctrl+C` | Copy selected object |
| `Ctrl+V` | Paste copied object |
| `Delete` | Delete selected |
| `Escape` | Cancel current mode |

## Copy & Paste

### Copy Selected Object:
1. Click to select object
2. Press `Ctrl+C` (or `Cmd+C` on Mac)
3. Object data is copied to clipboard

### Paste Object:
1. Press `Ctrl+V` (or `Cmd+V` on Mac)
2. Pasted object appears 1 meter offset from original
3. Click to position if needed

**Use Case:**
- Quickly duplicate similar panels
- Create array patterns
- Copy inverter configurations

## Undo & Redo

### Undo:
- Press `Ctrl+Z` to undo last action
- Up to 50 recent actions in history
- Undo/Redo buttons in top bar

### Redo:
- Press `Ctrl+Y` to redo undone action
- Useful if you undo too much

## Object Selection

### Select Single Object:
1. Press `V` for Select mode
2. Click on object (blue outline appears)
3. Right panel shows properties

### Deselect:
1. Click on empty canvas area
2. Or press `Escape`

### Double-Click Object:
1. Opens object properties (coming soon)
2. Edit position, height, rotation, specs

## Object Properties

When an object is selected, the right panel shows:
- **Position**: X and Y coordinates in meters
- **Dimensions**: Width and height in meters
- **Height (Z)**: Elevation above ground for shadows
- **Rotation**: 0-360° angle
- **Cost**: Price in INR
- **Specs**: Watts/kW/kWh depending on type

## Color Themes

Toggle themes in top bar:
- **Dark** (default) - Best for night work
- **Light** - Best for daytime
- **Sepia** - Vintage appearance

All themes maintain color coding for wires:
- **Red**: DC wires
- **Yellow**: AC wires
- **Green**: Earth connections

## Grid System

### Grid Visibility:
- Click "Grid" button to toggle on/off
- Helps with alignment and measurements
- 1-meter spacing (adjustable in advanced settings)

### Grid Snapping:
- Objects snap to grid for alignment
- Helps create neat, organized layouts
- Optional in advanced settings

## Sun & Shadows

### Sun Position:
- Shadows appear based on sun position
- Time slider (6 AM to 6 PM) controls sun height
- Updates every hour simulated

### Location:
- Set latitude/longitude in top bar
- Affects sun position calculations
- Used for accurate simulations

### Shadow Behavior:
- Height-based opacity (higher = lighter shadow)
- Different opacity for roof vs ground
- Updates in real-time

## Performance Tips

1. **Zoom Level**:
   - Use appropriate zoom (25 pixels/meter is default)
   - Too much zoom slows rendering

2. **Object Count**:
   - 100+ objects still render at 60 FPS
   - Keep objects only when needed

3. **Wires**:
   - Straight wires faster than orthogonal
   - Hundreds of wires still manageable

4. **Grid**:
   - Toggle off if not needed
   - Reduces rendering load

## Common Workflows

### Design a Rooftop System:
1. Place roof structure (draw rectangle mode)
2. Place solar panels on roof
3. Create DC wires from panels to inverter
4. Add inverter in corner
5. Create AC wire to ACDB/LT panel
6. Add safety components (earthing pit, LA)

### Ground-Mounted Array:
1. Place ground structure
2. Arrange panels in rows
3. Wire panels in series/parallel strings
4. String inverters handle each string
5. AC wires to central ACDB
6. Meter and grid connection

### Measurement Check:
1. Use Measure tool (M key)
2. Check distances between components
3. Verify cable run lengths
4. Confirm panel spacing

## Troubleshooting

### Objects Not Appearing:
- Check canvas is in view
- Verify objects have valid coordinates
- Try zooming out with scroll wheel

### Can't Select Objects:
- Press `V` to ensure Select mode is active
- Objects must be fully on canvas

### Wires Not Connected:
- Start and end on actual objects
- Objects must be valid types
- Can't wire object to itself

### Zoom Not Working:
- Scroll wheel required
- Check if page-level scroll is blocking
- Try zooming at different locations

### Grid Misaligned:
- Grid is reference only
- Objects snap automatically if enabled
- Try toggling grid off/on

## Settings

### Location Settings (Top Bar):
- **Latitude**: -90 to +90
- **Longitude**: -180 to +180
- **Detect Location**: Auto-detects via browser
- Used for sun position calculations

### Canvas Settings:
- **Grid Toggle**: Show/hide 1m grid
- **Cable Mode**: Straight vs Orthogonal wires
- **Color Theme**: Dark, Light, or Sepia

### Advanced (Coming Soon):
- Grid snap enable/disable
- Grid size customization
- Snap-to-grid distance
- Cable routing optimization

## Next Steps

Once your design is complete:

1. **Save Project**:
   - Click "Save" button (top bar)
   - Saves as JSON file to downloads

2. **Load Project**:
   - Click "Load" button
   - Select previously saved JSON file

3. **Evaluate Design**:
   - Click "Evaluate" button (green)
   - Shows performance report
   - 25-year financial projection
   - System validation checks

## Tips & Tricks

1. **Quick Placement**: Use keyboard shortcuts to switch tools (W, A, G, D, M, V)

2. **Precise Movement**: Click object, use arrow keys for pixel-perfect positioning (coming soon)

3. **Bulk Operations**: Select multiple objects (Shift+click) for grouped actions (coming soon)

4. **Visualization**: Toggle between themes to see design in different lighting

5. **Backup**: Regularly save projects as JSON

6. **Undo Habits**: Get comfortable with Ctrl+Z for experimental layouts

## Getting Help

For technical details, see:
- `docs/CANVAS_ENGINE_IMPLEMENTATION.md` - Complete API reference
- `CANVAS_ENGINE_COMPLETION_STATUS.md` - Feature list
- Code comments in `src/utils/canvas.js` and `src/utils/canvasEvents.js`

## Quick Reference

```
MODE SHORTCUTS:
V = Select    M = Measure    D = Delete
W = DC Wire   A = AC Wire    G = Earth
R = Rotate

EDIT SHORTCUTS:
Ctrl+Z = Undo     Ctrl+Y = Redo
Ctrl+C = Copy     Ctrl+V = Paste
Delete = Remove

VIEWING:
Scroll = Zoom     Click+Drag = Pan     Escape = Cancel
```

---

**Version**: 1.0
**Last Updated**: November 23, 2025
