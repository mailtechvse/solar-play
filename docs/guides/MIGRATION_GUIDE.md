# Migration Guide: v4.5 → v5.0

## For Users of the Original Solar Architect

This guide helps you transition from the original `solar-board.html` to the new React-based v5.0.

---

## What's the Same?

✅ Core canvas and rendering logic
✅ Object types and properties
✅ Project save/load format
✅ Keyboard shortcuts
✅ UI layout (sidebar, canvas, properties panel)
✅ Evaluation metrics and calculations

---

## What's Different?

### 1. Equipment Management

**Old (Hardcoded)**
- Equipment defined in JavaScript constants
- Changing equipment = editing code
- Limited to ~30 pre-defined options
- No way to add custom types

**New (Supabase)**
- Equipment stored in database
- Add/edit via UI or database
- Unlimited custom equipment
- Specifications extracted from PDFs with Gemini

### 2. Specifications

**Old**
- Minimal specs (watts, kW, cost)
- Manual entry only
- No metadata

**New**
- Comprehensive specs per type
- Auto-extracted from PDFs
- Validated against equipment type
- Searchable and queryable

### 3. Adding Equipment

**Old**
```javascript
// Edit solar-board.html
const COMPONENTS = {
  'panel_330': { type: 'panel', watts: 330, cost: 9000, ... }
}
```

**New**
```
UI: Click "Add Custom Component"
Database: Supabase automatically syncs
PDF: Upload spec sheet → Gemini extracts
```

### 4. Deployment

**Old**
- Single HTML file
- Copy to any web server
- No backend needed

**New**
- React + Vite build
- Needs Node.js for dev
- Supabase backend required
- Deploy to Vercel/Netlify or self-hosted

---

## Migration Path

### Option A: Fresh Start (Recommended)

**Best for**: New projects, starting fresh

1. Set up v5.0 (see QUICK_START.md)
2. Start designing new systems
3. Upload spec sheets for equipment
4. Build your project in new app

### Option B: Import Existing Projects

**Best for**: Keeping past designs

1. Set up v5.0 (see QUICK_START.md)
2. Open original `solar-board.html` in another window
3. Load your old project (File > Load)
4. Note the equipment used
5. In v5.0:
   - Add same equipment from library
   - Recreate design from scratch (faster than porting)
   - Or manually insert equipment data

### Option C: Hybrid (Run Both)

**Best for**: Gradual migration

1. Keep `solar-board.html` for reference
2. Run v5.0 for new projects
3. Use original for legacy data
4. Gradually migrate projects

---

## Equipment Migration

### List Current Equipment (from old app)

Open `solar-board.html` and check JavaScript console:
```javascript
// In browser console
Object.keys(COMPONENTS).forEach(key => {
  const comp = COMPONENTS[key];
  console.log(`${key}: ${comp.type} - ₹${comp.cost}`);
});
```

### Add to v5.0

**Method 1: Via UI**
1. Click "Add Custom Component"
2. Fill in details matching your equipment
3. Add to canvas

**Method 2: Direct SQL**
```sql
INSERT INTO equipment (type_id, name, manufacturer, model_number, specifications, cost, width, height, color, is_active)
SELECT
  (SELECT id FROM equipment_types WHERE name = 'Solar Panel'),
  'Your Panel Name',
  'Manufacturer',
  'Model',
  '{"watts": 330, "efficiency": 18.5}'::jsonb,
  9000,
  1.0,
  2.0,
  '#1e3a8a',
  true
WHERE NOT EXISTS (SELECT 1 FROM equipment WHERE model_number = 'Model');
```

---

## Project File Compatibility

### v4.5 Project Format
```json
{
  "objects": [
    {
      "id": "abc123",
      "type": "panel",
      "x": 10,
      "y": 10,
      "watts": 330,
      "cost": 9000
    }
  ],
  "wires": []
}
```

### v5.0 Project Format
```json
{
  "objects": [
    {
      "id": "abc123",
      "type": "panel",
      "x": 10,
      "y": 10,
      "watts": 330,
      "cost": 9000,
      "equipment_id": "xyz789",
      "specifications": {
        "watts": 330,
        "efficiency": 18.5,
        "technology": "Monocrystalline"
      }
    }
  ],
  "wires": [],
  "settings": {
    "scale": 25,
    "offsetX": 0,
    "offsetY": 0
  }
}
```

**Note**: v5.0 projects can't be imported to v4.5, but v4.5 designs can be recreated in v5.0 by importing the JSON (will need manual equipment mapping).

---

## Keyboard Shortcuts (Still the Same)

| Key | Action |
|-----|--------|
| **V** | Select mode |
| **M** | Measure mode |
| **D** | Delete mode |
| **W** | DC Wire |
| **A** | AC Wire |
| **G** | Earthing |
| **R** | Rotate (TBD) |
| **Cmd+Z** | Undo |
| **Cmd+Y** | Redo |
| **Cmd+S** | Save |
| **Delete** | Remove object |

---

## Features Comparison

