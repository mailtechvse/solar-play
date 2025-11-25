# 📁 Project Structure Overview

Complete file and folder layout for Solar Architect v5.0

---

## 🗂️ Root Directory

```
solar-play/
├── 📄 solar-board.html ..................... ORIGINAL APP (unchanged, 1,555 lines)
├── 📄 package.json ......................... Node dependencies
├── 📄 vite.config.js ....................... Vite bundler config
├── 📄 tailwind.config.js ................... Tailwind CSS config
├── 📄 postcss.config.js .................... PostCSS config
├── 📄 .env.example ......................... Environment template
├── 📄 .gitignore ........................... Git ignore rules
│
├── 📄 index.html ........................... React app entry point
├── 📄 README.md (symlink) .................. Project overview
├── 📄 FINAL_STATUS.md ...................... Completion summary
├── 📄 START_HERE_NOW.md (NEW) .............. Quick start options
├── 📄 SETUP_CHECKLIST.md (NEW) ............. Step-by-step setup
├── 📄 PROJECT_STRUCTURE.md (this file) .... File layout
│
├── 📁 src/ ................................. React application code
├── 📁 docs/ ................................ Complete documentation
├── 📁 supabase/ ............................ Database & backend
└── 📁 node_modules/ ........................ Dependencies (after npm install)
```

---

## 🎨 React Source Code (`src/`)

```
src/
├── 📄 main.jsx ............................ React entry point
│   └── Wraps app with AuthProvider
│
├── 📄 App.jsx ............................. Main app component
│   ├── Routes: /login, /auth/callback, /
│   ├── Route protection (requires auth for /)
│   └── Loads authenticated user's state
│
├── 📁 components/ ......................... React components (8 total)
│   ├── Canvas.jsx ........................ Canvas renderer
│   │   ├── 2D drawing surface
│   │   ├── requestAnimationFrame loop (60fps)
│   │   ├── Mouse/keyboard event handlers
│   │   └── Zoom with scroll wheel
│   │
│   ├── TopBar.jsx ........................ Application toolbar
│   │   ├── Statistics (DC capacity, AC output)
│   │   ├── Tool buttons (Save, Load, Evaluate, etc)
│   │   ├── User profile dropdown
│   │   └── Logout button
│   │
│   ├── LeftSidebar.jsx ................... Equipment palette
│   │   ├── Tool palette (Select, Wire, etc)
│   │   ├── Equipment list (expandable by type)
│   │   ├── Spec sheet upload tab
│   │   └── Drag-and-drop enabled
│   │
│   ├── RightPanel.jsx ................... Properties editor
│   │   ├── Position/dimension inputs
│   │   ├── Rotation and Z-height
│   │   ├── Cost and color picker
│   │   ├── Type-specific properties
│   │   └── Specs display
│   │
│   ├── EquipmentPalette.jsx ............. Equipment item component
│   │   ├── Manufacturer and model info
│   │   ├── Cost display
│   │   ├── Specs preview
│   │   └── Click to add to canvas
│   │
│   ├── SpecSheetUpload.jsx .............. PDF/image upload
│   │   ├── Equipment selector
│   │   ├── File upload (PDF/image)
│   │   ├── Calls Edge Function for Gemini
│   │   └── Shows extracted data + confidence
│   │
│   ├── EvaluationModal.jsx .............. System evaluation display
│   │   ├── Performance metrics
│   │   ├── Efficiency calculations
│   │   ├── 25-year financial projections
│   │   ├── Connectivity checks
│   │   └── Report download
│   │
│   └── CustomComponentModal.jsx ......... Create custom equipment
│       ├── Equipment type selector
│       ├── Spec key-value entry
│       ├── Dimension and cost inputs
│       └── Saves to Supabase immediately
│
├── 📁 pages/ .............................. Page components (authentication)
│   ├── LoginPage.jsx ..................... Google login UI
│   │   ├── "Solar Architect" branding
│   │   ├── Google sign-in button
│   │   ├── Loading and error states
│   │   └── Responsive dark theme
│   │
│   └── AuthCallback.jsx .................. OAuth callback handler
│       ├── Processes OAuth response
│       ├── Shows loading spinner
│       └── Auto-redirects on success
│
├── 📁 lib/ ................................ Core libraries
│   ├── supabase.js ....................... Supabase client
│   │   ├── Client initialization
│   │   ├── equipmentService functions
│   │   │   ├── getEquipmentTypes()
│   │   │   ├── getEquipmentByType(typeId)
│   │   │   ├── getAllEquipment()
│   │   │   ├── getEquipment(id)
│   │   │   ├── createEquipment(equipment)
│   │   │   ├── updateEquipment(id, updates)
│   │   │   └── deleteEquipment(id)
│   │   │
│   │   └── specSheetService functions
│   │       ├── createSpecSheet(specSheet)
│   │       ├── getSpecSheets(equipmentId)
│   │       ├── updateSpecSheet(id, updates)
│   │       └── analyzeSpecSheet(...) [calls Edge Function]
│   │
│   └── auth.js ........................... Authentication service
│       ├── signInWithGoogle()
│       ├── getCurrentUser()
│       ├── getSession()
│       ├── signOut()
│       ├── getUserProfile()
│       └── onAuthStateChange(callback)
│
├── 📁 context/ ............................ React Context
│   └── AuthContext.jsx ................... Authentication context
│       ├── AuthProvider component
│       ├── useAuth() hook with:
│       │   ├── user, profile, loading, error
│       │   ├── isAuthenticated, signInWithGoogle, signOut
│       │   └── Auto-detect session on mount
│       └── Real-time auth state listening
│
├── 📁 stores/ ............................ State management (Zustand)
│   └── solarStore.js ..................... Central state
│       ├── Canvas state (scale, offset, mode)
│       ├── Objects array + CRUD operations
│       ├── Wires management
│       ├── History (undo/redo, 50-state limit)
│       ├── Selected object tracking
│       ├── Equipment library state
│       ├── UI state (modals, evaluation)
│       └── Project (save/load/clear)
│
├── 📁 utils/ ............................. Utility functions
│   ├── canvas.js ......................... Canvas rendering
│   │   ├── renderCanvas(canvas, ctx, state)
│   │   ├── drawGrid(ctx, canvas, scale, offset)
│   │   ├── drawObject(ctx, obj, isSelected)
│   │   ├── drawWire(ctx, wire, objects, scale)
│   │   └── drawShadow(ctx, obj)
│   │
│   └── canvasEvents.js ................... Event handlers
│       ├── handleCanvasEvents object
│       ├── onMouseDown(e, canvas)
│       ├── onMouseMove(e, canvas)
│       ├── onMouseUp(e, canvas)
│       ├── onWheel(e, canvas)
│       ├── onKeyDown(e)
│       ├── onContextMenu(e, canvas)
│       ├── screenToWorld(screenX, screenY, offset, scale)
│       └── findObjectAtPoint(objects, x, y)
│
└── 📁 styles/ ............................ Styling
    └── index.css ......................... Tailwind imports + custom CSS
        ├── Tailwind directives
        ├── Scrollbar styling
        ├── Input range slider
        └── Animation definitions
```

