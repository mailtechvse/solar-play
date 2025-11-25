# Phase 1 Features - User Quick Start Guide

## New Features Overview

This guide helps you use the 6 new Phase 1 features in Solar Architect: Grid Master.

---

## 1. Financial Parameters (Settings Tab)

### Where to Find It:
- Left sidebar → **Settings** tab

### What You Can Control:
- **Grid Rate (₹/Unit)**: How much electricity costs where you are
  - Default: ₹8.5/unit
  - Common range: ₹5-15 per unit
  - Updates: Evaluate results update automatically

- **Monthly Load (Units)**: Average electricity consumption per month
  - Default: 500 units
  - Example: A typical home uses 200-400 units/month
  - This is the baseline consumption

- **System Cost (₹)**: Total cost of your solar system
  - Default: Auto-calculated from equipment costs
  - Used for ROI (Return on Investment) calculations
  - Helps determine break-even year

- **Commercial Project**: Checkbox for business installations
  - Enables 40% accelerated depreciation benefit
  - Available for commercial/industrial systems
  - Affects tax calculations in evaluation

### How It Works:
1. Adjust the values in Settings tab
2. Click **Evaluate** button in top bar
3. See results with your custom parameters

### Example:
```
If you set:
- Grid Rate: ₹10/unit
- Load: 600 units/month
- Cost: ₹250,000
- Type: Commercial

The evaluation will calculate ROI based on:
- Monthly savings: 600 units × ₹10 = ₹6,000
- Payback period: ₹250,000 ÷ monthly savings
- Tax benefits: Accelerated depreciation
```

---

## 2. Object Properties (Right Panel)

### Where to Find It:
- Right side of canvas → Select any object

### What You Can Edit:

**For All Objects:**
- **Position**: X and Y coordinates (in meters)
- **Dimensions**: Width and Height (in meters)
- **Height (h_z)**: How high the object is (0-50 meters)
  - Use slider for quick adjustments
  - Or type exact value in the number field
- **Rotation**: Angle in degrees (0-360°)
- **Cost**: Equipment cost in rupees (₹)
- **Color**: Click color box to change appearance

**For Solar Panels:**
- **Power (Watts)**: Panel capacity (e.g., 330W, 585W)

**For Inverters:**
- **Capacity (kW)**: Inverter size (e.g., 3kW, 10kW)

**For Batteries:**
- **Capacity (kWh)**: Storage amount (e.g., 5kWh, 10kWh)

**For Loads:**
- **Monthly Consumption**: Units consumed per month
- Example: A load box consuming 100 units/month

**Delete Any Object:**
- Red trash button at the top

### Why Height Matters:
- **Ground level (0m)**: Objects on ground
- **Rooftop (3-5m)**: Panels on building roof
- **Elevated (5-10m)**: Panels on raised structures
- Affects shadow calculations and visualization

### Example:
```
To place panels on a rooftop:
1. Select the panel
2. Set h_z = 4m (if roof is 4m high)
3. See it rendered higher on canvas
4. Shadows calculated for that height
```

---

## 3. Location & Orientation (Settings Tab)

### Where to Find It:
- Left sidebar → **Settings** tab → **Location & Orientation** section

### Location Controls:

**Latitude** (-90° to +90°)
- North of equator: positive (e.g., India = 28°N)
- South of equator: negative (e.g., Australia = -35°)
- Default: 28.60° (Delhi)

**Longitude** (-180° to +180°)
- East of Prime Meridian: positive (e.g., India = 77°E)
- West of Prime Meridian: negative (e.g., USA = -100°)
- Default: 77.20° (Delhi)

**Auto-Detect Location**
- Click blue button with location icon
- Browser asks for permission (click "Allow")
- Automatically fills your current latitude/longitude
- Works anywhere with GPS or location services

### Orientation Controls:

**Orientation Slider** (0-360°)
- **0° or 360°**: North
- **90°**: East
- **180°**: South
- **270°**: West

