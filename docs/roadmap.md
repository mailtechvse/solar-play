# Solar Architect - Codebase Analysis & Roadmap

## Current Tech Stack
- **Frontend:** React 18 + Vite
- **State:** Zustand
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
- **Styling:** Tailwind CSS
- **Canvas:** HTML5 Canvas API

---

## Critical Issues

| Issue | Impact | Fix Effort |
|-------|--------|------------|
| **API keys exposed in client** | Security risk - keys visible in browser | Move to Supabase functions |
| **No error boundaries** | App crashes on render errors | Add React ErrorBoundary |
| **Missing input validation** | gridRate=0 causes division errors | Add min/max constraints |
| **aiImportMode undefined** | Referenced but never initialized in store | Initialize in solarStore.js |

---

## Performance Bottlenecks

1. **Full canvas redraw every frame (60fps)**
   - Solution: Use canvas layers (static bg, dynamic objects, UI overlay)

2. **Linear search for objects** `objects.find(o => o.id === id)`
   - Solution: Use Map/Set for O(1) lookups on 100+ objects

3. **Simulation recalculates on every change**
   - Solution: Debounce calculations (500ms delay)

4. **No undo/redo history limit**
   - Solution: Cap at 20-30 states to prevent memory bloat

---

## Code Quality Issues

### Inconsistent Naming
```
showWeatherPanel vs isLoadingWeather
capKw vs capacity_kw vs watts
isActive vs is_active
```

### Magic Numbers (should be constants)
```javascript
shadowLoss capped at 30%
efficiency hardcoded at 85%
degradation 0.5%/year
benchmark cost ₹45k/kWp
```

### Large Components Need Splitting
- `LeftSidebar.jsx` - Should be split into smaller components
- `canvasEvents.js` - 700+ lines, needs modularization

### No Tests
- Financial simulation is critical but untested
- Canvas events untested

---

## Missing Features

| Feature | Priority | Effort |
|---------|----------|--------|
| Mobile touch support | High | 2-3 days |
| PDF export for reports | Medium | 2 days |
| Cable length/loss calculations | Medium | 1-2 days |
| Temperature derating | Low | 1 day |
| Electrical safety checks (breaker sizing) | Medium | 3-4 days |
| Drag & drop from equipment list | Low | 1 day |

---

## UI/UX Improvements

1. **Scroll issues** (mentioned in CLAUDE.md as problematic)
2. **No responsive design** - breaks on tablets/mobile
3. **Modals not dismissible with Escape key**
4. **No loading states** for async operations
5. **No keyboard shortcuts help overlay**

---

## Database & Security

- **RLS is properly configured**
- **Missing rate limiting** on Supabase functions
- **No audit logging** for project changes
- **Equipment table** could use indexes on `type_id`, `is_active`

---

## Action Plan

### Week 1 (Quick Wins)
- [ ] Add input validation on financial parameters
- [ ] Initialize missing store state (`aiImportMode`)
- [ ] Add ErrorBoundary component
- [ ] Fix scroll issues in sidebars
- [ ] Add Escape key to close modals

### Week 2-3 (Performance)
- [ ] Implement canvas layers
- [ ] Debounce simulation recalculation
- [ ] Add Map for object lookups
- [ ] Cap undo/redo history at 30

### Month 1 (Quality)
- [ ] Add unit tests for `simulation.js`
- [ ] Extract constants to config file
- [ ] Split large components
- [ ] Add TypeScript (gradual migration)
- [ ] Move API keys to server-side

### Future (Nice to Have)
- [ ] 3D visualization with Three.js
- [ ] Real-time collaboration
- [ ] AI-powered design recommendations
- [ ] Integration with inverter/panel manufacturer APIs

---

## Overall Assessment

**Score: 7/10** - Good foundation, needs polish

### Strengths
- Clean Zustand state management
- Proper authentication flow
- Comprehensive financial simulation
- Good database schema with RLS

### Weaknesses
- No tests
- Performance not optimized for large designs
- Missing mobile support
- Some security concerns with exposed keys

---

## Tech Debt Estimate

| Area | Effort (hours) |
|------|----------------|
| Unit tests | 40 |
| Performance optimizations | 30 |
| Type safety (TypeScript) | 50 |
| Mobile/responsive | 25 |
| Security hardening | 20 |
| **Total** | **165 hours** |
