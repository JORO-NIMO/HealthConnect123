/**
 * HealthConnect — Auth Module
 * Session management: save, retrieve, clear, guard, redirect
 */

const Auth = (() => {

  // ─── Session CRUD ────────────────────────────────────────────────────

  function saveSession({ accessToken, refreshToken }, user) {
    console.log('💾 Saving tokens to localStorage:', { accessToken: accessToken?.substring(0, 20) + '...', refreshToken: refreshToken?.substring(0, 20) + '...', user });
    localStorage.setItem(CONFIG.STORAGE.ACCESS_TOKEN, accessToken);
    if (refreshToken) localStorage.setItem(CONFIG.STORAGE.REFRESH_TOKEN, refreshToken);
    localStorage.setItem(CONFIG.STORAGE.USER, JSON.stringify(user));
    console.log('✅ Session saved. Tokens in storage:', {
      accessToken: !!localStorage.getItem(CONFIG.STORAGE.ACCESS_TOKEN),
      refreshToken: !!localStorage.getItem(CONFIG.STORAGE.REFRESH_TOKEN),
      user: !!localStorage.getItem(CONFIG.STORAGE.USER),
    });
  }

  function clearSession() {
    localStorage.removeItem(CONFIG.STORAGE.ACCESS_TOKEN);
    localStorage.removeItem(CONFIG.STORAGE.REFRESH_TOKEN);
    localStorage.removeItem(CONFIG.STORAGE.USER);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.STORAGE.USER)) || null;
    } catch {
      return null;
    }
  }

  function saveUser(user) {
    localStorage.setItem(CONFIG.STORAGE.USER, JSON.stringify(user));
  }

  function getToken() {
    return localStorage.getItem(CONFIG.STORAGE.ACCESS_TOKEN);
  }

  function isLoggedIn() {
    return !!(getToken() && getUser());
  }

  // ─── Redirect Helpers ────────────────────────────────────────────────

  function redirectToDashboard(role) {
    const path = CONFIG.DASHBOARDS[role] || CONFIG.DASHBOARDS.patient;
    window.location.href = path;
  }

  // ─── Route Guards ────────────────────────────────────────────────────

  /**
   * Call this at the top of every protected page.
   * If not logged in → redirect to login.
   * If wrong role → redirect to own dashboard.
   * Returns the user object if authorised.
   */
  function requireRole(...allowedRoles) {
    const user = getUser();
    const token = getToken();

    console.log('🔐 Auth check:', {
      hasToken: !!token,
      hasUser: !!user,
      token: token?.substring(0, 20) + '...',
      user,
      allowedRoles,
    });

    if (!user || !token) {
      console.warn('❌ No user or token found, redirecting to login');
      window.location.href = `/pages/auth/login.html?next=${encodeURIComponent(window.location.pathname)}`;
      return null;
    }

    if (allowedRoles.length && !allowedRoles.includes(user.role)) {
      console.warn(`❌ User role "${user.role}" not in allowed roles:`, allowedRoles);
      redirectToDashboard(user.role);
      return null;
    }

    console.log('✅ Auth check passed for user:', user);
    return user;
  }

  /**
   * Call on auth pages (login/register).
   * If already logged in → redirect to dashboard immediately.
   */
  function redirectIfLoggedIn() {
    if (isLoggedIn()) {
      const user = getUser();
      redirectToDashboard(user.role);
    }
  }

  // ─── Logout ──────────────────────────────────────────────────────────

  async function logout() {
    try {
      const refreshToken = localStorage.getItem(CONFIG.STORAGE.REFRESH_TOKEN);
      if (refreshToken) {
        await API.post('/auth/logout', { refreshToken }).catch(() => {});
      }
    } finally {
      clearSession();
      window.location.href = '/';
    }
  }

  // ─── Google OAuth ────────────────────────────────────────────────────

  function loginWithGoogle() {
    window.location.href = `${CONFIG.API_BASE}/auth/google`;
  }

  /**
   * Handle Google Sign-In response (from official Google Sign-In library)
   * Decodes JWT and sends to backend for validation
   */
  async function handleGoogleSignIn(decoded) {
    try {
      const loadingMsg = document.getElementById('alert');
      if (loadingMsg) {
        loadingMsg.className = 'mb-4 p-4 rounded-xl text-sm font-medium';
        loadingMsg.style.background = 'rgba(34, 211, 238, 0.1)';
        loadingMsg.style.color = 'var(--cyan)';
        loadingMsg.textContent = '🔄 Processing Google sign in...';
        loadingMsg.classList.remove('hidden');
      }

      console.log('🔐 Google decoded JWT:', decoded);

      // Extract user info from Google JWT
      const email = decoded.email;
      const firstName = decoded.given_name || (decoded.name?.split(' ')[0]) || 'User';
      const lastName = decoded.family_name || (decoded.name?.split(' ').slice(1).join(' ')) || '';
      const googleId = decoded.sub;
      const avatarUrl = decoded.picture;

      console.log('📤 Sending to backend:', { googleId, email, firstName, lastName });

      // Send to backend for token generation
      const response = await API.post('/auth/google', {
        googleId,
        email,
        firstName,
        lastName,
        avatarUrl,
      });

      console.log('📥 Backend response:', response);

      // Response structure: { success, message, data: { user, tokens } }
      const userData = response.data?.user || response.user;
      const tokens = response.data?.tokens || response.tokens;

      if (tokens && userData) {
        console.log('✅ Tokens received:', tokens);
        saveSession(tokens, userData);
        if (loadingMsg) {
          loadingMsg.className = 'mb-4 p-4 rounded-xl text-sm font-medium';
          loadingMsg.style.background = 'rgba(16, 185, 129, 0.1)';
          loadingMsg.style.color = 'var(--green)';
          loadingMsg.textContent = '✅ Sign in successful! Redirecting...';
        }
        setTimeout(() => {
          console.log('🔄 Redirecting to:', userData.role || 'patient');
          redirectToDashboard(userData.role || 'patient');
        }, 1000);
      } else {
        throw new Error(response.message || response.data?.message || 'No tokens received from server');
      }
    } catch (err) {
      console.error('❌ Google Sign-In error:', err);
      const alertEl = document.getElementById('alert');
      if (alertEl) {
        alertEl.className = 'mb-4 p-4 rounded-xl text-sm font-medium';
        alertEl.style.background = 'rgba(239, 68, 68, 0.1)';
        alertEl.style.color = '#EF4444';
        alertEl.textContent = `❌ Error: ${err.message || 'Google sign in failed. Please try again.'}`;
        alertEl.classList.remove('hidden');
        console.error('Full error:', err);
      }
    }
  }

  // ─── Handle OAuth Callback (token in URL hash/query) ─────────────────

  function handleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const accessToken  = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const userStr      = params.get('user');

    if (accessToken && userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr));
        saveSession({ accessToken, refreshToken }, user);
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  return {
    saveSession,
    clearSession,
    getUser,
    saveUser,
    getToken,
    isLoggedIn,
    redirectToDashboard,
    requireRole,
    redirectIfLoggedIn,
    logout,
    loginWithGoogle,
    handleGoogleSignIn,
    handleOAuthCallback,
  };
})();
