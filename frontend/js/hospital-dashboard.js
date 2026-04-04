/**
 * HealthConnect — Hospital Dashboard
 * Manages hospital profile, doctors, patients, and test results
 */

(async () => {
  const user = Auth.requireRole('hospital_admin');
  if (!user) return;

  // Block unverified hospital admins
  if (user.verificationStatus && user.verificationStatus !== 'verified') {
    window.location.href = '/pages/auth/pending-verification.html';
    return;
  }

  // ─── State ────────────────────────────────────────────────────────────
  let hospital = null;
  let stats = {};
  let selectedDoctorId = null;

  // ─── Init ─────────────────────────────────────────────────────────────
  document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  await loadHospital();

  // ─── Load Hospital Data ───────────────────────────────────────────────
  async function loadHospital() {
    try {
      const res = await API.get('/hospitals/me/hospital');
      hospital = res.data.hospital;
      stats = res.data.stats || {};
      renderDashboard();
      document.getElementById('no-hospital-banner').classList.add('hidden');
      document.getElementById('stats-section').classList.remove('hidden');
    } catch (err) {
      if (err.status === 404) {
        // No hospital registered yet
        document.getElementById('no-hospital-banner').classList.remove('hidden');
        document.getElementById('stats-section').classList.add('hidden');
      }
    }
  }

  // ─── Render Dashboard ────────────────────────────────────────────────
  function renderDashboard() {
    if (!hospital) return;

    // Sidebar
    document.getElementById('hospital-name-sidebar').textContent = hospital.name;
    document.getElementById('hospital-type-sidebar').textContent = capitalize(hospital.type);

    // Stats
    document.getElementById('stat-doctors').textContent = stats.total_doctors || 0;
    document.getElementById('stat-patients').textContent = stats.total_patients || 0;
    document.getElementById('stat-tests').textContent = stats.total_tests || 0;
    document.getElementById('stat-appointments').textContent = stats.total_appointments || 0;

    // Info
    document.getElementById('info-name').textContent = hospital.name;
    document.getElementById('info-type').textContent = capitalize(hospital.type);
    document.getElementById('info-city').textContent = hospital.city || '—';
    document.getElementById('info-rating').textContent = hospital.rating ? parseFloat(hospital.rating).toFixed(1) + ' ⭐' : 'No ratings yet';
    document.getElementById('info-emergency').textContent = hospital.emergency_available ? '✅ Yes' : '❌ No';

    // Verification badge
    const badge = document.getElementById('verification-badge');
    const statusMap = {
      pending: { text: '⏳ Pending Verification', cls: 'b-yellow' },
      verified: { text: '✅ Verified', cls: 'b-green' },
      rejected: { text: '❌ Rejected', cls: 'b-red' },
      suspended: { text: '⚠️ Suspended', cls: 'b-red' },
    };
    const s = statusMap[hospital.verification_status] || statusMap.pending;
    badge.textContent = s.text;
    badge.className = 'badge text-xs ' + s.cls;

    // Pre-fill profile form
    fillProfileForm();
  }

  // ─── Tab Navigation ──────────────────────────────────────────────────
  window.showTab = function (tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('tab-' + tab);
    if (target) target.classList.remove('hidden');

    // Load data for the tab
    if (tab === 'doctors') loadDoctors();
    if (tab === 'patients') loadPatients();
    if (tab === 'test-results') loadTestResults();
  };

  // ─── Sidebar Toggle ──────────────────────────────────────────────────
  window.toggleSidebar = function () {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
  };

  // ─── Modal Helpers ────────────────────────────────────────────────────
  window.closeModal = function (id) {
    document.getElementById(id).classList.add('hidden');
  };

  // ═══════════════════════════════════════════════════════════════════════
  // DOCTORS
  // ═══════════════════════════════════════════════════════════════════════

  async function loadDoctors() {
    const list = document.getElementById('doctors-list');
    try {
      const res = await API.get('/hospitals/me/doctors');
      const doctors = res.data.doctors || [];
      if (!doctors.length) {
        list.innerHTML = '<div class="text-center py-8 text-sm" style="color:var(--text3)">No doctors linked yet. Click "Add Doctor" to get started.</div>';
        return;
      }
      list.innerHTML = doctors.map(d => `
        <div class="rounded-xl p-4 flex items-center gap-4" style="background:var(--surface2);border:1px solid var(--border)">
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg" style="background:var(--surface1)">👨‍⚕️</div>
          <div class="flex-1">
            <p class="font-semibold text-sm">Dr. ${esc(d.first_name)} ${esc(d.last_name)}</p>
            <p class="text-xs" style="color:var(--cyan)">${esc(d.specialization || 'General')}</p>
            <p class="text-xs" style="color:var(--text3)">${esc(d.department || '')} ${d.position ? '· ' + esc(d.position) : ''}</p>
          </div>
          <div class="text-right">
            <span class="badge ${d.status === 'active' ? 'b-green' : 'b-yellow'} text-xs">${d.status}</span>
            <button onclick="removeDoctor('${d.doctor_id}')" class="block text-xs mt-1" style="color:var(--red)">Remove</button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      list.innerHTML = '<div class="text-center py-8 text-sm" style="color:var(--red)">Failed to load doctors.</div>';
    }
  }

  window.showAddDoctorModal = function () {
    document.getElementById('add-doctor-modal').classList.remove('hidden');
    selectedDoctorId = null;
    document.getElementById('confirm-add-doctor').disabled = true;
  };

  // Doctor search
  let searchTimeout;
  document.getElementById('search-doctor-input').addEventListener('input', function () {
    clearTimeout(searchTimeout);
    const q = this.value.trim();
    if (q.length < 2) { document.getElementById('doctor-search-results').innerHTML = ''; return; }
    searchTimeout = setTimeout(async () => {
      try {
        const res = await API.get('/doctors/search?q=' + encodeURIComponent(q) + '&limit=5');
        const doctors = res.data.doctors || [];
        document.getElementById('doctor-search-results').innerHTML = doctors.map(d => `
          <div class="p-2 rounded-lg cursor-pointer hover:opacity-80 transition text-sm flex items-center gap-2"
               style="background:var(--surface1);border:1px solid var(--border)"
               onclick="selectDoctor('${d.id}', 'Dr. ${esc(d.first_name)} ${esc(d.last_name)}')">
            <span>👨‍⚕️</span>
            <span>Dr. ${esc(d.first_name)} ${esc(d.last_name)} — ${esc(d.specialization || 'General')}</span>
          </div>
        `).join('');
      } catch (e) { /* ignore */ }
    }, 300);
  });

  window.selectDoctor = function (id, name) {
    selectedDoctorId = id;
    document.getElementById('search-doctor-input').value = name;
    document.getElementById('doctor-search-results').innerHTML = '';
    document.getElementById('confirm-add-doctor').disabled = false;
  };

  document.getElementById('confirm-add-doctor').addEventListener('click', async function () {
    if (!selectedDoctorId) return;
    Utils.setLoading(this, true);
    try {
      await API.post('/hospitals/me/doctors', {
        doctorId: selectedDoctorId,
        department: document.getElementById('add-doctor-dept').value.trim(),
        position: document.getElementById('add-doctor-position').value.trim(),
      });
      Utils.toast('Doctor added successfully!', 'success');
      closeModal('add-doctor-modal');
      loadDoctors();
      loadHospital(); // refresh stats
    } catch (err) {
      Utils.toast(err.message || 'Failed to add doctor', 'error');
    } finally {
      Utils.setLoading(this, false);
    }
  });

  window.removeDoctor = async function (doctorId) {
    if (!confirm('Remove this doctor from your hospital?')) return;
    try {
      await API.delete('/hospitals/me/doctors/' + doctorId);
      Utils.toast('Doctor removed.', 'success');
      loadDoctors();
      loadHospital();
    } catch (err) {
      Utils.toast(err.message || 'Failed to remove doctor', 'error');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PATIENTS
  // ═══════════════════════════════════════════════════════════════════════

  async function loadPatients() {
    const list = document.getElementById('patients-list');
    try {
      const res = await API.get('/hospitals/me/patients');
      const patients = res.data.patients || [];
      if (!patients.length) {
        list.innerHTML = '<div class="text-center py-8 text-sm" style="color:var(--text3)">No patients registered yet.</div>';
        return;
      }
      list.innerHTML = patients.map(p => `
        <div class="rounded-xl p-4 flex items-center gap-4" style="background:var(--surface2);border:1px solid var(--border)">
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg" style="background:var(--surface1)">👤</div>
          <div class="flex-1">
            <p class="font-semibold text-sm">${esc(p.first_name)} ${esc(p.last_name)}</p>
            <p class="text-xs" style="color:var(--text3)">File: ${esc(p.hospital_number || 'N/A')} · ${esc(p.gender || '')} · ${p.date_of_birth || ''}</p>
          </div>
          <div class="text-right">
            <span class="badge b-green text-xs">${p.status}</span>
            <button onclick="removePatient('${p.patient_id}')" class="block text-xs mt-1" style="color:var(--red)">Remove</button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      list.innerHTML = '<div class="text-center py-8 text-sm" style="color:var(--red)">Failed to load patients.</div>';
    }
  }

  window.showAddPatientModal = function () {
    document.getElementById('add-patient-modal').classList.remove('hidden');
  };

  window.confirmAddPatient = async function () {
    const patientId = document.getElementById('add-patient-id').value.trim();
    const hospitalNumber = document.getElementById('add-patient-number').value.trim();
    if (!patientId) return Utils.toast('Patient ID is required', 'warning');

    try {
      await API.post('/hospitals/me/patients', { patientId, hospitalNumber });
      Utils.toast('Patient registered to hospital!', 'success');
      closeModal('add-patient-modal');
      loadPatients();
      loadHospital();
    } catch (err) {
      Utils.toast(err.message || 'Failed to register patient', 'error');
    }
  };

  window.removePatient = async function (patientId) {
    if (!confirm('Remove this patient from your hospital?')) return;
    try {
      await API.delete('/hospitals/me/patients/' + patientId);
      Utils.toast('Patient removed.', 'success');
      loadPatients();
      loadHospital();
    } catch (err) {
      Utils.toast(err.message || 'Failed to remove patient', 'error');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // TEST RESULTS
  // ═══════════════════════════════════════════════════════════════════════

  async function loadTestResults() {
    const list = document.getElementById('test-results-list');
    try {
      const res = await API.get('/hospitals/me/test-results');
      const results = res.data.testResults || [];
      if (!results.length) {
        list.innerHTML = '<div class="text-center py-8 text-sm" style="color:var(--text3)">No test results yet. Click "New Test" to create one.</div>';
        return;
      }
      list.innerHTML = results.map(t => {
        const statusMap = {
          ordered: { icon: '📋', cls: 'b-yellow' },
          in_progress: { icon: '⏳', cls: 'b-cyan' },
          completed: { icon: '✅', cls: 'b-green' },
          cancelled: { icon: '❌', cls: 'b-red' },
        };
        const s = statusMap[t.status] || statusMap.ordered;
        return `
          <div class="rounded-xl p-4" style="background:var(--surface2);border:1px solid var(--border)">
            <div class="flex items-start justify-between">
              <div>
                <p class="font-semibold text-sm">${s.icon} ${esc(t.test_name)}</p>
                <p class="text-xs" style="color:var(--text3)">Patient: ${esc(t.patient_name || 'Unknown')} · Type: ${esc(t.test_type)}</p>
                <p class="text-xs mt-1" style="color:var(--text3)">${t.result_summary ? esc(t.result_summary.substring(0, 100)) + '...' : 'No results yet'}</p>
              </div>
              <div class="text-right">
                <span class="badge ${s.cls} text-xs">${t.status}</span>
                ${t.is_critical ? '<span class="badge b-red text-xs ml-1">⚠️ Critical</span>' : ''}
                <p class="text-xs mt-1" style="color:var(--text3)">${new Date(t.created_at).toLocaleDateString()}</p>
                ${t.status !== 'completed' ? `<button onclick="markTestComplete('${t.id}')" class="text-xs mt-1" style="color:var(--cyan)">Mark Complete</button>` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      list.innerHTML = '<div class="text-center py-8 text-sm" style="color:var(--red)">Failed to load test results.</div>';
    }
  }

  window.showCreateTestModal = function () {
    document.getElementById('create-test-modal').classList.remove('hidden');
  };

  window.submitTestResult = async function () {
    const patientId = document.getElementById('test-patient-id').value.trim();
    const testName = document.getElementById('test-name').value.trim();
    if (!patientId || !testName) return Utils.toast('Patient ID and test name are required', 'warning');

    try {
      await API.post('/hospitals/me/test-results', {
        patientId,
        testName,
        testType: document.getElementById('test-type').value,
        description: document.getElementById('test-description').value.trim(),
        resultSummary: document.getElementById('test-summary').value.trim(),
        status: document.getElementById('test-status').value,
        isCritical: document.getElementById('test-critical').checked,
      });
      Utils.toast('Test result created and patient notified!', 'success');
      closeModal('create-test-modal');
      loadTestResults();
      loadHospital();
    } catch (err) {
      // Show detailed backend validation errors if present
      if (err.errors && Array.isArray(err.errors)) {
        const details = err.errors.map(e => e.msg || e.message || JSON.stringify(e)).join('\n');
        Utils.toast('Validation failed:\n' + details, 'error');
      } else {
        Utils.toast(err.message || 'Failed to create test result', 'error');
      }
    }
  };

  window.markTestComplete = async function (id) {
    const summary = prompt('Enter result summary:');
    if (summary === null) return;
    try {
      await API.put('/hospitals/me/test-results/' + id, { status: 'completed', result_summary: summary });
      Utils.toast('Test marked as complete. Patient notified!', 'success');
      loadTestResults();
    } catch (err) {
      Utils.toast(err.message || 'Failed to update test', 'error');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // HOSPITAL PROFILE FORM
  // ═══════════════════════════════════════════════════════════════════════

  function fillProfileForm() {
    if (!hospital) return;
    document.getElementById('h-name').value = hospital.name || '';
    document.getElementById('h-reg').value = hospital.registration_number || '';
    document.getElementById('h-type').value = hospital.type || 'general';
    document.getElementById('h-phone').value = hospital.phone || '';
    document.getElementById('h-email').value = hospital.email || '';
    document.getElementById('h-city').value = hospital.city || '';
    document.getElementById('h-state').value = hospital.state || '';
    document.getElementById('h-country').value = hospital.country || 'Uganda';
    document.getElementById('h-address').value = hospital.address || '';
    document.getElementById('h-description').value = hospital.description || '';
    document.getElementById('h-beds').value = hospital.bed_count || '';
    document.getElementById('h-emergency').checked = !!hospital.emergency_available;
    document.getElementById('h-lat').value = hospital.latitude || '';
    document.getElementById('h-lng').value = hospital.longitude || '';
    if (hospital.latitude) {
      document.getElementById('h-location-status').textContent = '✅ Location set';
    }
  }

  document.getElementById('hospital-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = document.getElementById('save-hospital-btn');
    Utils.setLoading(btn, true, 'Saving...');

    const payload = {
      name: document.getElementById('h-name').value.trim(),
      registrationNumber: document.getElementById('h-reg').value.trim(),
      type: document.getElementById('h-type').value,
      phone: document.getElementById('h-phone').value.trim(),
      email: document.getElementById('h-email').value.trim(),
      city: document.getElementById('h-city').value.trim(),
      state: document.getElementById('h-state').value.trim(),
      country: document.getElementById('h-country').value.trim(),
      address: document.getElementById('h-address').value.trim(),
      description: document.getElementById('h-description').value.trim(),
      bedCount: parseInt(document.getElementById('h-beds').value) || 0,
      emergencyAvailable: document.getElementById('h-emergency').checked,
      latitude: parseFloat(document.getElementById('h-lat').value) || null,
      longitude: parseFloat(document.getElementById('h-lng').value) || null,
    };

    try {
      if (hospital) {
        // Update existing
        await API.put('/hospitals/me/hospital', payload);
        Utils.toast('Hospital profile updated!', 'success');
      } else {
        // Register new
        await API.post('/hospitals/register', payload);
        Utils.toast('Hospital registered! Pending verification.', 'success');
      }
      await loadHospital();
    } catch (err) {
      Utils.toast(err.message || 'Failed to save hospital', 'error');
    } finally {
      Utils.setLoading(btn, false);
    }
  });

  // ─── Location Detection ──────────────────────────────────────────────
  window.detectHospitalLocation = function () {
    if (!navigator.geolocation) return Utils.toast('Geolocation not supported', 'warning');
    const statusEl = document.getElementById('h-location-status');
    statusEl.textContent = '📡 Detecting...';
    navigator.geolocation.getCurrentPosition(
      pos => {
        document.getElementById('h-lat').value = pos.coords.latitude;
        document.getElementById('h-lng').value = pos.coords.longitude;
        statusEl.textContent = '✅ Location detected!';
        statusEl.style.color = 'var(--green)';
      },
      err => {
        statusEl.textContent = '❌ Location failed';
        statusEl.style.color = 'var(--red)';
        Utils.toast('Could not detect location: ' + err.message, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ─── Helpers ──────────────────────────────────────────────────────────
  function esc(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(str || '').replace(/[&<>"']/g, m => map[m]);
  }
  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

})();
