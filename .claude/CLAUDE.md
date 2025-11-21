# Solar Architect: Grid Master - Project Guide

## Project Overview
**Solar Architect** is an interactive web-based solar grid design and simulation tool. It's a single-file application (solar-board.html) built with vanilla JavaScript, Canvas rendering, and Tailwind CSS for the UI.

### Key Purpose
- Design solar PV systems with panels, inverters, batteries, and balance-of-system (BOS) components
- Visualize the layout on a 2D canvas with perspective rendering (height z-index)
- Run financial simulations to calculate ROI, savings, and grid export scenarios
- Generate performance reports with monthly and 25-year projections

## Tech Stack
- **Frontend**: Vanilla JavaScript (Canvas API for rendering)
- **UI**: Tailwind CSS + Font Awesome icons
- **Data Viz**: Chart.js for graphs
- **Build Tool**: Vite (dev server)
- **Node Modules**: Minimal (vite only)

## Architecture Overview

### Core Application (GameApp class - line 705+)
The main application logic is contained in a single `GameApp` class that handles:
- Canvas rendering and interaction
- Object management (placement, selection, rotation, grouping)
- Wire/connection management (DC, AC, earthing)
- Simulation and financial calculations
- Undo/Redo history
- Project save/load as JSON

### Component System (line 671-701)
Pre-defined component library in `COMPONENTS` object:
- **Panels**: 330W-730W solar panels with specs
- **Inverters**: Micro (0.5kW), String (3-100kW), Hybrid (5kW) options
- **BOS Components**: ACDB, LT/HT panels, meters (net/gross), grid points, transformers
- **Safety**: Lightning arrestor (LA), earthing pits
- **Storage**: 5kWh batteries
- **Custom**: User can add custom components via modal

### Data Structure
Objects stored in `this.objects` array:
```javascript
{
  id: "unique-id",
  type: "panel|inverter|structure|obstacle|battery|bos|grid|load|safety",
  x, y, w, h,           // Position and dimensions (in meters)
  h_z, relative_h,      // Height z-index for 3D-like perspective
  rotation: 0-360,      // For panels
  watts/capKw/capKwh,   // Capacity specs
  cost: number,         // In INR
  color: "#hex",
  label: "string",
  isOn: true|false,     // For switches
  // ... other component-specific properties
}
```

Wires stored in `this.wires` array:
```javascript
{
  id: "unique-id",
  from: "object-id",
  to: "object-id",
  type: "dc|ac|earth",
  path: [{x, y}, ...],  // For orthogonal routing
}
```

## Key Features & Implementation

### 1. Canvas Rendering System (line 1000+)
- **Pixel-aligned rendering**: `image-rendering: pixelated` for crisp output
- **Z-ordering**: Objects sorted by `h_z` for depth perception
- **Grid overlay**: Optional reference grid with 1m spacing
- **Dynamic panning**: offsetX/offsetY with mouse wheel zoom (scale = 25px/meter)

### 2. Tool Modes (line 1100+)
- **select**: Click to select, drag to move, double-click to open properties
- **measure**: Distance calculation tool
- **delete**: Remove objects/wires
- **wire_dc/wire_ac/earthing**: Draw connections between components
- **structure/obstacle**: Place base structures

### 3. Financial Simulation (line 1400+)
- **Capacity calculation**: Sum of all panel watts / 1000 = DC capacity in kWp
- **Monthly generation**: Based on sun time (6-18 hours slider)
- **Load matching**: Input load in units/month vs generated units
- **Metering modes**: Net metering (savings) vs Gross metering (income)
- **ROI projection**: 25-year analysis with 0.5% yearly degradation

### 4. Simulation Logic (runSimulation method)
Calculates for each month:
1. Average daily generation based on sun hours
2. Load consumption (fixed input)
3. Net export / import
4. Cost savings (net) or income (gross)
5. 25-year cumulative analysis

### 5. Layer Management
- Groups objects for easier manipulation
- Visual hierarchy in sidebar
- Layer properties panel (hidden in current version)

## UI Components

### Top Bar (line 122-191)
- Project name & version
- Statistics display (DC capacity, AC output, estimated cost)
- Grid/Cable mode toggles
- Save/Load buttons
- Copy/Paste/Rotate operations
- Undo/Redo
- Clear & Evaluate buttons

### Left Sidebar (line 209-505)
- Project scenario selector (Blank, Residential, Commercial)
- Financial inputs (grid rate, load, plant cost)
- Layers panel with grouping controls
- Tool palette (6 main tools in 2 rows)
- Component palettes (Panels, Inverters, BOS, Safety)
- Custom component creator modal

### Right Panel (line 460-505)
- Object properties when selected
- Rotation, movement, scaling controls
- Height input (in meters or feet)
- Fill operations for structures

### Evaluation Modal (line 571-666)
- Performance score circle
- System stats (DC size, annual generation)
- Generation vs ROI charts
- Monthly breakdown table
- 25-year projection table
- Critical connectivity checks

## Important Implementation Notes

### 1. Object ID Generation
```javascript
// All objects use random alphanumeric IDs
id: Math.random().toString(36).slice(2)
// Custom components use timestamp
id: 'cust_' + Date.now()
```

### 2. Height System
- **h_z**: Absolute height from ground (meters)
- **relative_h**: Height above the structure it's placed on
- When object placed on structure, h_z = structure.h_z + relative_h
- Enables roof-mounted vs ground-mounted solar panels

