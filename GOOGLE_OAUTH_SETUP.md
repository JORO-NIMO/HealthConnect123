# Google OAuth 2.0 Setup Guide for HealthConnect

## Overview
This guide helps you set up Google OAuth 2.0 authentication for HealthConnect, allowing users to sign in with their Google accounts.

---

## Step 1: Create a Google Cloud Project

### 1.1 Go to Google Cloud Console
- Visit: https://console.cloud.google.com/
- Sign in with your Google account
- Click on the project dropdown at the top

### 1.2 Create a New Project
- Click **"New Project"**
- Enter project name: **"HealthConnect"** (or your choice)
- Click **"Create"**
- Wait for it to be created (may take a minute)

### 1.3 Enable Google+ API
- In the **Search bar**, search for **"Google+ API"**
- Click on **"Google+ API"** from results
- Click **"Enable"** button
- Wait for it to enable

---

## Step 2: Create OAuth 2.0 Credentials

### 2.1 Go to Credentials Page
- In the **left sidebar**, click **"Credentials"**
- Click **"+ CREATE CREDENTIALS"** at the top
- Select **"OAuth client ID"**

### 2.2 Configure OAuth Consent Screen
If prompted to configure the OAuth consent screen:
1. Click **"Configure Consent Screen"**
2. Select **"External"** user type
3. Click **"Create"**
4. Fill in the form:
   - **App name:** HealthConnect
   - **User support email:** your-email@gmail.com
   - **Developer contact:** your-email@gmail.com
5. Click **"Save and Continue"** (skip optional fields)
6. Click **"Save and Continue"** again (for scopes)
7. Click **"Save and Continue"** (for test users)
8. Click **"Back to Dashboard"**

### 2.3 Create OAuth Client ID
1. Click **"+ CREATE CREDENTIALS"** again
2. Select **"OAuth client ID"**
3. Choose **"Web application"**
4. Enter name: **"HealthConnect Backend"**
5. Under **"Authorized redirect URIs"**, add:
   ```
   http://localhost:5000/api/v1/auth/google/callback
   http://localhost:3000/pages/dashboards/patient.html
   ```
   (Add production URLs later when deployed)
6. Click **"Create"**

### 2.4 Copy Your Credentials
- In the popup, you'll see:
  - **Client ID** (looks like: `123456789-abc...@apps.googleusercontent.com`)
  - **Client Secret** (looks like: `GOCSPX-abc...`)
- **SAVE THESE** - you'll need them in the next step

---

## Step 3: Configure Backend Environment Variables

### 3.1 Update .env File
Edit `backend/.env` and add/update these lines:

```env
# ─── Google OAuth 2.0 ─────────────────────────────────────────────────
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback

# For production, also set FRONTEND_URL:
FRONTEND_URL=https://yourdomain.com
```

**Replace:**
- `YOUR_CLIENT_ID_HERE` → paste your Client ID from Step 2.4
- `YOUR_CLIENT_SECRET_HERE` → paste your Client Secret from Step 2.4

### 3.2 Restart Server
```bash
cd backend
npm start
```

You should see:
```
✅ Google OAuth Strategy configured
```

If you see a warning, double-check your credentials in .env.

---

## Step 4: Add Google Login Button to Frontend

### 4.1 Update Login Page
Edit `frontend/pages/auth/login.html` and add a Google login button:

```html
<!-- Add this in your login form -->
<button type="button" onclick="Auth.loginWithGoogle()" class="btn btn-google">
  <img src="/images/google-logo.png" alt="Google"> Sign in with Google
</button>
```

Or use a simpler version:
```html
<button type="button" onclick="Auth.loginWithGoogle()" class="btn btn-primary">
  🔵 Login with Google
</button>
```

---

## Step 5: Test Google OAuth

### 5.1 Local Testing
1. Open http://localhost:3000 (or your frontend URL)
2. Go to **login page**
3. Click **"Login with Google"**
4. Sign in with your Google account
5. You should be redirected to your dashboard

### 5.2 Troubleshooting

