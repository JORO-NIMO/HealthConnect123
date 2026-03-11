/**
 * HealthConnect — API Module
 * Fetch wrapper with JWT injection, token refresh on 401, and error normalization
 */

const API = (() => {
  let _isRefreshing = false;
  let _refreshQueue = [];

  function _processQueue(error, token = null) {
    _refreshQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token));
    _refreshQueue = [];
  }

  function _getHeaders(extra = {}) {
    const token = localStorage.getItem(CONFIG.STORAGE.ACCESS_TOKEN);
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    };
  }

  async function _refreshTokens() {
    const refreshToken = localStorage.getItem(CONFIG.STORAGE.REFRESH_TOKEN);
    if (!refreshToken) throw new Error('No refresh token');

    const res = await fetch(`${CONFIG.API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) throw new Error('Refresh failed');

    let data;
    try {
      data = await res.json();
    } catch (_) {
      throw new Error('Refresh failed — invalid response');
    }
    const tokens = data?.data?.tokens || data?.data || {};

    if (!tokens.accessToken) throw new Error('Refresh failed');

    localStorage.setItem(CONFIG.STORAGE.ACCESS_TOKEN, tokens.accessToken);
    if (tokens.refreshToken) {
      localStorage.setItem(CONFIG.STORAGE.REFRESH_TOKEN, tokens.refreshToken);
    }
    return tokens.accessToken;
  }

  async function _request(method, path, body = null, options = {}) {
    const url = path.startsWith('http') ? path : `${CONFIG.API_BASE}${path}`;

    const fetchOptions = {
      method,
      headers: _getHeaders(options.headers || {}),
    };

    if (body && method !== 'GET') {
      fetchOptions.body = options.isFormData ? body : JSON.stringify(body);
      if (options.isFormData) delete fetchOptions.headers['Content-Type'];
    }

    let response = await fetch(url, fetchOptions);

    // Skip auto-refresh for public auth endpoints — 401 there means
    // bad credentials, NOT an expired session token.
    const publicAuthPaths = ['/auth/login', '/auth/register', '/auth/google', '/auth/send-otp', '/auth/verify-otp', '/auth/refresh'];
    const isPublicAuth    = publicAuthPaths.some(p => path.endsWith(p) || path.includes(p));
    const hasRefreshToken = !!localStorage.getItem(CONFIG.STORAGE.REFRESH_TOKEN);

    if (response.status === 401 && !isPublicAuth && hasRefreshToken && !options._retry) {
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _refreshQueue.push({ resolve, reject });
        }).then(token => {
          fetchOptions.headers['Authorization'] = `Bearer ${token}`;
          return fetch(url, fetchOptions).then(_parseResponse);
        });
      }

      _isRefreshing = true;

      try {
        const newToken = await _refreshTokens();
        _processQueue(null, newToken);
        fetchOptions.headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(url, fetchOptions);
      } catch (err) {
        _processQueue(err);
        // Clear session and redirect to login
        Auth.clearSession();
        window.location.href = '/pages/auth/login.html?expired=1';
        throw err;
      } finally {
        _isRefreshing = false;
      }
    }

    return _parseResponse(response);
  }

  async function _parseResponse(response) {
    let data;
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (_jsonErr) {
        // Server said JSON but body isn't valid JSON
        data = { message: `Server returned invalid JSON (HTTP ${response.status})` };
      }
    } else {
      const text = await response.text();
      // Try parsing as JSON anyway (some proxies strip content-type)
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = { message: text || `HTTP ${response.status}` };
      }
    }

    if (!response.ok) {
      const msg = (typeof data.message === 'string' && data.message.length < 500)
        ? data.message
        : `Request failed (HTTP ${response.status})`;
      const err = new Error(msg);
      err.status = response.status;
      err.errors = data.errors || null;
      err.data = data;
      throw err;
    }

    return data;
  }

  return {
    get:    (path, options = {})        => _request('GET',    path, null, options),
    post:   (path, body, options = {})  => _request('POST',   path, body, options),
    put:    (path, body, options = {})  => _request('PUT',    path, body, options),
    patch:  (path, body, options = {})  => _request('PATCH',  path, body, options),
    delete: (path, options = {})        => _request('DELETE', path, null, options),
    upload: (path, formData)            => _request('POST',   path, formData, { isFormData: true }),
  };
})();
