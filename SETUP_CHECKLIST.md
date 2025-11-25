# ✅ Solar Architect v5.0 - Setup Checklist

Use this to track your progress through setup. Estimated time: **1-2 hours**

---

## Phase 1: Database Setup (15 minutes)

### Supabase Project Creation
- [ ] Create Supabase account at https://supabase.com
- [ ] Create new project named "Solar Architect"
- [ ] Wait for project initialization (2-3 minutes)
- [ ] Copy Project URL and Anon Key to safe location

### Database Migration
- [ ] Go to Supabase SQL Editor
- [ ] Create new query
- [ ] Copy entire contents of: `supabase/migrations/001_create_equipment_tables.sql`
- [ ] Paste into SQL Editor
- [ ] Click RUN and wait for green checkmark ✅
- [ ] Verify tables in Table Editor:
  - [ ] equipment_types (should have 8 items)
  - [ ] equipment (should have 3 items)
  - [ ] spec_sheets (empty, ready for uploads)
  - [ ] equipment_presets (empty, ready for user presets)

**🎯 Checkpoint**: Database is ready with tables and sample data

---

## Phase 2: Google OAuth Setup (30 minutes)

### Google Cloud Console Setup
- [ ] Go to https://console.cloud.google.com
- [ ] Create new project (or select existing)
- [ ] Search "OAuth consent screen" and configure:
  - [ ] Choose "External" user type
  - [ ] Fill app name: "Solar Architect"
  - [ ] Fill support email
  - [ ] Add scopes: email, profile, openid
  - [ ] Add test users (your email)
- [ ] Go to "Credentials" and create OAuth 2.0 Client ID:
  - [ ] Choose "Web application"
  - [ ] Add authorized redirect URIs:
    - `http://localhost:5173/auth/callback` (local development)
    - `https://your-domain.com/auth/callback` (production - add later)
  - [ ] Copy Client ID and Client Secret to safe location

### Supabase Auth Configuration
- [ ] Go to Supabase > Authentication > Providers
- [ ] Find and enable "Google"
- [ ] Paste in the Client ID and Client Secret from Google Cloud
- [ ] Save

**🎯 Checkpoint**: Google OAuth is configured

---

## Phase 3: Local Development Setup (15 minutes)

### Project Dependencies
- [ ] Open terminal in project root: `/Users/piyushchitkara/scripts/solar-play`
- [ ] Run: `npm install`
- [ ] Wait for all packages to install
- [ ] Verify no errors at the end

### Environment Configuration
- [ ] Create file: `.env.local` in project root
- [ ] Add your Supabase credentials:
  ```
  VITE_SUPABASE_URL=https://your-project.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-public-key
  ```
- [ ] Save file
- [ ] **Important**: Never commit `.env.local` to git

### Run the Application
- [ ] In terminal, run: `npm run dev`
- [ ] Wait for Vite to start (should say "Local: http://localhost:5173")
- [ ] Open browser to: `http://localhost:5173`

**🎯 Checkpoint**: App loads and shows login page

---

## Phase 4: Test Login (10 minutes)

### Google Login Test
- [ ] See "Solar Architect" login page
- [ ] Click "Sign in with Google"
- [ ] You should be redirected to Google login
- [ ] Enter your test account email
- [ ] After login, you should see:
  - [ ] Main canvas with grid
  - [ ] Top bar with user profile
  - [ ] Left sidebar with equipment palette
  - [ ] Right panel ready for object properties

### Verify Authentication
- [ ] Check top-right corner - your profile name should appear
- [ ] Click your profile - should see "Logout" option
- [ ] Click "Logout" - should redirect to login page
- [ ] Click "Sign in with Google" again - should automatically log back in (fast path)

**🎯 Checkpoint**: Google OAuth is working!

---

## Phase 5: Test Core Features (20 minutes)

### Equipment Loading
- [ ] Left sidebar should show "Equipment Types"
- [ ] Expand each type to see equipment:
  - [ ] Solar Panel (see "330W" sample)
  - [ ] Inverter (see "500W Micro" sample)
  - [ ] Battery (see "5kWh" sample)
- [ ] Expand equipment to see specs

### Canvas Interaction
- [ ] Click any equipment to select it
- [ ] Drag it onto the canvas
- [ ] Should see object placed on grid
- [ ] Right panel should show properties (X, Y, rotation, cost, etc)
- [ ] Change properties - object should update in real-time

### Wire Connections
- [ ] Select DC Wire tool (W key or click tool)
- [ ] Click a panel, then click an inverter
- [ ] Should draw a red wire between them

### Custom Equipment
- [ ] Go to Equipment > "Upload Specs" tab
- [ ] Click "+ Add Custom Equipment"
- [ ] Fill form (name, type, cost, etc)
- [ ] Click Create
- [ ] New equipment should appear in palette

**🎯 Checkpoint**: App is fully functional!

---

