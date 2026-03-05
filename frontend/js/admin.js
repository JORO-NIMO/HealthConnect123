/**
 * HealthConnect — Admin Dashboard
 */

(async () => {
  Auth.requireRole('admin');

  let allUsers  = [];
  let auditPage = 1;

  // Sidebar toggle
  window.toggleSidebar = function () {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.toggle('hidden');
  };

  // ─── Section Navigation ───────────────────────────────────────────────
  const sections = ['overview', 'users', 'doctors', 'revenue', 'audit'];

  window.showSection = function (name) {
    sections.forEach(s => document.getElementById(`section-${s}`)?.classList.toggle('hidden', s !== name));
    document.querySelectorAll('.admin-nav').forEach(a => {
      const isActive = a.getAttribute('href') === '#' && a.getAttribute('onclick')?.includes(`'${name}'`);
      a.classList.toggle('active', isActive);
    });
    // Lazy-load section data
    if (name === 'users' && !allUsers.length) loadUsers();
    if (name === 'doctors') loadPendingDoctors();
    if (name === 'revenue') loadRevenue();
    if (name === 'audit') loadAudit();
  };

  // ─── Overview ─────────────────────────────────────────────────────────
  async function loadOverview() {
    try {
      const [dashRes, auditRes] = await Promise.allSettled([
        API.get('/admin/dashboard'),
        API.get('/admin/audit-logs?limit=10'),
      ]);

      if (dashRes.status === 'fulfilled') {
        const d = dashRes.value.data || {};
        document.getElementById('stat-users').textContent  = d.totalUsers || '—';
        document.getElementById('stat-doctors').textContent= d.activeDoctors || '—';
        document.getElementById('stat-appointments').textContent = d.totalAppointments || '—';
        document.getElementById('stat-revenue').textContent = Utils.formatCurrency(d.totalRevenue || 0);

        const pendingCount = d.pendingDoctors || 0;
        if (pendingCount > 0) {
          document.getElementById('pending-alert').classList.remove('hidden');
          document.getElementById('pending-alert-text').textContent =
            `${pendingCount} doctor${pendingCount > 1 ? 's' : ''} awaiting verification`;
        }
      }

      if (auditRes.status === 'fulfilled') {
        const logs = auditRes.value.data?.logs || [];
        const container = document.getElementById('recent-audit');
        container.innerHTML = logs.length
          ? logs.map(log => `
              <div class="flex items-center gap-3 py-2 last:border-0" style="border-bottom:1px solid var(--border)">
                <span class="text-xs w-24 flex-shrink-0" style="color:var(--text3)">${Utils.timeAgo(log.createdAt)}</span>
                <span class="text-xs font-medium truncate">${Utils.escapeHtml(log.action || log.endpoint || '')}</span>
                <span class="text-xs ml-auto truncate max-w-[120px]" style="color:var(--text3)">${Utils.escapeHtml(log.userEmail || log.ipAddress || '')}</span>
              </div>`)
            .join('')
          : '<p class="text-sm" style="color:var(--text3)">No recent activity</p>';
      }
    } catch { /* ignore */ }
  }

  // ─── Users ────────────────────────────────────────────────────────────
  async function loadUsers() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;
    tbody.innerHTML = Utils.skeletonRow(5).repeat(5);
    try {
      const res = await API.get('/admin/users');
      allUsers = res.data?.users || [];
      renderUsers(allUsers);
    } catch {
      tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-8 text-center" style="color:var(--text3)">Could not load users</td></tr>`;
    }
  }

  window.filterUsers = function () {
    const q    = document.getElementById('user-search')?.value.toLowerCase() || '';
    const role = document.getElementById('role-filter')?.value || '';
    const filtered = allUsers.filter(u =>
      (!q || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q)) &&
      (!role || u.role === role)
    );
    renderUsers(filtered);
  };

  function renderUsers(users) {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;
    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-8 text-center" style="color:var(--text3)">No users found</td></tr>`;
      return;
    }
    tbody.innerHTML = users.map(u => `
      <tr style="border-bottom:1px solid var(--border)">
        <td class="px-5 py-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 ${Utils.avatarColor(u.firstName)} rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              ${Utils.initials(`${u.firstName || ''} ${u.lastName || ''}`)}
            </div>
            <div>
              <div class="font-medium text-sm">${Utils.escapeHtml(`${u.firstName || ''} ${u.lastName || ''}`.trim())}</div>
              <div class="text-xs" style="color:var(--text3)">${Utils.escapeHtml(u.email)}</div>
            </div>
          </div>
        </td>
        <td class="px-5 py-4">
          <span class="badge ${u.role === 'admin' ? 'b-red' : u.role === 'doctor' ? 'b-cyan' : 'b-purple'}">
            ${Utils.capitalize(u.role)}
          </span>
        </td>
        <td class="px-5 py-4">
          <span class="badge ${u.isActive ? 'b-green' : 'b-red'}">
            ${u.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td class="px-5 py-4 text-xs" style="color:var(--text3)">${Utils.formatDate(u.createdAt)}</td>
        <td class="px-5 py-4">
          ${u.role !== 'admin' ? `
            <button onclick="confirmDelete(${u.id})" class="text-xs font-medium" style="color:var(--red)">Delete</button>
          ` : ''}
        </td>
      </tr>
    `).join('');
  }

  let _deleteUserId = null;
  window.confirmDelete = function (id) {
    _deleteUserId = id;
    document.getElementById('delete-modal').classList.remove('hidden');
  };
  document.getElementById('confirm-delete-btn')?.addEventListener('click', async () => {
    if (!_deleteUserId) return;
    try {
      await API.delete(`/admin/users/${_deleteUserId}`);
      document.getElementById('delete-modal').classList.add('hidden');
      Utils.toast('User deleted', 'success');
      await loadUsers();
    } catch (err) {
      Utils.toast(err.message || 'Delete failed', 'error');
    }
  });

  // ─── Doctor Verification ──────────────────────────────────────────────
  async function loadPendingDoctors() {
    const container = document.getElementById('pending-doctors-list');
    const noMsg     = document.getElementById('no-pending-msg');
    if (!container) return;
    container.innerHTML = '';
    try {
      const res = await API.get('/admin/doctors/pending');
      const docs = res.data?.doctors || [];
      if (!docs.length) {
        noMsg?.classList.remove('hidden');
        return;
      }
      noMsg?.classList.add('hidden');
      container.innerHTML = docs.map(d => `
        <div class="rounded-[18px] p-5" style="background:var(--surface2);border:1px solid var(--border)">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 ${Utils.avatarColor(d.firstName)} rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0">
                ${Utils.initials(`${d.firstName || ''} ${d.lastName || ''}`)}
              </div>
              <div>
                <div class="font-bold">Dr. ${Utils.escapeHtml(`${d.firstName || ''} ${d.lastName || ''}`)}</div>
                <div class="text-sm" style="color:var(--text2)">${Utils.escapeHtml(d.specialization || '')} · Lic: ${Utils.escapeHtml(d.licenseNumber || '—')}</div>
                <div class="text-xs" style="color:var(--text3)">Joined ${Utils.formatDate(d.createdAt)}</div>
              </div>
            </div>
            <div class="flex gap-2">
              <button onclick="verifyDoctor(${d.doctorId || d.id}, 'verified')"
                class="text-sm font-medium px-4 py-2 rounded-xl text-white transition" style="background:var(--green)">
                ✓ Approve
              </button>
              <button onclick="verifyDoctor(${d.doctorId || d.id}, 'rejected')"
                class="text-sm font-medium px-4 py-2 rounded-xl transition" style="background:rgba(239,68,68,.1);color:var(--red)">
                ✕ Reject
              </button>
            </div>
          </div>
        </div>
      `).join('');
    } catch {
      container.innerHTML = Utils.emptyState('⚠️', 'Could not load pending doctors');
    }
  }

  window.verifyDoctor = async function (id, status) {
    try {
      await API.put(`/admin/doctors/${id}/verify`, { status });
      Utils.toast(`Doctor ${status === 'verified' ? 'approved' : 'rejected'}`, status === 'verified' ? 'success' : 'info');
      await loadPendingDoctors();
    } catch (err) {
      Utils.toast(err.message || 'Action failed', 'error');
    }
  };

  // ─── Revenue ──────────────────────────────────────────────────────────
  async function loadRevenue() {
    try {
      const res  = await API.get('/admin/revenue');
      const data = res.data || {};
      document.getElementById('rev-today').textContent = Utils.formatCurrency(data.todayRevenue || 0);
      document.getElementById('rev-month').textContent = Utils.formatCurrency(data.monthRevenue || 0);
      document.getElementById('rev-total').textContent = Utils.formatCurrency(data.totalRevenue || 0);

      const tbody = document.getElementById('revenue-tbody');
      const payments = data.recentPayments || [];
      tbody.innerHTML = payments.length
        ? payments.map(p => `
            <tr style="border-bottom:1px solid var(--border)">
              <td class="px-4 py-3">${Utils.escapeHtml(p.patientName || '—')}</td>
              <td class="px-4 py-3 font-semibold">${Utils.formatCurrency(p.amount, p.currency)}</td>
              <td class="px-4 py-3 capitalize" style="color:var(--text2)">${Utils.escapeHtml(p.paymentMethod || '—')}</td>
              <td class="px-4 py-3">${Utils.statusBadge(p.status)}</td>
              <td class="px-4 py-3 text-xs" style="color:var(--text3)">${Utils.formatDate(p.createdAt)}</td>
            </tr>`)
          .join('')
        : `<tr><td colspan="5" class="px-4 py-8 text-center" style="color:var(--text3)">No payments yet</td></tr>`;
    } catch { /* ignore */ }
  }

  // ─── Audit Logs ───────────────────────────────────────────────────────
  async function loadAudit() {
    const tbody = document.getElementById('audit-tbody');
    if (!tbody) return;
    tbody.innerHTML = Utils.skeletonRow(5).repeat(8);
    try {
      const res  = await API.get(`/admin/audit-logs?page=${auditPage}&limit=${CONFIG.DEFAULT_PAGE_SIZE}`);
      const logs = res.data?.logs || [];
      const total = res.data?.total || 0;
      const pages = Math.ceil(total / CONFIG.DEFAULT_PAGE_SIZE);

      tbody.innerHTML = logs.length
        ? logs.map(log => `
            <tr style="border-bottom:1px solid var(--border)">
              <td class="px-5 py-3 text-xs" style="color:var(--text3)">${Utils.formatDateTime(log.createdAt)}</td>
              <td class="px-5 py-3 text-xs">${Utils.escapeHtml(log.userEmail || log.userId || '—')}</td>
              <td class="px-5 py-3 text-xs font-medium">${Utils.escapeHtml(log.action || '—')}</td>
              <td class="px-5 py-3 text-xs font-mono" style="color:var(--text2)">${Utils.escapeHtml(log.endpoint || '—')}</td>
              <td class="px-5 py-3 text-xs" style="color:var(--text3)">${Utils.escapeHtml(log.ipAddress || '—')}</td>
            </tr>`)
          .join('')
        : `<tr><td colspan="5" class="px-5 py-8 text-center" style="color:var(--text3)">No logs</td></tr>`;

      document.getElementById('audit-page-info').textContent = `Page ${auditPage} of ${pages || 1}`;
      document.getElementById('audit-prev').disabled = auditPage <= 1;
      document.getElementById('audit-next').disabled = auditPage >= pages;
    } catch {
      tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-8 text-center" style="color:var(--text3)">Could not load logs</td></tr>`;
    }
  }

  window.loadAuditPage = function (delta) {
    auditPage = Math.max(1, auditPage + delta);
    loadAudit();
  };

  // ─── Init ─────────────────────────────────────────────────────────────
  await loadOverview();
})();
