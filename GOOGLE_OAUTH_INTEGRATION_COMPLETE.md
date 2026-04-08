# HealthConnect — Google OAuth 2.0 Integration ✅

## Status: **FULLY INTEGRATED**

Your Google OAuth 2.0 is now fully integrated with your existing login and register pages!

---

## What Was Integrated

### 1. **Backend** (Already Configured)
- ✅ Passport.js Google OAuth Strategy (`backend/config/passport.js`)
- ✅ Routes for OAuth flow (`backend/routes/auth.routes.js`):
  - `GET /api/v1/auth/google` — Initiates OAuth flow
  - `GET /api/v1/auth/google/callback` — Handles OAuth callback
  - `POST /api/v1/auth/google` — Fallback for frontend-based Google Sign-In
- ✅ Auth controller with Google handlers (`backend/controllers/auth.controller.js`)
- ✅ Environment variables configured (`backend/.env`):
  - `GOOGLE_CLIENT_ID=580689981142-uvrqtm24k6ooreddgfh0kq7ovs4o6k7p.apps.googleusercontent.com`
  - `GOOGLE_CLIENT_SECRET=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`
  - `GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback`

### 2. **Frontend** (Just Enhanced)
- ✅ **Login page** (`frontend/pages/auth/login.html`):
  - Integrated official Google Sign-In button
  - Added fallback button if library fails
  - Loads `https://accounts.google.com/gsi/client` script

- ✅ **Register page** (`frontend/pages/auth/register.html`):
  - Integrated official Google Sign-In button
  - Role selection preserved (patient/doctor/hospital_admin)
  - Works seamlessly with existing form

- ✅ **Auth module** (`frontend/js/auth.js`):
  - New `handleGoogleSignIn()` function processes Google JWT
  - Sends credentials to backend
  - Handles token storage and redirect

---

## How It Works

### **User Flow - Google Sign-In**

```
1. User clicks Google button on login/register page
   ↓
2. Google Sign-In dialog opens (official Google UI)
   ↓
3. User authenticates with Google
   ↓
4. Frontend receives JWT credential from Google
   ↓
5. Frontend decodes JWT to extract:
   - Google ID (sub)
   - Email
   - Name (first & last)
   - Avatar URL
   ↓
6. Frontend sends to: POST /api/v1/auth/google
   ↓
7. Backend validates Google ID & creates/links user
   ↓
8. Backend generates JWT tokens and saves refresh token
   ↓
9. Backend returns tokens + user data
   ↓
10. Frontend stores tokens in localStorage
    ↓
11. Frontend redirects to appropriate dashboard
```

### **User Flow - OAuth Redirect (Alternative)**

```
1. User clicks Google button
   ↓
2. Frontend redirects to: GET /api/v1/auth/google
   ↓
3. Passport.js initiates Google OAuth flow
   ↓
4. User authenticates at Google
   ↓
5. Google redirects to: /api/v1/auth/google/callback
   ↓
6. Passport verifies, creates/links user
   ↓
7. Backend generates tokens
   ↓
8. Backend redirects to frontend with tokens in URL:
   /pages/dashboards/patient.html?accessToken=...&user=...
   ↓
9. Frontend extracts tokens from URL and stores them
   ↓
10. Frontend redirects to appropriate dashboard
```

---

## Testing Google OAuth

### **Prerequisites**
1. Google OAuth credentials configured in `.env` ✅
2. Backend running: `cd backend && npm start`
3. Frontend served (use `npm start` in frontend folder or via Railway)

### **Test Login with Google**

```bash
# 1. Start backend
cd backend
npm start

# 2. Open browser to frontend
http://localhost:3000/pages/auth/login.html
# or Railway: https://your-railway-url/pages/auth/login.html

# 3. Click "Continue with Google" button

# 4. Expected flow:
# - Google Sign-In dialog appears
# - OR redirects to Google OAuth consent
# - After auth, redirected to patient dashboard
# - Tokens saved in localStorage
```

### **Test Register with Google**

```bash
# 1. Open register page
http://localhost:3000/pages/auth/register.html

# 2. Select role (Patient, Doctor, or Hospital)

# 3. Click "Continue with Google"

# 4. Expected: Same as login
#    - With Google account linked to new/existing user
#    - Redirects to dashboard for selected role
```

---

## Key Features Implemented

### **1. Google Sign-In Button (Official)**
- Uses official Google Sign-In library
- Customizable UI (standard size, dark theme)
- Shows `signin_with` or `signup_with` text

### **2. Fallback Button**
- If Google library fails to load, fallback button appears
- Uses traditional OAuth redirect flow
- Same end result