| Feature | v4.5 | v5.0 |
|---------|------|------|
| Canvas drawing | ✅ | ✅ |
| Object placement | ✅ | ✅ |
| Wire connections | ✅ | ✅ |
| Object properties | ✅ | ✅ |
| Undo/Redo | ✅ | ✅ |
| Save/Load projects | ✅ | ✅ |
| System evaluation | ✅ | ✅ |
| Keyboard shortcuts | ✅ | ✅ |
| --- | --- | --- |
| Equipment database | ❌ | ✅ |
| PDF spec analysis | ❌ | ✅ |
| Custom equipment UI | ❌ | ✅ |
| Cloud sync | ❌ | ✅ |
| Real-time specs | ❌ | ✅ |
| Collaborative design | ❌ | 🔄 (planned) |

---

## API Changes (for developers)

### Getting Equipment

**v4.5**
```javascript
const equipment = COMPONENTS['panel_330'];
```

**v5.0**
```javascript
const equipment = await equipmentService.getEquipmentByType(typeId);
// Or from Zustand store
const equipmentLibrary = useSolarStore(state => state.equipmentLibrary);
```

### Adding Objects

**v4.5**
```javascript
this.objects.push({
  id: Math.random().toString(36).slice(2),
  type: 'panel',
  x: 10, y: 10,
  watts: 330,
  cost: 9000
});
this.saveState(); // Manual save to history
```

**v5.0**
```javascript
useSolarStore.getState().addObject({
  id: Math.random().toString(36).slice(2),
  type: 'panel',
  x: 10, y: 10,
  watts: 330,
  cost: 9000,
  equipment_id: 'xyz-id'
});
// Auto-saved to history
```

---

## Troubleshooting Migration

### Old Projects Not Opening

**Cause**: v5.0 project format is slightly different

**Solution**:
1. Keep old app running in separate tab
2. Recreate design in v5.0 (faster for most)
3. Or manually map equipment_id field to JSON

### Equipment Missing

**Cause**: Equipment not imported from old version

**Solution**:
1. Use "Add Custom Component" to recreate
2. Or insert directly via SQL
3. Check equipment `is_active = true`

### Evaluation Numbers Different

**Cause**: Slightly different calculation logic in v5.0

**Solution**:
- Differences should be minor (<5%)
- Check assumptions (sun hours, degradation, etc.)
- Both calculate conservatively

---

## Tips for Migration

### 1. Gradually Onboard Equipment
- Don't need to migrate all at once
- Add equipment as you design projects
- Use spec sheets to quickly populate details

### 2. Keep Old Version for Reference
- `solar-board.html` remains in repo
- Open in separate window
- Reference for unfamiliar components

### 3. Use Spec Sheets
- v5.0's killer feature!
- Upload PDFs instead of manual entry
- Gemini extracts all specs
- Updates equipment automatically

### 4. Organize Equipment Types
- Create meaningful categories
- Use equipment presets for common setups
- Makes future projects faster

### 5. Document Changes
- Add notes when changing equipment
- Use equipment descriptions
- Helps team understand choices

---

## Performance Comparison

| Aspect | v4.5 | v5.0 |
|--------|------|------|
| Load time | <1s | 2-3s (first load) |
| Canvas render | Instant | Instant |
| Equipment list | Fixed | Dynamic |
| Search equipment | No | Yes |
| Upload speeds | N/A | <1s |
| Analysis time | N/A | 10-30s |
| Save project | <1s | <1s |
| Project sync | Local only | Cloud + Local |

---

## FAQ

### Q: Can I use both versions?
**A**: Yes! Keep `solar-board.html` and run v5.0 side-by-side. No conflicts.

### Q: How do I import old projects?
**A**: Recreate in v5.0 (faster) or manually map equipment_id in JSON.

### Q: Will my old projects still work?
**A**: Yes, `solar-board.html` is unchanged. Old projects load normally.

### Q: What if I don't want Supabase?
**A**: You need Supabase for v5.0 (that's the whole point). Keep using v4.5.

### Q: Can I self-host v5.0?
**A**: Yes! Docker instructions in DEPLOYMENT.md. Still needs Supabase.

### Q: Is the original HTML still maintained?
**A**: It's frozen in time. v5.0 is the future development path.

---

## Rollback Instructions

If you want to go back to v4.5:

```bash
# Keep current branch with v5.0
git checkout -b solar-v5

# Go back to old version
git checkout main

# Open original
open solar-board.html
```

Both versions work independently.

---

## Next Steps

1. **Try v5.0**: Follow QUICK_START.md
2. **Explore Features**: Upload a spec sheet
3. **Create Equipment**: Use "Add Custom Component"
4. **Design System**: Build a test project
5. **Deploy**: Follow DEPLOYMENT.md when ready

---

## Questions?

- **Technical**: See SETUP_GUIDE.md
- **Deployment**: See DEPLOYMENT.md
- **Usage**: See QUICK_START.md or README.md

**Welcome to v5.0!** 🚀
