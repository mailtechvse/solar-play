# UI Consistency Update

## Objective
Align the React application's UI with the `solar-board.html` reference and the user's target design.

## Changes Implemented

### 1. Left Sidebar (`src/components/LeftSidebar.jsx`)
- **Structure**: Replaced tab-based layout with a vertical scrolling section layout.
- **Sections**:
  - **Project Scenario**: Dropdown for Residential/Commercial.
  - **Financials**: Inputs for Grid Rate, Load, and Plant Cost.
  - **Layers**: Placeholder for layer management (Group/Ungroup).
  - **Main Tools**: Grid of buttons for Select, Measure, Delete, DC Wire, AC Wire, Earthing.
  - **PV Modules**: List of available panels from the store.
  - **Electrical & Grid**: List of inverters, batteries, and load box.
  - **Structures**: Drawing tools for Roof, Tin Shed, Building, Tree, Obstacle.
- **Styling**: Matched the light theme and compact spacing of the reference.

### 2. Top Bar (`src/components/TopBar.jsx`)
- **Structure**:
  - **Left**: Logo, Title, Version.
  - **Center-Left**: Location inputs (Lat/Lon) and Auto-Detect button.
  - **Center-Right**: Stats (DC Capacity, AC Output, Est. Cost) with specific styling.
  - **Right**: Controls for Grid, Cable Mode, File Operations (Save/Load/Cloud), Undo/Redo, Themes, Clear, and Evaluate.
- **Removed**: User profile dropdown (to match target image), Sun Path controls (moved to SimulationControls).

### 3. Simulation Controls (`src/components/SimulationControls.jsx`)
- **Location**: Floating panel at bottom-left.
- **Features**:
  - Sun Position Slider (6 AM - 6 PM).
  - Orientation Slider (0° - 360°).
  - Simulation Controls (Month, Power, Play/Pause, Speed).
  - Map Overlay Setup button.

### 4. Canvas Overlay (`src/components/Canvas.jsx`)
- **Location**: Floating panel at bottom-right.
- **Features**:
  - Compass Visualizer (Orientation).
  - Legend (Sun Path, Shadow Ground, Shadow Roof).
  - Playback Controls (Duplicate of left panel for convenience/consistency).

### 5. Right Panel (`src/components/RightPanel.jsx`)
- **Behavior**: Changed from a fixed flex item to a slide-out absolute overlay.
- **Styling**: Updated to light theme to match the sidebar.
- **Animation**: Added `animate-slide-in-right` for smooth appearance.

### 6. App Layout (`src/App.jsx`)
- **Cleanup**: Removed `DrawingToolbar` as its features are now in the Left Sidebar.
- **Structure**: Maintained `LeftSidebar`, `Canvas`, `RightPanel` (overlay), `WeatherPanel`, and `SimulationControls` (overlay).

## CSS Updates (`src/styles/index.css`)
- Added `@keyframes slideInRight` and `.animate-slide-in-right` class.
- Ensured scrollbar and range input styling matches the dark/light theme mix.
