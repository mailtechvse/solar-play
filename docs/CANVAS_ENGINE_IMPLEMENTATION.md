# Canvas Engine Implementation Guide

## Overview

The Solar Architect React application now includes a sophisticated canvas rendering engine ported from the original vanilla JavaScript application. This document details the implementation of the game engine components that enable the interactive 2D design canvas.

## Components Implemented

### 1. **SunCalc Class** (`src/utils/suncalc.js`)

Advanced sun position calculator based on simplified NOAA/SunCalc algorithms.

**Key Methods:**
- `getPosition(date, lat, lon)` - Returns azimuth and altitude of the sun
  - Parameters:
    - `date`: JavaScript Date object
    - `lat`: Latitude in degrees
    - `lon`: Longitude in degrees
  - Returns: `{azimuth: radians, altitude: radians}`
  - Calculates accurate solar position using astronomical formulas
  - Accounts for solar declination, equation of time, and hour angle

- `getTimes(date, lat, lon)` - Returns sunrise/sunset times
  - Parameters: Same as `getPosition`
  - Returns: `{sunrise: Date, sunset: Date}`

**Usage Example:**
```javascript
import { SunCalc } from "../utils/suncalc";

const now = new Date();
const sunPos = SunCalc.getPosition(now, 28.6, 77.2); // Delhi coordinates
console.log(`Sun altitude: ${sunPos.altitude * 180/Math.PI}°`);
```

**Solar Calculations:**
- Solar longitude (L, g)
- Ecliptic longitude (l)
- Obliquity of ecliptic (eps)
- Right ascension (ra)
- Declination (dec)
- Greenwich Mean Sidereal Time (h)
- Hour angle (H)
- Azimuth (az)
- Altitude (alt)

### 2. **WeatherService Class** (`src/utils/weatherService.js`)

Fetches real-time weather data for solar irradiance calculations using Open-Meteo API (free, no key required).

**Key Methods:**
- `getWeather(lat, lon, date)` - Fetch hourly weather data
  - Returns: `{direct_normal_irradiance, diffuse_radiation, cloudcover, temperature, relativehumidity}`
  - 1-hour caching to prevent API rate limiting
  - Graceful fallback to clear-sky model if API fails

- `calculatePOA(sunAltitude, dni, diffuse, panelTilt, panelAzimuth)` - Plane of Array irradiance
  - Calculates actual irradiance on tilted panels
  - Accounts for sun angle and cloud cover

- `getHourlyIrradiance(weatherData, hour)` - Get irradiance at specific hour
  - Returns irradiance in W/m²

- `getFallbackIrradiance(hour, cloudCover)` - Clear-sky model
  - Used when weather API unavailable
  - Simplified atmospheric model

**API Details:**
- Endpoint: `https://api.open-meteo.com/v1/forecast`
- Free tier: No API key required
- Parameters:
  - `latitude`, `longitude`: Location coordinates
  - `hourly`: Requested data (irradiance, cloud cover, etc.)
  - `timezone`: Automatic timezone detection
  - `start_date`, `end_date`: Date range in YYYY-MM-DD format

### 3. **Canvas Rendering Engine** (`src/utils/canvas.js`)

Complete 2D rendering pipeline for the solar design canvas.

**Main Function:**
```javascript
renderCanvas(canvas, ctx, state)
```

**Rendering Pipeline (in order):**
1. **Clear Canvas** - Fill with background color
2. **Draw Grid** - 1-meter grid with dynamic culling
3. **Draw Map Overlay** - Satellite imagery if loaded
4. **Draw Wires** - Electrical connections (DC/AC/Earth)
5. **Draw Shadows** - Based on sun position and object height
6. **Draw Objects** - Components sorted by z-order (height)
7. **Draw Sun Path** - Visual sun position indicator
8. **Draw Measurements** - Distance tool overlay
9. **Draw Compass** - Orientation reference (screen-space)

**Color Themes:**
Three complete color schemes available:
- `dark` - Default dark theme
- `light` - Light theme for daytime viewing
- `sepia` - Vintage sepia theme

Switch themes with: `setColorTheme('light')`

**Rendering Features:**

#### Grid Rendering
- 1-meter spacing (customizable)
- Dynamic culling based on viewport
- Alpha blending for visibility
- Infinite scroll support

#### Object Rendering
- Rotation support (via `obj.rotation` in degrees)
- Type-specific styling
- Selection highlighting (blue border)
- Specs display (watts, kW, kWh)
- Label rendering

#### Wire Rendering
- Three types: DC (red), AC (yellow), Earth (green)
- Straight routing (diagonal lines)
- Orthogonal routing (L-shaped paths with waypoints)
- Connection point visualization (small circles)

#### Shadow System
- Based on SunCalc sun position
- Height-sensitive opacity
- Different opacity for roof vs ground-mounted objects
- Follows sun movement in real-time

