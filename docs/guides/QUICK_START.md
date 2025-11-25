# Quick Start Guide - Solar Architect v5.0

## 5-Minute Setup

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Create Supabase Project
1. Visit https://supabase.com and create a free account
2. Create a new project
3. Copy your **Project URL** and **Anon Key** from Settings > API

### Step 3: Setup Environment
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 4: Create Database Tables
1. Open Supabase Dashboard > SQL Editor
2. Create new query
3. Copy-paste the entire contents of `supabase/migrations/001_create_equipment_tables.sql`
4. Click "Run"

### Step 5: Setup Google OAuth (Required for Login)
**Quick setup** (2 minutes):
1. Go to https://console.cloud.google.com
2. Create project: "Solar Architect"
3. Enable Google+ API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized JavaScript origins:
   - `http://localhost:5173`
   - `http://localhost:3000`
6. Add authorized redirect URIs:
   - `http://localhost:5173/auth/callback`
   - `http://localhost:3000/auth/callback`
7. Copy **Client ID** and **Client Secret**
8. Go to Supabase > Authentication > Providers > Google
9. Enable Google and paste Client ID & Secret
10. Go to Authentication > URL Configuration
11. Add: `http://localhost:5173/auth/callback`

**Detailed guide**: See [GOOGLE_AUTH_SETUP.md](./GOOGLE_AUTH_SETUP.md)

### Step 6: Get Gemini API Key (Optional for Spec Analysis)
1. Go to https://aistudio.google.com/apikey
2. Click "Create API Key"
3. Copy the key
4. In Supabase > Project Settings > Edge Functions > Secrets
5. Add `GEMINI_API_KEY` with your key

### Step 7: Deploy Edge Function
```bash
# Install Supabase CLI if needed
npm install -g supabase

# Login
supabase login

# Set the secret
supabase secrets set GEMINI_API_KEY="your-gemini-key"

# Deploy
supabase functions deploy analyze-spec-sheet --no-verify
```

### Step 8: Start Development
```bash
npm run dev
```

Open http://localhost:5173 in your browser!

**You'll see the Google login page** - click "Continue with Google" to sign in.

---

## Using the App (10 Minutes)

### Add Equipment to Canvas
1. **Left Sidebar** shows equipment types
2. **Expand** a type (e.g., "Solar Panel")
3. **Click** to add to canvas
4. **Drag on canvas** to position

### Edit Properties
1. **Click** an object on canvas to select (blue border)
2. **Right Panel** shows all properties
3. **Edit** values (position, size, cost, color)
4. **Changes save instantly**

### Create Custom Equipment
1. Click **"Add Custom Component"** button
2. Fill in name, type, manufacturer, cost
3. Add dimensions and color
4. Add custom specs (e.g., watts: 400)
5. Click **"Create & Add"**
6. Equipment saved to database and added to canvas

### Upload Spec Sheet (with Gemini)
1. Go to **"Upload Specs"** tab
2. Select equipment from dropdown
3. Choose a PDF or image file
4. Click **"Upload & Analyze"**
5. Wait for Gemini to extract specs
6. Review extracted data with confidence score
7. Specs automatically saved to equipment

### Evaluate Your System
1. Click **"Evaluate"** button (top right)
2. View:
   - DC/AC capacity
   - Panel count
   - Efficiency
   - Annual generation
   - 25-year ROI
   - System connectivity checks
3. **Download Report** as text file

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **V** | Select mode |
| **M** | Measure mode |
| **D** | Delete mode |
| **W** | DC Wire mode |
| **A** | AC Wire mode |
| **G** | Earthing mode |
| **Cmd+Z** | Undo |
| **Cmd+Y** | Redo |
| **Cmd+S** | Save project |
| **Delete** | Remove selected object |

---

## Database Structure (Quick Overview)

### Equipment Types
Pre-defined types with required specs:
- **Solar Panel**: watts, efficiency, technology
- **Inverter**: capacity_kw, efficiency, voltage
- **Battery**: capacity_kwh, chemistry, voltage
- **BOS**: voltage_rating, current_rating
- **Transformer**: voltage_ratio, capacity_kva
- **Safety**: protection_type, rating
- **Structure**: material, weight_capacity
- **Load**: rated_power, voltage

### Equipment
Instances of types with actual values:
- Name, Manufacturer, Model
- Specifications (stored as JSON)
- Cost, Dimensions, Color
- Links to spec sheets

### Spec Sheets
Uploaded documents:
- File reference
- Extraction status
- Extracted specs
- Gemini response (raw)

---

## Adding More Equipment

### Via Database (Direct SQL)
```sql
INSERT INTO equipment (type_id, name, manufacturer, model_number, specifications, cost, width, height, color, is_active)
SELECT
  (SELECT id FROM equipment_types WHERE name = 'Solar Panel'),
  'Monocrystalline 400W',
  'JinkoSolar',
  'JKM400M-60',
  '{"watts": 400, "efficiency": 19.2, "technology": "Monocrystalline", "temperature_coefficient": -0.41}'::jsonb,
  11000,
  2.0,
  1.0,
  '#1e3a8a',
  true
WHERE NOT EXISTS (SELECT 1 FROM equipment WHERE model_number = 'JKM400M-60');
```

### Via Application
1. Click **"Add Custom Component"**
2. Fill form and click **"Create & Add"**
3. Equipment automatically saved to database

---

## Troubleshooting

### Environment not loading
```bash
# Make sure .env.local exists and has correct values
cat .env.local

# Restart dev server
npm run dev
```

### Supabase connection error
- Check URL is correct (no trailing slash)
- Verify Anon Key is correct
- Ensure project is active in Supabase Dashboard

### Spec sheet upload fails
- Ensure Gemini API key is set in Supabase
- Check Edge Function is deployed: `supabase functions list`
- Check function logs: `supabase functions logs analyze-spec-sheet`

### Equipment not showing
- Refresh browser (F5)
- Check `is_active = true` in database
- Verify equipment has a valid `type_id`

---

## What's Different from Original?

| Feature | Original (HTML) | React Version |
|---------|---|---|
| Equipment Source | Hardcoded in JS | Supabase Database |
| Adding Equipment | Code edit only | UI + Database |
| Specifications | Static | Dynamic + Gemini extracted |
| Spec Sheets | Manual entry | PDF/Image upload + Gemini |
| Scalability | Single file | Modular components |
| State Management | Global JS objects | Zustand store |
| Styling | Inline Tailwind CDN | Tailwind + PostCSS |

---

## Next: Go Deeper

- Read **SETUP_GUIDE.md** for detailed architecture
- Explore **supabase/migrations/** for database schema
- Check **src/components/** for React component structure
- See **src/lib/supabase.js** for API integration

---

## Support

- **Stuck?** Check SETUP_GUIDE.md troubleshooting section
- **Want to extend?** See architecture notes in SETUP_GUIDE.md
- **Need more?** Check the original solar-board.html for reference

Enjoy building solar systems! ☀️
