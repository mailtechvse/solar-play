# Phase 1 Features - User Quick Start Guide

**Status**: ✅ COMPLETE
**Last Updated**: November 24, 2025

---

## New Features Overview

This guide explains the 6 new Phase 1 features and how to use them.

---

## 1. Financial Parameters (Settings Tab)

### Where to Find It
Left sidebar → **Settings** tab

### What You Can Control

**Grid Rate (₹/Unit)**
- How much electricity costs in your area
- Default: ₹8.5/unit
- Common range: ₹5-15 per unit
- Used for: Cost savings calculations

**Monthly Load (Units)**
- Average electricity consumption per month
- Default: 500 units
- Example: Typical home uses 200-400 units/month
- Used for: System sizing and ROI

**System Cost (₹)**
- Total cost of your solar system
- Default: Auto-calculated from equipment
- Used for: ROI and payback period
- Leave 0 to use equipment total

**Commercial Project**
- Checkbox for business installations
- Enables 40% accelerated depreciation
- Available for industrial systems
- Affects tax calculations

### How to Use

1. Open Settings tab
2. Adjust values as needed
3. Click Evaluate button (top bar)
4. See results with your parameters

### Example
```
Grid Rate: ₹10/unit
Load: 600 units/month
Cost: ₹250,000
Type: Commercial

Result:
- Monthly savings: ₹6,000
- Payback period: ~42 months
- 25-year benefit: ₹4.8 lakhs
```

---

## 2. Object Properties (Right Panel)

### Where to Find It
Right side of canvas → Select any object

### What You Can Edit

**For All Objects:**
- Position (X, Y in meters)
- Dimensions (Width, Height)
- **Height (h_z)** - Above ground (0-50m) ← NEW
- Rotation (0-360°)
- Cost (₹)
- Color

**For Solar Panels:**
- Power (Watts)

**For Inverters:**
- Capacity (kW)

**For Batteries:**
- Capacity (kWh)

**For Load Boxes:**
- **Monthly Consumption** (Units) ← NEW

### Height Slider (NEW)

The height slider is critical:
- **0m**: Ground level
- **3-5m**: Typical rooftop
- **5-10m**: Elevated structures
- **10+m**: High mounting

This affects:
- Shadow calculations
- 3D perspective visualization
- System design accuracy

### Using Height Slider

1. Select object on canvas
2. Look for "Height (h_z)" slider
3. Drag slider or enter value
4. See object move up on canvas
5. Shadows recalculate automatically

### Example
```
To place panels on 4m roof:
1. Select solar panel
2. Move height slider to 4
3. Panel appears higher on canvas
4. Shadows calculated for 4m height
```

---

## 3. Location & Orientation (Settings Tab)

### Where to Find It
Left sidebar → Settings tab → **Location & Orientation** section

### Setting Your Location

**Latitude** (-90° to +90°)
- North of equator: positive
- South of equator: negative
- Examples:
  - Delhi: 28.6°N
  - Mumbai: 19.1°N
  - Sydney: -33.9°

**Longitude** (-180° to +180°)
- East of Prime Meridian: positive
- West of Prime Meridian: negative
- Examples:
  - Delhi: 77.2°E
  - New York: -74.0°W

**Auto-Detect Location**
1. Click "Auto-Detect Location" button
2. Browser asks for permission
3. Click "Allow" when prompted
4. Latitude/Longitude auto-populate

### Setting Orientation

**Orientation Slider** (0-360°)
- 0° or 360°: North
- 90°: East
- 180°: South
- 270°: West

**Visual Compass**
- Shows your current orientation
- Blue needle points in direction
- Red dot marks East
- Updates as you move slider

### Why It Matters

- **Sun Calculations**: Accurate sun position
- **Shadow Analysis**: Shadows based on location
- **System Orientation**: Shows which way system faces
- **Generation Estimates**: Location-specific

### Example
```
For Mumbai-facing Southeast:
- Latitude: 19.08°N
- Longitude: 72.88°E
- Orientation: 135° (Southeast)

Result:
- Compass needle points Southeast
- Shadows calculated for Mumbai
- Generation estimated for that location
```

---

## 4. Load Boxes

### What Are Load Boxes?

Load boxes represent places where electricity is consumed:
- Show consumption points on canvas
- Help model consumer profiles
- Different capacities available
- Editable consumption amounts

### Available Load Boxes

1. **Single Phase Load Box** (5kW)
   - Residential or small commercial
   - 220V, 50Hz
   - Cost: ₹15,000

2. **Three Phase Load Box** (10kW)
   - Larger commercial systems
   - 415V, 50Hz
   - Cost: ₹25,000

3. **Industrial Load Box** (30kW)
   - Industrial or large installations
   - 415V, 50Hz
   - Cost: ₹45,000

