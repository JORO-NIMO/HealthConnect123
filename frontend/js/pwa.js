/**
 * HealthConnect — PWA Registration & Install Prompt
 * Add this script to every HTML page before </body>
 */

// ─── Register Service Worker ──────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[PWA] Service worker registered:', reg.scope);
        // Check for updates every 30 min
        setInterval(() => reg.update(), 30 * 60 * 1000);
      })
      .catch(err => console.warn('[PWA] Service worker registration failed:', err));
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
