# Google OAuth Setup Guide - Solar Architect v5.0

This guide walks you through setting up Google Authentication with Supabase.

---

## Overview

Solar Architect v5.0 now requires users to **login with Google** using Supabase Auth.

**Features:**
- ✅ One-click Google sign-in
- ✅ Automatic user profile from Google (name, email, avatar)
- ✅ Secure session management
- ✅ Auto logout on page close

---

## Step 1: Create Google OAuth Credentials

### 1.1 Go to Google Cloud Console
1. Visit https://console.cloud.google.com
2. Create a new project (or select existing)
3. Project name: "Solar Architect" (or your choice)

### 1.2 Enable Google+ API
1. Go to **APIs & Services > Library**
2. Search for "Google+ API"
3. Click it and press "Enable"

### 1.3 Create OAuth 2.0 Credentials
1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth 2.0 Client IDs**
3. First time? Click "Create OAuth consent screen"

### 1.4 Configure OAuth Consent Screen
1. Choose **External** (to allow any Google account)
2. Fill in required fields:
   - **App name**: Solar Architect
   - **User support email**: Your email
   - **Developer contact**: Your email
3. Click **Save and Continue**
4. Skip optional scopes (click **Save and Continue**)
5. Skip test users (click **Save and Continue**)
6. Review and click **Back to Dashboard**

### 1.5 Create OAuth Client ID
1. Go back to **Credentials**
2. Click **Create Credentials > OAuth 2.0 Client IDs**
3. Application type: **Web application**
4. Name: Solar Architect
5. **Authorized JavaScript origins** (add both):
   - `http://localhost:5173`
   - `http://localhost:3000`
6. **Authorized redirect URIs** (add both):
   - `http://localhost:5173/auth/callback`
   - `http://localhost:3000/auth/callback`
