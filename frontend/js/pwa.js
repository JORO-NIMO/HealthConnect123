/**
 * HealthConnect — PWA Registration & Install Prompt
 * Add this script to every HTML page before </body>
 */

// ─── Service Worker: Unregister old ones and re-register ──────────────
// Force-clear stale caches from previous deploys
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    // Unregister ALL existing service workers to clear stale caches
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      await reg.unregister();
      console.log('[PWA] Unregistered old service worker');
    }
    // Clear ALL caches
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      await caches.delete(name);
      console.log('[PWA] Deleted cache:', name);
    }
    // Re-register fresh
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      console.log('[PWA] Fresh service worker registered:', reg.scope);
    } catch (err) {
      console.warn('[PWA] Service worker registration failed:', err);
    }
  });
}

// ─── Install Banner ───────────────────────────────────────────────────
let _deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  _deferredInstallPrompt = event;

  // Don't show if already dismissed
  if (localStorage.getItem('pwa_install_dismissed')) return;

  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.innerHTML = `
    <span class="text-2xl">📱</span>
    <span>Install HealthConnect app for offline access</span>
    <button id="pwa-install-btn" class="bg-primary text-white text-xs font-bold px-4 py-2 rounded-xl ml-2">Install</button>
    <button id="pwa-dismiss-btn" style="color:var(--text3)" class="hover:text-white ml-1 text-lg">×</button>
  `;
  document.body.appendChild(banner);

  document.getElementById('pwa-install-btn').addEventListener('click', async () => {
    _deferredInstallPrompt.prompt();
    const result = await _deferredInstallPrompt.userChoice;
    if (result.outcome === 'accepted') {
      banner.remove();
    }
    _deferredInstallPrompt = null;
  });

  document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
    banner.remove();
    localStorage.setItem('pwa_install_dismissed', '1');
  });
});

window.addEventListener('appinstalled', () => {
  document.getElementById('pwa-install-banner')?.remove();
  _deferredInstallPrompt = null;
  console.log('[PWA] App installed');
});
