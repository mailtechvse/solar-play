# What Has NOT Been Done Yet

## Overview
The canvas engine is **100% complete**. However, several important features that were in the original solar-board.html and are needed for full functionality have **NOT been implemented** yet.

---

## 🔴 HIGH PRIORITY - MUST HAVE

### 1. Simulation Engine (`src/utils/simulation.js`)
**Status**: NOT STARTED
**Impact**: Critical - Cannot run financial projections without this

**What's needed**:
```javascript
// Core calculation functions
- calculateDailyGeneration(panelCapacity, sunHours, weather)
- calculateSystemLosses(dcCapacity, acCapacity, wireLength, temperature)
- calculateMonthlyEnergy(dailyGen, daysInMonth, degradation)
- calculateNetMetering(generation, load, exportRate, importRate)
- calculateGrossMetering(generation, exportRate)
- project25Year(monthlyData, degradationRate)
```

**Inputs needed**:
- Panel capacity (watts from each panel)
- Inverter efficiency (kW)
- Battery capacity (kWh, if applicable)
- Location (latitude/longitude - already have this)
- Grid rate (₹/unit - already in store)
- Load consumption (units/month - already in store)
- Plant cost (₹ - already in store)

**Outputs required**:
- Monthly generation (kWh)
- Monthly savings/income (₹)
- Annual generation (MWh)
- 25-year cumulative savings (₹)
- ROI payback period (years)
- Performance score (0-100%)

**Key algorithms to implement**:
1. **Sun hours calculation** - From sun position + weather
2. **Plane of Array (POA) irradiance** - Adjusted for tilt/azimuth
3. **Panel degradation** - 0.5% per year
4. **Temperature coefficient** - Panel efficiency loss in heat
5. **Soiling losses** - Dust/dirt on panels (~2% typical)
6. **Wiring losses** - Cable resistance losses
7. **Inverter efficiency** - DC to AC conversion loss
8. **Battery round-trip efficiency** - If batteries present (85-90%)

**Reference data from original**:
- Grid rate: `₹8.50/unit` (editable)
- Load: `500 units/month` (editable)
- Plant cost: Auto-calculated from equipment cost
- Degradation: `0.5%/year`
- Analysis period: `25 years`

---

### 2. Evaluation Modal Enhancement (`src/components/EvaluationModal.jsx`)
**Status**: EXISTS but INCOMPLETE
**Impact**: Critical - Users cannot see results of their designs

**What's needed**:
```javascript
// Modal should display:

1. PERFORMANCE SCORE (circular gauge)
   - 0-100% based on system quality
   - Green (>80%), Yellow (60-80%), Red (<60%)
   - Text verdict: "System Optimized" / "Needs Review" / "Poor Design"

2. SYSTEM STATS (cards)
   - DC Capacity (kWp) - Sum of panel watts / 1000
   - AC Output (kW) - Sum of inverter capacities
   - Battery Storage (kWh) - Sum of battery capacities
   - Total Cost (₹) - Sum of all equipment costs
   - Annual Generation (MWh) - From simulation
   - System Efficiency (%) - Generation / theoretical max

3. CHARTS (using Chart.js - already in package.json)
   - Monthly Generation Chart (bar chart, 12 months)
   - Annual Savings Chart (line chart, 25 years)
   - Loss Breakdown Chart (pie: temp, soiling, wiring, inverter)

4. MONTHLY BREAKDOWN TABLE
   Columns: Month | Gross Gen (Units) | Load (Units) | Net Export (Units) | Net Meter Saving (₹) | Gross Meter Income (₹)
   Rows: Jan-Dec

5. 25-YEAR PROJECTIONS TABLE
   Columns: Year | Generation (Units) | Savings (₹) | Cumulative (₹) | ROI Status
   Rows: Year 1-25 (with 5-year intervals)

6. CRITICAL CONNECTIVITY CHECKS (validation list)
   ✓ Panels connected to inverter (DC wire)
   ✓ Inverter connected to ACDB (AC wire)
   ✓ System sized correctly (panels vs inverter)
   ✓ Earthing pit present
   ✓ Lightning arrestor present
   ✓ Meters configured (net or gross)
   ✓ Load box properly configured
   ✓ No orphaned components
```

