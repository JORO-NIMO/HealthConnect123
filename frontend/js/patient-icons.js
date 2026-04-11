/* HealthConnect patient icon enhancement: replaces patient-page emoji markers with SVG icons. */
(() => {
  if (!window.location.pathname.includes('/pages/patient/')) return;

  const ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 11.5L12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/><path d="M9 20v-5h6v5"/></svg>',
    symptoms: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l1.8 3.7L18 8.5l-3 2.9.7 4.1-3.7-2-3.7 2 .7-4.1-3-2.9 4.2-1.8L12 3z"/><path d="M17.5 16.5l.8 1.6 1.7.8-1.2 1.1.3 1.7-1.6-.9-1.6.9.3-1.7-1.2-1.1 1.7-.8.8-1.6z"/></svg>',
    vitals: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/><path d="M3 12h4l2-3 3 6 2-3h7"/></svg>',
    appointments: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M8 14h3M13 14h3M8 18h3"/></svg>',
    drugs: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 4l11 11a3.5 3.5 0 0 1-5 5L4 9a3.5 3.5 0 0 1 5-5z"/><path d="M6 14l8-8"/></svg>',
    documents: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>',
    doctors: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="5"/><path d="M21 21l-6-6"/></svg>',
    records: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3h8l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M15 3v5h5"/><path d="M9 14h6M9 17h4"/></svg>',
    history: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 4h8M9 2v4M15 2v4"/><rect x="4" y="4" width="16" height="18" rx="2"/><path d="M8 11h8M8 15h8M8 19h5"/></svg>',
    emergency: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10.3 4.6L2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0z"/><path d="M12 9v5M12 17h.01"/></svg>',
    hospitals: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 21V5a2 2 0 0 1 2-2h8v18"/><path d="M14 21V9h4a2 2 0 0 1 2 2v10"/><path d="M8 7h2M8 11h2M8 15h2M12 21v-4"/></svg>',
    tests: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 3h6"/><path d="M10 3v5l-5.5 8.7A3 3 0 0 0 7 21h10a3 3 0 0 0 2.5-4.3L14 8V3"/><path d="M8 14h8"/></svg>',
    payments: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/></svg>',
    profile: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>',
    notification: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 17H5l1.5-2V10a5.5 5.5 0 1 1 11 0v5L19 17h-4"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
    stethoscope: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3v5a3 3 0 0 0 6 0V3"/><path d="M10 11v3a5 5 0 0 0 10 0v-1"/><circle cx="20" cy="12" r="2"/><path d="M5 3h4M5 6h4M9 3h4M9 6h4"/></svg>',
    imaging: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-4 4-2-2-4 3"/></svg>'
  };

  const EMOJI_ICON_MAP = {
    '🏠': 'dashboard',
    '🤖': 'symptoms',
    '❤️': 'vitals',
    '📅': 'appointments',
    '💊': 'drugs',
    '📁': 'documents',
    '🔍': 'doctors',
    '🏥': 'hospitals',
    '📋': 'history',
    '🆘': 'emergency',
    '🧪': 'tests',
    '💳': 'payments',
    '👤': 'profile',
    '🚪': 'logout',
    '🔔': 'notification',
    '📹': 'stethoscope',
    '🩺': 'stethoscope',
    '💉': 'drugs',
    '🩻': 'imaging',
    '📝': 'documents',
    '📄': 'documents',
    '🧬': 'tests',
    '🧫': 'tests',
    '📷': 'imaging',
    '🩸': 'tests'
  };

  const EMOJI_TOKENS = Object.keys(EMOJI_ICON_MAP).sort((a, b) => b.length - a.length);

  const HREF_ICON_RULES = [
    { re: /dashboard\.html/, key: 'dashboard' },
    { re: /symptom-checker\.html/, key: 'symptoms' },
    { re: /vitals\.html/, key: 'vitals' },
    { re: /appointments\.html/, key: 'appointments' },
    { re: /drug-checker\.html/, key: 'drugs' },
    { re: /documents\.html/, key: 'documents' },
    { re: /find-doctors\.html/, key: 'doctors' },
    { re: /health-records\.html/, key: 'records' },
    { re: /medical-history\.html/, key: 'history' },
    { re: /emergency\.html/, key: 'emergency' },
    { re: /my-hospitals\.html/, key: 'hospitals' },
    { re: /test-results\.html/, key: 'tests' },
    { re: /payment\.html/, key: 'payments' }
  ];

  function iconMarkup(key, className = '') {
    const svg = ICONS[key];
    if (!svg) return '';
    return `<span class="${className}" aria-hidden="true">${svg}</span>`;
  }

  function splitLeadingEmoji(text) {
    const value = (text || '').trim();
    for (const token of EMOJI_TOKENS) {
      if (value === token) return { emoji: token, rest: '' };
      if (value.startsWith(`${token} `)) {
        return { emoji: token, rest: value.slice(token.length).trim() };
      }
    }
    return null;
  }

  function inferIconKey(el) {
    if (el.id === 'logout-btn') return 'logout';
    if (el.id === 'profile-link') return 'profile';

    const fromData = el.dataset.page;
    if (fromData && ICONS[fromData]) return fromData;

    const href = el.getAttribute('href') || '';
    if (/medical-history\.html\?tab=profile/.test(href)) return 'profile';

    const hit = HREF_ICON_RULES.find((rule) => rule.re.test(href));
    return hit ? hit.key : null;
  }

  function removeLeadingEmoji(text) {
    const parts = splitLeadingEmoji(text);
    return parts ? parts.rest : (text || '').trim();
  }

  function applyPatientSidebarIcons() {
    document.querySelectorAll('.sidebar-item').forEach((item) => {
      if (item.dataset.svgIconApplied === '1') return;

      const iconKey = inferIconKey(item);
      const svg = iconKey ? ICONS[iconKey] : null;
      if (!svg) return;

      const label = removeLeadingEmoji(item.textContent);
      item.textContent = '';

      const iconWrap = document.createElement('span');
      iconWrap.className = 'hc-nav-icon';
      iconWrap.setAttribute('aria-hidden', 'true');
      iconWrap.innerHTML = svg;

      const labelWrap = document.createElement('span');
      labelWrap.className = 'hc-nav-label';
      labelWrap.textContent = label;

      item.appendChild(iconWrap);
      item.appendChild(labelWrap);
      item.dataset.svgIconApplied = '1';
    });
  }

  function applyPatientContentIcons() {
    const candidates = document.querySelectorAll('a, button, h1, h2, h3, h4, p, div, span, label, strong');

    candidates.forEach((el) => {
      if (el.dataset.svgEmojiApplied === '1') return;
      if (el.classList.contains('sidebar-item')) return;
      if (el.closest('.sidebar-item')) return;
      if (el.closest('.hc-nav-icon, .hc-inline-icon, .hc-display-icon')) return;
      if (el.tagName === 'OPTION') return;
      if (el.children.length > 0) return;

      const raw = (el.textContent || '').trim();
      if (!raw) return;

      const parts = splitLeadingEmoji(raw);
      if (!parts) return;

      const iconKey = EMOJI_ICON_MAP[parts.emoji];
      if (!iconKey || !ICONS[iconKey]) return;

      if (!parts.rest) {
        el.innerHTML = iconMarkup(iconKey, 'hc-display-icon');
      } else {
        el.innerHTML = `${iconMarkup(iconKey, 'hc-inline-icon')}<span>${parts.rest}</span>`;
      }

      el.dataset.svgEmojiApplied = '1';
    });
  }

  function initPatientIcons() {
    applyPatientSidebarIcons();
    applyPatientContentIcons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPatientIcons);
  } else {
    initPatientIcons();
  }
})();
