/**
 * HealthConnect — Doctor Schedule Management
 */

(async () => {
  Auth.requireRole('doctor');

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const TIME_SLOTS = [
    '06:00','06:30','07:00','07:30','08:00','08:30','09:00','09:30',
    '10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30',
    '14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30',
    '18:00','18:30','19:00','19:30','20:00','20:30','21:00',
  ];

  // Availability state: { Monday: { enabled: true, slots: ['09:00', ...] }, ... }
  let availability = {};
  DAYS.forEach(d => { availability[d] = { enabled: false, slots: [] }; });

  // ─── Load existing availability ───────────────────────────────────────
  async function loadAvailability() {
    try {
      const res = await API.get('/doctors/me/profile');
      const doc = res.data?.doctor || {};

      Utils.setFieldValue('consultation-fee', doc.consultationFee || '');
      Utils.setFieldValue('currency', doc.currency || 'USD');

      // Parse availability array from backend
      const avRes = await API.get('/doctors/me/availability');
      const slots = avRes.data?.availability || [];
      slots.forEach(slot => {
        const day = DAYS[slot.dayOfWeek - 1]; // 1=Mon
        if (day) {
          if (!availability[day]) availability[day] = { enabled: false, slots: [] };
          availability[day].enabled = true;
          availability[day].slots.push(slot.startTime?.slice(0, 5));
        }
      });
    } catch { /* use defaults */ }
    renderGrid();
  }

  // ─── Render weekly grid ───────────────────────────────────────────────
  function renderGrid() {
    const grid = document.getElementById('availability-grid');
    if (!grid) return;
    grid.innerHTML = DAYS.map(day => `
      <div class="rounded-2xl p-4" style="border:1px solid var(--border);background:var(--surface2)">
        <div class="flex items-center justify-between mb-3">
          <span class="font-semibold">${day}</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="day-${day}" ${availability[day].enabled ? 'checked' : ''}
              onchange="toggleDay('${day}', this.checked)" class="sr-only peer">
            <div class="w-10 h-5 rounded-full peer peer-checked:bg-primary transition-colors
              after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4
              after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" style="background:var(--border)"></div>
          </label>
        </div>
        <div id="slots-${day}" class="${availability[day].enabled ? '' : 'hidden'} flex flex-wrap gap-2">
          ${TIME_SLOTS.map(t => `
            <button id="slot-${day}-${t.replace(':', '')}"
              onclick="toggleSlot('${day}', '${t}')"
              class="slot-btn text-xs px-2.5 py-1.5 rounded-lg border transition
                ${availability[day].slots.includes(t)
                  ? 'bg-primary text-white border-primary'
                  : ''}" ${!availability[day].slots.includes(t) ? 'style="border-color:var(--border);color:var(--text2)"' : ''}>
              ${t}
            </button>`).join('')}
        </div>
        ${!availability[day].enabled ? `<p class="text-xs" style="color:var(--text3)">Day disabled</p>` : ''}
      </div>
    `).join('');
  }

  window.toggleDay = function (day, enabled) {
    availability[day].enabled = enabled;
    const slotsContainer = document.getElementById(`slots-${day}`);
    if (slotsContainer) slotsContainer.classList.toggle('hidden', !enabled);
  };

  window.toggleSlot = function (day, time) {
    const slots = availability[day].slots;
    const idx   = slots.indexOf(time);
    if (idx >= 0) slots.splice(idx, 1);
    else slots.push(time);
    slots.sort();

    const btn = document.getElementById(`slot-${day}-${time.replace(':', '')}`);
    if (btn) {
      const active = slots.includes(time);
      btn.classList.toggle('bg-primary', active);
      btn.classList.toggle('text-white', active);
      btn.classList.toggle('border-primary', active);
      if (!active) {
        btn.style.borderColor = 'var(--border)';
        btn.style.color = 'var(--text2)';
      } else {
        btn.style.borderColor = '';
        btn.style.color = '';
      }
    }
  };

  // ─── Save ─────────────────────────────────────────────────────────────
  document.getElementById('save-avail-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('save-avail-btn');
    Utils.setLoading(btn, true, 'Saving…');
    Utils.hideAlert('save-alert');

    // Build slots array for API
    const slotsPayload = [];
    DAYS.forEach((day, idx) => {
      if (availability[day].enabled) {
        availability[day].slots.forEach(startTime => {
          // Calculate end time (+30 min)
          const [h, m] = startTime.split(':').map(Number);
          const end = m === 30 ? `${String(h + 1).padStart(2, '0')}:00` : `${String(h).padStart(2, '0')}:30`;
          slotsPayload.push({ dayOfWeek: idx + 1, startTime, endTime: end });
        });
      }
    });

    try {
      await API.put('/doctors/me/availability', { availability: slotsPayload });
      await API.put('/doctors/me/profile', {
        consultationFee: document.getElementById('consultation-fee').value || undefined,
        currency: document.getElementById('currency').value || undefined,
      });
      Utils.showAlert('save-alert', 'Schedule saved successfully!', 'success');
    } catch (err) {
      Utils.showAlert('save-alert', err.message || 'Save failed', 'error');
    } finally {
      Utils.setLoading(btn, false);
    }
  });

  await loadAvailability();
})();
