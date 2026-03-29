/**
 * HealthConnect — Vital Signs Tracker
 * Optimized for mobile performance with lazy loading and responsive charts
 */

let bpChart, hrChart, sugarChart, weightChart;
let chartsLoaded = false;

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  devicePixelRatio: window.devicePixelRatio || 1,
  animation: {
    duration: window.innerWidth < 768 ? 300 : 600,
  },
  plugins: { 
    legend: { 
      labels: { 
        color: '#E4F2FF', 
        font: { size: window.innerWidth < 768 ? 10 : 11 },
        padding: window.innerWidth < 768 ? 8 : 12,
      },
      display: true,
    },
  },
  scales: {
    x: { 
      ticks: { 
        color: 'rgba(228,242,255,.35)', 
        font: { size: window.innerWidth < 768 ? 9 : 10 },
        autoSkip: true,
        maxTicksLimit: window.innerWidth < 768 ? 5 : 8,
        maxRotation: 45,
        minRotation: 0,
      }, 
      grid: { color: 'rgba(34,211,238,.06)' } 
    },
    y: { 
      ticks: { 
        color: 'rgba(228,242,255,.35)', 
        font: { size: window.innerWidth < 768 ? 9 : 10 } 
      }, 
      grid: { color: 'rgba(34,211,238,.06)' } 
    },
  },
};

// ─── Initialize ───────────────────────────────────────────────────────────
(async function init() {
  // Load critical data first
  await Promise.all([loadLatest(), loadHistory(), loadAlerts()]);
  // Defer chart loading for better performance
  if (document.hidden) {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !chartsLoaded) loadTrends();
    }, { once: true });
  } else {
    loadTrends();
  }
})();

// ─── Load Latest Reading ──────────────────────────────────────────────────
async function loadLatest() {
  try {
    const res = await API.get('/vitals/latest');
    const v = res.data.vital;
    if (!v) return;

    document.getElementById('v-bp').textContent = v.systolic_bp ? `${v.systolic_bp}/${v.diastolic_bp}` : '—/—';
    document.getElementById('v-hr').textContent = v.heart_rate || '—';
    document.getElementById('v-temp').textContent = v.temperature || '—';
    document.getElementById('v-spo2').textContent = v.oxygen_sat || '—';
    document.getElementById('v-sugar').textContent = v.blood_sugar || '—';
    document.getElementById('v-weight').textContent = v.weight_kg || '—';

    // Color code abnormal values
    colorCodeVital('v-bp', v.systolic_bp > 140 || v.systolic_bp < 90 || v.diastolic_bp > 90 || v.diastolic_bp < 60);
    colorCodeVital('v-hr', v.heart_rate > 100 || v.heart_rate < 50);
    colorCodeVital('v-temp', v.temperature > 38.0 || v.temperature < 35.5);
    colorCodeVital('v-spo2', v.oxygen_sat && v.oxygen_sat < 94);
    colorCodeVital('v-sugar', v.blood_sugar > 200 || v.blood_sugar < 70);
  } catch (err) {
    console.warn('Failed to load latest vitals:', err);
  }
}

function colorCodeVital(id, isAbnormal) {
  const el = document.getElementById(id);
  if (isAbnormal) {
    el.style.color = 'var(--red)';
    el.parentElement.style.borderColor = 'rgba(244,63,94,.3)';
    el.parentElement.style.background = 'rgba(244,63,94,.06)';
  }
}