**Component updates needed**:
- Import Chart.js components
- Call simulation engine for calculations
- Format currency (₹) and units properly
- Handle both net and gross metering modes
- Export report as PDF/HTML (partially implemented)

---

### 3. Project Save/Load to Supabase
**Status**: PARTIALLY DONE
**Impact**: High - Projects currently only save as JSON files locally

**What's needed**:
```javascript
// src/lib/supabase.js - Add these methods:

export async function saveProjectToSupabase(projectName, projectData, userId) {
  // Save canvas state (objects, wires, settings) to Supabase
  // Project table: id, name, user_id, canvas_data (JSON), created_at, updated_at
}

export async function loadProjectFromSupabase(projectId) {
  // Load canvas state from Supabase
}

export async function listUserProjects(userId) {
  // Show all saved projects for user
}

export async function deleteProject(projectId) {
  // Delete a saved project
}
```

**Database schema needed**:
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  canvas_data JSONB,          -- objects, wires, settings
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE INDEX ON projects(user_id);
```

**UI updates needed**:
- Save button → "Save to Cloud"
- Load button → Dialog to select from list
- Recent projects dropdown
- Delete project button

---

## 🟡 MEDIUM PRIORITY - NICE TO HAVE

### 4. Equipment Library from Supabase
**Status**: NOT STARTED
**Impact**: Medium - Currently hardcoded, not scalable

**What's needed**:
- Load COMPONENTS from `equipment` table in Supabase
- Filter by equipment_type
- Display specs and cost from database
- Remove hardcoded COMPONENTS constant

**Changes needed**:
```javascript
// In solarStore.js
const equipmentLibrary = await fetchEquipmentFromSupabase()
// Currently: Uses hardcoded COMPONENTS object
```

---

### 5. Electrical Validation System
**Status**: NOT STARTED
**Impact**: Medium - Help users design correct systems

**What's needed**:
```javascript
// src/utils/validation.js

