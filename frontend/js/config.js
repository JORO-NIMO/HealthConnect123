/**
 * HealthConnect — App Configuration
 * Global constants and environment settings
 */

// Determine API base URL - supports port forwarding and direct IP access
function getApiBase() {
  // If running on localhost, use same origin
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `${window.location.protocol}//${window.location.host}/api/v1`;
  }
  // For remote access (port forwarding, IP address, etc), construct full URL
  return `${window.location.protocol}//${window.location.host}/api/v1`;
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