// ─── Load History Table ───────────────────────────────────────────────────
async function loadHistory() {
  try {
    const res = await API.get('/vitals/history?limit=50');
    const vitals = res.data.vitals;
    const table = document.getElementById('vitals-table');
    const noVitals = document.getElementById('no-vitals');

    if (!vitals?.length) {
      table.innerHTML = '';
      noVitals.classList.remove('hidden');
      return;
    }

    noVitals.classList.add('hidden');
    table.innerHTML = vitals.map(v => `
      <tr class="border-t" style="border-color:var(--border)">
        <td class="py-2.5 text-xs">${new Date(v.recorded_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</td>
        <td class="py-2.5 text-xs font-semibold ${isAbnormalBP(v) ? 'text-red-400' : ''}">${v.systolic_bp ? `${v.systolic_bp}/${v.diastolic_bp}` : '—'}</td>
        <td class="py-2.5 text-xs ${isAbnormalHR(v) ? 'text-red-400' : ''}">${v.heart_rate || '—'}</td>
        <td class="py-2.5 text-xs ${v.temperature > 38 ? 'text-red-400' : ''}">${v.temperature || '—'}</td>
        <td class="py-2.5 text-xs ${v.oxygen_sat && v.oxygen_sat < 94 ? 'text-red-400' : ''}">${v.oxygen_sat || '—'}</td>
        <td class="py-2.5 text-xs ${isAbnormalSugar(v) ? 'text-red-400' : ''}">${v.blood_sugar || '—'}</td>
        <td class="py-2.5 text-xs">${v.weight_kg || '—'}</td>
        <td class="py-2.5 text-xs" style="color:var(--text3);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${v.notes || ''}">${v.notes || '—'}</td>
        <td class="py-2.5">
          <button onclick="deleteVital('${v.id}')" class="text-xs px-2 py-1 rounded hover:bg-red-500/10 min-h-[44px] min-w-[44px] flex items-center justify-center" style="color:var(--red)" title="Delete">🗑️</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.warn('Failed to load vitals history:', err);
  }
}

function isAbnormalBP(v) { return v.systolic_bp > 140 || v.systolic_bp < 90 || v.diastolic_bp > 90 || v.diastolic_bp < 60; }
function isAbnormalHR(v) { return v.heart_rate > 100 || v.heart_rate < 50; }
function isAbnormalSugar(v) { return v.blood_sugar > 200 || v.blood_sugar < 70; }

// ─── Load Trends (Charts) ────────────────────────────────────────────────
async function loadTrends() {
  chartsLoaded = true;
  
  const days = document.getElementById('bp-days')?.value || 30;
  try {
    const [bpRes, hrRes, sugarRes, weightRes] = await Promise.all([
      API.get(`/vitals/trends?metric=systolic_bp&days=${days}`),
      API.get(`/vitals/trends?metric=heart_rate&days=${days}`),
      API.get(`/vitals/trends?metric=blood_sugar&days=${days}`),
      API.get(`/vitals/trends?metric=weight_kg&days=${days}`),
    ]);

    renderBPChart(bpRes.data.trends);
    renderHRChart(hrRes.data.trends);
    renderSugarChart(sugarRes.data.trends);
    renderWeightChart(weightRes.data.trends);
  } catch (err) {
    console.warn('Failed to load trends:', err);
  }
}

function renderBPChart(data) {
  if (bpChart) bpChart.destroy();
  const ctx = document.getElementById('chart-bp');
  bpChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => new Date(d.recorded_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' })),
      datasets: [
        { label: 'Systolic', data: data.map(d => d.systolic_bp), borderColor: '#22D3EE', backgroundColor: 'rgba(34,211,238,.1)', tension: 0.3, fill: true },
        { label: 'Diastolic', data: data.map(d => d.diastolic_bp), borderColor: '#A78BFA', backgroundColor: 'rgba(167,139,250,.1)', tension: 0.3, fill: true },
      ],
    },
    options: { ...chartDefaults, plugins: { ...chartDefaults.plugins, annotation: {} } },
  });
}

function renderHRChart(data) {
  if (hrChart) hrChart.destroy();
  const ctx = document.getElementById('chart-hr');
  hrChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => new Date(d.recorded_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' })),
      datasets: [
        { label: 'Heart Rate', data: data.map(d => d.heart_rate), borderColor: '#F43F5E', backgroundColor: 'rgba(244,63,94,.1)', tension: 0.3, fill: true },
      ],
    },
    options: chartDefaults,
  });
}

function renderSugarChart(data) {
  if (sugarChart) sugarChart.destroy();
  const ctx = document.getElementById('chart-sugar');
  sugarChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => new Date(d.recorded_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' })),
      datasets: [
        { label: 'Blood Sugar', data: data.map(d => d.blood_sugar), borderColor: '#FBBF24', backgroundColor: 'rgba(251,191,36,.1)', tension: 0.3, fill: true },
      ],
    },
    options: chartDefaults,
  });
}

function renderWeightChart(data) {
  if (weightChart) weightChart.destroy();
  const ctx = document.getElementById('chart-weight');
  weightChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => new Date(d.recorded_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' })),
      datasets: [
        { label: 'Weight (kg)', data: data.map(d => d.weight_kg), borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,.1)', tension: 0.3, fill: true },
      ],
    },
    options: chartDefaults,
  });
}

// ─── Load Alerts ──────────────────────────────────────────────────────────
async function loadAlerts() {
  try {
    const res = await API.get('/vitals/alerts');
    const alerts = res.data.alerts;

    if (alerts?.length) {
      document.getElementById('alerts-section').classList.remove('hidden');
      document.getElementById('alerts-list').innerHTML = alerts.slice(0, 5).map(a => {
        const issues = [];
        if (a.systolic_bp > 140 || a.systolic_bp < 90) issues.push(`BP: ${a.systolic_bp}/${a.diastolic_bp}`);
        if (a.heart_rate > 100 || a.heart_rate < 50) issues.push(`HR: ${a.heart_rate}`);
        if (a.temperature > 38) issues.push(`Temp: ${a.temperature}°C`);
        if (a.oxygen_sat && a.oxygen_sat < 94) issues.push(`SpO₂: ${a.oxygen_sat}%`);
        if (a.blood_sugar > 200 || a.blood_sugar < 70) issues.push(`Sugar: ${a.blood_sugar}`);
        return `<div class="flex items-center gap-3 p-3 rounded-xl" style="background:rgba(244,63,94,.04);border:1px solid rgba(244,63,94,.12)">
          <span class="text-sm">⚠️</span>
          <div class="flex-1">
            <div class="text-xs font-semibold" style="color:var(--red)">${issues.join(' · ')}</div>
            <div class="text-[10px]" style="color:var(--text3)">${new Date(a.recorded_at).toLocaleString('en-GB')}</div>
          </div>
        </div>`;
      }).join('');
    }
  } catch (err) {
    console.warn('Failed to load alerts:', err);
  }
}

// ─── Record Vitals ────────────────────────────────────────────────────────
function showRecordModal() { document.getElementById('record-modal').classList.remove('hidden'); }
function hideRecordModal() { document.getElementById('record-modal').classList.add('hidden'); }

document.getElementById('vitals-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('record-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const form = new FormData(e.target);
  const body = {};
  for (const [k, v] of form.entries()) {
    if (v) body[k] = isNaN(v) ? v : Number(v);
  }

  try {
    const res = await API.post('/vitals', body);

    if (res.data.alerts?.length) {
      Utils.toast('⚠️ Abnormal values detected! Check alerts.', 'warning', 5000);
    } else {
      Utils.toast('✅ Vital signs recorded!', 'success');
    }

    hideRecordModal();
    e.target.reset();
    await Promise.all([loadLatest(), loadHistory(), loadTrends(), loadAlerts()]);
  } catch (err) {
    Utils.showAlert('record-alert', err.message || 'Failed to save', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Reading';
  }
});

// ─── Delete Vital ─────────────────────────────────────────────────────────
async function deleteVital(id) {
  if (!confirm('Delete this reading?')) return;
  try {
    await API.delete(`/vitals/${id}`);
    Utils.toast('Reading deleted', 'success');
    await Promise.all([loadLatest(), loadHistory(), loadTrends()]);
  } catch (err) {
    Utils.toast('Failed to delete', 'error');
  }
}
