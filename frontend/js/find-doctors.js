/**
 * HealthConnect — Find Doctors Page
 * Browse, search, filter, and get AI recommendations for doctors
 */

(async () => {
  Auth.requireRole('patient');

  let allDoctors = [];
  let symptoms = [];
  let specializations = [];

  // ─── Mode Toggle ──────────────────────────────────────────────────────
  document.querySelectorAll('.tab-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.mode;
      document.getElementById('browse-section').classList.toggle('hidden', mode !== 'browse');
      document.getElementById('recommend-section').classList.toggle('hidden', mode !== 'recommend');
    });
  });

  // ─── Load & Render Doctors ────────────────────────────────────────────
  async function loadDoctors() {
    try {
      const q = document.getElementById('search-input')?.value || '';
      const spec = document.getElementById('filter-spec')?.value || '';
      const res = await API.get(`/doctors/search?q=${encodeURIComponent(q)}&specialization=${encodeURIComponent(spec)}&limit=40`);
      allDoctors = res.data?.doctors || [];
      specializations = res.data?.specializations || [];
      populateSpecFilter();
      sortAndRender();
    } catch (err) {
      document.getElementById('doctors-grid').innerHTML =
        '<p class="col-span-full text-center py-8 text-sm" style="color:var(--text3)">Could not load doctors. Please try again.</p>';
    }
  }

  function populateSpecFilter() {
    const sel = document.getElementById('filter-spec');
    if (!sel || sel.options.length > 1) return;
    specializations.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      sel.appendChild(opt);
    });
  }

  function sortAndRender() {
    const sortBy = document.getElementById('filter-sort')?.value || 'rating';
    let sorted = [...allDoctors];
    switch (sortBy) {
      case 'fee_low':    sorted.sort((a, b) => (a.consultation_fee || 0) - (b.consultation_fee || 0)); break;
      case 'fee_high':   sorted.sort((a, b) => (b.consultation_fee || 0) - (a.consultation_fee || 0)); break;
      case 'experience': sorted.sort((a, b) => (b.years_experience || 0) - (a.years_experience || 0)); break;
      default:           sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    renderDoctors(sorted);
  }

  function renderDoctors(doctors) {
    const grid = document.getElementById('doctors-grid');
    if (!doctors.length) {
      grid.innerHTML = `
        <div class="col-span-full text-center py-16" style="color:var(--text3)">
          <div class="text-5xl mb-4">🔍</div>
          <p class="font-medium">No doctors found</p>
          <p class="text-sm mt-1">Try adjusting your search filters</p>
        </div>`;
      return;
    }
    grid.innerHTML = doctors.map(d => doctorCard(d)).join('');
  }

  function doctorCard(d, showMatch = false) {
    const stars = '⭐'.repeat(Math.round(d.rating || 0));
    const matchHtml = showMatch && d.matchScore ? `
      <div class="mt-3 pt-3" style="border-top:1px solid var(--border)">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-semibold" style="color:var(--cyan)">AI Match</span>
          <span class="text-xs font-bold" style="color:var(--cyan)">${d.matchScore}%</span>
        </div>
        <div class="match-bar"><div class="match-bar-fill" style="width:${d.matchScore}%;background:${d.matchScore >= 80 ? '#10B981' : d.matchScore >= 60 ? '#FBBF24' : '#F87171'}"></div></div>
        ${d.matchReason ? `<p class="text-xs mt-1.5" style="color:var(--text3)">${Utils.escapeHtml(d.matchReason)}</p>` : ''}
      </div>` : '';

    return `
      <div class="doc-card">
        <div class="flex items-start gap-3">
          <div class="w-14 h-14 rounded-xl ${Utils.avatarColor(d.first_name)} flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
            ${d.avatar_url ? `<img src="${d.avatar_url}" class="w-full h-full rounded-xl object-cover">` : Utils.initials((d.first_name||'')+ ' '+(d.last_name||''))}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold">Dr. ${Utils.escapeHtml((d.first_name||'')+' '+(d.last_name||''))}</div>
            <div class="text-sm" style="color:var(--text3)">${Utils.escapeHtml(d.specialization || 'General Practice')}</div>
            <div class="flex items-center gap-3 mt-1 text-xs" style="color:var(--text3)">
              <span>${stars || '—'} (${d.total_reviews || 0})</span>
              <span>·</span>
              <span>${d.years_experience || 0} yrs exp</span>
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <div class="text-sm font-bold" style="color:var(--cyan)">${Utils.formatCurrency(d.consultation_fee)}</div>
            ${d.hospital_affiliation ? `<div class="text-xs mt-1" style="color:var(--text3)">${Utils.escapeHtml(d.hospital_affiliation)}</div>` : ''}
          </div>
        </div>
        ${d.bio ? `<p class="text-xs mt-3 leading-relaxed" style="color:var(--text3)">${Utils.truncate(d.bio, 120)}</p>` : ''}
        ${d.languages ? `<div class="flex flex-wrap gap-1 mt-2">${d.languages.split(',').map(l => `<span class="text-[10px] px-2 py-0.5 rounded-full" style="background:rgba(34,211,238,.08);color:var(--cyan);border:1px solid rgba(34,211,238,.15)">${l.trim()}</span>`).join('')}</div>` : ''}
        ${matchHtml}
        <div class="flex gap-2 mt-4">
          <button onclick="viewDoctorProfile('${d.id}')" class="flex-1 text-sm py-2.5 rounded-xl font-semibold transition" style="background:rgba(34,211,238,.08);color:var(--cyan);border:1px solid rgba(34,211,238,.15)" onmouseover="this.style.background='rgba(34,211,238,.15)'" onmouseout="this.style.background='rgba(34,211,238,.08)'">
            View Profile
          </button>
          <a href="/pages/patient/appointments.html?doctor=${d.id}" class="flex-1 text-sm py-2.5 rounded-xl font-semibold text-center btn-teal">
            Book Now
          </a>
        </div>
      </div>`;
  }

  // ─── Doctor Profile Modal ─────────────────────────────────────────────
  window.viewDoctorProfile = async function(id) {
    try {
      const res = await API.get(`/doctors/${id}`);
      const d = res.data?.doctor;
      if (!d) return;

      document.getElementById('modal-doc-name').textContent = `Dr. ${d.first_name} ${d.last_name}`;
      document.getElementById('modal-doc-body').innerHTML = `
        <div class="flex items-center gap-4">
          <div class="w-20 h-20 rounded-2xl ${Utils.avatarColor(d.first_name)} flex items-center justify-center text-white text-2xl font-bold">
            ${d.avatar_url ? `<img src="${d.avatar_url}" class="w-full h-full rounded-2xl object-cover">` : Utils.initials(d.first_name+' '+d.last_name)}
          </div>
          <div>
            <div class="text-xl font-bold">Dr. ${Utils.escapeHtml(d.first_name+' '+d.last_name)}</div>
            <div class="text-sm" style="color:var(--cyan)">${Utils.escapeHtml(d.specialization || 'General Practice')}</div>
            <div class="text-sm mt-1" style="color:var(--text3)">⭐ ${Number(d.rating||0).toFixed(1)} · ${d.total_reviews||0} reviews · ${d.years_experience||0} yrs</div>
          </div>
        </div>
        ${d.bio ? `<div class="rounded-xl p-4" style="background:var(--bg2)"><p class="text-sm leading-relaxed" style="color:var(--text2)">${Utils.escapeHtml(d.bio)}</p></div>` : ''}
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-xl p-3 text-center" style="background:var(--bg2)">
            <div class="text-lg font-bold" style="color:var(--cyan)">${Utils.formatCurrency(d.consultation_fee)}</div>
            <div class="text-xs" style="color:var(--text3)">Consultation Fee</div>
          </div>
          <div class="rounded-xl p-3 text-center" style="background:var(--bg2)">
            <div class="text-lg font-bold" style="color:var(--cyan)">${d.years_experience || 0} yrs</div>
            <div class="text-xs" style="color:var(--text3)">Experience</div>
          </div>
        </div>
        ${d.hospital_affiliation ? `<div class="text-sm"><span style="color:var(--text3)">Hospital:</span> ${Utils.escapeHtml(d.hospital_affiliation)}</div>` : ''}
        ${d.languages ? `<div class="text-sm"><span style="color:var(--text3)">Languages:</span> ${Utils.escapeHtml(d.languages)}</div>` : ''}
        <a href="/pages/patient/appointments.html?doctor=${d.id}" class="btn-teal text-sm font-semibold px-6 py-3 w-full text-center block rounded-xl mt-2">
          📅 Book Appointment
        </a>
      `;
      document.getElementById('doctor-modal').classList.remove('hidden');
    } catch {}
  };

  // ─── AI Recommendations ───────────────────────────────────────────────
  window.addSymptom = function() {
    const input = document.getElementById('symptom-input');
    const val = input.value.trim();
    if (!val || symptoms.includes(val)) return;

    symptoms.push(val);
    input.value = '';
    renderSymptomTags();
  };

  function renderSymptomTags() {
    const container = document.getElementById('symptom-tags');
    container.innerHTML = symptoms.map((s, i) => `
      <span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium" style="background:rgba(34,211,238,.1);color:var(--cyan);border:1px solid rgba(34,211,238,.2)">
        ${Utils.escapeHtml(s)}
        <button onclick="removeSymptom(${i})" class="ml-0.5 text-base leading-none opacity-60 hover:opacity-100">×</button>
      </span>
    `).join('');
    document.getElementById('recommend-btn').disabled = symptoms.length < 1;
  }

  window.removeSymptom = function(idx) {
    symptoms.splice(idx, 1);
    renderSymptomTags();
  };

  window.getRecommendations = async function() {
    if (!symptoms.length) return;
    const list = document.getElementById('recommendations-list');
    const btn = document.getElementById('recommend-btn');
    btn.disabled = true;
    btn.textContent = '🔄 Analyzing...';
    list.innerHTML = '<div class="text-center py-8"><div class="text-3xl mb-3 animate-pulse">🤖</div><p class="text-sm" style="color:var(--text3)">AI is matching you with the best doctors...</p></div>';

    try {
      const res = await API.post('/doctors/recommend', { symptoms });
      const docs = res.data?.doctors || [];

      if (!docs.length) {
        list.innerHTML = '<p class="text-center py-8 text-sm" style="color:var(--text3)">No matching doctors found. Try different symptoms.</p>';
        return;
      }

      list.innerHTML = `
        <div class="mb-4 rounded-xl p-3" style="background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.15)">
          <p class="text-sm font-medium" style="color:#10B981">✅ Found ${docs.length} matching doctor${docs.length > 1 ? 's' : ''} based on your symptoms</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${docs.map(d => doctorCard(d, true)).join('')}
        </div>
      `;
    } catch (err) {
      list.innerHTML = `<p class="text-center py-8 text-sm" style="color:var(--red)">Failed to get recommendations: ${err.message || 'Unknown error'}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Get AI Recommendations →';
    }
  };

  // ─── Event Listeners ──────────────────────────────────────────────────
  let searchTimer;
  document.getElementById('search-input')?.addEventListener('input', function() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadDoctors, 300);
  });
  document.getElementById('filter-spec')?.addEventListener('change', loadDoctors);
  document.getElementById('filter-sort')?.addEventListener('change', sortAndRender);

  // ─── Init ─────────────────────────────────────────────────────────────
  await loadDoctors();
})();