### How to Use Load Boxes

**Step 1: Add Load Box**
1. Left sidebar → Equipment tab
2. Scroll to "Load" category
3. Drag "Single Phase Load Box" to canvas

**Step 2: Configure**
1. Click load box on canvas to select
2. Right panel shows properties
3. Edit:
   - Monthly Consumption (Units)
   - Height (h_z)
   - Cost
   - Color

**Step 3: Connect**
1. Use AC Wire tool
2. Connect load to inverter
3. Shows power flow in design

**Step 4: Evaluate**
1. Click Evaluate button
2. System calculates if solar meets load
3. Reports excess/deficit

### Example Design
```
Canvas Layout:
- 10 Solar Panels (3.3kW)
- 1 Micro Inverter (5kW)
- 1 Single Phase Load Box (5kW)
- 1 Meter
- Wire connections

Evaluation:
✓ System supplies 100% of load
✓ Leftover exports to grid
✓ Monthly savings: ₹3,000
```

---

## 5. Custom Components

### When to Use

Create custom equipment when:
- Not in default library
- Specific brand/model needed
- Proprietary equipment
- Local equipment

### How to Create

**Step 1: Open Modal**
- Left sidebar → Equipment tab
- Click "Add Custom Component" button
- Modal dialog opens

**Step 2: Basic Info**
- Component Name (required)
  - Example: "Titan 50kW Inverter"
- Equipment Type (required)
  - Panel, Inverter, Battery, Load, etc.

**Step 3: Details**
- Manufacturer (optional)
  - Example: "Titan Power Solutions"
- Model Number (optional)
  - Example: "TP-50K-V3"

**Step 4: Physical Properties**
- Cost (₹)
- Width (meters)
- Height (meters)
- Color (click to pick)

**Step 5: Specifications**
- Click in "Key" field: Enter spec name
  - Example: "Efficiency"
- Click in "Value" field: Enter value
  - Example: "97.5%"
- Click plus button to add
- Repeat for all specs
- Click trash to remove

**Step 6: Save**
- Click "Create & Add"
- Equipment saves to Supabase
- Automatically added to canvas
- Available for future projects

### Example
```
Component Name: Twin Disc 40kW UPS
Equipment Type: Inverter
Manufacturer: Twin Disc Systems
Model: TD-40-2024

Specs:
- Efficiency: 98.2%
- Input Voltage: 360-450V DC
- Output: 230V 3-phase
- Warranty: 10 years

Cost: ₹320,000
Width: 1.2m
Height: 1.8m
Color: #2c3e50
```

---

## Configuration Summary

### What It Shows

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

This helps verify all settings before Evaluate.

---

## Typical Workflow

### Basic Design with Phase 1 Features

```
1. SET LOCATION
   → Settings tab → Auto-detect location
   → Set orientation for your area

2. CONFIGURE FINANCES
   → Grid rate for your region
   → Monthly load to offset
   → System cost estimate

3. DESIGN ON CANVAS
   → Add solar panels
   → Add inverter
   → Add load boxes for consumption
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

### For Accurate Results

1. **Set Correct Location**
   - Use auto-detect or find your city's coordinates
   - Accuracy within 0.1° is sufficient

2. **Realistic Costs**
   - Equipment costs affect ROI
   - Update for custom equipment

3. **Configure Load Properly**
   - Monthly load should match actual consumption
   - Load boxes help distribute it

4. **Use Correct Orientations**
   - South-facing optimal in Northern Hemisphere
   - North-facing optimal in Southern Hemisphere
   - Use compass for reference

### For Better Designs

1. **Show Load Consumption Visually**
   - Add load boxes on canvas
   - Shows where power is used

2. **Use Custom Components**
   - Create equipment matching your real choices
   - Builds accurate cost estimates
   - Useful for documentation

3. **Verify Regularly**
   - Run evaluation after changes
   - Adjust parameters to see impact
   - Compare different scenarios

---

## Troubleshooting

### Auto-Detect Location Not Working
- Ensure location services enabled
- Check browser permissions (allow when asked)
- Try entering coordinates manually

### Load Boxes Not Showing Units
- Make sure load box is selected
- Enter number in "Monthly Consumption" field
- Units display on canvas as "5U"

### Properties Panel Not Updating
- Click object on canvas to select
- Right panel will show that object
- Make changes and see canvas update

### Compass Not Rotating
- Move orientation slider
- Blue needle should rotate
- Red dot stays East for reference

---

## Next Steps

- **For More Info**: See COMPLETION.md
- **For Examples**: See EXAMPLES.md
- **For Architecture**: See ARCHITECTURE.md

---

**Enjoy designing with Solar Architect!** 🌞

