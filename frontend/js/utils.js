/**
 * HealthConnect — Utility Functions
 */

const Utils = (() => {

  // ─── Date & Time ────────────────────────────────────────────────────

  function formatDate(dateStr, opts = {}) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', ...opts,
    });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return '—';
    return d.toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function formatTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return '—';
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (seconds < 60)  return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function todayISO() {
    return new Date().toISOString().split('T')[0];
  }

  // ─── Currency ────────────────────────────────────────────────────────

  function formatCurrency(amount, currency = 'USD') {
    if (amount == null) return '—';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency, minimumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency} ${Number(amount).toFixed(2)}`;
    }
  }

  // ─── String Helpers ──────────────────────────────────────────────────

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  function initials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  function truncate(str, max = 80) {
    if (!str) return '';
    return str.length > max ? str.slice(0, max) + '…' : str;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ─── UI Helpers ──────────────────────────────────────────────────────

  function showAlert(elId, message, type = 'error') {
    const el = document.getElementById(elId);
    if (!el) return;
    const styles = {
      error:   { bg:'rgba(239,68,68,.08)', color:'#F87171', border:'rgba(239,68,68,.2)' },
      success: { bg:'rgba(16,185,129,.08)', color:'#34D399', border:'rgba(16,185,129,.2)' },
      info:    { bg:'rgba(34,211,238,.08)', color:'#22D3EE', border:'rgba(34,211,238,.2)' },
      warning: { bg:'rgba(245,158,11,.08)', color:'#FBBF24', border:'rgba(245,158,11,.2)' },
    };
    const s = styles[type] || styles.info;
    el.className = 'p-3 rounded-xl text-sm font-medium';
    el.style.background = s.bg;
    el.style.color = s.color;
    el.style.border = '1px solid ' + s.border;
    el.textContent = message;
    el.classList.remove('hidden');
  }

  function hideAlert(elId) {
    const el = document.getElementById(elId);
    if (el) el.classList.add('hidden');
  }

  let _toastTimer = null;
  function toast(message, type = 'info', duration = 3500) {
    let el = document.getElementById('healthconnect-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'healthconnect-toast';
      el.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold transition-all duration-300 opacity-0 pointer-events-none';
      document.body.appendChild(el);
    }
    const colors = {
      success: { bg:'#10B981', color:'#fff' },
      error:   { bg:'#EF4444', color:'#fff' },
      info:    { bg:'#0F1D32', color:'#E2E8F0', border:'1px solid rgba(34,211,238,.2)' },
      warning: { bg:'#F59E0B', color:'#fff' },
    };
    const c = colors[type] || colors.info;
    el.style.background = c.bg;
    el.style.color = c.color;
    el.style.border = c.border || 'none';
    el.textContent = message;
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
    }, duration);
  }

  function setLoading(btn, loading, loadingText = 'Loading...') {
    if (!btn) return;
    if (loading) {
      btn.dataset.originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = loadingText;
    } else {
      btn.disabled = false;
      btn.textContent = btn.dataset.originalText || btn.textContent;
    }
  }

  function skeletonRow(cols) {
    return `<tr>${Array(cols).fill('<td class="px-5 py-4"><div class="h-4 rounded animate-pulse" style="background:var(--border)"></div></td>').join('')}</tr>`;
  }

  function emptyState(icon, title, subtitle = '') {
    return `
      <div class="text-center py-16" style="color:var(--text3)">
        <div class="text-5xl mb-3">${icon}</div>
        <p class="font-medium" style="color:var(--text2)">${escapeHtml(title)}</p>
        ${subtitle ? `<p class="text-sm mt-1">${escapeHtml(subtitle)}</p>` : ''}
      </div>`;
  }

  // ─── Status Badges ───────────────────────────────────────────────────

  function statusBadge(status) {
    const cfg = CONFIG.APPT_STATUS[status] || { label: capitalize(status), badge: 'badge b-purple' };
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.badge}">${cfg.label}</span>`;
  }

  function urgencyBadge(level) {
    const cfg = CONFIG.URGENCY[level] || CONFIG.URGENCY.low;
    return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.badge}">${cfg.icon} ${cfg.label}</span>`;
  }

  // ─── Form Helpers ────────────────────────────────────────────────────

  function getFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};
    const fd = new FormData(form);
    const obj = {};
    fd.forEach((v, k) => { obj[k] = v; });
    return obj;
  }

  function setFieldValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') el.value = value || '';
    else el.value = value || '';
  }

  // ─── Pagination ──────────────────────────────────────────────────────

  function renderPagination(containerId, currentPage, totalPages, onPageChange) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const pages = [];
    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
      pages.push(i);
    }
    el.innerHTML = [
      currentPage > 1 ? `<button onclick="(${onPageChange})(${currentPage - 1})" class="btn-out px-3 py-1.5 text-xs">← Prev</button>` : '',
      ...pages.map(p => `<button onclick="(${onPageChange})(${p})" class="px-3 py-1.5 text-xs rounded-lg ${p === currentPage ? 'btn-teal' : 'btn-out'}">${p}</button>`),
      currentPage < totalPages ? `<button onclick="(${onPageChange})(${currentPage + 1})" class="btn-out px-3 py-1.5 text-xs">Next →</button>` : '',
    ].join('');
  }

  // ─── Avatar Color ────────────────────────────────────────────────────

  function avatarColor(name) {
    const colors = ['da0','da1','da2','da3','da4','da5'];
    const hash = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  // ─── URL Params ──────────────────────────────────────────────────────

  function getParam(key) {
    return new URLSearchParams(window.location.search).get(key);
  }

  return {
    formatDate, formatDateTime, formatTime, timeAgo, todayISO,
    formatCurrency,
    capitalize, initials, truncate, escapeHtml,
    showAlert, hideAlert, toast, setLoading, skeletonRow, emptyState,
    statusBadge, urgencyBadge,
    getFormData, setFieldValue,
    renderPagination,
    avatarColor,
    getParam,
  };
})();
