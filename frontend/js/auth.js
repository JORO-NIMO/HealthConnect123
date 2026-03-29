/**
 * HealthConnect — Auth Module
 * Session management: save, retrieve, clear, guard, redirect
 */

const Auth = (() => {

  // ─── Session CRUD ────────────────────────────────────────────────────

  function saveSession({ accessToken, refreshToken }, user) {
    localStorage.setItem(CONFIG.STORAGE.ACCESS_TOKEN, accessToken);
    if (refreshToken) localStorage.setItem(CONFIG.STORAGE.REFRESH_TOKEN, refreshToken);
    localStorage.setItem(CONFIG.STORAGE.USER, JSON.stringify(user));
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

    if (!user || !token) {
      window.location.href = `/pages/auth/login.html?next=${encodeURIComponent(window.location.pathname)}`;
      return null;
    }

    if (allowedRoles.length && !allowedRoles.includes(user.role)) {
      redirectToDashboard(user.role);
      return null;
    }

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
    handleOAuthCallback,
  };
})();
