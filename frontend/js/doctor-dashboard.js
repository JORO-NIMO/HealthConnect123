/**
 * HealthConnect — Doctor Dashboard
 */

(async () => {
  Auth.handleOAuthCallback();
  const user = Auth.requireRole('doctor');
  if (!user) return;

  // Block unverified doctors
  if (user.verificationStatus && user.verificationStatus !== 'verified') {
    window.location.href = '/pages/auth/pending-verification.html';
    return;
  }

  let allAppointments = [];
  let currentTab = 'dashboard';

  // Sidebar toggle
  window.toggleSidebar = function () {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.toggle('hidden');
  };

  // ─── Tab switching ────────────────────────────────────────────────────
  window.showTab = function (tab) {
    currentTab = tab;
    // Hide all views
    document.getElementById('view-dashboard').classList.add('hidden');
    document.getElementById('view-appointments').classList.add('hidden');
    document.getElementById('view-prescriptions').classList.add('hidden');

    // Show selected
    const viewId = tab === 'appointments' ? 'view-appointments'
                 : tab === 'prescriptions' ? 'view-prescriptions'
                 : 'view-dashboard';
    document.getElementById(viewId).classList.remove('hidden');

    // Update sidebar active state
    document.querySelectorAll('#sidebar .sidebar-item').forEach(el => el.classList.remove('active'));
    const activeMap = { dashboard: 0, appointments: 2, prescriptions: 3 };
    const items = document.querySelectorAll('#sidebar nav .sidebar-item');
    if (items[activeMap[tab]]) items[activeMap[tab]].classList.add('active');

    // Load data for the tab
    if (tab === 'appointments') loadAllPatients();
    if (tab === 'prescriptions') loadAllPrescriptions();

    window.scrollTo({ top: 0 });
    return false;
  };

  // Today date
  document.getElementById('today-date').textContent = Utils.formatDate(new Date());
  document.getElementById('header-name').textContent = user.firstName || 'Doctor';

  // ─── Load doctor profile ──────────────────────────────────────────────
  async function loadProfile() {
    try {
      const res = await API.get('/doctors/me/profile');
      const doc = res.data?.doctor || {};

      document.getElementById('doc-avatar').textContent = Utils.initials(`${user.firstName || ''} ${user.lastName || ''}`);
      document.getElementById('doc-name').textContent = `Dr. ${user.firstName || ''} ${user.lastName || ''}`;
      document.getElementById('doc-spec').textContent = doc.specialization || '';

      const av = doc.averageRating;
      document.getElementById('stat-rating').textContent = av ? Number(av).toFixed(1) + ' ★' : '—';
      document.getElementById('stat-total').textContent  = doc.totalPatients || 0;

      const badge = document.getElementById('verification-badge');
      if (doc.verificationStatus === 'verified') {
        badge.textContent = '✓ Verified';
        badge.className = 'badge b-green';
        badge.classList.remove('hidden');
      } else if (doc.verificationStatus === 'pending') {
        badge.textContent = '⏳ Pending Review';
        badge.className = 'badge b-yellow';
        badge.classList.remove('hidden');
      }

      const sw = document.getElementById('avail-switch');
      const avail = doc.is_available ?? doc.isAvailable;
      if (sw) sw.checked = avail === 1 || avail === true;
    } catch { /* ignore */ }
  }

  window.toggleAvailability = async function (val) {
    try {
      await API.put('/doctors/me/profile', { isAvailable: val });
      Utils.toast(val ? 'You are now available' : 'Set to unavailable', 'success');
    } catch {
      Utils.toast('Could not update availability', 'error');
    }
  };

  // ─── Load appointments (dashboard) ────────────────────────────────────
  async function loadAppointments() {
    try {
      const res = await API.get('/appointments/doctor');
      allAppointments = res.data?.appointments || [];

      const today = Utils.todayISO();
      const todayAppts   = allAppointments.filter(a => a.appointmentDate?.startsWith(today) && ['pending','confirmed','in_progress'].includes(a.status));
      const pendingAppts = allAppointments.filter(a => a.status === 'pending');

      document.getElementById('stat-today').textContent   = todayAppts.length;
      document.getElementById('stat-pending').textContent = pendingAppts.length;

      const todayList = document.getElementById('today-appointments');
      todayList.innerHTML = todayAppts.length
        ? todayAppts.map(renderApptCard).join('')
        : '<p class="text-sm text-center py-6" style="color:var(--text3)">No appointments today</p>';

      const pendList = document.getElementById('pending-appointments');
      pendList.innerHTML = pendingAppts.length
        ? pendingAppts.slice(0, 5).map(renderPendingCard).join('')
        : '<p class="text-sm text-center py-6" style="color:var(--text3)">No pending requests</p>';
    } catch { /* ignore */ }
  }

  // ─── Full Patients view ───────────────────────────────────────────────
  async function loadAllPatients() {
    const container = document.getElementById('all-patients-list');
    try {
      if (!allAppointments.length) {
        const res = await API.get('/appointments/doctor');
        allAppointments = res.data?.appointments || [];
      }
      renderPatientsList(allAppointments);
    } catch {
      container.innerHTML = '<p class="text-sm text-center py-10" style="color:var(--text3)">Failed to load patients.</p>';
    }
  }

  window.filterPatients = function () {
    const filter = document.getElementById('patient-filter').value;
    const filtered = filter === 'all' ? allAppointments : allAppointments.filter(a => a.status === filter);
    renderPatientsList(filtered);
  };

  function renderPatientsList(list) {
    const container = document.getElementById('all-patients-list');
    if (!list.length) {
      container.innerHTML = `
        <div class="text-center py-16" style="color:var(--text3)">
          <div class="text-5xl mb-4">👥</div>
          <p class="font-medium">No patients found</p>
        </div>`;
      return;
    }
    container.innerHTML = list.map(appt => {
      const name = `${appt.patientFirstName || ''} ${appt.patientLastName || ''}`.trim() || 'Patient';
      const date = Utils.formatDate(appt.appointmentDate);
      const time = Utils.formatTime(appt.appointmentDate);
      const statusColors = {
        pending: 'b-yellow', confirmed: 'b-green', in_progress: 'b-cyan',
        completed: 'b-green', cancelled: 'b-red', no_show: 'b-red'
      };
      const badgeCls = statusColors[appt.status] || 'b-yellow';
      const canJoin = appt.status === 'in_progress';
      const isPending = appt.status === 'pending';
      return `
        <div class="flex items-center gap-3 p-4 rounded-xl" style="background:var(--surface2);border:1px solid var(--border)">
          <div class="w-10 h-10 ${Utils.avatarColor(name)} rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            ${Utils.initials(name)}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm truncate">${Utils.escapeHtml(name)}</div>
            <div class="text-xs" style="color:var(--text3)">${date} at ${time} · ${Utils.capitalize(appt.consultationType || 'video')}</div>
            ${appt.symptoms ? `<div class="text-xs mt-0.5" style="color:var(--text3)">${Utils.escapeHtml(appt.symptoms.substring(0, 80))}</div>` : ''}
          </div>
          <div class="flex flex-col items-end gap-1.5">
            <span class="badge ${badgeCls} text-[10px]">${Utils.capitalize(appt.status || '')}</span>
            ${canJoin ? `<a href="/pages/doctor/consultation.html?apptId=${appt.id}" class="text-xs font-semibold" style="color:var(--cyan)">Join →</a>` : ''}
            ${isPending ? `
              <div class="flex gap-1.5">
                <button onclick="confirmAppt('${appt.id}')" class="text-xs px-2.5 py-1 rounded-lg font-medium" style="background:rgba(16,185,129,.1);color:var(--green)">✓ Accept</button>
                <button onclick="cancelAppt('${appt.id}')" class="text-xs px-2.5 py-1 rounded-lg font-medium" style="background:rgba(239,68,68,.08);color:var(--red)">✕</button>
              </div>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  // ─── Full Prescriptions view ──────────────────────────────────────────
  async function loadAllPrescriptions() {
    const container = document.getElementById('all-prescriptions-list');
    try {
      const res = await API.get('/doctors/me/prescriptions');
      const rxList = res.data?.prescriptions || [];
      if (!rxList.length) {
        container.innerHTML = `
          <div class="text-center py-16" style="color:var(--text3)">
            <div class="text-5xl mb-4">💊</div>
            <p class="font-medium">No prescriptions issued yet</p>
          </div>`;
        return;
      }
      container.innerHTML = rxList.map(rx => `
        <div class="p-4 rounded-xl" style="background:var(--surface2);border:1px solid var(--border)">
          <div class="flex items-center justify-between mb-2">
            <div class="font-semibold text-sm">${Utils.escapeHtml(rx.diagnosis || 'Prescription')}</div>
            <span class="badge b-green text-[10px]">Issued</span>
          </div>
          <div class="text-xs" style="color:var(--text3)">
            Patient: ${Utils.escapeHtml(rx.patientName || 'N/A')} · ${Utils.formatDate(rx.createdAt)}
          </div>
          ${rx.medications ? `<div class="text-xs mt-1.5" style="color:var(--text2)">${Utils.escapeHtml(rx.medications)}</div>` : ''}
          ${rx.notes ? `<div class="text-xs mt-1" style="color:var(--text3)">Notes: ${Utils.escapeHtml(rx.notes)}</div>` : ''}
        </div>`
      ).join('');
    } catch {
      container.innerHTML = '<p class="text-sm text-center py-10" style="color:var(--text3)">Failed to load prescriptions.</p>';
    }
  }

  // ─── Shared renderers (dashboard) ─────────────────────────────────────
  function renderApptCard(appt) {
    const name  = `${appt.patientFirstName || ''} ${appt.patientLastName || ''}`.trim() || 'Patient';
    const time  = Utils.formatTime(appt.appointmentDate);
    const badge = Utils.statusBadge(appt.status);
    const canJoin = appt.status === 'in_progress';
    return `
      <div class="flex items-center gap-3 p-3 rounded-xl" style="background:var(--surface2);border:1px solid var(--border)">
        <div class="w-9 h-9 ${Utils.avatarColor(name)} rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          ${Utils.initials(name)}
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-sm truncate">${Utils.escapeHtml(name)}</div>
          <div class="text-xs" style="color:var(--text3)">${time} · ${Utils.capitalize(appt.consultationType || '')}</div>
        </div>
        <div class="flex flex-col items-end gap-1">
          ${badge}
          ${canJoin ? `<a href="/pages/doctor/consultation.html?apptId=${appt.id}" class="text-xs font-medium" style="color:var(--cyan)">Join</a>` : ''}
        </div>
      </div>`;
  }

  function renderPendingCard(appt) {
    const name = `${appt.patientFirstName || ''} ${appt.patientLastName || ''}`.trim() || 'Patient';
    const date = Utils.formatDate(appt.appointmentDate);
    const time = Utils.formatTime(appt.appointmentDate);
    return `
      <div class="flex items-center gap-3 p-3 rounded-xl" style="background:var(--surface2);border:1px solid var(--border)">
        <div class="w-9 h-9 ${Utils.avatarColor(name)} rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          ${Utils.initials(name)}
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-sm truncate">${Utils.escapeHtml(name)}</div>
          <div class="text-xs" style="color:var(--text3)">${date} ${time}</div>
        </div>
        <div class="flex gap-2">
          <button onclick="confirmAppt('${appt.id}')" class="text-xs px-2.5 py-1.5 rounded-lg font-medium transition" style="background:rgba(16,185,129,.1);color:var(--green)">✓</button>
          <button onclick="cancelAppt('${appt.id}')" class="text-xs px-2.5 py-1.5 rounded-lg font-medium transition" style="background:rgba(239,68,68,.08);color:var(--red)">✕</button>
        </div>
      </div>`;
  }

  window.confirmAppt = async function (id) {
    try {
      await API.put(`/appointments/${id}/confirm`);
      Utils.toast('Appointment confirmed', 'success');
      allAppointments = [];
      await loadAppointments();
      if (currentTab === 'appointments') loadAllPatients();
    } catch (err) { Utils.toast(err.message, 'error'); }
  };

  window.cancelAppt = async function (id) {
    if (!confirm('Cancel this appointment?')) return;
    try {
      await API.put(`/appointments/${id}/cancel`);
      Utils.toast('Appointment cancelled', 'info');
      allAppointments = [];
      await loadAppointments();
      if (currentTab === 'appointments') loadAllPatients();
    } catch (err) { Utils.toast(err.message, 'error'); }
  };

  // ─── Recent Prescriptions (dashboard preview) ─────────────────────────
  async function loadRecentPrescriptions() {
    const container = document.getElementById('recent-prescriptions');
    if (!container) return;
    try {
      const res = await API.get('/doctors/me/prescriptions?limit=5');
      const rxList = res.data?.prescriptions || [];
      container.innerHTML = rxList.length
        ? rxList.map(rx => `
            <div class="flex items-center justify-between p-3 rounded-xl text-sm" style="background:var(--surface2);border:1px solid var(--border)">
              <div>
                <div class="font-semibold">${Utils.escapeHtml(rx.diagnosis || 'Prescription')}</div>
                <div class="text-xs" style="color:var(--text3)">Patient: ${Utils.escapeHtml(rx.patientName || '')} · ${Utils.formatDate(rx.createdAt)}</div>
              </div>
              <span class="badge b-green">Issued</span>
            </div>`
          ).join('')
        : Utils.emptyState('💊', 'No prescriptions yet');
    } catch { /* ignore */ }
  }

  await Promise.allSettled([loadProfile(), loadAppointments(), loadRecentPrescriptions()]);
})();
