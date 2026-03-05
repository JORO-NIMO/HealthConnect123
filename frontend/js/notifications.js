/**
 * Notifications Module
 * Real-time notifications via Socket.IO + REST API
 */
const Notifications = (() => {
  let socket = null;
  let unreadCount = 0;
  let isOpen = false;

  function init() {
    loadUnreadCount();
    connectSocket();
    renderBell();
    // Poll every 60s as fallback
    setInterval(loadUnreadCount, 60000);
  }

  function connectSocket() {
    if (typeof io === 'undefined') return;
    const user = Auth.getUser();
    if (!user) return;

    socket = io(CONFIG.API_BASE.replace('/api/v1', ''), {
      auth: { token: localStorage.getItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN) },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join-user', user.id);
    });

    socket.on('notification', (data) => {
      unreadCount++;
      updateBadge();
      showToastNotification(data);
    });

    socket.on('vital-alert', (data) => {
      unreadCount++;
      updateBadge();
      showToastNotification({
        title: '⚠️ Vital Sign Alert',
        message: data.message || 'Abnormal vital sign detected',
        type: 'warning',
      });
    });

    socket.on('emergency-sos', (data) => {
      showToastNotification({
        title: '🆘 Emergency SOS',
        message: data.message || 'Emergency alert triggered',
        type: 'error',
      });
    });
  }

  async function loadUnreadCount() {
    try {
      const res = await API.get('/notifications/unread-count');
      unreadCount = res.data.count || 0;
      updateBadge();
    } catch {
      // silent
    }
  }

  function updateBadge() {
    const badges = document.querySelectorAll('.notif-badge');
    badges.forEach((badge) => {
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    });
  }

  function renderBell() {
    // Find existing notification bell or create one
    const bells = document.querySelectorAll('.notif-bell');
    bells.forEach((bell) => {
      bell.style.cursor = 'pointer';
      bell.addEventListener('click', togglePanel);
    });
  }

  function showToastNotification(data) {
    if (typeof Utils !== 'undefined' && Utils.toast) {
      const type = data.type || 'info';
      const msg = data.title ? `${data.title}: ${data.message}` : data.message;
      Utils.toast(msg, type);
    }
  }

  async function togglePanel() {
    if (isOpen) {
      closePanel();
      return;
    }
    isOpen = true;

    // Create panel
    let panel = document.getElementById('notif-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'notif-panel';
      panel.style.cssText = `
        position:fixed;top:60px;right:16px;width:360px;max-width:calc(100vw - 32px);
        max-height:70vh;border-radius:18px;z-index:100;overflow:hidden;
        background:var(--surface2);border:1px solid rgba(34,211,238,.15);
        box-shadow:0 20px 60px rgba(0,0,0,.5);
      `;
      document.body.appendChild(panel);
    }

    panel.innerHTML = `
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <span style="font-weight:700;font-size:15px">Notifications</span>
        <div style="display:flex;gap:8px">
          <button id="mark-all-read" style="font-size:12px;color:var(--cyan);cursor:pointer;background:none;border:none">Mark all read</button>
          <button id="close-notif" style="font-size:18px;color:var(--text3);cursor:pointer;background:none;border:none">&times;</button>
        </div>
      </div>
      <div id="notif-list" style="overflow-y:auto;max-height:calc(70vh - 60px);padding:8px"></div>
    `;

    document.getElementById('close-notif').addEventListener('click', closePanel);
    document.getElementById('mark-all-read').addEventListener('click', markAllRead);

    // Load notifications
    try {
      const res = await API.get('/notifications?limit=20');
      const notifs = res.data.notifications || [];
      const list = document.getElementById('notif-list');

      if (!notifs.length) {
        list.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--text3)">
          <div style="font-size:2rem;margin-bottom:8px">🔔</div>
          <p style="font-size:13px">No notifications yet</p>
        </div>`;
        return;
      }

      list.innerHTML = notifs
        .map((n) => {
          const icons = {
            appointment: '📅',
            vital_alert: '❤️',
            prescription: '💊',
            system: '⚙️',
            emergency: '🆘',
            consultation: '🩺',
            reminder: '⏰',
          };
          const icon = icons[n.type] || '🔔';
          const time = Utils.timeAgo
            ? Utils.timeAgo(n.created_at)
            : new Date(n.created_at).toLocaleDateString();
          const bg = n.is_read
            ? 'transparent'
            : 'rgba(34,211,238,.04)';
          const dot = n.is_read
            ? ''
            : '<span style="width:8px;height:8px;border-radius:50%;background:var(--cyan);flex-shrink:0"></span>';

          return `
          <div class="notif-item" data-id="${n.id}" style="display:flex;align-items:flex-start;gap:10px;padding:12px;border-radius:12px;margin-bottom:4px;cursor:pointer;background:${bg};transition:background .15s" onmouseover="this.style.background='rgba(34,211,238,.08)'" onmouseout="this.style.background='${bg}'">
            <span style="font-size:1.2rem;flex-shrink:0">${icon}</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:${n.is_read ? '400' : '600'};line-height:1.4">${n.title || n.message}</div>
              ${n.title && n.message ? `<div style="font-size:12px;color:var(--text3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${n.message}</div>` : ''}
              <div style="font-size:11px;color:var(--text3);margin-top:4px">${time}</div>
            </div>
            ${dot}
          </div>`;
        })
        .join('');

      // Click to mark read
      list.querySelectorAll('.notif-item').forEach((item) => {
        item.addEventListener('click', () => markRead(item.dataset.id));
      });
    } catch (err) {
      document.getElementById('notif-list').innerHTML =
        '<p style="text-align:center;padding:20px;color:var(--text3);font-size:13px">Failed to load</p>';
    }

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', outsideClickHandler);
    }, 100);
  }

  function outsideClickHandler(e) {
    const panel = document.getElementById('notif-panel');
    const bell = e.target.closest('.notif-bell');
    if (panel && !panel.contains(e.target) && !bell) {
      closePanel();
    }
  }

  function closePanel() {
    isOpen = false;
    const panel = document.getElementById('notif-panel');
    if (panel) panel.remove();
    document.removeEventListener('click', outsideClickHandler);
  }

  async function markRead(id) {
    try {
      await API.put(`/notifications/${id}/read`);
      unreadCount = Math.max(0, unreadCount - 1);
      updateBadge();
      // Update item visually
      const item = document.querySelector(`.notif-item[data-id="${id}"]`);
      if (item) {
        item.style.background = 'transparent';
        const dot = item.querySelector('span:last-child');
        if (dot && dot.style.borderRadius === '50%') dot.remove();
      }
    } catch {
      // silent
    }
  }

  async function markAllRead() {
    try {
      await API.put('/notifications/read-all');
      unreadCount = 0;
      updateBadge();
      // Refresh panel
      if (isOpen) {
        closePanel();
        togglePanel();
      }
    } catch {
      // silent
    }
  }

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init, loadUnreadCount, connectSocket };
})();
