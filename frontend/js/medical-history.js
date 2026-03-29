/**
 * HealthConnect — Medical History Page
 */

(async () => {
  Auth.requireRole('patient');

  function parseJsonSafe(value, fallback = null) {
    if (value == null) return fallback;
    if (typeof value === 'object') return value;
    if (typeof value !== 'string') return fallback;
    try { return JSON.parse(value); } catch { return fallback; }
  }

  function normalizeReport(raw = {}) {
    return {
      id: raw.id,
      symptoms: parseJsonSafe(raw.symptoms_raw, raw.symptoms || []),
      urgencyLevel: (raw.urgencyLevel || raw.urgency_level || 'low').toLowerCase(),
      createdAt: raw.createdAt || raw.created_at || null,
      aiAnalysis: parseJsonSafe(raw.ai_analysis, raw.aiAnalysis || {}),
    };
  }

  function normalizePrescription(raw = {}) {
    const first = raw.doctor_first_name || '';
    const last  = raw.doctor_last_name || '';
    return {
      id: raw.id,
      diagnosis: raw.diagnosis,
      status: raw.status || 'active',
      createdAt: raw.createdAt || raw.created_at || null,
      doctorName: raw.doctorName || `${first} ${last}`.trim(),
      notes: raw.notes,
      items: raw.items || raw.medications || [],
    };
  }

  function confidencePercent(condition = {}) {
    const score = condition.confidence ?? condition.confidenceScore ?? condition.confidence_score;
    if (typeof score === 'number') return Math.round(score <= 1 ? score * 100 : score);

    const probability = String(condition.probability || '').toLowerCase();
    if (probability === 'high') return 85;
    if (probability === 'medium') return 60;
    if (probability === 'low') return 35;
    return 0;
  }

  // ─── Tab Navigation ───────────────────────────────────────────────────
  const tabs = ['symptom-reports', 'prescriptions', 'profile'];
  window.currentHistoryTab = 'symptom-reports';

  function activateTab(tab) {
    if (!tabs.includes(tab)) return;
    window.currentHistoryTab = tab;

    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active', 'text-primary', 'border-b-2', 'border-primary', 'font-semibold');
      if (b.dataset.tab === tab) {
        b.classList.add('active', 'text-primary', 'border-b-2', 'border-primary', 'font-semibold');
      }
    });

    tabs.forEach(t => document.getElementById(`tab-${t}`)?.classList.toggle('hidden', t !== tab));
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activateTab(btn.dataset.tab);
    });
  });

  // Optional deep link: /pages/patient/medical-history.html?tab=profile
  const initialTab = new URLSearchParams(window.location.search).get('tab');
  if (initialTab) activateTab(initialTab);

  // ─── Load Symptom Reports ─────────────────────────────────────────────
  async function loadReports() {
    const container = document.getElementById('reports-list');
    if (!container) return;
    try {
      const res = await API.get('/symptoms/history?limit=50');
      const reports = (res.data?.reports || []).map(normalizeReport);
      if (!reports.length) {
        container.innerHTML = Utils.emptyState('🔍', 'No symptom checks yet', 'Use the AI Symptom Checker to analyse your symptoms');
        return;
      }
      container.innerHTML = reports.map(r => {
        const syms = (r.symptoms || []).slice(0, 4).map(s => Utils.escapeHtml(s)).join(', ');
        return `
          <div onclick='openReportModal(${JSON.stringify(r.id)})'
            class="rounded-[18px] p-5 cursor-pointer transition" style="background:var(--surface2);border:1px solid var(--border)">
            <div class="flex items-center justify-between">
              <div>
                <div class="font-semibold text-sm">${syms || 'Symptom check'}</div>
                <div class="text-xs mt-0.5" style="color:var(--text3)">${Utils.formatDateTime(r.createdAt)}</div>
              </div>
              ${Utils.urgencyBadge(r.urgencyLevel)}
            </div>
          </div>`;
      }).join('');
    } catch {
      container.innerHTML = Utils.emptyState('⚠️', 'Could not load reports');
    }
  }

  window.openReportModal = async function (id) {
    const modal = document.getElementById('report-modal');
    const body  = document.getElementById('report-modal-body');
    modal.classList.remove('hidden');
    body.innerHTML = '<div class="text-center py-8" style="color:var(--text3)">Loading…</div>';
    try {
      const res = await API.get(`/symptoms/report/${id}`);
      const report = normalizeReport(res.data?.report || {});
      const analysis = report.aiAnalysis || {};
      const urgency  = CONFIG.URGENCY[report.urgencyLevel] || CONFIG.URGENCY.low;

      body.innerHTML = `
        <div class="space-y-4">
          <div class="rounded-xl p-3 flex items-center gap-2" style="background:${urgency.bg};border:1px solid ${urgency.border}">
            <span class="text-2xl">${urgency.icon}</span>
            <span class="font-semibold" style="color:${urgency.color}">${urgency.label} Priority</span>
          </div>
          <div>
            <div class="text-xs font-medium mb-1" style="color:var(--text3)">SYMPTOMS REPORTED</div>
            <div class="flex flex-wrap gap-2">${(report.symptoms || []).map(s =>
              `<span class="chip">${Utils.escapeHtml(s)}</span>`
            ).join('')}</div>
          </div>
          <div>
            <div class="text-xs font-medium mb-1" style="color:var(--text3)">AI SUMMARY</div>
            <p class="text-sm" style="color:var(--text2)">${Utils.escapeHtml(analysis.summary || '—')}</p>
          </div>
          ${(analysis.possibleConditions || []).length ? `
          <div>
            <div class="text-xs font-medium mb-2" style="color:var(--text3)">POSSIBLE CONDITIONS</div>
            <div class="space-y-2">${(analysis.possibleConditions || []).map(c => {
              const pct = confidencePercent(c);
              return `<div class="flex justify-between items-center text-sm">
                <span>${Utils.escapeHtml(c.name)}</span>
                <span class="text-xs font-bold" style="color:var(--text3)">${pct}%</span>
              </div>`;
            }).join('')}</div>
          </div>` : ''}
          <div class="text-xs pt-2" style="color:var(--text3);border-top:1px solid var(--border)">
            Report generated ${Utils.formatDateTime(report.createdAt)}
          </div>
        </div>`;
    } catch {
      body.innerHTML = Utils.emptyState('⚠️', 'Could not load report');
    }
  };

  // ─── Load Prescriptions ───────────────────────────────────────────────
  async function loadPrescriptions() {
    const container = document.getElementById('prescriptions-list');
    if (!container) return;
    try {
      const res = await API.get('/patients/prescriptions');
      const rxList = (res.data?.prescriptions || []).map(normalizePrescription);
      if (!rxList.length) {
        container.innerHTML = Utils.emptyState('💊', 'No prescriptions yet');
        return;
      }
      container.innerHTML = rxList.map(rx => `
        <div onclick='openRxModal(${JSON.stringify(rx.id)})'
          class="rounded-[18px] p-5 cursor-pointer transition" style="background:var(--surface2);border:1px solid var(--border)">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-semibold text-sm">${Utils.escapeHtml(rx.diagnosis || 'Prescription')}</div>
              <div class="text-xs mt-0.5" style="color:var(--text3)">Dr. ${Utils.escapeHtml(rx.doctorName || '')} · ${Utils.formatDate(rx.createdAt)}</div>
            </div>
            <span class="badge ${rx.status === 'active' ? 'b-green' : 'b-purple'}">
              ${Utils.capitalize(rx.status || 'active')}
            </span>
          </div>
        </div>
      `).join('');
    } catch {
      container.innerHTML = Utils.emptyState('⚠️', 'Could not load prescriptions');
    }
  }

  window.openRxModal = async function (id) {
    const modal = document.getElementById('rx-modal');
    const body  = document.getElementById('rx-modal-body');
    modal.classList.remove('hidden');
    body.innerHTML = '<div class="text-center py-8" style="color:var(--text3)">Loading…</div>';
    try {
      const res = await API.get(`/patients/prescriptions`);
      const rx  = (res.data?.prescriptions || []).map(normalizePrescription).find(p => p.id === id);
      if (!rx) throw new Error('Not found');

      body.innerHTML = `
        <div class="space-y-4">
          <div class="flex justify-between">
            <div>
              <div class="font-bold">${Utils.escapeHtml(rx.diagnosis || 'Prescription')}</div>
              <div class="text-xs" style="color:var(--text3)">Dr. ${Utils.escapeHtml(rx.doctorName || '')} · ${Utils.formatDate(rx.createdAt)}</div>
            </div>
          </div>
          <div>
            <div class="text-xs font-medium mb-2" style="color:var(--text3)">MEDICATIONS</div>
            <div class="space-y-2">
              ${(rx.items || []).map(item => `
                <div class="rounded-xl p-3" style="background:var(--bg2);border:1px solid var(--border)">
                  <div class="font-semibold text-sm">${Utils.escapeHtml(item.medicationName || item.medication_name || '')}</div>
                  <div class="text-xs mt-1" style="color:var(--text3)">
                    ${item.dosage ? `Dosage: ${Utils.escapeHtml(item.dosage)}` : ''}
                    ${item.frequency ? ` · ${Utils.escapeHtml(item.frequency)}` : ''}
                    ${item.duration ? ` · ${Utils.escapeHtml(item.duration)}` : ''}
                  </div>
                  ${item.instructions ? `<div class="text-xs mt-1" style="color:var(--text3)">${Utils.escapeHtml(item.instructions)}</div>` : ''}
                </div>`).join('')}
              ${(rx.items || []).length ? '' : `<div class="text-xs" style="color:var(--text3)">Medication details are not available in this summary view yet.</div>`}
            </div>
          </div>
          ${rx.notes ? `<div><div class="text-xs font-medium mb-1" style="color:var(--text3)">NOTES</div><p class="text-sm" style="color:var(--text2)">${Utils.escapeHtml(rx.notes)}</p></div>` : ''}
        </div>`;
    } catch {
      body.innerHTML = Utils.emptyState('⚠️', 'Could not load prescription');
    }
  };

  // ─── Avatar Upload ────────────────────────────────────────────────────
  const fileInput     = document.getElementById('avatar-file');
  const uploadBtn     = document.getElementById('upload-avatar-btn');
  const avatarPreview = document.getElementById('avatar-preview');
  const avatarInitials= document.getElementById('avatar-initials-profile');

  // Populate preview from current user
  const currentUser = Auth.getUser();
  if (currentUser) {
    const initials = Utils.initials(`${currentUser.firstName || ''} ${currentUser.lastName || ''}`);
    if (avatarInitials) avatarInitials.textContent = initials;
    if (currentUser.avatarUrl && avatarPreview) {
      avatarPreview.src = currentUser.avatarUrl;
      avatarPreview.classList.remove('hidden');
      if (avatarInitials) avatarInitials.classList.add('hidden');
    }
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) {
        Utils.showAlert('avatar-alert', 'Image must be under 3 MB', 'error');
        fileInput.value = '';
        return;
      }
      // Show local preview
      const reader = new FileReader();
      reader.onload = (e) => {
        if (avatarPreview) { avatarPreview.src = e.target.result; avatarPreview.classList.remove('hidden'); }
        if (avatarInitials) avatarInitials.classList.add('hidden');
      };
      reader.readAsDataURL(file);
      Utils.hideAlert('avatar-alert');
      if (uploadBtn) uploadBtn.classList.remove('hidden');
    });
  }

  if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
      const file = fileInput?.files[0];
      if (!file) return;
      Utils.setLoading(uploadBtn, true, 'Uploading…');
      Utils.hideAlert('avatar-alert');
      try {
        const formData = new FormData();
        formData.append('avatar', file);
        const res = await API.upload('/patients/avatar', formData);
        const newUrl = res.data?.avatarUrl;
        // Persist to local user object so sidebar refreshes on next navigation
        const user = Auth.getUser();
        if (user && newUrl) { user.avatarUrl = newUrl; Auth.saveUser(user); }
        uploadBtn.classList.add('hidden');
        fileInput.value = '';
        Utils.showAlert('avatar-alert', 'Profile picture updated!', 'success');
      } catch (err) {
        Utils.showAlert('avatar-alert', err.message || 'Upload failed', 'error');
      } finally {
        Utils.setLoading(uploadBtn, false);
      }
    });
  }

  // ─── Health Profile ───────────────────────────────────────────────────
  async function loadHealthProfile() {
    try {
      const res = await API.get('/patients/profile');
      const profile = res.data?.patient || {};
      Utils.setFieldValue('blood-type', profile.blood_type);
      Utils.setFieldValue('weight', profile.weight_kg);
      Utils.setFieldValue('height', profile.height_cm);
      Utils.setFieldValue('date-of-birth', profile.date_of_birth?.split('T')[0]);
      Utils.setFieldValue('chronic-conditions', profile.chronic_conditions);
      Utils.setFieldValue('allergies', profile.allergies);
      Utils.setFieldValue('current-medications', profile.current_medications);
      Utils.setFieldValue('surgical-history', profile.surgical_history);
      Utils.setFieldValue('profile-address', profile.address);
      Utils.setFieldValue('profile-city', profile.city);
      Utils.setFieldValue('profile-state', profile.state);
      Utils.setFieldValue('profile-country', profile.country);
      Utils.setFieldValue('profile-latitude', profile.latitude);
      Utils.setFieldValue('profile-longitude', profile.longitude);
    } catch { /* Pre-fill silently ignored */ }
  }

  document.getElementById('detect-profile-location-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('detect-profile-location-btn');
    Utils.hideAlert('profile-location-alert');

    if (!navigator.geolocation) {
      Utils.showAlert('profile-location-alert', 'Geolocation is not supported on this device.', 'error');
      return;
    }

    Utils.setLoading(btn, true, 'Detecting…');
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true,
          maximumAge: 120000,
        });
      });

      Utils.setFieldValue('profile-latitude', pos.coords.latitude.toFixed(7));
      Utils.setFieldValue('profile-longitude', pos.coords.longitude.toFixed(7));
      Utils.showAlert('profile-location-alert', 'Location detected. Add city/region if needed, then save profile.', 'success');
    } catch (err) {
      Utils.showAlert('profile-location-alert', 'Could not detect location. Please allow location access or enter it manually.', 'error');
    } finally {
      Utils.setLoading(btn, false);
    }
  });

  document.getElementById('save-profile-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('save-profile-btn');
    Utils.setLoading(btn, true, 'Saving…');
    Utils.hideAlert('profile-alert');
    try {
      await API.put('/patients/profile', {
        blood_type:          document.getElementById('blood-type').value || undefined,
        weight_kg:           document.getElementById('weight').value || undefined,
        height_cm:           document.getElementById('height').value || undefined,
        date_of_birth:       document.getElementById('date-of-birth').value || undefined,
        chronic_conditions:  document.getElementById('chronic-conditions').value.trim() || undefined,
        allergies:           document.getElementById('allergies').value.trim() || undefined,
        current_medications: document.getElementById('current-medications').value.trim() || undefined,
        surgical_history:    document.getElementById('surgical-history').value.trim() || undefined,
        address:             document.getElementById('profile-address').value.trim() || undefined,
        city:                document.getElementById('profile-city').value.trim() || undefined,
        state:               document.getElementById('profile-state').value.trim() || undefined,
        country:             document.getElementById('profile-country').value.trim() || undefined,
        latitude:            document.getElementById('profile-latitude').value || undefined,
        longitude:           document.getElementById('profile-longitude').value || undefined,
      });
      Utils.showAlert('profile-alert', 'Health profile saved!', 'success');
    } catch (err) {
      Utils.showAlert('profile-alert', err.message || 'Save failed', 'error');
    } finally {
      Utils.setLoading(btn, false);
    }
  });

  // ─── Init ─────────────────────────────────────────────────────────────
  await Promise.allSettled([loadReports(), loadPrescriptions(), loadHealthProfile()]);
})();