---

## 📚 Documentation (`docs/`)

```
docs/
├── 📄 START_HERE.txt ..................... Visual quick start (2 min)
├── 📄 AUTH_COMPLETE.txt ................. Auth implementation summary
├── 📄 README.md .......................... Project overview & features
├── 📄 INDEX.md ........................... Master documentation index
├── 📄 NAVIGATION.md ...................... Quick navigation guide
│
├── 📁 guides/ ............................ User guides & migration
│   ├── QUICK_START.md ................... 5-minute setup guide (10 min)
│   └── MIGRATION_GUIDE.md ............... Upgrade from v4.5 (20 min)
│
├── 📁 setup/ ............................ Installation & configuration
│   ├── QUICK_SUPABASE_SETUP.md .......... Database only (5 min) [NEW]
│   ├── SETUP_GUIDE.md ................... Complete setup (30 min)
│   ├── GOOGLE_AUTH_SETUP.md ............ Google OAuth config (20 min)
│   └── SUPABASE_MIGRATION.md ........... Migration troubleshooting
│
├── 📁 deployment/ ....................... Production deployment
│   └── DEPLOYMENT.md .................... Deploy to Vercel/Netlify/Docker (25 min)
│
└── 📁 reference/ ........................ Technical reference
    ├── BUILD_SUMMARY.md ................ Project recap & stats (20 min)
    ├── GOOGLE_AUTH_SUMMARY.md .......... Auth technical details (15 min)
    └── DELIVERABLES.md ................ Feature & file checklist (10 min)
```

---

## 🗄️ Database & Backend (`supabase/`)

```
supabase/
├── 📁 migrations/ ........................ Database migrations
│   └── 001_create_equipment_tables.sql ... Create all tables + sample data
│       ├── equipment_types table
│       ├── equipment table
│       ├── spec_sheets table
│       ├── equipment_presets table
│       ├── Indexes (8 total)
│       ├── RLS Policies (10 total)
│       └── Sample data (8 types + 3 items)
│
└── 📁 functions/ ........................ Supabase Edge Functions
    └── analyze-spec-sheet/ ............. Gemini spec analysis
        ├── index.ts .................... Main function
        ├── Uses Gemini 2.5 Flash API
        ├── Processes PDFs/images
        ├── Extracts equipment specs
        ├── Scores confidence (0-1)
        ├── Lists missing data
        └── Updates Supabase spec_sheets
```

---

## ⚙️ Configuration Files

