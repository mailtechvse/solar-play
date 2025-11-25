# Deployment Guide - Solar Architect v5.0

## Overview
This guide covers deploying the React application and Edge Functions to production.

---

## Option 1: Vercel (Recommended for React)

### Prerequisites
- Vercel account (free at vercel.com)
- GitHub account with your repo

### Step 1: Push Code to GitHub
```bash
git add .
git commit -m "Deploy Solar Architect v5.0 React Edition"
git push origin main
```

### Step 2: Import to Vercel
1. Go to https://vercel.com/new
2. Select "Import Git Repository"
3. Choose your GitHub repo
4. Click "Import"

### Step 3: Set Environment Variables
In Vercel Dashboard:
1. Go to Project Settings > Environment Variables
2. Add:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your Anon Key
3. Click "Save"

### Step 4: Deploy
1. Click "Deploy"
2. Wait for build to complete
3. Your app is live!

**Production URL**: Vercel automatically assigns a domain
- Example: `solar-architect-xyz.vercel.app`

---

## Option 2: Netlify

### Prerequisites
- Netlify account (free at netlify.com)
- GitHub repo

### Step 1: Connect Repository
1. Go to https://app.netlify.com
2. Click "New site from Git"
3. Connect GitHub
4. Select your repo

### Step 2: Configure Build
- **Build command**: `npm run build`
- **Publish directory**: `dist`

### Step 3: Set Env Variables
1. Go to Site Settings > Build & deploy > Environment
2. Add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Step 4: Deploy
Click "Deploy site" and wait for completion.

---

## Option 3: Self-Hosted (Docker)

### Create Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build
RUN npm run build

# Use simple HTTP server
RUN npm install -g serve

# Expose port
EXPOSE 3000

# Start server
CMD ["serve", "-s", "dist", "-l", "3000"]
```

### Create .dockerignore
```
node_modules
.git
.env
.env.local
```

### Build and Run
```bash
# Build image
docker build -t solar-architect .

# Run container
docker run -p 3000:3000 \
  -e VITE_SUPABASE_URL="your-url" \
  -e VITE_SUPABASE_ANON_KEY="your-key" \
  solar-architect
```

---

## Deploying Edge Functions

### Using Supabase CLI

```bash
# Ensure you're logged in
supabase login

# Set secrets (if not done)
supabase secrets set GEMINI_API_KEY="your-key"

# Deploy function
supabase functions deploy analyze-spec-sheet --no-verify

# Verify deployment
supabase functions list
```

### Verify Function Works
```bash
curl -X POST https://your-project.supabase.co/functions/v1/analyze-spec-sheet \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "spec_sheet_id": "test",
    "equipment_type": "Solar Panel",
    "file_content": "test-base64",
    "file_type": "pdf"
  }'
```

---

## Production Checklist

### Frontend Deployment
- [ ] Environment variables set
- [ ] Build completes successfully
- [ ] App loads at production URL
- [ ] Supabase connection works
- [ ] Equipment library loads

### Edge Function Deployment
- [ ] Function deployed to Supabase
- [ ] `GEMINI_API_KEY` set as secret
- [ ] Function invocation successful
- [ ] PDF/image analysis working

### Security
- [ ] `.env.local` not in git
- [ ] API keys rotated (if needed)
- [ ] RLS policies reviewed
- [ ] CORS configured (if needed)

### Monitoring
- [ ] Browser console for errors
- [ ] Supabase logs checked
- [ ] Function logs monitored
- [ ] Error tracking setup (Sentry, etc.)

---

## Post-Deployment

### 1. Test Equipment Loading
- Verify equipment types appear in sidebar
- Check equipment instances load
- Test adding objects to canvas

### 2. Test Spec Sheet Analysis
- Upload a test PDF/image
- Monitor function logs
- Verify extraction works

### 3. Test Object Operations
- Add, move, delete objects
- Edit properties
- Save/load projects

### 4. Verify Evaluation
- Click Evaluate button
- Check metrics calculate correctly
- Test Download Report

---

## Scaling Considerations

### Database
- Supabase auto-scales PostgreSQL
- Monitor connection usage
- Enable backups in settings

### Edge Functions
- Supabase handles scaling
- Monitor invocation count
- Watch Gemini API quota

### Frontend
- Vercel/Netlify handle scaling
- Enable Edge Caching
- Optimize bundle size

### Optimization
```bash
# Check bundle size
npm run build
# Look at dist/ folder size

# Analyze with Vite
npm run build -- --analyze
```

---

## CI/CD Pipeline

### GitHub Actions Example
Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - run: npm install
      - run: npm run build
      - run: npm run lint # if you add linting

      - uses: vercel/action@main
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
```

---

## Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Environment Variables Not Loading
- Check exact names match `.env.example`
- Ensure no spaces around `=`
- Restart deploy after changing

### Gemini API Fails
- Verify API key in Supabase settings
- Check function logs
- Test with curl command above

### Equipment Not Loading
- Check Supabase project URL is correct
- Verify anon key has read access
- Check RLS policies

### Canvas Rendering Issues
- Test in Chrome first (most compatible)
- Check browser console for errors
- Verify canvas size settings

---

## Rollback

### Vercel
1. Go to Deployments tab
2. Find previous working deployment
3. Click "..." > Promote to Production

### Netlify
1. Go to Deploys tab
2. Find previous working deploy
3. Click "..." > Publish deploy

### Supabase Functions
```bash
# View deployment history
supabase functions list

# Deploy previous version
supabase functions deploy analyze-spec-sheet
```

---

## Monitoring & Logs

### Supabase Function Logs
```bash
# Real-time logs
supabase functions logs analyze-spec-sheet

# With search
supabase functions logs analyze-spec-sheet --grep "error"
```

### Browser Console
```javascript
// Check Supabase connection
console.log(window.supabase)

// Check store state
console.log(useSolarStore.getState())
```

### Error Tracking (Optional)
Add Sentry for error monitoring:

```bash
npm install @sentry/react
```

```javascript
// In main.jsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: "production",
});
```

---

## Performance Optimization

### Bundle Size
```bash
npm run build
# Check dist/ folder

# Remove unused dependencies
npm prune --production
```

### Caching Headers
Vercel/Netlify automatically optimize:
- HTML: No cache
- JS/CSS: 1 year
- Images: 365 days

### Database Queries
Add pagination for large result sets:

```javascript
// In supabase.js
const { data, error } = await supabase
  .from("equipment")
  .select("*")
  .range(0, 100) // First 100 items
  .order("created_at", { ascending: false });
```

---

## Cost Estimation

### Supabase (PostgreSQL)
- Free tier: 500MB storage, plenty of queries
- Paid: $25/month for 8GB storage + more

### Gemini API
- Free tier: Limited requests
- Paid: ~$0.00075 per request (2.5 Flash)

### Hosting (Vercel/Netlify)
- Free tier: Sufficient for most cases
- Paid: $20/month for advanced features

**Total**: ~$25-50/month for production setup

---

## Questions?

See SETUP_GUIDE.md for detailed architecture information.