### 3. Shadow Rendering
- Sun position calculated from sunTime (6-18 for 6 AM to 6 PM)
- Shadow vector: {dx: sunX - objCenterX, dy: sunY - objCenterY}
- Different opacity for roof vs ground shadows

### 4. Wire Routing
- **Straight mode**: Direct diagonal lines between components
- **Orthogonal mode**: Right-angle paths (grid-snapped)
- Wire type affects color (red=DC, yellow=AC, green=earth)

### 5. History & Undo/Redo
- Snapshots stored as JSON strings in `this.history` array
- Limited to last 50 states to prevent memory bloat
- Line 742: `saveState()` is called after every user action

### 6. Financial Constants
- Panel efficiencies baked into component definitions
- Degradation rate: 0.5% per year (25-year projection)
- Cost per unit varies by metering mode

## Scenarios (line 1450+)

### Blank Canvas
Start with empty grid, user defines all components

### Residential Rooftop (default)
- 40sqm roof structure at 3m height
- 4-5 panels (330-585W) with micro inverters
- Microinverter for residential simplicity

### Commercial Ground Mount
- Large ground structure (100sqm)
- 25-100kW string inverters
- Ground-mounted panels in arrays
- AC/DC disconnect switches

## Keyboard Shortcuts (line 718-734)
- **V**: Select mode
- **M**: Measure mode
- **D**: Delete mode
- **W**: DC wire
- **A**: AC wire
- **G**: Earthing
- **R**: Rotate selected
- **Ctrl+S/Cmd+S**: Save project
- **Ctrl+Z/Cmd+Z**: Undo
- **Ctrl+Y/Cmd+Y**: Redo
- **Ctrl+C/Cmd+C**: Copy
- **Ctrl+V/Cmd+V**: Paste
- **Delete/Backspace**: Delete selected object

## Important Behaviors & Edge Cases

### 1. Selection & Movement
- Only one object can be selected at a time (`selectedObjectId`)
- Selected objects have blue highlight border
- Dragging moves object while updating h_z based on structure below
- Snap-to-grid disabled for fine positioning

### 2. Wire Connections
- Can't create wire from component to itself
- Wire endpoints are snapped to component centers
- Wire deletion via context menu or delete tool

### 3. Grouping
- Multiple objects can be grouped
- Group operations move all members together
- Groups are stored as `children` array on parent object (line 1200+)

### 4. Simulation Constraints
- Minimum DC capacity: 1 kWp (to avoid division by zero)
- Load capacity check: If system generation < load, shows warning
- Connectivity check: Panels must connect to inverter via DC wire

## Common Tasks

### Adding a New Component Type
1. Add entry to `COMPONENTS` object with all required properties
2. Properties: `type`, `w`, `h`, `cost`, `color`, `h_z` (minimum)
3. Type-specific: `watts` (panel), `capKw` (inverter), `capKwh` (battery)
4. Add button to appropriate sidebar section

### Modifying Simulation Logic
- Main calculation: `runSimulation()` method (~line 1380)
- Monthly generation: Edit sun hours calculation
- Cost calculation: Modify rate/load multipliers
- ROI logic: 25-year projection in year-loop (line 1450+)

### Changing UI Layout
- Top bar: Line 122-191
- Sidebar sections: Line 214-505
- Modal dialogs: Line 531-666
- Color scheme: Tailwind classes (dark theme: gray-900, gray-800)

## Performance Considerations

### Canvas Rendering Loop
- 60fps target via `requestAnimationFrame`
- Redraws entire canvas every frame (no optimization needed for small designs)
- For large designs (100+ objects), consider chunked rendering

### Object Lookup
- Linear searches: `this.objects.find()` and `this.objects.filter()`
- For large designs, consider spatial index (quadtree)

### JSON Serialization
- Used for undo/redo and save/load
- Full clones using `JSON.stringify` + `JSON.parse`
- Not optimized for very large projects (100+ wires)

## Known Limitations / TODOs

1. **Scroll**: Sidebar and panels may need explicit scroll handling on smaller screens
2. **Mobile**: Canvas interaction not optimized for touch
3. **Simulation accuracy**: Simplified sun hours model (not location-based)
4. **Export**: Report download creates basic HTML, not formatted Excel
5. **Undo**: Limited to 50 states, full project snapshots (not delta)

## Development Setup

```bash
npm install
npm run dev          # Start Vite dev server on localhost:5173
npm run build        # Minify for production
npm run preview      # Preview build locally
```

## File Structure
```
/solar-play/
├── solar-board.html          # Entire application (1555 lines)
├── package.json              # Vite config
├── node_modules/             # Dependencies
└── .git/                      # Version control
```

## Notes for Contributors

- **Don't refactor**: Monolithic file is intentional for portability
- **Component changes**: Update COMPONENTS object and bindings
- **UI changes**: Modify corresponding HTML + JavaScript handlers
- **Simulation fixes**: Keep financial formulas transparent (document constants)
- **Testing**: Use browser DevTools console; app object exposed as `window.currentSolarApp`

## Future Enhancement Ideas

- [ ] Multi-story buildings with stacking
- [ ] DC/AC loss calculations (cable length effects)
- [ ] Weather file import (TMY data)
- [ ] 3D visualization mode
- [ ] Real-time cost estimation as user designs
- [ ] Electrical safety checks (wire sizing, breaker protection)
- [ ] Energy storage dispatch strategy
- [ ] Visualization of current flow through wires
