/**
 * HealthConnect — Health Records (Universal Health Record) Page
 */

(async () => {
  Auth.requireRole('patient');

  const TYPE_META = {
    diagnosis:    { icon: '🩺', label: 'Diagnosis',    color: '#F87171', bg: 'rgba(239,68,68,.1)' },
    condition:    { icon: '💊', label: 'Condition',    color: '#A5E2F6', bg: 'rgba(133,203,238,.1)' },
    procedure:    { icon: '🏥', label: 'Procedure',    color: '#818CF8', bg: 'rgba(129,140,248,.1)' },
    lab_result:   { icon: '🔬', label: 'Lab Result',   color: '#4ECFB2', bg: 'rgba(110,216,170,.1)' },
    immunization: { icon: '💉', label: 'Immunization', color: '#4ED8B9', bg: 'rgba(78,216,185,.1)' },
    allergy:      { icon: '⚠️', label: 'Allergy',      color: '#FB923C', bg: 'rgba(251,146,60,.1)' },
    note:         { icon: '📝', label: 'Note',         color: '#94A3B8', bg: 'rgba(148,163,184,.1)' },
  };

  const SEVERITY_COLORS = {
    mild:     '#4ECFB2',
    moderate: '#A5E2F6',
    severe:   '#F87171',
    critical: '#EF4444',
  };

  let currentTab = 'timeline';
  let editingId = null;

  // ─── Tabs ─────────────────────────────────────────────────────────────
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      loadContent();
    });
  });

  // ─── Add Record Modal ────────────────────────────────────────────────
  document.getElementById('add-record-btn')?.addEventListener('click', () => {
    editingId = null;
    document.getElementById('modal-title').textContent = 'Add Health Record';
    document.getElementById('rec-submit').textContent = 'Save Record';
    ['rec-type','rec-title','rec-desc','rec-provider','rec-facility','rec-icd'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('rec-date').value = Utils.todayISO();
    document.getElementById('rec-severity').value = '';
    document.getElementById('rec-status').value = 'active';
    document.getElementById('rec-alert').innerHTML = '';
    document.getElementById('record-modal').classList.remove('hidden');
  });

  // ─── Save Record ─────────────────────────────────────────────────────
  window.saveRecord = async function() {
    const data = {
      recordType:   document.getElementById('rec-type').value,
      title:        document.getElementById('rec-title').value.trim(),
      recordDate:   document.getElementById('rec-date').value,
      description:  document.getElementById('rec-desc').value.trim() || undefined,
      providerName: document.getElementById('rec-provider').value.trim() || undefined,
      facilityName: document.getElementById('rec-facility').value.trim() || undefined,
      severity:     document.getElementById('rec-severity').value || undefined,
      status:       document.getElementById('rec-status').value,
      icd10Code:    document.getElementById('rec-icd').value.trim() || undefined,
    };

    if (!data.title || !data.recordDate) {
      Utils.showAlert('rec-alert', 'Title and date are required.', 'error');
      return;
    }

    try {
      if (editingId) {
        await API.put(`/health-records/${editingId}`, data);
      } else {
        await API.post('/health-records', data);
      }
      document.getElementById('record-modal').classList.add('hidden');
      loadSummary();
      loadContent();
    } catch (err) {
      Utils.showAlert('rec-alert', err.message || 'Failed to save record.', 'error');
    }
  };

  // ─── Edit Record ─────────────────────────────────────────────────────
  window.editRecord = async function(id) {
    try {
      const res = await API.get(`/health-records/${id}`);
      const r = res.data?.record;
      if (!r) return;
      editingId = id;
      document.getElementById('modal-title').textContent = 'Edit Health Record';
      document.getElementById('rec-submit').textContent = 'Update Record';
      document.getElementById('rec-type').value = r.record_type;
      document.getElementById('rec-title').value = r.title;
      document.getElementById('rec-date').value = r.record_date?.split('T')[0] || '';
      document.getElementById('rec-desc').value = r.description || '';
      document.getElementById('rec-provider').value = r.provider_name || '';
      document.getElementById('rec-facility').value = r.facility_name || '';
      document.getElementById('rec-severity').value = r.severity || '';
      document.getElementById('rec-status').value = r.status || 'active';
      document.getElementById('rec-icd').value = r.icd10_code || '';
      document.getElementById('rec-alert').innerHTML = '';
      document.getElementById('record-modal').classList.remove('hidden');
    } catch {}
  };

  // ─── Delete Record ────────────────────────────────────────────────────
  window.deleteRecord = async function(id) {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      await API.delete(`/health-records/${id}`);
      loadSummary();
      loadContent();
    } catch {}
  };

  // ─── Load Summary ────────────────────────────────────────────────────
  async function loadSummary() {
    try {
      const res = await API.get('/health-records/summary');
      const { counts = [], activeConditions = [] } = res.data?.summary || {};
      const cards = document.getElementById('summary-cards');

      const countMap = {};
      counts.forEach(c => countMap[c.record_type] = c.count);
      const total = Object.values(countMap).reduce((a, b) => a + b, 0);

      cards.innerHTML = `
        <div class="rounded-xl p-4" style="background:var(--surface2);border:1px solid var(--border)">
          <div class="text-2xl font-bold" style="color:var(--cyan)">${total}</div>
          <div class="text-xs mt-1" style="color:var(--text3)">Total Records</div>
        </div>
        <div class="rounded-xl p-4" style="background:var(--surface2);border:1px solid var(--border)">
          <div class="text-2xl font-bold" style="color:#F87171">${countMap.diagnosis || 0}</div>
          <div class="text-xs mt-1" style="color:var(--text3)">Diagnoses</div>
        </div>
        <div class="rounded-xl p-4" style="background:var(--surface2);border:1px solid var(--border)">
          <div class="text-2xl font-bold" style="color:#A5E2F6">${activeConditions.length}</div>
          <div class="text-xs mt-1" style="color:var(--text3)">Active Conditions</div>
        </div>
        <div class="rounded-xl p-4" style="background:var(--surface2);border:1px solid var(--border)">
          <div class="text-2xl font-bold" style="color:#4ECFB2">${countMap.lab_result || 0}</div>
          <div class="text-xs mt-1" style="color:var(--text3)">Lab Results</div>
        </div>
      `;
    } catch {}
  }

  // ─── Load Content Based on Tab ────────────────────────────────────────
  async function loadContent() {
    const container = document.getElementById('records-content');

    if (currentTab === 'timeline') {
      return loadTimeline(container);
    }
    if (currentTab === 'access') {
      return loadAccessControl(container);
    }

    const typeMap = { diagnoses: 'diagnosis', conditions: 'condition', procedures: 'procedure', labs: 'lab_result' };
    const type = typeMap[currentTab] || 'diagnosis';

    try {
      const res = await API.get(`/health-records?type=${type}`);
      const records = res.data?.records || [];
      if (!records.length) {
        container.innerHTML = emptyState(TYPE_META[type]?.label || 'records');
        return;
      }
      container.innerHTML = `<div class="space-y-3">${records.map(r => recordCard(r)).join('')}</div>`;
    } catch {
      container.innerHTML = '<p class="text-center py-8 text-sm" style="color:var(--text3)">Failed to load records.</p>';
    }
  }

  // ─── Timeline View ───────────────────────────────────────────────────
  async function loadTimeline(container) {
    try {
      const res = await API.get('/health-records/timeline');
      const items = res.data?.timeline || [];
      if (!items.length) {
        container.innerHTML = emptyState('health records');
        return;
      }

      // Group by month
      const groups = {};
      items.forEach(r => {
        const d = new Date(r.record_date);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        if (!groups[key]) groups[key] = { label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), items: [] };
        groups[key].items.push(r);
      });

      let html = '';
      for (const [, group] of Object.entries(groups)) {
        html += `<div class="mb-6"><h3 class="text-sm font-semibold mb-3" style="color:var(--text3)">${group.label}</h3>`;
        html += group.items.map(r => {
          const meta = TYPE_META[r.record_type] || TYPE_META.note;
          const sevColor = SEVERITY_COLORS[r.severity] || 'var(--text3)';
          return `
            <div class="flex gap-3 mb-3">
              <div class="flex flex-col items-center">
                <div class="timeline-dot"></div>
                <div class="timeline-line flex-1 mt-1"></div>
              </div>
              <div class="record-card flex-1">
                <div class="flex items-start gap-3">
                  <div class="type-icon" style="background:${meta.bg};color:${meta.color}">${meta.icon}</div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-semibold text-sm">${Utils.escapeHtml(r.title)}</span>
                      <span class="text-[10px] px-2 py-0.5 rounded-full" style="background:${meta.bg};color:${meta.color}">${meta.label}</span>
                    </div>
                    <div class="text-xs mt-1" style="color:var(--text3)">
                      ${Utils.formatDate(r.record_date)}
                      ${r.provider_name ? ` · ${Utils.escapeHtml(r.provider_name)}` : ''}
                      ${r.facility_name ? ` · ${Utils.escapeHtml(r.facility_name)}` : ''}
                    </div>
                    ${r.severity ? `<div class="text-xs mt-1"><span class="severity-dot" style="background:${sevColor}"></span> ${r.severity}</div>` : ''}
                    ${r.description ? `<p class="text-xs mt-2 leading-relaxed" style="color:var(--text2)">${Utils.truncate(r.description, 150)}</p>` : ''}
                  </div>
                  <div class="flex gap-1 flex-shrink-0">
                    <button onclick="editRecord('${r.id}')" class="p-1.5 rounded-lg text-xs transition" style="color:var(--text3)" onmouseover="this.style.color='var(--cyan)'" onmouseout="this.style.color='var(--text3)'">✏️</button>
                    <button onclick="deleteRecord('${r.id}')" class="p-1.5 rounded-lg text-xs transition" style="color:var(--text3)" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--text3)'">🗑️</button>
                  </div>
                </div>
              </div>
            </div>`;
        }).join('');
        html += '</div>';
      }
      container.innerHTML = html;
    } catch {
      container.innerHTML = '<p class="text-center py-8 text-sm" style="color:var(--text3)">Failed to load timeline.</p>';
    }
  }

  // ─── Access Control Tab ──────────────────────────────────────────────
  async function loadAccessControl(container) {
    try {
      const res = await API.get('/health-records/access');
      const grants = res.data?.grants || [];

      container.innerHTML = `
        <div class="rounded-xl p-5 mb-4" style="background:var(--surface2);border:1px solid var(--border)">
          <h3 class="font-semibold mb-1">🔒 Who can see your records?</h3>
          <p class="text-sm" style="color:var(--text3)">You control who has access to your health records. Grant or revoke access to specific doctors anytime.</p>
        </div>
        ${!grants.length ? '<p class="text-center py-8 text-sm" style="color:var(--text3)">No access grants yet. Your records are private.</p>' :
        `<div class="space-y-3">${grants.map(g => `
          <div class="record-card flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl ${Utils.avatarColor(g.first_name)} flex items-center justify-center text-white text-sm font-bold">${Utils.initials(g.first_name+' '+g.last_name)}</div>
            <div class="flex-1">
              <div class="font-semibold text-sm">${Utils.escapeHtml(g.first_name+' '+g.last_name)}</div>
              <div class="text-xs" style="color:var(--text3)">${g.record_title} · ${g.access_level} access${g.expires_at ? ` · Expires ${Utils.formatDate(g.expires_at)}` : ''}</div>
            </div>
            <button onclick="revokeAccess('${g.record_id}','${g.granted_to}')" class="text-xs px-3 py-1.5 rounded-lg" style="background:rgba(239,68,68,.08);color:#F87171;border:1px solid rgba(239,68,68,.15)">Revoke</button>
          </div>`).join('')}
        </div>`}
      `;
    } catch {}
  }

  window.revokeAccess = async function(recordId, doctorUserId) {
    if (!confirm('Revoke access to this record?')) return;
    try {
      await API.post('/health-records/access/revoke', { recordId, doctorUserId });
      loadContent();
    } catch {}
  };

  // ─── Helpers ──────────────────────────────────────────────────────────
  function recordCard(r) {
    const meta = TYPE_META[r.record_type] || TYPE_META.note;
    const sevColor = SEVERITY_COLORS[r.severity] || 'var(--text3)';
    const statusBadge = r.status === 'active' ? 'b-green' : r.status === 'chronic' ? 'b-yellow' : r.status === 'resolved' ? 'b-cyan' : 'b-purple';

    return `
      <div class="record-card">
        <div class="flex items-start gap-3">
          <div class="type-icon" style="background:${meta.bg};color:${meta.color}">${meta.icon}</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-semibold text-sm">${Utils.escapeHtml(r.title)}</span>
              <span class="badge ${statusBadge} text-[10px]">${r.status}</span>
              ${r.icd10_code ? `<span class="text-[10px] px-1.5 py-0.5 rounded" style="background:var(--bg2);color:var(--text3)">${r.icd10_code}</span>` : ''}
            </div>
            <div class="text-xs mt-1" style="color:var(--text3)">
              ${Utils.formatDate(r.record_date)}
              ${r.provider_name ? ` · ${Utils.escapeHtml(r.provider_name)}` : ''}
              ${r.facility_name ? ` · ${Utils.escapeHtml(r.facility_name)}` : ''}
            </div>
            ${r.severity ? `<div class="text-xs mt-1"><span class="severity-dot" style="background:${sevColor}"></span> ${Utils.capitalize(r.severity)}</div>` : ''}
            ${r.description ? `<p class="text-xs mt-2 leading-relaxed" style="color:var(--text2)">${Utils.escapeHtml(r.description)}</p>` : ''}
          </div>
          <div class="flex gap-1 flex-shrink-0">
            <button onclick="editRecord('${r.id}')" class="p-1.5 rounded-lg text-xs transition" style="color:var(--text3)" onmouseover="this.style.color='var(--cyan)'" onmouseout="this.style.color='var(--text3)'">✏️</button>
            <button onclick="deleteRecord('${r.id}')" class="p-1.5 rounded-lg text-xs transition" style="color:var(--text3)" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--text3)'">🗑️</button>
          </div>
        </div>
      </div>`;
  }

  function emptyState(type) {
    return `
      <div class="text-center py-16" style="color:var(--text3)">
        <div class="text-5xl mb-4">📋</div>
        <p class="font-medium">No ${type} yet</p>
        <p class="text-sm mt-1">Add your first record to start building your health timeline</p>
      </div>`;
  }

  // ─── Init ─────────────────────────────────────────────────────────────
  loadSummary();
  loadContent();
})();