### **3. User Linking**
- If Google email matches existing HealthConnect account:
  - Account is linked with Google ID
  - User keeps their existing data (role, profile, etc.)
- If new email:
  - New account created as "patient"
  - Google ID stored for future logins

### **4. Role Preservation (Register)**
- User selects role before Google sign-up
- After Google authentication:
  - Patient: Immediate access to dashboard
  - Doctor: Pending verification
  - Hospital Admin: Pending verification

### **5. Token Management**
- Tokens stored in localStorage
- Refresh token saved server-side (7-day expiry)
- OTP backup for phone login still available

---

## API Endpoints

### **POST /api/v1/auth/google**
Frontend-initiated Google Sign-In endpoint

**Request:**
```json
{
  "googleId": "103048..."      // Google user ID (sub)
  "email": "user@gmail.com",
  "firstName": "John",
  "lastName": "Doe",
  "avatarUrl": "https://lh3.googleusercontent.com/..." // optional
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Google authentication successful.",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@gmail.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "patient"
    },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc..."
    }
  }
}
```

### **GET /api/v1/auth/google**
Initiates Passport.js OAuth flow

**Redirects to:** Google OAuth consent screen

### **GET /api/v1/auth/google/callback**
OAuth callback from Google (Passport-handled)

**Redirects to:** Frontend dashboard with tokens in URL params

---

## Environment Variables (Already Set)

```env
# Google OAuth 2.0
GOOGLE_CLIENT_ID=580689981142-uvrqtm24k6ooreddgfh0kq7ovs4o6k7p.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback

# Note: Frontend uses same Client ID (hardcoded in login.html & register.html)
# In production, consider fetching from backend for better security
```

---

## Production Checklist

- [ ] Update `GOOGLE_CALLBACK_URL` in `.env` for production domain:
  ```
  GOOGLE_CALLBACK_URL=https://yourdomain.com/api/v1/auth/google/callback
  ```

- [ ] Update Google Cloud Console OAuth credentials:
  - Add authorized redirect URI:
    ```
    https://yourdomain.com/api/v1/auth/google/callback
    ```
  - Add authorized JavaScript origins:
    ```
    https://yourdomain.com
    ```

- [ ] Update frontend (login.html, register.html, config.js):
  - For security: Serve Google Client ID from backend instead of hardcoding
  - OR fetch via: `GET /api/v1/config/google-client-id`

- [ ] Test full flow on production domain

- [ ] Monitor logs: `tail -f backend/logs/*.log`

---

## Troubleshooting

### **"Google button not loading"**
- Check browser console for CSP errors
- Ensure `https://accounts.google.com` is not blocked
- Test fallback button still works

### **"404 on /api/v1/auth/google"**
- Backend not running
- Check routes in `backend/routes/auth.routes.js`
- Verify API_BASE in frontend config

### **"Google sign-in failed"**
- Check `.env` credentials are correct
- Verify Google Cloud project has Google+ API enabled
- Check email permission is requested

### **"User already exists"**
- Existing email linked to another Google account
- User must use original registration method first

### **Tokens not saving**
- Check localStorage is not full or blocked
- Verify `CONFIG.STORAGE` keys in `frontend/js/config.js`
- Check browser console for errors

---

## Files Modified

```
✅ frontend/pages/auth/login.html
   - Added Google Sign-In script
   - Replaced Google button with official button
   - Updated event handlers

✅ frontend/pages/auth/register.html
   - Added Google Sign-In script
   - Replaced Google button with official button
   - Updated event handlers

✅ frontend/js/auth.js
   - Added handleGoogleSignIn() function
   - Integrated with existing Auth module
   - Handles JWT decoding and backend communication
```

## Files Already Configured

```
✅ backend/.env
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - GOOGLE_CALLBACK_URL

✅ backend/config/passport.js
   - Google OAuth Strategy

✅ backend/routes/auth.routes.js
   - /auth/google routes

✅ backend/controllers/auth.controller.js
   - googleCallback()
   - handleGoogleCallback()

✅ frontend/js/config.js
   - API_BASE, STORAGE, DASHBOARDS, etc.
```

---

## Next Steps

1. **Start Backend:** `cd backend && npm start`
2. **Test OAuth:** Visit login/register pages and click Google button
3. **Verify Tokens:** Check browser DevTools > Application > LocalStorage
4. **Check Logs:** Monitor backend for OAuth flow
5. **Deploy:** Update production credentials in Google Cloud Console

---

## Support

- 📖 Google Sign-In docs: https://developers.google.com/identity/gsi/web
- 🔐 Passport Google Strategy: http://www.passportjs.org/packages/passport-google-oauth20/
- 🛠️ HealthConnect Backend: See `backend/README_TECHNICAL.md`

**Integration Complete!** 🎉
