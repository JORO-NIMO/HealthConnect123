/**
 * HealthConnect — Appointments Page
 */

(async () => {
  Auth.requireRole('patient');

  let allDoctors = [];
  let selectedDoctor = null;
  let currentTab = 'upcoming';
  let appointments = [];

  // ─── Tabs ─────────────────────────────────────────────────────────────
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active', 'text-primary', 'border-b-2', 'border-primary', 'font-semibold');
      });
      btn.classList.add('active', 'text-primary', 'border-b-2', 'border-primary', 'font-semibold');
      currentTab = btn.dataset.tab;
      renderAppointments();
    });
  });

  // ─── Open/Close Modal ─────────────────────────────────────────────────
  document.getElementById('book-new-btn')?.addEventListener('click', openModal);
  document.getElementById('book-first-btn')?.addEventListener('click', openModal);

  function openModal() {
    document.getElementById('book-modal').classList.remove('hidden');
    loadDoctors();
    // Set min date to today
    document.getElementById('appointment-date').min = Utils.todayISO();
  }

  // Consultation type card selection
  document.querySelectorAll('.type-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.type-card').forEach(c => {
        c.style.borderColor = 'var(--border)';
        c.style.background = 'transparent';
      });
      card.style.borderColor = 'var(--cyan)';
      card.style.background = 'rgba(78,216,185,.06)';
    });
  });

  // Date change → populate time slots
  document.getElementById('appointment-date')?.addEventListener('change', function () {
    if (selectedDoctor) loadTimeSlots(selectedDoctor.id, this.value);
  });

  // ─── Load Doctors ─────────────────────────────────────────────────────
  async function loadDoctors(search = '') {
    const list = document.getElementById('doctors-list');
    if (!list) return;

    try {
      const res = await API.get(`/doctors/search?q=${encodeURIComponent(search)}&limit=10`);
      allDoctors = res.data?.doctors || [];
      renderDoctorsList(allDoctors);
    } catch {
      list.innerHTML = '<p class="text-sm text-center py-4" style="color:var(--text3)">Could not load doctors</p>';
    }
  }

  function renderDoctorsList(doctors) {
    const list = document.getElementById('doctors-list');
    if (!list) return;
    if (!doctors.length) {
      list.innerHTML = '<p class="text-sm text-center py-4" style="color:var(--text3)">No doctors found</p>';
      return;
    }
    list.innerHTML = doctors.map(d => `
      <button onclick="selectDoctor(${JSON.stringify(d).replace(/"/g, '&quot;')})"
        class="w-full flex items-center gap-3 p-3 rounded-xl text-left transition" style="border:1px solid var(--border)" onmouseover="this.style.borderColor='var(--cyan)'" onmouseout="this.style.borderColor='var(--border)'">
        <div class="w-10 h-10 rounded-xl ${Utils.avatarColor(d.first_name)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          ${Utils.initials((d.first_name || '') + ' ' + (d.last_name || ''))}
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-sm">Dr. ${Utils.escapeHtml((d.first_name || '') + ' ' + (d.last_name || ''))}</div>
          <div class="text-xs" style="color:var(--text3)">${Utils.escapeHtml(d.specialization || '')} · ⭐ ${d.rating ? Number(d.rating).toFixed(1) : '—'}</div>
        </div>
        <div class="text-xs font-bold" style="color:var(--cyan)">${Utils.formatCurrency(d.consultation_fee, d.currency || 'USD')}</div>
      </button>
    `).join('');
  }

  // Debounced search
  let searchTimer;
  document.getElementById('doctor-search')?.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadDoctors(this.value), 300);
  });

  window.selectDoctor = function (doc) {
    selectedDoctor = doc;
    document.getElementById('doctors-list').innerHTML = '';
    const card = document.getElementById('selected-doctor-card');
    card.classList.remove('hidden');
    document.getElementById('selected-doc-avatar').textContent = Utils.initials((doc.first_name || '') + ' ' + (doc.last_name || ''));
    document.getElementById('selected-doc-name').textContent = `Dr. ${doc.first_name || ''} ${doc.last_name || ''}`;
    document.getElementById('selected-doc-spec').textContent = doc.specialization || '';
    document.getElementById('selected-doc-fee').textContent = Utils.formatCurrency(doc.consultation_fee, doc.currency || 'USD');

    const dateVal = document.getElementById('appointment-date').value;
    if (dateVal) loadTimeSlots(doc.id, dateVal);
  };

  window.clearSelectedDoctor = function () {
    selectedDoctor = null;
    document.getElementById('selected-doctor-card').classList.add('hidden');
    document.getElementById('appointment-time').innerHTML = '<option value="">Select time...</option>';
    loadDoctors();
  };

  async function loadTimeSlots(doctorId, date) {
    const select = document.getElementById('appointment-time');
    select.innerHTML = '<option value="">Loading slots...</option>';
    try {
      const res = await API.get(`/doctors/${doctorId}/availability?date=${date}`);
      const slots = res.data?.slots || [];
      select.innerHTML = slots.length
        ? '<option value="">Select a time</option>' + slots.map(s =>
            `<option value="${s.startTime}">${s.startTime} — ${s.endTime}</option>`
          ).join('')
        : '<option value="">No slots available this day</option>';
    } catch {
      select.innerHTML = '<option value="">Could not load slots</option>';
    }
  }

  // ─── Confirm Booking ──────────────────────────────────────────────────
  document.getElementById('confirm-booking-btn')?.addEventListener('click', async () => {
    Utils.hideAlert('booking-alert');

    if (!selectedDoctor) return Utils.showAlert('booking-alert', 'Please select a doctor', 'error');
    const date = document.getElementById('appointment-date').value;
    if (!date) return Utils.showAlert('booking-alert', 'Please select a date', 'error');
    const time = document.getElementById('appointment-time').value;
    if (!time) return Utils.showAlert('booking-alert', 'Please select a time slot', 'error');

    const type = document.querySelector('input[name="consult-type"]:checked')?.value || 'video';
    const notes = document.getElementById('appointment-notes').value.trim();

    const btn = document.getElementById('confirm-booking-btn');
    Utils.setLoading(btn, true, 'Booking…');

    try {
      await API.post('/appointments', {
        doctorId: selectedDoctor.id,
        appointmentDate: `${date}T${time}:00`,
        consultationType: type,
        notes: notes || undefined,
      });
      document.getElementById('book-modal').classList.add('hidden');
      Utils.toast('Appointment booked successfully!', 'success');
      await loadAppointments();
    } catch (err) {
      Utils.showAlert('booking-alert', err.message || 'Booking failed', 'error');
    } finally {
      Utils.setLoading(btn, false);
    }
  });

  // ─── Load Appointments ────────────────────────────────────────────────
  async function loadAppointments() {
    try {
      const res = await API.get('/appointments/patient');
      appointments = res.data?.appointments || [];
      renderAppointments();
    } catch {
      document.getElementById('appointments-list').innerHTML =
        Utils.emptyState('⚠️', 'Could not load appointments');
    }
  }

  function renderAppointments() {
    const container = document.getElementById('appointments-list');
    if (!container) return;

    const filter = {
      upcoming:  ['pending', 'confirmed', 'in_progress'],
      past:      ['completed'],
      cancelled: ['cancelled'],
    }[currentTab] || [];

    const filtered = appointments.filter(a => filter.includes(a.status));

    if (!filtered.length) {
      container.innerHTML = Utils.emptyState('📅', 'No appointments here', 'Book a consultation to get started');
      return;
    }

    container.innerHTML = filtered.map(appt => {
      const docName = `${appt.doctor_first_name || ''} ${appt.doctor_last_name || ''}`.trim() || 'Doctor';
      const date = Utils.formatDate(appt.appointment_date);
      const time = Utils.formatTime(appt.appointment_date);
      const typeIcon = appt.type === 'video' ? '📹' : appt.type === 'chat' ? '💬' : '🏥';
      const canCancel = ['pending', 'confirmed'].includes(appt.status);
      const canJoin = appt.status === 'in_progress';

      return `
        <div class="rounded-[18px] p-5" style="background:var(--surface2);border:1px solid var(--border)">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0" style="background:linear-gradient(135deg,var(--cyan),var(--green))">
                ${Utils.initials(docName)}
              </div>
              <div>
                <div class="font-bold text-sm">Dr. ${Utils.escapeHtml(docName)}</div>
                <div class="text-sm" style="color:var(--text3)">${Utils.escapeHtml(appt.specialization || '')} · ${typeIcon} ${Utils.capitalize(appt.type || '')}</div>
              </div>
            </div>
            ${Utils.statusBadge(appt.status)}
          </div>
          <div class="mt-3 flex flex-wrap gap-4 text-sm" style="color:var(--text2)">
            <span>📅 ${date}</span>
            <span>🕐 ${time}</span>
            <span>💰 ${Utils.formatCurrency(appt.consultation_fee, appt.currency || 'USD')}</span>
          </div>
          ${appt.notes ? `<p class="mt-2 text-sm italic" style="color:var(--text3)">"${Utils.escapeHtml(Utils.truncate(appt.notes))}"</p>` : ''}
          ${canCancel || canJoin ? `
            <div class="mt-4 flex gap-2">
              ${canJoin ? `<a href="/pages/doctor/consultation.html?apptId=${appt.id}" class="btn-teal flex-1 text-center text-sm font-bold py-2.5">Join Consultation</a>` : ''}
              ${canCancel ? `<button onclick="cancelAppt(${appt.id})" class="flex-1 text-sm font-medium py-2.5 rounded-xl transition" style="border:1px solid var(--red);color:var(--red)">Cancel</button>` : ''}
            </div>` : ''}
        </div>`;
    }).join('');
  }

  window.cancelAppt = async function (id) {
    if (!confirm('Cancel this appointment?')) return;
    try {
      await API.put(`/appointments/${id}/cancel`);
      Utils.toast('Appointment cancelled', 'info');
      await loadAppointments();
    } catch (err) {
      Utils.toast(err.message || 'Could not cancel', 'error');
    }
  };

  await loadAppointments();
})();