**Visual Compass**
- Located in bottom-right of canvas
- Blue needle shows current orientation
- Red dot marks East for reference
- Updates as you move slider

### How It's Used:
- **Sun calculations**: Accurate sun position based on your location and date
- **Shadow analysis**: Shadows calculated for your exact location
- **System orientation**: Shows which direction your system faces

### Example:
```
For a system in Mumbai facing Southeast:
- Latitude: 19.08°N
- Longitude: 72.88°E
- Orientation: 135° (Southeast)

Canvas shows:
- Compass needle pointing Southeast
- Shadows calculated for Mumbai's latitude
- Generation estimates specific to that location
```

---

## 4. Load Boxes

### Where to Find Them:
- Left sidebar → **Equipment** tab → **Load** category (scroll down if needed)

### What Are Load Boxes?
- Represent consumption points in your system
- Show where electricity is being used
- Help model consumer profiles
- Can have different consumption amounts

### Available Load Boxes:

1. **Single Phase Load Box** (5kW)
   - For residential or small commercial
   - 220V, 50Hz
   - Cost: ₹15,000

2. **Three Phase Load Box** (10kW)
   - For larger commercial systems
   - 415V, 50Hz
   - Cost: ₹25,000

3. **Industrial Load Box 30kW** (30kW)
   - For industrial or large installations
   - 415V, 50Hz
   - Cost: ₹45,000

### How to Use Load Boxes:

**Step 1: Add a Load Box**
1. Click Equipment tab in left sidebar
2. Find "Load" category
3. Drag "Single Phase Load Box" to canvas

**Step 2: Configure**
1. Select the load box on canvas
2. In right panel, edit:
   - **Monthly Consumption (Units)**: How much it uses
   - **Height (h_z)**: Where it's located (ground = 0m)
   - **Cost**: Equipment cost
   - **Color**: Appearance (already amber)

**Step 3: Connect**
1. Use AC Wire tool to connect load to inverter
2. This shows power flow in your design

**Step 4: Evaluate**
1. Click Evaluate button
2. System calculates if solar generation meets load
3. Reports any excess/deficit

### Example Design:
```
Canvas Layout:
- 10 Solar Panels (3.3kW total)
- 1 Micro Inverter (5kW)
- 1 Single Phase Load Box (5kW consumption)
- 1 Meter
- Wire connections showing flow

Evaluation Result:
- System can supply 100% of 5kW load
- Leftover energy exports to grid (if net metering)
```

---

## 5. Custom Components

### Where to Find It:
- Left sidebar → **Equipment** tab → **Add Custom Component** button (purple)

### When to Use:
- Equipment not in default library
- Specific brand/model you want to track
- Proprietary or local equipment
- Building-specific components

### How to Create One:

**Step 1: Click "Add Custom Component"**
- Purple button at top of Equipment tab
- Modal dialog opens

**Step 2: Fill in Basic Info**
- **Component Name**: What it's called (required)
  - Example: "Titan 50kW Inverter"
- **Equipment Type**: Pick from dropdown (required)
  - Panel, Inverter, Battery, BOS, Load, etc.

**Step 3: Add Manufacturer Details**
- **Manufacturer**: Company name (optional)
  - Example: "Titan Power Solutions"
- **Model Number**: Model ID (optional)
  - Example: "TP-50K-V3"

**Step 4: Set Physical Properties**
- **Cost (₹)**: Price of the equipment
- **Width (m)**: Physical width
- **Height (m)**: Physical height
- **Color**: Appearance on canvas

**Step 5: Add Specifications** (Optional)
- Click in "Key" field: Enter specification name
  - Example: "Efficiency"
- Click in "Value" field: Enter value
  - Example: "97.5%"
- Click plus button to add
- Repeat for all specs
- Click trash to remove any spec

**Step 6: Save**
- Click "Create & Add" button
- Equipment saves to Supabase
- Automatically added to your canvas
- Available for all future projects

