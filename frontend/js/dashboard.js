/**
 * HealthConnect — Patient Dashboard
 */

(async () => {
  // Handle tokens passed back from Google OAuth redirect
  Auth.handleOAuthCallback();
  const user = Auth.requireRole('patient');
  if (!user) return;

  // Render avatar / name
  document.getElementById('user-name')?.setAttribute('data-name', user.firstName || user.email);
  const initialsEl = document.getElementById('avatar-initials');
  const avatarImg  = document.getElementById('avatar-img');
  if (initialsEl) {
    initialsEl.textContent = Utils.initials(`${user.firstName || ''} ${user.lastName || ''}`);
    initialsEl.classList.add(Utils.avatarColor(user.firstName));
  }
  if (avatarImg && user.avatarUrl) {
    avatarImg.src = user.avatarUrl;
    avatarImg.classList.remove('hidden');
    if (initialsEl) initialsEl.classList.add('hidden');
  }
  document.querySelectorAll('.user-first-name').forEach(el => {
    el.textContent = user.firstName || 'there';
  });

  // Today's date
  const dateEl = document.getElementById('today-date');
  if (dateEl) dateEl.textContent = Utils.formatDate(new Date());

  // Sidebar toggle
  window.toggleSidebar = function () {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.toggle('hidden');
  };

  // Sign out from patient dashboard
  document.getElementById('logout-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    Auth.logout();
  });

  // ── Load stats + upcoming appointments + recent reports in parallel ──

  async function loadDashboard() {
    try {
      const apptList = document.getElementById('upcoming-appointments');
      if (apptList) {
        apptList.innerHTML = Utils.skeletonCards(3, {
          containerClass: 'space-y-3',
          cardClass: 'p-4 rounded-xl',
          cardStyle: 'background:var(--surface2);border:1px solid var(--border)',
          lines: [45, 30],
        });
      }

      const sympList = document.getElementById('recent-reports');
      if (sympList) {
        sympList.innerHTML = Utils.skeletonCards(3, {
          containerClass: 'space-y-3',
          cardClass: 'p-4 rounded-xl',
          cardStyle: 'background:var(--surface2);border:1px solid var(--border)',
          lines: [60, 35],
        });
      }

      const [statsRes, apptRes, sympRes] = await Promise.allSettled([
        API.get('/patients/stats'),
        API.get('/appointments/patient?status=upcoming&limit=5'),
        API.get('/symptoms/history?limit=5'),
      ]);

      // Stats cards
      if (statsRes.status === 'fulfilled') {
        const s = statsRes.value?.data?.stats || statsRes.value?.stats || statsRes.value?.data || {};
        _setText('stat-appointments', s.totalAppointments ?? s.total_appointments ?? '0');
        _setText('stat-checks', s.totalSymptomChecks ?? s.total_symptom_reports ?? s.total_symptom_checks ?? '0');
        _setText('stat-prescriptions', s.totalPrescriptions ?? s.total_prescriptions ?? '0');
        _setText('stat-consultations', s.totalConsultations ?? s.total_consultations ?? '0');
      }

      // Upcoming appointments
      if (apptList) {
        if (apptRes.status === 'fulfilled') {
          const items = apptRes.value?.data?.appointments || apptRes.value?.appointments || [];
          apptList.innerHTML = items.length
            ? items.map(renderAppointmentCard).join('')
            : Utils.emptyState('📅', 'No upcoming appointments', 'Book a consultation to get started');
        } else {
          apptList.innerHTML = Utils.emptyState('⚠️', 'Could not load appointments');
        }
      }

      // Recent symptom reports
      if (sympList) {
        if (sympRes.status === 'fulfilled') {
          const items = sympRes.value?.data?.reports || sympRes.value?.reports || [];
          sympList.innerHTML = items.length
            ? items.map(renderReportCard).join('')
            : Utils.emptyState('🔍', 'No symptom checks yet', 'Use the AI Symptom Checker to get started');
        } else {
          sympList.innerHTML = Utils.emptyState('⚠️', 'Could not load reports');
        }
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  }

  function renderAppointmentCard(appt) {
    const docName = `${appt.doctor_first_name || ''} ${appt.doctor_last_name || ''}`.trim() || 'Doctor';
    const spec    = appt.specialization || '';
    const date    = Utils.formatDate(appt.appointment_date);
    const time    = Utils.formatTime(appt.appointment_date);
    const badge   = Utils.statusBadge(appt.status);
    const typeIcon = appt.type === 'video' ? '📹' : appt.type === 'chat' ? '💬' : '🏥';

    return `
      <div class="flex items-center justify-between p-4 rounded-xl transition" style="background:var(--surface2);border:1px solid var(--border)">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style="background:linear-gradient(135deg,var(--cyan),var(--green))">
            ${Utils.initials(docName)}
          </div>
          <div>
            <div class="font-semibold text-sm">Dr. ${Utils.escapeHtml(docName)}</div>
            <div class="text-xs" style="color:var(--text3)">${Utils.escapeHtml(spec)} · ${typeIcon} ${Utils.capitalize(appt.type || 'video')}</div>
          </div>
        </div>
        <div class="text-right flex flex-col items-end gap-1">
          ${badge}
          <div class="text-xs" style="color:var(--text3)">${date} ${time}</div>
        </div>
      </div>`;
  }

  function renderReportCard(report) {
    const badge   = Utils.urgencyBadge(report.urgency_level || report.urgencyLevel);
    const syms    = (report.symptoms || report.symptoms_raw || []).slice(0, 3).map(s => Utils.escapeHtml(s)).join(', ');
    const date    = Utils.timeAgo(report.created_at || report.createdAt);

    return `
      <a href="/pages/patient/symptom-checker.html?reportId=${report.id}" class="flex items-center justify-between p-4 rounded-xl transition block" style="background:var(--surface2);border:1px solid var(--border)">
        <div>
          <div class="font-semibold text-sm">${syms || 'Symptom check'}</div>
          <div class="text-xs mt-0.5" style="color:var(--text3)">${date}</div>
        </div>
        ${badge}
      </a>`;
  }

  function _setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  await loadDashboard();
})();