## Phase 6: Spec Sheet Upload (Optional, Advanced)

This requires Gemini API key setup (not required for basic functionality).

- [ ] Upload spec sheet:
  - [ ] Select equipment in "Upload Specs"
  - [ ] Choose PDF/image with specs
  - [ ] Click "Upload & Analyze"
  - [ ] Should extract specs using Gemini AI
- [ ] See extracted data in equipment

**Note**: Requires deploying Edge Function with Gemini API key. See `docs/setup/GOOGLE_AUTH_SETUP.md` for details.

**🎯 Checkpoint**: Full spec management working!

---

## Phase 7: Save & Load Projects (Optional)

- [ ] Design a simple system (2-3 components)
- [ ] Click "Save" in top bar
- [ ] Type a project name
- [ ] Project saves to Supabase
- [ ] Click "Load" to see saved projects
- [ ] Click a project to restore it

---

## Troubleshooting Checklist

### "Can't see login page"
- [ ] Browser shows http://localhost:5173?
- [ ] Check terminal - npm run dev is running?
- [ ] Try Ctrl+R to refresh browser
- [ ] Check console for errors (F12 > Console)

### "Google login not working"
- [ ] Client ID and Secret correct in Supabase?
- [ ] Redirect URL includes `/auth/callback`?
- [ ] Redirect URL matches exactly? (including http vs https)
- [ ] Are you on http://localhost:5173 (not IP address)?

### "Can't see equipment types"
- [ ] Database migration ran successfully? (check Phase 1)
- [ ] Tables visible in Supabase Table Editor?
- [ ] Browser console shows errors? (F12 > Console)
- [ ] Try logging out and back in

### "Canvas not responding"
- [ ] Is the app fully loaded? (check for spinner)
- [ ] Try refreshing page (Ctrl+R)
- [ ] Check browser console for errors (F12)
- [ ] Make sure you're logged in

### "Environment variables not loading"
- [ ] File is named `.env.local` (with dot)?
- [ ] In project root directory?
- [ ] Contains correct URL and key?
- [ ] Restart npm run dev after creating file
- [ ] Check that VITE_ prefix is correct

---

## Next Steps After Setup

### Short Term (This week)
1. ✅ Complete setup checklist above
2. Design a test system:
   - Add solar panels
   - Add inverter
   - Connect with wires
   - Test evaluation
3. Create custom equipment for your needs
4. Test save/load projects

### Medium Term (This month)
1. Deploy to production:
   - Follow `docs/deployment/DEPLOYMENT.md`
   - Deploy to Vercel or Netlify
   - Update Google OAuth redirect URLs for production domain
2. Configure Gemini API for spec sheet analysis
3. Deploy Edge Function with Gemini key
4. Test full spec sheet upload workflow

### Long Term (Ongoing)
1. Build equipment library with PDFs
2. Share with team
3. Gather feedback
4. Plan enhancements

---

## Resource Links

| Resource | Link | Purpose |
|----------|------|---------|
| Supabase Dashboard | https://app.supabase.com | Database management |
| Google Cloud Console | https://console.cloud.google.com | OAuth configuration |
| App Local | http://localhost:5173 | Development app |
| Setup Guide | docs/setup/SETUP_GUIDE.md | Detailed documentation |
| Quick Supabase Setup | docs/setup/QUICK_SUPABASE_SETUP.md | Database setup (5 min) |
| Google Auth Setup | docs/setup/GOOGLE_AUTH_SETUP.md | OAuth setup (20 min) |
| Deployment Guide | docs/deployment/DEPLOYMENT.md | Production deployment |

---

## Estimated Time Breakdown

| Phase | Time | Status |
|-------|------|--------|
| Phase 1: Database | 15 min | ⏳ Pending |
| Phase 2: OAuth Setup | 30 min | ⏳ Pending |
| Phase 3: Dev Setup | 15 min | ⏳ Pending |
| Phase 4: Login Test | 10 min | ⏳ Pending |
| Phase 5: Features | 20 min | ⏳ Pending |
| Phase 6: Spec Upload | 30 min | ⏳ Optional |
| **Total** | **120 min** | **≈ 2 hours** |

---

## Quick Start Command Reference

```bash
# Install dependencies (run once)
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Deploy Edge Function (after setup)
npx supabase functions deploy analyze-spec-sheet
```

---

## Support

**Stuck?** Check in this order:
1. This checklist (Troubleshooting section)
2. `docs/setup/QUICK_SUPABASE_SETUP.md` (database issues)
3. `docs/setup/GOOGLE_AUTH_SETUP.md` (login issues)
4. `docs/setup/SETUP_GUIDE.md` (detailed help)
5. Check browser console (F12 > Console tab)

---

**Ready to get started?** Begin with **Phase 1** above! 🚀

The fastest path: **QUICK_SUPABASE_SETUP.md → GOOGLE_AUTH_SETUP.md → npm run dev**
