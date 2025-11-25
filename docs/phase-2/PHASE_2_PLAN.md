# Phase 2 Enhancement Plan

**Status**: Planning
**Estimated Duration**: 8 hours
**Target Features**: 5 Quick Wins

---

## Phase 2 Overview

Phase 2 focuses on enhancing user experience and visualization capabilities. Building on Phase 1's solid foundation, these "quick win" features will significantly improve usability and data visibility.

---

## 🎯 Phase 2 Features (5 Quick Wins)

### Feature 1: Geolocation Integration (2 hours)

**What**: Automatic location-based weather and sun data

**Components**:
- Use stored latitude/longitude (from Phase 1)
- Fetch weather data from Open-Meteo API
- Calculate sun position using location
- Display sunrise/sunset times
- Show cloud cover percentage
- Display atmospheric conditions

**Files to Modify**:
- `src/utils/weatherService.js` (already exists, enhance)
- `src/stores/solarStore.js` (add weather state)
- `src/components/Canvas.jsx` (display weather info)
- `src/components/TopBar.jsx` (show weather widget)

**Integration Points**:
- Use latitude/longitude from Phase 1 Settings
- Cache weather data (30-minute intervals)
- Trigger on location change
- Display in info overlay on canvas

**Testing**:
- Weather API responds correctly
- Data updates on location change
- Caching works properly
- Performance impact minimal

---

### Feature 2: Theme Toggle UI (1 hour)

**What**: User-selectable color themes (Dark, Light, Sepia)

**Components**:
- Theme selector buttons in TopBar
- Three theme options with icons
- Persistent theme selection
- Real-time canvas re-render

**Files to Modify**:
- `src/components/TopBar.jsx` (add theme buttons)
- `src/utils/canvas.js` (already has theme support, use it)
- `src/stores/solarStore.js` (add theme state)