export function validateSolarSystem(objects, wires) {
  const issues = []

  // Check 1: At least one panel
  if (objects.filter(o => o.type === 'panel').length === 0) {
    issues.push("ERROR: No solar panels in design")
  }

  // Check 2: Panels connected to inverter
  const panelIds = objects.filter(o => o.type === 'panel').map(o => o.id)
  const inverterIds = objects.filter(o => o.type === 'inverter').map(o => o.id)
  const dcWires = wires.filter(w => w.type === 'dc')

  panelIds.forEach(panelId => {
    const connected = dcWires.some(w => w.from === panelId || w.to === panelId)
    if (!connected) issues.push(`WARNING: Panel ${panelId} not connected`)
  })

  // Check 3: Sizing validation
  const totalPanels = objects.filter(o => o.type === 'panel')
    .reduce((sum, p) => sum + p.watts, 0) / 1000
  const totalInverters = objects.filter(o => o.type === 'inverter')
    .reduce((sum, i) => sum + i.capKw, 0)

  if (totalPanels > totalInverters * 1.3) {
    issues.push(`WARNING: Panel capacity (${totalPanels}kWp) oversized for inverter (${totalInverters}kW)`)
  }

  // Check 4: Safety components
  if (objects.filter(o => o.subtype === 'earth').length === 0) {
    issues.push("WARNING: No earthing pit present")
  }

  if (objects.filter(o => o.subtype === 'la').length === 0) {
    issues.push("WARNING: No lightning arrestor present")
  }

  return { valid: issues.filter(i => i.startsWith('ERROR')).length === 0, issues }
}
```

---

### 6. Real-time System Stats
**Status**: PARTIALLY DONE
**Impact**: Medium - Shows in TopBar but incomplete

**What's needed**:
- Update DC capacity calculation
- Update AC output calculation
- Update estimated cost calculation
- Update in real-time as objects are placed

**Currently missing**:
```javascript
// In TopBar, should show:
- Total DC Capacity (kWp) - SUM(all panel watts) / 1000
- Total AC Output (kW) - SUM(all inverter capKw)
- Total Battery (kWh) - SUM(all battery capKwh)
- Estimated System Cost (₹) - SUM(all equipment costs)
```

---

## 🟢 LOW PRIORITY - ENHANCEMENTS

### 7. 3D Visualization
**Status**: NOT STARTED
**Impact**: Low - Nice feature but not essential

**What could be added**:
- WebGL canvas rendering
- Isometric/3D perspective
- Realistic shadows with perspective
- Component details and labels

---

### 8. Automatic Wire Routing
**Status**: NOT STARTED
**Impact**: Low - Currently manual

**What could be added**:
- A* pathfinding algorithm
- Avoid obstacles
- Minimize cable length
- Automatic orthogonal routing

---

### 9. Layer Management
**Status**: PARTIAL (sidebar shows layers but no management)
**Impact**: Low - Helps with complex designs

**What could be added**:
- Group components
- Visibility toggle per layer
- Lock/unlock layers
- Reorder layers

---

### 10. Export Options
**Status**: PARTIAL (JSON save exists)
**Impact**: Low - Currently only JSON export

**What could be added**:
- Export to SVG (schematic diagram)
- Export to PDF (report with design)
- Export to DXF/CAD format
- Export to PNG/image

---

## 📊 Summary Table

| Feature | Status | Priority | Effort | Impact |
|---------|--------|----------|--------|--------|
| Simulation Engine | ❌ NOT DONE | 🔴 HIGH | 2-3 hrs | CRITICAL |
| Evaluation Modal | ⚠️ INCOMPLETE | 🔴 HIGH | 2-3 hrs | CRITICAL |
| Save/Load to Supabase | ⚠️ PARTIAL | 🔴 HIGH | 2 hrs | HIGH |
| Equipment from Supabase | ❌ NOT DONE | 🟡 MEDIUM | 1 hr | MEDIUM |
| Validation System | ❌ NOT DONE | 🟡 MEDIUM | 1.5 hrs | MEDIUM |
| Real-time Stats | ⚠️ PARTIAL | 🟡 MEDIUM | 1 hr | MEDIUM |
| 3D Visualization | ❌ NOT DONE | 🟢 LOW | 4+ hrs | LOW |
| Wire Routing AI | ❌ NOT DONE | 🟢 LOW | 3 hrs | LOW |
| Layer Management | ⚠️ PARTIAL | 🟢 LOW | 1.5 hrs | LOW |
| Export Options | ⚠️ PARTIAL | 🟢 LOW | 2 hrs | LOW |

---

## What to Prioritize

### To get a working MVP:
1. **Simulation Engine** - Without this, no financial calculations
2. **Evaluation Modal** - Without this, no results display
3. **Save/Load Supabase** - Without this, projects lost on refresh

**Estimated time**: 5-7 hours

### Then for polish:
4. Equipment from Supabase
5. Validation system
6. Real-time stats updates

**Estimated time**: 3-4 hours

### Then for features:
7. Everything else (low priority)

---

## Original solar-board.html Features Still Missing

From the original 1,555-line application, these features were NOT ported to React:

| Feature | Implemented | Notes |
|---------|-------------|-------|
| Canvas rendering | ✅ YES | Complete |
| Object manipulation | ✅ YES | Complete |
| Wire system | ✅ YES | Complete |
| Undo/redo | ✅ YES | Complete |
| Scenarios (Blank/Residential/Commercial) | ❌ NO | Never used |
| Map overlay import | ❌ NO | Google Maps API |
| Building import from OSM | ❌ NO | OpenStreetMap |
| Simulation engine | ❌ NO | **CRITICAL** |
| Financial calculations | ❌ NO | **CRITICAL** |
| Evaluation report | ⚠️ PARTIAL | UI exists, no data |
| Save/load to Supabase | ❌ NO | **NEEDED** |
| API key management | ❌ NO | Not needed in React |

---

## Conclusion

**The canvas engine is 100% complete and production-ready.**

**But the application is not complete without:**
1. ✅ Simulation engine (calculates generation/ROI)
2. ✅ Evaluation modal (displays results)
3. ✅ Supabase save/load (persist projects)

These three items should be prioritized to make the application fully functional.

---

**Total estimated time to MVP**: 5-7 hours
**Total estimated time for full feature parity with original**: 10-12 hours
