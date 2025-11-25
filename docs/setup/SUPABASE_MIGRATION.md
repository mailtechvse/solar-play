# 🚀 Supabase Migration Setup Guide

If you're having issues pushing migrations to Supabase, follow this complete guide.

---

## Option 1: Using Supabase Dashboard (Easiest - No CLI)

### **Step 1: Go to Supabase Dashboard**
1. Open: https://app.supabase.com
2. Select your project
3. Go to **SQL Editor**

### **Step 2: Create New Query**
1. Click **New Query** button
2. Copy entire SQL from: `supabase/migrations/001_create_equipment_tables.sql`
3. Paste into the SQL editor
4. Click **Run** button

### **Step 3: Verify**
- Check for green checkmarks
- No error messages should appear
- Check in **Table Editor** to see new tables

**That's it!** Database is now set up. ✅

---

## Option 2: Using Supabase CLI

### **Step 1: Install Supabase CLI**

```bash
# Option A: Using npm (recommended)
npm install -g supabase

# Option B: Using Homebrew (Mac)
brew install supabase/tap/supabase

# Option C: Using Chocolatey (Windows)
choco install supabase
```

### **Step 2: Login to Supabase**

```bash
supabase login
```

This will:
1. Open browser to Supabase
2. Ask for your access token
3. Get from: https://app.supabase.com/account/tokens
4. Copy your **Personal Access Token**
5. Paste in terminal

### **Step 3: Link Project**

```bash
# List your projects
supabase projects list

# Link to your project (use your project ID)
supabase link --project-id your-project-id
```

Get `project-id` from:
1. Supabase Dashboard
2. Project Settings > General
3. Copy **Project ID**

### **Step 4: Push Migration**

```bash
supabase db push
```

This will:
1. Check for migrations in `supabase/migrations/`
2. Push them to your Supabase database
3. Show status messages

### **Step 5: Verify**

```bash
# Check status
supabase status

# See migrations applied
supabase db remote commit
```

---

## Troubleshooting

### **"Command not found: supabase"**

**Solution:**
```bash
# Verify installation
npm list -g supabase

# If not installed:
npm install -g supabase

# Or use Homebrew:
brew install supabase/tap/supabase
```

### **"Not logged in"**

**Solution:**
```bash
# Login again
supabase login

# Get token from: https://app.supabase.com/account/tokens
# Paste when prompted
```

### **"Project not linked"**

**Solution:**
```bash
# Get your project ID from Supabase Dashboard
supabase link --project-id your-project-id

# Verify:
supabase status
```

### **"Migration already applied"**

**Solution:**
This is normal if you already ran the migration via Dashboard.
No action needed - database is ready!

### **"Permission denied"**

**Solution:**
```bash
# Fix permissions
chmod +x ~/.supabase
npm install -g supabase
```

### **"Network error"**

**Solution:**
1. Check internet connection
2. Check Supabase status: https://status.supabase.com
3. Try again in 5 minutes

---

## Manual SQL Setup (If All Else Fails)

If you can't use CLI or Dashboard, set up manually:

### **Step 1: Get SQL File**
Path: `/supabase/migrations/001_create_equipment_tables.sql`

### **Step 2: Open Supabase SQL Editor**
1. Go to: https://app.supabase.com
2. Select project
3. Go to **SQL Editor**

### **Step 3: Paste & Run**
1. Click **New Query**
2. Copy-paste entire migration SQL
3. Click **Run**

### **Step 4: Verify Tables Created**
1. Go to **Table Editor**
2. You should see:
   - `equipment_types`
   - `equipment`
   - `spec_sheets`
   - `equipment_presets`

---

## Verify Migration Success

### **Via Dashboard**
1. Go to **Table Editor**
2. Check these tables exist:
   - ✅ equipment_types (with sample data)
   - ✅ equipment (with sample data)
   - ✅ spec_sheets
   - ✅ equipment_presets

### **Via CLI**
```bash
# Show all tables
supabase db list tables

# Show migrations
supabase db migrations list
```

### **Via SQL**
```sql
-- Run in SQL Editor
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
```

Should show:
- equipment_types
- equipment
- spec_sheets
- equipment_presets

---

## Quick Commands Reference

```bash
# Install CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-id your-project-id

# Push migrations
supabase db push

# Check status
supabase status

# Pull migrations from database
supabase db pull

# List migrations
supabase db migrations list

# See local migrations
ls supabase/migrations/

# Get help
supabase --help
supabase db --help
```

---

## Recommended Workflow

### **For Development**

1. **First time setup:**
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-id your-project-id
   supabase db push
   ```

2. **After each migration:**
   ```bash
   supabase db push
   ```

3. **Check status:**
   ```bash
   supabase status
   ```

### **For Deployment**

1. **Push to production:**
   ```bash
   supabase link --project-id production-project-id
   supabase db push
   ```

2. **Verify:**
   ```bash
   supabase status
   ```

---

## After Migration: Next Steps

Once migration is complete:

1. **Verify in Supabase Dashboard:**
   - Go to Table Editor
   - See all 4 tables created
   - See sample data inserted

2. **Configure Google OAuth:**
   - Go to Authentication > Providers
   - Enable Google
   - Add credentials

3. **Run application:**
   ```bash
   npm install
   npm run dev
   ```

4. **Test:**
   - Should see login page
   - Click Google button
   - If redirects to Google, OAuth is working!

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| CLI not found | `npm install -g supabase` |
| Not logged in | `supabase login` |
| Project not linked | `supabase link --project-id your-id` |
| Migration failed | Check error, fix SQL, try again |
| Permission denied | Check Supabase credentials |
| Network error | Check internet, try again |
| Tables not created | Verify migration ran (SQL Editor) |

---

## Getting Help

### **Official Resources**
- Supabase Docs: https://supabase.com/docs
- CLI Docs: https://supabase.com/docs/guides/cli
- GitHub Issues: https://github.com/supabase/supabase/issues

### **In This Project**
- **Full setup guide**: `docs/setup/SETUP_GUIDE.md`
- **Quick start**: `docs/guides/QUICK_START.md`
- **OAuth setup**: `docs/setup/GOOGLE_AUTH_SETUP.md`

---

## Summary

✅ **Easiest**: Use Supabase Dashboard (copy-paste SQL)
✅ **Recommended**: Use Supabase CLI (after first login)
✅ **Fallback**: Manual SQL in Dashboard

Pick one method and follow the steps above. Database will be ready in 5 minutes!

---

**Next**: Once migration is complete, go to `docs/guides/QUICK_START.md` to continue setup.
