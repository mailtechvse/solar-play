# Solar Architect: Grid Master - React Edition
## Complete Setup & Integration Guide

### Overview
This is a complete React + Supabase conversion of the original Solar Architect application. It features:
- **Equipment Database**: Supabase-backed equipment library with specifications
- **Spec Sheet Analysis**: Gemini 2.5 Flash powered specification extraction from PDFs/images
- **Dynamic Equipment Types**: Extensible equipment system aligned to specifications
- **Custom Components**: Users can add custom equipment that syncs with database
- **Edge Functions**: Server-side processing for secure Gemini API integration

---

## Table of Contents
1. [Project Structure](#project-structure)
2. [Initial Setup](#initial-setup)
3. [Supabase Configuration](#supabase-configuration)
4. [Environment Variables](#environment-variables)
5. [Deploying Edge Functions](#deploying-edge-functions)
6. [Running the Application](#running-the-application)
7. [Key Features & Workflows](#key-features--workflows)
8. [Architecture Notes](#architecture-notes)

---

## Project Structure

```
solar-play/
├── src/
│   ├── main.jsx                    # React entry point
│   ├── App.jsx                     # Main application component
│   ├── components/
│   │   ├── Canvas.jsx              # Canvas rendering component
│   │   ├── TopBar.jsx              # Top toolbar with stats
│   │   ├── LeftSidebar.jsx         # Equipment palette & tools
│   │   ├── RightPanel.jsx          # Object properties panel
│   │   ├── EquipmentPalette.jsx    # Individual equipment selector
│   │   ├── SpecSheetUpload.jsx     # Spec sheet upload & analysis
│   │   ├── EvaluationModal.jsx     # System evaluation metrics
│   │   └── CustomComponentModal.jsx # Custom equipment creation
│   ├── stores/
│   │   └── solarStore.js           # Zustand state management
│   ├── lib/
│   │   └── supabase.js             # Supabase client & queries
│   ├── utils/
│   │   ├── canvas.js               # Canvas rendering functions
│   │   └── canvasEvents.js         # Event handlers
│   └── styles/
│       └── index.css               # Tailwind CSS & custom styles
├── supabase/
│   ├── migrations/
│   │   └── 001_create_equipment_tables.sql  # Database schema
│   └── functions/
│       └── analyze-spec-sheet/
│           └── index.ts            # Gemini analysis Edge Function
├── index.html                      # HTML entry
├── vite.config.js                  # Vite configuration
├── tailwind.config.js              # Tailwind configuration
├── postcss.config.js               # PostCSS configuration
├── package.json                    # Dependencies
├── .env.example                    # Environment template
└── solar-board.html                # Original vanilla JS (NOT MODIFIED)
```

---

## Initial Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Supabase Project
1. Go to https://supabase.com
2. Create a new project
3. Note the **Project URL** and **Anon Key** from Project Settings > API

### 3. Copy Environment File
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## Supabase Configuration

### 1. Run Database Migrations
```bash
# Using Supabase CLI
supabase db push
```

Or manually:
1. Go to Supabase Dashboard > SQL Editor
2. Create new query
3. Paste contents of `supabase/migrations/001_create_equipment_tables.sql`
4. Run

This creates:
- `equipment_types` - Type definitions (Solar Panel, Inverter, Battery, etc.)
- `equipment` - Equipment instances with specifications
- `spec_sheets` - Uploaded spec sheets and extracted data
- `equipment_presets` - User-defined equipment sets

### 2. Verify RLS Policies
All tables have Row Level Security (RLS) enabled:
- **equipment_types**: Public read
- **equipment**: Public read for active, authenticated write
- **spec_sheets**: User access control
- **equipment_presets**: User access control

### 3. Load Sample Data
The migration includes sample equipment:
- Solar Panel 330W (Sunwatt Solar)
- Micro Inverter 500W (APSystems)
- Lithium Battery 5kWh (BYD)

Add more via the application or directly in the database.

---

## Environment Variables

### Required (Vite Frontend)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Required (Edge Function)
Set in Supabase Dashboard > Project Settings > Edge Functions > Secrets:
```
GEMINI_API_KEY=your-gemini-api-key
```

Get your Gemini API key:
1. Go to https://aistudio.google.com/apikey
2. Create a new API key
3. Copy and store securely

---

## Deploying Edge Functions

### Install Supabase CLI
```bash
brew install supabase/tap/supabase
# or npm install -g supabase
```

### Login to Supabase
```bash
supabase login
```

### Set Edge Function Secret
```bash
supabase secrets set GEMINI_API_KEY="your-gemini-api-key"
```

### Deploy the Function
```bash
supabase functions deploy analyze-spec-sheet --no-verify
```

### Verify Deployment
```bash
supabase functions list
```

You should see `analyze-spec-sheet` listed.

### Test the Function
```bash
supabase functions invoke analyze-spec-sheet --body '{
  "spec_sheet_id": "test-id",
  "equipment_type": "Solar Panel",
  "file_content": "base64-encoded-content",
  "file_type": "pdf"
}'
```

---

## Running the Application

### Development
```bash
npm run dev
```

Opens at http://localhost:5173

### Build for Production
```bash
npm run build
npm run preview
```

---

## Key Features & Workflows

### Feature 1: Equipment Management

**Add Equipment from Library:**
1. Left sidebar shows equipment types
2. Expand a type (e.g., "Solar Panel")
3. Click on equipment to add to canvas
4. Or drag to canvas

**Equipment Properties:**
- Synchronized with Supabase `equipment` table
- Includes manufacturer, model, cost, specifications
- Each equipment type has predefined key specs

### Feature 2: Spec Sheet Upload & Analysis

**Upload a Spec Sheet:**
1. Go to "Upload Specs" tab in left sidebar
2. Select equipment from dropdown
3. Choose PDF or image file
4. Click "Upload & Analyze"

**Process:**
1. File uploaded to Edge Function
2. Gemini 2.5 Flash analyzes the document
3. Extracted specs saved to `spec_sheets` table
4. Equipment specifications updated automatically
5. Results displayed with confidence score

**Extracted Data Includes:**
- Power ratings (watts, kW, kWh)
- Efficiency percentages
- Voltage/Current specifications
- Temperature coefficients
- Technology type (Monocrystalline, LiFePO4, etc.)
- Missing data warnings

### Feature 3: Custom Component Creation

**Create Custom Equipment:**
1. Click "Add Custom Component" button
2. Fill in details:
   - Name, Type, Manufacturer, Model
   - Cost, Dimensions, Color
3. Add custom specifications (key-value pairs)
4. Click "Create & Add"

**Result:**
- Equipment created in Supabase (`is_custom = true`)
- Immediately added to canvas
- Synced to library for future use

### Feature 4: System Evaluation

**Evaluate Your System:**
1. Design system on canvas
2. Click "Evaluate" button (top right)

**Metrics Shown:**
- DC/AC capacity calculations
- Panel and inverter counts
- System efficiency
- Annual generation estimate
- Total cost & cost per kW
- Connectivity checks
- 25-year financial projection

**Download Report:**
- Click "Download Report" in evaluation modal
- Saves as text file with all metrics

---

## Architecture Notes

### State Management (Zustand)
`useSolarStore` manages:
- Canvas state (scale, offset, grid)
- Objects & wires on canvas
- Tool modes (select, delete, wire, etc.)
- History for undo/redo
- Equipment library
- UI state (modal visibility)

**Example Usage:**
```javascript
const objects = useSolarStore((state) => state.objects);
const addObject = useSolarStore((state) => state.addObject);
```

### Supabase Integration
`src/lib/supabase.js` provides:
- `equipmentService.getEquipmentTypes()`
- `equipmentService.getEquipmentByType(typeId)`
- `equipmentService.createEquipment(data)`
- `specSheetService.analyzeSpecSheet(...)` - calls Edge Function

### Canvas Rendering
`src/utils/canvas.js`:
- Renders grid, objects, wires, shadows
- Handles Z-ordering by `h_z` property
- Pixel-perfect rendering

### Event Handling
`src/utils/canvasEvents.js`:
- Mouse events (click, drag, wheel)
- Keyboard shortcuts (V, M, D, W, A, G, Cmd+Z, Cmd+S)
- Object selection and manipulation

---

## Database Schema Overview

### equipment_types
```sql
id, name, description, key_specs (JSONB)
```
Defines what specs each type should have.

### equipment
```sql
id, type_id, name, manufacturer, model_number,
specifications (JSONB), cost, width, height,
color, spec_sheets (relation), is_custom, is_active,
created_by, created_at, updated_at
```
Individual equipment instances.

### spec_sheets
```sql
id, equipment_id, file_url, file_name,
extracted_specs (JSONB), extraction_status,
gemini_response (JSONB), created_by, created_at
```
Uploaded spec sheets and extraction results.

### equipment_presets
```sql
id, name, category, equipment_ids (UUID[]),
created_by, created_at
```
User-saved equipment bundles.

---

## Important Design Decisions

### Why Zustand?
- Lightweight state management
- Simple API for React components
- No Redux boilerplate
- Perfect for this use case

### Why Edge Functions (not direct API)?
- **Security**: Gemini API key never exposed to client
- **Privacy**: Server-side processing
- **Scalability**: Supabase manages function execution
- **Audit trail**: All analysis logged server-side

### Why Not Modify solar-board.html?
- Maintains original as reference
- Ensures backward compatibility
- Can run both versions side-by-side
- Easier migration path for users

### Equipment Specifications as JSONB
- **Flexibility**: New spec types without schema migration
- **Type safety**: Created via Edge Function analysis
- **Validation**: Supabase ensures valid JSON
- **Queryability**: Can filter by specification values

---

## Common Workflows

### Add Solar Panel Type Equipment

1. **Create in Supabase (if not exists):**
   - Equipment Type: "Solar Panel"
   - Key Specs: `{"watts": "numeric", "efficiency": "percentage", "technology": "text"}`

2. **Create Equipment Instance:**
   - Name: "Bifacial 450W"
   - Type: Solar Panel
   - Specifications: `{"watts": 450, "efficiency": 20.5, "technology": "Bifacial"}`
   - Cost: 18000

3. **Use in App:**
   - Equipment appears in left sidebar
   - Click to add to canvas
   - Properties editable in right panel

### Upload and Extract Spec from PDF

1. **Prepare:**
   - Have equipment created in database
   - Have PDF spec sheet ready

2. **Upload:**
   - Select equipment in "Upload Specs" tab
   - Choose PDF file
   - System analyzes with Gemini

3. **Review:**
   - Confidence score shown
   - Extracted specs displayed
   - Missing data highlighted

4. **Sync:**
   - Specs automatically saved to equipment
   - Library updated for next use

---

## Troubleshooting

### "Missing Supabase configuration"
- Check `.env.local` has correct URL and key
- Ensure keys are from correct project
- Restart dev server after env change

### "Edge Function Error: Gemini API failed"
- Verify `GEMINI_API_KEY` is set in Supabase
- Check key is valid at https://aistudio.google.com/apikey
- Ensure function was deployed: `supabase functions list`

### Equipment not showing in library
- Check `is_active = true` in database
- Verify RLS policies allow read access
- Check `type_id` references valid equipment_type

### Spec sheet extraction slow
- Gemini API can take 10-30 seconds
- Check browser console for errors
- Verify function logs: `supabase functions logs analyze-spec-sheet`

---

## Next Steps

1. **Deploy to Production:**
   - Build: `npm run build`
   - Deploy to Vercel, Netlify, or your platform
   - Set environment variables on hosting platform

2. **Extend Equipment Types:**
   - Add new types via SQL
   - Update key specs for each type
   - Create equipment instances

3. **Custom Analytics:**
   - Add load curve simulation
   - Implement battery dispatch strategy
   - Include cable sizing calculations

4. **Collaboration:**
   - Add shared projects via RLS policies
   - Implement real-time updates with Realtime
   - Add comments/notes to objects

---

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **Gemini API**: https://ai.google.dev/docs
- **React**: https://react.dev
- **Zustand**: https://github.com/pmndrs/zustand
- **Tailwind CSS**: https://tailwindcss.com

---

## License
Same as original Solar Architect project
