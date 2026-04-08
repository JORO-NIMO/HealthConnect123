/**
 * HealthConnect — Service Worker
 * Cache-first for static assets, network-first for API calls
 * Optimised for low-bandwidth African networks
 */

const CACHE_VERSION = 'v3.0.3';
const STATIC_CACHE  = `healthconnect-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `healthconnect-dynamic-${CACHE_VERSION}`;

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/config.js',
  '/js/api.js',
  '/js/utils.js',
  '/js/auth.js',
  '/js/auth-pages.js',
  '/js/dashboard.js',
  '/js/symptom-checker.js',
  '/js/appointments.js',
  '/js/medical-history.js',
  '/js/doctor-dashboard.js',
  '/js/schedule.js',
  '/js/consultation.js',
  '/js/admin.js',
  '/pages/auth/login.html',
  '/pages/auth/register.html',
  '/pages/patient/dashboard.html',
  '/pages/patient/symptom-checker.html',
  '/pages/patient/appointments.html',
  '/pages/patient/medical-history.html',
  '/pages/doctor/dashboard.html',
  '/pages/doctor/schedule.html',
  '/pages/doctor/consultation.html',
  '/pages/admin/dashboard.html',
  '/manifest.json',
  '/images/logo.jpeg',
  '/favicon.ico',
  // Tailwind from CDN will be cached dynamically on first load
];

// API routes that should never be served from cache
const NETWORK_ONLY = [
  '/api/v1/auth/',
  '/api/v1/symptoms/analyze',
  '/api/v1/consultations/',
];

// ─── Install ──────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Pre-cache failed (some assets may not exist yet):', err))
  );
});

// ─── Activate ─────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch Strategy ───────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin (Socket.IO etc.)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // ALL API calls must be network-only — never serve cached API data
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ success: false, message: 'You are offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // Network-first for HTML, JS, CSS — so code updates are always picked up
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname === '/') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first only for images, fonts, and other truly static assets
  event.respondWith(cacheFirst(request));
});

// ─── Strategies ───────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return offline page if available
    return caches.match('/index.html');
  }
}

async function networkFirst(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ success: false, message: 'You are offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ─── Background Sync (appointment reminders) ─────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-appointments') {
    event.waitUntil(syncAppointments());
  }
});

async function syncAppointments() {
  // Placeholder: extend with IndexedDB queue for offline-first booking
  console.log('[SW] Background sync: appointments');
}

// ─── Push Notifications ───────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'HealthConnect', {
      body:  data.body  || 'You have a new notification',
      icon:  data.icon  || '/images/logo.jpeg',
      badge: data.badge || '/images/logo.jpeg',
      data:  data.url   || '/',
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const url = event.notification.data || '/';
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
