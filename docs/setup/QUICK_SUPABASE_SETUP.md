# ⚡ Quick Supabase Setup (5 Minutes)

This is the **FASTEST** way to get your database running. No CLI needed.

---

## Step 1: Copy the Migration SQL

Your migration file is already prepared at:
```
supabase/migrations/001_create_equipment_tables.sql
```

**All the SQL you need to run is there.** No modifications needed.

---

## Step 2: Go to Supabase Dashboard

1. Open: https://app.supabase.com
2. Select your **Solar Architect** project
3. Go to **SQL Editor** (in left sidebar)

---

## Step 3: Create & Run New Query

1. Click **"New Query"** button (top right)
2. **Clear** any default text
3. **Copy-paste** the ENTIRE contents of `supabase/migrations/001_create_equipment_tables.sql` into the editor
4. Click the **"RUN"** button (or press Ctrl+Enter)

---

## Step 4: Wait for Success ✅

You should see:
- **Green checkmark** ✅ next to the query
- No error messages
- "Query executed successfully" message

---

## Step 5: Verify Everything Created

### Option A: Use Table Editor
1. Go to **Table Editor** in Supabase sidebar
2. You should see these **4 new tables**:
   - ✅ equipment_types (8 default types)
   - ✅ equipment (3 sample items)
   - ✅ spec_sheets
   - ✅ equipment_presets

### Option B: Run Verification Query
Still in SQL Editor, run this to verify:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Should show:
```
equipment
equipment_presets
equipment_types
spec_sheets
```

---

## Step 6: Check Sample Data

In **Table Editor**, click on **equipment_types** and you should see:

| name | description | key_specs |
|------|-------------|-----------|
| Solar Panel | Photovoltaic panel... | {watts, efficiency, ...} |
| Inverter | Device to convert... | {capacity_kw, efficiency, ...} |
| Battery | Energy storage... | {capacity_kwh, chemistry, ...} |
| ... (5 more types) | | |

---

## That's It! 🎉

Your database is now ready. The tables are created with:
- ✅ Proper column types
- ✅ Foreign key relationships
- ✅ Row Level Security (RLS) policies
- ✅ Sample data (8 equipment types + 3 sample items)
- ✅ Indexes for performance

---

## Next: Configure Environment Variables

1. Get your credentials from Supabase:
   - Go to **Settings > API** in Supabase
   - Copy: **Project URL** and **anon public key**

2. Create `.env.local` in your project root:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. Done! You're ready to run the app:
   ```bash
   npm install
   npm run dev
   ```

---

## Troubleshooting

### "Query failed"
- Check for typos in SQL
- Try running a simpler query first: `SELECT 1;`
- If tables already exist, that's fine - the SQL uses `IF NOT EXISTS`

### "Permission denied"
- Make sure you're logged into Supabase
- You need to be a project admin
- Try logging out and back in

### Tables don't appear in Table Editor
- Refresh the browser (Cmd+R or Ctrl+R)
- Go to **Table Editor** and look again
- Run the verification query above

### Want to run this via CLI instead?
See: `docs/setup/GOOGLE_AUTH_SETUP.md` for CLI setup

---

## What This SQL Does

1. **Creates 4 tables** for equipment management:
   - equipment_types: 8 categories (Solar Panel, Inverter, Battery, BOS, Transformer, Safety, Structure, Load)
   - equipment: Individual equipment items with specs
   - spec_sheets: Uploaded PDFs/images with Gemini analysis results
   - equipment_presets: Saved equipment bundles

2. **Adds sample data**:
   - 330W Solar Panel (Sunwatt Solar)
   - 500W Micro Inverter (APSystems)
   - 5kWh Lithium Battery (BYD)

3. **Enables Row Level Security (RLS)**:
   - equipment_types: Public read (everyone sees available types)
   - equipment: Public read for active, users can create/edit their own
   - spec_sheets: Users can only see their own
   - equipment_presets: Users can only see their own

4. **Creates indexes** for fast queries on common fields

---

**That's all! Your Solar Architect database is ready to go.** 🌞

Next: Set up Google OAuth in `docs/setup/GOOGLE_AUTH_SETUP.md`