#### Coordinate Conversion
- `screenToWorld(screenX, screenY, offsetX, offsetY, scale)` - Convert mouse to world coords
- `worldToScreen(worldX, worldY, offsetX, offsetY, scale)` - Convert world to screen coords
- Accounts for pan (offset) and zoom (scale)

**Hit Detection:**
- `getObjectAtScreenPoint(screenX, screenY, objects, offsetX, offsetY, scale)` - Find object at cursor
- Searches in reverse z-order (top objects first)
- Used for selection and interaction

**Path Calculation:**
- `calculateOrthogonalPath(from, to)` - L-shaped wire routing
- Creates horizontal-vertical waypoint pattern
- Useful for clean electrical schematic diagrams

### 4. **Canvas Event Handler** (`src/utils/canvasEvents.js`)

Complete event handling system for user interactions.

**Supported Interactions:**

#### Selection Mode (`mode: "select"`)
- **Click**: Select object or deselect if empty space
- **Drag**: Move selected object
- **Ctrl+Drag**: Pan canvas (move view)
- Cursor changes based on hover

#### Placement Mode (`mode: "place"`)
- **Click**: Place selected equipment type at cursor
- Requires `selectedToolId` set in store
- Automatically creates object with default properties

#### Measure Mode (`mode: "measure"`)
- **Click**: Set measurement start point
- **Click Again**: Set end point and calculate distance
- Displays distance between points

#### Delete Mode (`mode: "delete"`)
- **Click**: Delete object at cursor
- Cursor becomes "not-allowed" indicator

#### Wire Modes (`mode: "wire_dc" | "wire_ac" | "earthing"`)
- **Click on Object**: Start wire from object
- **Move Mouse**: Preview wire connection
- **Click on Another Object**: Complete wire
- Supports straight and orthogonal routing
- Prevents self-connection (object to itself)

#### Draw Mode (`mode: "draw_rect"`)
- **Click and Drag**: Create rectangular structure
- Used for roofs and ground areas

**Keyboard Shortcuts:**
- `V`: Select mode
- `M`: Measure mode
- `D`: Delete mode
- `W`: DC wire mode
- `A`: AC wire mode
- `G`: Earthing mode
- `R`: Rotate selected object (90°)
- `Ctrl+Z`: Undo
- `Ctrl+Y`: Redo
- `Ctrl+C`: Copy selected object
- `Ctrl+V`: Paste object
- `Delete/Backspace`: Delete selected object
- `Escape`: Cancel current operation

**Cursor States:**
- `grab` - Object can be dragged
- `crosshair` - Measurement/drawing
- `copy` - Placement mode
- `pointer` - Wire mode
- `not-allowed` - Delete mode

**State Management:**
- Internal tracking of drag start positions
- Wire creation state machine
- Measurement start point memory
- Automatic state cleanup on mouse up

## Integration with Zustand Store

The canvas utilities integrate with the `useSolarStore` for state management.

**Store Methods Used:**
- `setSelectedObject(id)` - Select/deselect object
- `setMode(mode)` - Change interaction mode
- `setTool(id)` - Set active equipment tool
- `addObject(obj)` - Add new object to canvas
- `updateObject(id, updates)` - Modify object properties
- `deleteObject(id)` - Remove object
- `addWire(wire)` - Create connection
- `setView({scale, offsetX, offsetY})` - Pan and zoom
- `saveState()` - Save to undo/redo history
- `undo()` / `redo()` - Undo/redo operations
- `copy(id)` / `paste()` - Clipboard operations

**Canvas-Related State Properties:**
```javascript
{
  scale: 25,              // Pixels per meter (5-100 range)
  offsetX: number,        // Pan X (pixels)
  offsetY: number,        // Pan Y (pixels)
  mode: string,           // Current tool mode
  selectedToolId: string, // Selected equipment tool
  selectedObjectId: string, // Currently selected object
  objects: Array,         // All canvas objects
  wires: Array,          // All electrical connections
  showGrid: boolean,      // Grid visibility
  cableMode: string,      // 'straight' or 'ortho' for wires
  sunTime: number,        // 0-24 hour (for sun position)
  orientation: number,    // 0-360° (compass heading)
  lat: number,            // Latitude for sun calculations
  lon: number,            // Longitude for sun calculations
}
```

## Object Data Structure

Objects stored in canvas have the following structure:

```javascript
{
  id: "unique-id-string",
  type: "panel|inverter|battery|structure|obstacle|bos|grid|load|safety",
  x: number,              // X position in meters
  y: number,              // Y position in meters
  w: number,              // Width in meters
  h: number,              // Height in meters
  h_z: number,            // Height above ground (meters) - for z-ordering
  relative_h: number,     // Height above structure it's on
  rotation: 0-360,        // Rotation angle in degrees (mainly for panels)
  color: "#hexcolor",
  label: "string",        // Display label
  cost: number,           // Price in INR

  // Type-specific properties
  watts: number,          // For panels (330-730W typical)
  capKw: number,          // For inverters (0.5-100kW)
  capKwh: number,         // For batteries
  subtype: string,        // Subtype: 'micro', 'string', 'building', etc.

  // State
  isOn: boolean,          // For switches (ACDB, LT panel)
  groupId: string,        // For grouped objects
}
```

