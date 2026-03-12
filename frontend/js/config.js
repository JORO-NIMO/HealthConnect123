/**
 * HealthConnect — App Configuration
 * Global constants and environment settings
 */

// Determine API base URL dynamically from current origin
// Works on localhost, Railway, or any deployment host
function getApiBase() {
  return `${window.location.origin}/api/v1`;
}

const CONFIG = {
  API_BASE: getApiBase(),
  APP_NAME: 'HealthConnect',
  APP_VERSION: '1.0.0',

  // Token storage keys
  STORAGE: {
    ACCESS_TOKEN:  'healthconnect_access_token',
    REFRESH_TOKEN: 'healthconnect_refresh_token',
    USER:          'healthconnect_user',
  },

  // User roles
  ROLES: {
    PATIENT:        'patient',
    DOCTOR:         'doctor',
    ADMIN:          'admin',
    HOSPITAL_ADMIN: 'hospital_admin',
  },

  // Dashboard paths per role
  DASHBOARDS: {
    patient:        '/pages/patient/dashboard.html',
    doctor:         '/pages/doctor/dashboard.html',
    admin:          '/pages/admin/dashboard.html',
    hospital_admin: '/pages/hospital/dashboard.html',
  },

  // Urgency level config
  URGENCY: {
    emergency: { label: 'Emergency',    color: '#F87171', bg: 'rgba(239,68,68,.08)',    border: 'rgba(239,68,68,.2)',    icon: '🚨', badge: 'badge b-red' },
    high:      { label: 'High',         color: '#FB923C', bg: 'rgba(251,146,60,.08)',   border: 'rgba(251,146,60,.2)',   icon: '⚠️', badge: 'badge b-gold' },
    medium:    { label: 'Medium',       color: '#FBBF24', bg: 'rgba(245,158,11,.08)',   border: 'rgba(245,158,11,.2)',   icon: '📋', badge: 'badge b-yellow' },
    low:       { label: 'Low',          color: '#34D399', bg: 'rgba(16,185,129,.08)',   border: 'rgba(16,185,129,.2)',   icon: 'ℹ️', badge: 'badge b-green' },
  },

  // Appointment status config
  APPT_STATUS: {
    pending:   { label: 'Pending',    badge: 'badge b-yellow' },
    confirmed: { label: 'Confirmed',  badge: 'badge b-cyan' },
    completed: { label: 'Completed',  badge: 'badge b-green' },
    cancelled: { label: 'Cancelled',  badge: 'badge b-red' },
    in_progress: { label: 'In Progress', badge: 'badge b-purple' },
  },

  // Pagination defaults
  DEFAULT_PAGE_SIZE: 20,

  // Socket.IO server (same origin)
  SOCKET_URL: window.location.origin,
};

// Freeze to prevent accidental mutation
Object.freeze(CONFIG);
Object.freeze(CONFIG.STORAGE);
Object.freeze(CONFIG.ROLES);
Object.freeze(CONFIG.DASHBOARDS);

// ─── Global Brand Logo Wiring ─────────────────────────────────────────
(function initGlobalBranding() {
  const LOGO_URL = '/images/logo.jpeg';

  function ensureFavicon() {
    let icon = document.querySelector('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement('link');
      icon.rel = 'icon';
      document.head.appendChild(icon);
    }
    icon.type = 'image/jpeg';
    icon.href = LOGO_URL;
  }

  function updateBrandMarks() {
    const anchors = document.querySelectorAll('a[href="/"], a[href="/index.html"]');
    anchors.forEach((a) => {
      if (!/HealthConnect/i.test(a.textContent || '')) return;

      const iconWrap = Array.from(a.children).find((el) =>
        (el.textContent || '').trim() === '🏥' && !el.querySelector('img')
      );

      if (!iconWrap) return;

      iconWrap.textContent = '';
      const img = document.createElement('img');
      img.src = LOGO_URL;
      img.alt = 'HealthConnect logo';
      img.className = 'hc-logo-img';
      iconWrap.appendChild(img);
    });
  }

  function applyBranding() {
    ensureFavicon();
    updateBrandMarks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBranding);
  } else {
    applyBranding();
  }
})();