7. Click **Create**
8. Copy **Client ID** (you'll need this)

---

## Step 2: Configure Supabase

### 2.1 Go to Supabase Dashboard
1. Open your Supabase project: https://app.supabase.com
2. Go to **Authentication > Providers**

### 2.2 Enable Google OAuth
1. Click **Google**
2. Toggle **Enable Google**
3. Paste your **Client ID** from Google Cloud
4. Paste your **Client Secret** from Google Cloud (from the same credentials page)
5. Click **Save**

### 2.3 Configure Redirect URL
1. Go to **Authentication > URL Configuration**
2. Add your app URLs under **Redirect URLs**:
   ```
   http://localhost:5173/auth/callback
   http://localhost:3000/auth/callback
   https://yourdomain.com/auth/callback (production)
   ```
3. Save

---

## Step 3: Test Locally

### 3.1 Update Environment
Your `.env.local` should already have:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3.2 Install Dependencies
```bash
npm install
```

### 3.3 Start Dev Server
```bash
npm run dev
```

### 3.4 Test Login
1. Open http://localhost:5173
2. You should see the **Login Page** with "Continue with Google"
3. Click the button
4. You'll be redirected to Google login
5. After successful login, you'll be redirected back to the app

---

## Step 4: Deploy to Production

### 4.1 Update Redirect URLs in Supabase
1. Go to **Authentication > URL Configuration**
2. Add your production URL:
   ```
   https://yourdomain.com/auth/callback
   ```

### 4.2 Update Google Cloud Credentials
1. Go to Google Cloud Console > Credentials
2. Select your OAuth 2.0 Client ID
3. Add production URLs:
   - **JavaScript Origins**: `https://yourdomain.com`
   - **Redirect URIs**: `https://yourdomain.com/auth/callback`

### 4.3 Update Environment for Production
On your hosting platform (Vercel, Netlify, etc.):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4.4 Deploy
```bash
npm run build
# Deploy to your platform
```

---

## Troubleshooting

### "OAuth provider not found"
**Cause**: Google provider not enabled in Supabase
**Solution**:
1. Go to Supabase > Authentication > Providers
2. Enable Google
3. Add Client ID and Secret

### "Invalid Redirect URI"
**Cause**: Redirect URI not configured correctly
**Solution**:
1. Check exact match in Supabase **URL Configuration**
2. Check exact match in Google Cloud Console credentials
3. Common mistake: trailing slash mismatch

### "Client ID is invalid"
**Cause**: Wrong credentials
**Solution**:
1. Double-check Client ID (not Secret)
2. Ensure it's from the OAuth 2.0 credentials (not API key)
3. Regenerate if needed

### "Blank login page"
**Cause**: JavaScript error, check console
**Solution**:
1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Check Network tab for failed requests

### "Stuck on /auth/callback"
**Cause**: Session not completing
**Solution**:
1. Check browser console for errors
2. Verify Supabase URL and key are correct
3. Hard refresh (Cmd+Shift+R)

### "Can't sign in on mobile"
**Cause**: OAuth flow doesn't support all mobile browsers
**Solution**:
1. Use Chrome or Safari (not in-app browsers)
2. For in-app browsers, may need to open in external browser
3. Consider adding email/password as fallback (future enhancement)

---

## What Happens After Login

### User Profile
After Google login, the user profile includes:
- **Name**: From Google account
- **Email**: From Google account
- **Avatar**: Google profile picture
- **User ID**: Unique Supabase identifier

### Stored Data
User data is stored in Supabase `auth.users` table:
- Automatically created on first login
- Metadata from Google included
- Can be used with RLS policies

### Session Management
- Session stored in browser
- Auto-restored on page reload
- Expires after inactivity (default 1 hour)
- User can logout anytime

---

## Security Notes

### What's Protected
- ✅ API keys stored server-side (never in JavaScript)
- ✅ Google secrets stored in Supabase (encrypted)
- ✅ Sessions validated by Supabase
- ✅ RLS policies enforce data access

### What's Public
- ✅ Supabase Anon key (OK, it's public)
- ✅ User profile data (name, email, avatar)
- ✅ Equipment library (public read)

### Best Practices
1. Keep `.env` files out of git
2. Rotate secrets periodically
3. Use HTTPS in production
4. Monitor access logs
5. Enable 2FA in Google Cloud Console

---

## Advanced: Restrict to Domain

If you only want users from a specific domain:

### 1. In Google Cloud Console
1. OAuth Consent Screen > Edit App
2. Add your domain to restricted domains (if applicable)

### 2. In Supabase
Currently, Supabase doesn't natively filter by domain. To add this:

```javascript
// src/lib/auth.js - After sign in
const { data } = await supabase.auth.getUser();
const userEmail = data.user.email;

if (!userEmail.endsWith("@yourcompany.com")) {
  await supabase.auth.signOut();
  throw new Error("Only company accounts allowed");
}
```

---

## Multi-Provider Support (Future)

To add more providers later:

```javascript
// Sign in with GitHub
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: "github",
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
});

// Sign in with Microsoft
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: "azure",
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
});
```

Supported providers:
- Google
- GitHub
- Microsoft
- GitLab
- Apple
- Discord
- Twitch
- Facebook
- And more...

---

## Architecture

### Flow Diagram
```
1. User clicks "Continue with Google"
   ↓
2. Redirected to Google login
   ↓
3. User authenticates with Google
   ↓
4. Redirected to /auth/callback
   ↓
5. Supabase verifies OAuth code
   ↓
6. Session created
   ↓
7. Redirected to home page (/)
   ↓
8. App loads with authenticated user
```

### Code Organization
```
src/
├── context/AuthContext.jsx      # Auth state + provider
├── lib/auth.js                  # Auth service functions
├── pages/LoginPage.jsx          # Login UI
├── pages/AuthCallback.jsx       # OAuth callback handler
├── App.jsx                      # Route protection
└── components/TopBar.jsx        # User menu + logout
```

---

## User Data Flow

### Sign In
1. User clicks Google button
2. `authService.signInWithGoogle()` called
3. Supabase initiates OAuth flow
4. Google handles auth
5. Code returned to /auth/callback
6. `useAuth()` hook detects session
7. Component re-renders with `isAuthenticated = true`
8. User redirected to home page

### Logout
1. User clicks Logout in menu
2. `signOut()` called
3. Session cleared in Supabase
4. Context updated with `user = null`
5. App redirected to /login
6. Login page shown again

---

## Database Integration

### User Data in RLS
Equipment and projects are linked to `auth.uid()`:

```sql
-- In RLS policies
WHERE created_by = auth.uid()

-- Example: Users can only modify their equipment
CREATE POLICY "users_can_modify_own_equipment"
  ON equipment FOR UPDATE
  USING (created_by = auth.uid());
```

---

## Monitoring & Analytics

### Log User Activities
```javascript
// After login, you can log:
const user = await authService.getCurrentUser();
console.log(`User ${user.email} signed in`);

// Track usage
await supabase
  .from("activity_logs")
  .insert({
    user_id: user.id,
    action: "sign_in",
    timestamp: new Date(),
  });
```

### Check Active Sessions
```sql
-- In Supabase SQL Editor
SELECT * FROM auth.sessions
WHERE user_id = 'user-uuid'
ORDER BY created_at DESC;
```

---

## Frequently Asked Questions

### Q: Can I use email/password instead?
**A**: This build uses Google only. To add email, modify `LoginPage.jsx` and `authService.signInWithPassword()`.

### Q: How do I enforce 2FA?
**A**: Supabase Auth doesn't support 2FA with OAuth. Users can enable 2FA in their Google Account.

### Q: Can I customize the login page?
**A**: Yes! `src/pages/LoginPage.jsx` is fully customizable.

### Q: How long are sessions valid?
**A**: Default 1 hour of inactivity. Configure in Supabase > Authentication > Policies.

### Q: Can I sync user data to other tables?
**A**: Yes, use a Postgres trigger to copy auth data to a `profiles` table on first login.

---

## Support

- **Setup Issues**: Check Troubleshooting section
- **Supabase Docs**: https://supabase.com/docs/guides/auth/social-login/auth-google
- **Google OAuth**: https://developers.google.com/identity/protocols/oauth2

---

## Checklist

- [ ] Created Google Cloud project
- [ ] Enabled Google+ API
- [ ] Created OAuth 2.0 credentials
- [ ] Copied Client ID and Secret
- [ ] Configured Supabase OAuth provider
- [ ] Updated Redirect URLs
- [ ] Tested locally
- [ ] Verified user login works
- [ ] Deployed to production
- [ ] Updated production URLs

---

**Google Auth is now configured! 🔐**

Users will see the Google login page when they first visit the app.