## Wire Data Structure

Wires represent electrical connections:

```javascript
{
  id: "unique-id",
  from: "object-id",      // Start object ID
  to: "object-id",        // End object ID
  type: "dc|ac|earth",
  path: [                 // Orthogonal waypoints (optional)
    {x: number, y: number},
    ...
  ],
}
```

## Camera System

### Zooming
- **Range**: 5-100 pixels per meter
- **Scroll Wheel**: Zoom in/out towards cursor
- **Maintains focal point** - Content stays centered under cursor

### Panning
- **Select Mode + Drag Empty Space**: Move view
- **Offset Tracking**: `offsetX`, `offsetY` in store
- **Infinite canvas** - No bounds checking

## Performance Considerations

### Optimization Techniques
1. **Z-Order Sorting** - Sort objects once per frame by height
2. **Dynamic Grid Culling** - Only draw visible grid cells
3. **Object Hit Detection** - Reverse iteration (top objects first)
4. **Canvas Transforms** - Use `translate` and `scale` for efficient panning/zoom
5. **State Context** - Single render call per frame (via React component)

### Rendering Cost
- Canvas redraws every frame (60 FPS via requestAnimationFrame)
- Objects: O(n) where n = number of objects
- Wires: O(w) where w = number of wires
- Grid: O(visible cells) with culling
- Typical: 100+ objects at 60 FPS on modern hardware

## Using the Canvas Component

```javascript
import Canvas from '../components/Canvas';

// In your React component
<Canvas />
```

Canvas component automatically:
1. Creates canvas element
2. Attaches event handlers
3. Sets up animation loop
4. Reads from Zustand store
5. Renders continuously

## Setting Up Sun/Weather Simulation

```javascript
// In component or store
import { SunCalc } from '../utils/suncalc';
import { weatherService } from '../utils/weatherService';

// Get sun position
const now = new Date();
const sunPos = SunCalc.getPosition(now, lat, lon);

// Get weather data
const weather = await weatherService.getWeather(lat, lon, now);

// Use in rendering
const shadowVector = getShadowVector(sunTime, lat, lon, orientation);
```

## Future Enhancements

1. **3D Visualization** - WebGL renderer for 3D view
2. **Perspective Rendering** - Isometric or true 3D projection
3. **Pathfinding** - A* for automatic wire routing
4. **Collision Detection** - Prevent object overlap
5. **Snap-to-Grid** - Alignment aids
6. **Layer Management** - Grouped objects with visibility toggle
7. **Animations** - Smooth transitions and effects
8. **Texture Mapping** - Detailed component visuals
9. **Real-time Validation** - Electrical code checking
10. **Export Options** - SVG, PNG, CAD formats

## Troubleshooting

### Canvas not rendering
- Check if Canvas component is mounted
- Verify Zustand store is initialized
- Check browser console for errors

### Objects not appearing
- Verify `objects` array in store is populated
- Check object `x`, `y` coordinates are within reasonable range
- Ensure `h_z` values are set for proper ordering

### Events not working
- Check mode is not 'select' for placement to work
- Verify `selectedToolId` is set for placement mode
- Check event listeners are attached in Canvas component

### Zoom/Pan issues
- Verify `scale` is in range 5-100
- Check `offsetX`, `offsetY` calculations
- Test with different mouse positions

## API Reference

### Canvas Rendering
```javascript
renderCanvas(canvas, ctx, state) // Main render function
setColorTheme(theme) // Switch color scheme
```

### Coordinate System
```javascript
screenToWorld(screenX, screenY, offsetX, offsetY, scale)
worldToScreen(worldX, worldY, offsetX, offsetY, scale)
```

### Hit Detection
```javascript
isPointInObject(point, obj)
getObjectAtScreenPoint(screenX, screenY, objects, offsetX, offsetY, scale)
```

### Utilities
```javascript
getShadowVector(sunTime, lat, lon, orientation)
calculateOrthogonalPath(from, to)
```

### Event Handling
```javascript
handleCanvasEvents.onMouseDown(event, canvas)
handleCanvasEvents.onMouseMove(event, canvas)
handleCanvasEvents.onMouseUp(event, canvas)
handleCanvasEvents.onWheel(event, canvas)
handleCanvasEvents.onKeyDown(event)
```

## Version History

- **v1.0** - Initial canvas engine port from vanilla JS
  - Complete rendering pipeline
  - All interaction modes
  - Sun/weather integration
  - Zustand store integration