### Example Custom Component:
```
Component Name: Twin Disc 40kW UPS
Equipment Type: Inverter
Manufacturer: Twin Disc Systems
Model: TD-40-2024

Specifications:
- Efficiency: 98.2%
- Input Voltage: 360-450V DC
- Output: 230V, 3-phase
- Warranty: 10 years
- Support: 24/7 local service

Cost: ₹320,000
Width: 1.2m
Height: 1.8m
Color: #2c3e50 (dark)

After creation:
- Appears in Equipment palette
- Can drag to canvas like any other
- Persists in database for future use
```

---

## Configuration Summary

### What It Shows:
The Settings tab displays your current configuration:

```
Configuration Summary
━━━━━━━━━━━━━━━━━━━━━
💰 Rate: ₹10.5/unit
⚡ Load: 600 units/month
💵 Cost: ₹250,000
🏢 Type: Commercial
📍 Location: 19.08°N, 72.88°E
🧭 Orientation: 135°
```

This summary helps you verify all settings at a glance before running Evaluate.

---

## Typical Workflow

### Basic Solar Design with Phase 1 Features:

```
1. SET LOCATION
   → Settings tab → Auto-detect or enter manually
   → Set orientation for your area

2. SET FINANCIAL PARAMS
   → Grid rate for your region
   → Monthly load you want to offset
   → System cost estimate

3. DESIGN ON CANVAS
   → Add solar panels
   → Add inverter
   → Add load boxes showing consumption
   → Connect with wires

4. EDIT PROPERTIES
   → Select each object
   → Adjust height for 3D effect
   → Set cost if different
   → Configure load consumption

5. EVALUATE
   → Click Evaluate button
   → See results with your parameters
   → Check if system meets load
   → Review ROI calculation

6. REFINE
   → Adjust parameters
   → Add/remove components
   → Check evaluation again
   → Save when satisfied
```

---

## Tips & Best Practices

### For Accurate Results:
1. **Set correct location**
   - Use auto-detect or find your city's coordinates
   - Accuracy within 0.1° is sufficient

2. **Set realistic costs**
   - Equipment costs affect ROI calculation
   - Update cost for custom equipment

3. **Configure load properly**
   - Monthly load should match your actual consumption
   - Load boxes help distribute consumption

4. **Use correct orientations**
   - South-facing in Northern Hemisphere is optimal
   - North-facing in Southern Hemisphere
   - Use compass for visual reference

### For Better Designs:
1. **Show load consumption visually**
   - Add load boxes on canvas
   - Shows where power is used
   - Helps with system planning

2. **Use custom components for specifics**
   - Create equipment matching your real choices
   - Builds accurate cost estimates
   - Useful for project documentation

3. **Verify with evaluation regularly**
   - Run evaluation after major changes
   - Adjust parameters to see impact
   - Compare different scenarios

---

## Troubleshooting

### Auto-Detect Location Not Working?
- Ensure location services enabled on your device
- Check browser permissions (allow when asked)
- Try entering latitude/longitude manually

### Load Boxes Not Showing Units?
- Make sure load box is selected
- Enter a number in "Monthly Consumption" field
- Units display on canvas as "5U" (for 5 units)

### Properties Panel Not Updating?
- Click object on canvas to select it
- Right panel will show that object's properties
- Make changes and see canvas update in real-time

### Compass Not Rotating?
- Move orientation slider left-right
- Blue needle should rotate
- Red dot stays East for reference

---

## Next Steps

### Want to Learn More?
- See complete PHASE_1_COMPLETION.md for technical details
- Check original CANVAS_QUICKSTART.md for canvas basics
- Review FEATURE_COMPARISON.md for all available features

### Ready for Phase 2?
Phase 1 is just the beginning. Coming soon:
- Weather data and cloud cover visualization
- Sun path animation and playback
- Theme toggle (dark/light/sepia)
- Geolocation integration
- Advanced drawing tools

---

**Enjoy designing with Solar Architect!** 🌞