**Themes**:
1. **Dark** (current, optimal for solar data)
   - Background: #1f2937
   - Grid: #374151
   - Wires: red (#ef4444) / yellow (#eab308)

2. **Light** (high contrast, print-friendly)
   - Background: #f9fafb
   - Grid: #e5e7eb
   - Wires: red (#dc2626) / orange (#d97706)

3. **Sepia** (vintage, reduced blue light)
   - Background: #f5f0e6
   - Grid: #d6cbb8
   - Wires: brown (#b91c1c) / orange (#b45309)

**Testing**:
- Theme changes instantly
- All elements re-render correctly
- Theme persists on page reload
- No performance impact

---

### Feature 3: Sun Path Animation (2 hours)

**What**: Animated sun movement showing daily path

**Components**:
- Time slider (6 AM - 6 PM)
- Play/Pause/Speed controls
- Current sun position indicator
- Sun path arc on canvas
- Sunrise/Sunset markers

**Files to Modify**:
- `src/utils/suncalc.js` (already exists, use for calculations)
- `src/components/Canvas.jsx` (render sun path + position)
- `src/stores/solarStore.js` (add animation state)
- `src/components/TopBar.jsx` (add playback controls)

**Features**:
- Drag time slider to change sun position
- Click Play to animate throughout day
- Adjust animation speed (0.5x, 1x, 2x, 4x)
- Show current time and sun position
- Display sun azimuth and altitude angles
- Show shadows updating in real-time

**Testing**:
- Sun path renders correctly
- Animation runs smoothly (60 FPS)
- Controls work properly
- Shadow updates follow sun position

---

### Feature 4: Weather Data Display (1 hour)

**What**: Visual weather information overlay

**Components**:
- Weather info panel (collapsible)
- Cloud cover percentage with visualization
- Temperature indicator
- Wind speed and direction
- Atmospheric conditions
- 5-day forecast (optional)

**Files to Modify**:
- `src/components/Canvas.jsx` (add weather overlay)
- `src/stores/solarStore.js` (store weather data)
- Create: `src/components/WeatherPanel.jsx` (new)

**Display**:
- Panel in top-right corner of canvas
- Toggleable with button in TopBar
- Shows real-time data from weather API
- Icons for conditions (sunny, cloudy, rainy)
- Color-coded cloud cover visualization

**Testing**:
- Weather data displays correctly
- Panel toggles on/off
- Data updates periodically
- No canvas performance impact

---

### Feature 5: Drawing Tools for Structures (2 hours)

**What**: Freehand and geometric shape drawing tools

**Tools**:
1. **Rectangle Tool**: Draw rectangular structures
   - Click-drag to define area
   - Set dimensions in dialog
   - Auto-calculate roof area

2. **Polygon Tool**: Draw custom-shaped areas
   - Click to place vertices
   - Double-click to finish
   - Calculate area automatically

3. **Freehand Tool**: Draw obstacles and terrain
   - Draw freehand on canvas
   - Convert to closed shape
   - Use for trees, buildings, landscape

**Files to Create**:
- `src/utils/drawingTools.js` (new - shape utilities)
- `src/components/DrawingToolbar.jsx` (new - tool controls)

**Files to Modify**:
- `src/components/Canvas.jsx` (handle drawing input)
- `src/utils/canvasEvents.js` (drawing event handlers)
- `src/stores/solarStore.js` (drawing state)

**Features**:
- Real-time preview while drawing
- Snap-to-grid option
- Undo/Redo for drawing operations
- Convert drawn shapes to equipment structures
- Automatic cost estimation

**Testing**:
- Drawing tools create correct shapes
- Shapes render properly on canvas
- Area calculations accurate
- Integration with existing objects smooth

---

## 📊 Feature Effort Breakdown

| Feature | Est. Time | Difficulty | Priority |
|---------|-----------|-----------|----------|
| Geolocation Integration | 2 hours | Medium | High |
| Theme Toggle | 1 hour | Easy | High |
| Sun Path Animation | 2 hours | Medium | High |
| Weather Display | 1 hour | Easy | Medium |
| Drawing Tools | 2 hours | Hard | Medium |
| **Total** | **8 hours** | - | - |

---

## 🎯 Implementation Order

### Day 1 (4 hours)
1. **Theme Toggle** (1h) - Quick win, immediate impact
2. **Geolocation Integration** (2h) - Foundation for weather
3. **Weather Display** (1h) - Uses geolocation data

### Day 2 (4 hours)
1. **Sun Path Animation** (2h) - Complex but impressive
2. **Drawing Tools** (2h) - Foundational for Phase 3

---

## 📈 Expected Outcomes

### User Experience Improvements
- ✅ Multiple theme options for different preferences
- ✅ Visual sun path showing daily generation potential
- ✅ Real-time weather affecting system design
- ✅ Drawing tools making design faster
- ✅ Automatic location-based weather data

### Technical Improvements
- ✅ API integration pattern established
- ✅ Weather data caching system
- ✅ Drawing system foundation for Phase 3
- ✅ Enhanced visualization capabilities
- ✅ Real-time animation support

### Feature Parity
- Before Phase 2: 60%+
- After Phase 2: 70%+ (estimated)
- Improvement: +10 percentage points

---

## 🔧 Technical Stack

**No New Dependencies Required**
- Use existing Open-Meteo API (free, no key needed)
- Use existing Chart.js for weather visualization
- Canvas API for drawing tools
- Zustand for state management (already in place)

---

## 🧪 Testing Strategy

### Unit Tests
- Weather data parsing and validation
- Sun position calculations for various locations
- Area calculations for drawn shapes
- Theme color validation

### Integration Tests
- Location change triggers weather fetch
- Weather updates affect simulation
- Sun path updates affect shadows
- Drawing tools integrate with existing objects

### E2E Tests
- Complete workflow with all Phase 2 features
- Drawing and simulating
- Weather impact on design
- Theme switching during work

---

## 📚 Documentation Plan

Each feature will have:
- **User Guide**: How to use the feature
- **Technical Doc**: Implementation details
- **API Reference**: Any external services used
- **Examples**: Real-world use cases

---

## 🚀 Success Criteria

- ✅ All 5 features implemented
- ✅ 15+/15+ tests passed (100%)
- ✅ Build successful with no errors
- ✅ 60 FPS performance maintained
- ✅ Comprehensive documentation
- ✅ Feature parity improved to 70%+

---

## Next Steps

1. ✅ Review this plan
2. ⏳ Approve features and timeline
3. ⏳ Begin implementation (Theme Toggle first)
4. ⏳ Test each feature as completed
5. ⏳ Document all changes
6. ⏳ Prepare Phase 3 planning

---

**Phase 2 is ready to begin!**

