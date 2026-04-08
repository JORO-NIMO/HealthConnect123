/**
 * HealthConnect — Admin Dashboard
 */

(async () => {
  Auth.handleOAuthCallback();
  Auth.requireRole('admin');

  let allUsers  = [];
  let auditPage = 1;

  // Sidebar toggle
  window.toggleSidebar = function () {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.toggle('hidden');
  };

  // ─── Section Navigation ───────────────────────────────────────────────
  const sections = ['overview', 'users', 'doctors', 'hospitals', 'revenue', 'audit'];

  window.showSection = function (name) {
    sections.forEach(s => document.getElementById(`section-${s}`)?.classList.toggle('hidden', s !== name));
    document.querySelectorAll('.admin-nav').forEach(a => {
      const isActive = a.getAttribute('href') === '#' && a.getAttribute('onclick')?.includes(`'${name}'`);
      a.classList.toggle('active', isActive);
    });
    // Lazy-load section data
    if (name === 'users' && !allUsers.length) loadUsers();
    if (name === 'doctors') loadPendingDoctors();
    if (name === 'hospitals') loadAdminHospitals();
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
        const s = dashRes.value.data?.stats || dashRes.value.data || {};
        document.getElementById('stat-users').textContent  = s.total_patients || s.totalUsers || '—';
        document.getElementById('stat-doctors').textContent= s.total_doctors || s.activeDoctors || '—';
        document.getElementById('stat-appointments').textContent = s.total_appointments || s.totalAppointments || '—';
        document.getElementById('stat-revenue').textContent = Utils.formatCurrency(s.total_revenue || s.totalRevenue || 0);

        const pendingCount = s.pending_doctors || s.pendingDoctors || 0;
        if (pendingCount > 0) {
          document.getElementById('pending-alert').classList.remove('hidden');
          document.getElementById('pending-alert-text').textContent =
            `${pendingCount} doctor${pendingCount > 1 ? 's' : ''} awaiting verification`;
        }

        const pendingHospitals = s.pending_hospitals || s.pendingHospitals || 0;
        if (pendingHospitals > 0) {
          document.getElementById('pending-hospitals-alert')?.classList.remove('hidden');
          const alertText = document.getElementById('pending-hospitals-alert-text');
          if (alertText) alertText.textContent =
            `${pendingHospitals} hospital${pendingHospitals > 1 ? 's' : ''} awaiting verification`;
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
      allUsers = (res.data?.users || []).map(normalizeUser);
      renderUsers(allUsers);
    } catch {
      tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-8 text-center" style="color:var(--text3)">Could not load users</td></tr>`;
    }
  }

  function normalizeUser(u) {
    const firstName = u.firstName || u.first_name || '';
    const lastName  = u.lastName || u.last_name || '';
    const createdAt = u.createdAt || u.created_at;
    const isActive = typeof u.isActive === 'boolean'
      ? u.isActive
      : (u.is_active === true || u.is_active === 1 || u.is_active === '1');

    return {
      ...u,
      firstName,
      lastName,
      createdAt,
      isActive,
    };
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
            <button onclick="confirmDelete('${u.id}')" class="text-xs font-medium" style="color:var(--red)">Delete</button>
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
              <div class="w-12 h-12 ${Utils.avatarColor(d.first_name || d.firstName || '')} rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0">
                ${Utils.initials(`${d.first_name || d.firstName || ''} ${d.last_name || d.lastName || ''}`)}
              </div>
              <div>
                <div class="font-bold">Dr. ${Utils.escapeHtml(`${d.first_name || d.firstName || ''} ${d.last_name || d.lastName || ''}`)}</div>
                <div class="text-sm" style="color:var(--text2)">${Utils.escapeHtml(d.specialization || '')} · Lic: ${Utils.escapeHtml(d.license_number || d.licenseNumber || '—')}</div>
                <div class="text-xs" style="color:var(--text3)">Joined ${Utils.formatDate(d.created_at || d.createdAt)}</div>
              </div>
            </div>
            <div class="flex gap-2">
              <button onclick="verifyDoctor('${d.doctorId || d.id}', 'verified')"
                class="text-sm font-medium px-4 py-2 rounded-xl text-white transition" style="background:var(--green)">
                ✓ Approve
              </button>
              <button onclick="verifyDoctor('${d.doctorId || d.id}', 'rejected')"
                class="text-sm font-medium px-4 py-2 rounded-xl transition" style="background:rgba(239,68,68,.1);color:var(--red)">
                ✕ Reject
              </button>
            </div>
          </div>
          <div class="mt-3 p-3 rounded-xl" style="background:var(--bg2);border:1px solid var(--border)">
            <p class="text-xs font-semibold mb-2" style="color:var(--text2)">Verification Documents</p>
            ${(d.verification_documents && d.verification_documents.length)
              ? `<div class="space-y-1">${d.verification_documents.map(v =>
                  `<a href="${v.file_url}" target="_blank" class="block text-xs hover:underline" style="color:var(--cyan)">• ${Utils.escapeHtml(v.file_name || 'Document')} <span style="color:var(--text3)">(${Utils.escapeHtml((v.document_type || 'other').replace(/_/g, ' '))})</span></a>`
                ).join('')}</div>`
              : `<p class="text-xs" style="color:var(--red)">No supporting documents uploaded.</p>`}
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

  // ─── Hospital Verification ─────────────────────────────────────────────
  let _verifyHospitalId = null;

  window.loadAdminHospitals = async function () {
    const container = document.getElementById('hospitals-list');
    const noMsg     = document.getElementById('no-hospitals-msg');
    if (!container) return;
    container.innerHTML = '';
    const statusFilter = document.getElementById('hospital-status-filter')?.value || 'pending';
    try {
      const url = statusFilter
        ? `/admin/hospitals?status=${statusFilter}`
        : '/admin/hospitals';
      const res = await API.get(url);
      const hospitals = res.data?.hospitals || [];
      if (!hospitals.length) {
        noMsg?.classList.remove('hidden');
        const noMsgText = noMsg?.querySelector('p');
        if (noMsgText) noMsgText.textContent = statusFilter === 'pending' ? 'No pending hospitals!' : 'No hospitals found.';
        return;
      }
      noMsg?.classList.add('hidden');
      container.innerHTML = hospitals.map(h => `
        <div class="rounded-[18px] p-5" style="background:var(--surface2);border:1px solid var(--border)">
          <div class="flex items-start justify-between gap-4 flex-wrap">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
                   style="background:linear-gradient(135deg,var(--cyan),var(--purple))">
                🏥
              </div>
              <div>
                <div class="font-bold">${Utils.escapeHtml(h.name || '')}</div>
                <div class="text-sm" style="color:var(--text2)">
                  ${Utils.escapeHtml(h.type || 'general')} · ${Utils.escapeHtml(h.city || '')}${h.state ? ', ' + Utils.escapeHtml(h.state) : ''}, ${Utils.escapeHtml(h.country || '')}
                </div>
                <div class="text-xs mt-1" style="color:var(--text3)">
                  Reg#: ${Utils.escapeHtml(h.registration_number || h.registrationNumber || '—')}
                  · Admin: ${Utils.escapeHtml((h.first_name || h.firstName || '') + ' ' + (h.last_name || h.lastName || ''))} (${Utils.escapeHtml(h.email || h.admin_email || '')})
                </div>
                <div class="text-xs" style="color:var(--text3)">
                  📞 ${Utils.escapeHtml(h.phone || '—')} · 🛏️ ${h.bed_count || h.bedCount || 0} beds · 🚨 Emergency: ${(h.emergency_available || h.emergencyAvailable) ? 'Yes' : 'No'}
                </div>
                ${h.description ? `<div class="text-xs mt-1" style="color:var(--text3)">${Utils.escapeHtml(h.description.substring(0, 120))}${h.description.length > 120 ? '…' : ''}</div>` : ''}
                <div class="text-xs mt-1" style="color:var(--text3)">Registered ${Utils.formatDate(h.created_at || h.createdAt)}</div>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              ${h.verification_status === 'pending' ? `
                <button onclick="openHospitalVerifyModal('${h.id}', '${Utils.escapeHtml(h.name)}')"
                  class="text-sm font-medium px-4 py-2 rounded-xl text-white transition" style="background:var(--cyan)">
                  ⚡ Review
                </button>
              ` : `
                <span class="badge ${h.verification_status === 'verified' ? 'b-green' : 'b-red'}">
                  ${h.verification_status === 'verified' ? '✅ Verified' : '❌ Rejected'}
                </span>
              `}
            </div>
          </div>
          ${h.admin_note ? `<div class="mt-3 text-xs px-3 py-2 rounded-lg" style="background:var(--bg2);color:var(--text3)">📝 Note: ${Utils.escapeHtml(h.admin_note)}</div>` : ''}
        </div>
      `).join('');
    } catch {
      container.innerHTML = '<div class="text-center py-8" style="color:var(--text3)">⚠️ Could not load hospitals</div>';
    }
  };

  window.openHospitalVerifyModal = function (id, name) {
    _verifyHospitalId = id;
    document.getElementById('hospital-verify-title').textContent = `Verify: ${name}`;
    document.getElementById('hospital-verify-note').value = '';
    document.getElementById('hospital-verify-modal').classList.remove('hidden');
  };

  window.submitHospitalVerification = async function (status) {
    if (!_verifyHospitalId) return;
    const note = document.getElementById('hospital-verify-note')?.value || '';
    try {
      await API.put(`/admin/hospitals/${_verifyHospitalId}/verify`, { status, note });
      document.getElementById('hospital-verify-modal').classList.add('hidden');
      Utils.toast(`Hospital ${status === 'verified' ? 'approved' : 'rejected'}`, status === 'verified' ? 'success' : 'info');
      await loadAdminHospitals();
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