**Error: "The redirect URI in the request doesn't match the registered callback URIs"**
- ✅ Check that `GOOGLE_CALLBACK_URL` matches exactly in Google Cloud Console
- ✅ Make sure Backend server is running on port 5000

**Error: "Invalid Client ID or Secret"**
- ✅ Double-check your credentials in `.env`
- ✅ Restart the backend server after changing `.env`

**Google login button doesn't redirect**
- ✅ Check browser console for errors (Press F12)
- ✅ Verify `FRONTEND_URL` is set correctly

---

## Step 6: Production Deployment

### 6.1 Update Google Cloud Console
1. Go to https://console.cloud.google.com/
2. Click **"Credentials"** in left sidebar
3. Click your OAuth app
4. Add your production URLs under **"Authorized redirect URIs"**:
   ```
   https://yourdomain.com/api/v1/auth/google/callback
   https://yourdomain.com/pages/dashboards/patient.html
   ```

### 6.2 Update Backend .env
```env
GOOGLE_CLIENT_ID=YOUR_PRODUCTION_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_PRODUCTION_CLIENT_SECRET
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/v1/auth/google/callback
FRONTEND_URL=https://yourdomain.com
```

### 6.3 Deploy & Test
1. Deploy your backend to production
2. Test Google login at https://yourdomain.com
3. Verify users are created in database

---

## How It Works (Technical Overview)

### Authentication Flow:

```
1. User clicks "Login with Google" button
   ↓
2. Frontend calls Auth.loginWithGoogle()
   ↓
3. Browser redirected to: /api/v1/auth/google
   ↓
4. Passport.js initiates Google OAuth flow
   ↓
5. User logs in with their Google account
   ↓
6. Google redirects to: /api/v1/auth/google/callback
   ↓
7. Passport verifies credentials with Google
   ↓
8. Backend creates/updates user in database
   ↓
9. Backend generates JWT tokens
   ↓
10. Backend redirects to frontend with tokens in URL:
    /pages/dashboards/patient.html?accessToken=...&refreshToken=...
   ↓
11. Frontend's Auth.handleOAuthCallback() extracts tokens
   ↓
12. User is logged in!
```

### Database Integration:

When a user logs in with Google:
- If Google ID exists → user logged in
- If email exists → Google ID linked to existing account
- If new user → account created as "patient" role

---

## Security Notes

⚠️ **Important Security Practices:**

1. **Never commit secrets** - Add to `.env` and add `.env` to `.gitignore`
2. **Use HTTPS in production** - OAuth only works over HTTPS
3. **Validate redirect URIs** - Both in code and Google Console
4. **Rotate secrets regularly** - Change Client Secret monthly
5. **Monitor unauthorized logins** - Log all OAuth attempts

---

## FAQ

### Q: Can I use the same credentials for development and production?
**A:** No. Create separate projects for development and production in Google Cloud Console.

### Q: How do I log out?
**A:** Users are logged out when they clear their browser storage or click logout. JWT tokens expire after 24 hours.

### Q: Can doctors/hospital admins use Google OAuth?
**A:** Currently, Google OAuth creates accounts as "patient" role. Modify `backend/config/passport.js` to allow role selection if needed.

### Q: What if a user has both email/password and Google account?
**A:** The Google ID is linked to the existing account. First email match wins.

---

## Support

For issues:
1. Check Google Cloud Console credentials are correct
2. Check backend `.env` variables
3. Check browser console (F12) for errors
4. Check server logs for OAuth errors
5. Verify CORS settings allow your domain

---

**Backend OAuth Routes:**
- `GET /api/v1/auth/google` - Initiate Google login
- `GET /api/v1/auth/google/callback` - OAuth callback from Google
- `POST /api/v1/auth/google` - Alternative endpoint (frontend-initiated)

**Frontend OAuth Function:**
- `Auth.loginWithGoogle()` - Click handler to start login
- `Auth.handleOAuthCallback()` - Processes OAuth response

---

Created: April 8, 2026  
Status: Ready for Configuration