```
project-root/
├── vite.config.js ........................ Vite bundler
│   ├── React plugin
│   ├── Dev server: port 5173
│   └── Build: dist/ folder
│
├── tailwind.config.js .................... Tailwind CSS
│   ├── Dark theme (gray-900 base)
│   ├── Custom colors
│   ├── Animation definitions
│   └── Plugin configuration
│
├── postcss.config.js ..................... PostCSS
│   ├── Tailwind directive processing
│   ├── AutoPrefixer
│   └── CSS optimization
│
├── .env.example .......................... Environment template
│   ├── VITE_SUPABASE_URL
│   └── VITE_SUPABASE_ANON_KEY
│
├── .gitignore ............................ Git rules
│   ├── node_modules/
│   ├── .env.local (secret)
│   ├── dist/ (build)
│   └── .DS_Store
│
└── package.json .......................... Node configuration
    ├── Dependencies (React, Vite, Zustand, etc)
    ├── Scripts (dev, build, preview)
    └── Vite configuration
```

---

## 📊 Summary Statistics

| Category | Count | Files |
|----------|-------|-------|
| **React Components** | 8 | Canvas, TopBar, LeftSidebar, RightPanel, EquipmentPalette, SpecSheetUpload, EvaluationModal, CustomComponentModal |
| **Page Components** | 2 | LoginPage, AuthCallback |
| **Utility Modules** | 2 | canvas.js, canvasEvents.js |
| **Services** | 2 | supabase.js, auth.js |
| **Contexts** | 1 | AuthContext.jsx |
| **Stores** | 1 | solarStore.js |
| **Config Files** | 5 | vite.config.js, tailwind.config.js, postcss.config.js, .env.example, .gitignore |
| **Documentation** | 14 | START_HERE.txt, 12 docs, this file |
| **Database** | 2 | 1 migration, 1 Edge Function |
| **Core HTML** | 2 | index.html, solar-board.html |
| **Total New Files** | **40+** | Across React, docs, config, and database |

---

## 🔄 Data Flow

```
User Login Flow:
└─ LoginPage → Sign in with Google
   └─ AuthCallback (OAuth callback)
      └─ Supabase Auth
         └─ AuthContext (global state)
            └─ App.jsx (route protection)
               └─ SolarApp (main application)

Equipment Loading Flow:
└─ useEffect in App.jsx
   └─ solarStore (Zustand)
      └─ equipmentService.getEquipmentTypes()
         └─ Supabase query
            └─ equipment_types table
               └─ Display in LeftSidebar

Canvas Interaction Flow:
└─ Canvas component
   └─ requestAnimationFrame loop
      ├─ Event handlers (mouse, keyboard)
      ├─ solarStore (state updates)
      ├─ Canvas utilities (rendering)
      └─ Render output to screen

Spec Sheet Analysis Flow:
└─ SpecSheetUpload component
   └─ User uploads PDF/image
      └─ analyzeSpecSheet() call
         └─ Edge Function: analyze-spec-sheet
            └─ Gemini 2.5 Flash API
               └─ Extract specifications
                  └─ Update spec_sheets table
                     └─ Update equipment specs
                        └─ Display in UI
```

---

## 🚀 Build Output

After `npm run build`, creates:

```
dist/
├── index.html ........................... Minified HTML
├── assets/
│   ├── [hash].js ........................ Minified React bundle
│   ├── [hash].css ....................... Minified Tailwind styles
│   └── ... other assets
└── Configuration for deployment to Vercel, Netlify, or Docker
```

---

## 🔐 Security

Files that contain secrets (NEVER commit):
- ❌ `.env.local` (your Supabase credentials)
- ❌ Supabase Edge Function secrets (Gemini API key)

Protected by:
- ✅ `.gitignore` excludes `.env.local`
- ✅ Environment variables (Vite prefix: `VITE_`)
- ✅ Supabase RLS policies on all tables
- ✅ Row-level security enforces user isolation
- ✅ Google OAuth for authentication

---

## 📱 File Sizes

| Type | Approximate Size |
|------|------------------|
| Solar Board HTML (original) | 55 KB |
| React App Source (src/) | 45 KB |
| Documentation | 200 KB |
| node_modules (after install) | 500+ MB |
| Built app (dist/) | 150 KB |

---

## 🎯 Key Entry Points

When you `npm run dev`:
1. **index.html** → Loads main.jsx
2. **main.jsx** → Renders React with AuthProvider
3. **App.jsx** → Sets up routes and protection
4. **LoginPage** → Shows if not authenticated
5. **SolarApp** → Main canvas app (if authenticated)

---

## ✨ What's New vs Original

| Feature | Original | v5.0 |
|---------|----------|------|
| Technology | Vanilla JS | React 18 |
| State Management | In-memory | Zustand |
| Database | None | Supabase PostgreSQL |
| Equipment | Hardcoded | Cloud-backed |
| Authentication | None | Google OAuth |
| Spec Sheets | Manual | PDF/image upload + Gemini AI |
| Architecture | Single file | Modular components |
| Styling | Tailwind (inline) | Tailwind (separate) |
| Build Tool | None | Vite |

---

**For quick orientation: See `START_HERE_NOW.md` ← Start here**

**For complete setup: See `SETUP_CHECKLIST.md`**

**For file details: You're reading it!**
