/**
 * HealthConnect — AI Symptom Checker
 * Click-to-select symptom chips + custom input → context details → AI analysis
 */

(async () => {
  Auth.requireRole('patient');

  // ─── State ────────────────────────────────────────────────────────────
  let currentStep      = 1;
  let selectedSymptoms = [];
  let currentReport    = null;

  // ─── DOM Refs ─────────────────────────────────────────────────────────
  const stepsEl       = [1, 2, 3].map(n => document.getElementById(`step-${n}`));
  const stepDots      = [1, 2, 3].map(n => document.getElementById(`step${n}`));
  const progressBars  = [1, 2].map(n => document.getElementById(`progress-${n}`));
  const selectedBox   = document.getElementById('selected-symptoms');
  const countLabel    = document.getElementById('symptom-count');
  const clearAllBtn   = document.getElementById('clear-all-btn');
  const filterInput   = document.getElementById('symptom-filter');
  const customInput   = document.getElementById('custom-symptom-input');
  const addCustomBtn  = document.getElementById('add-custom-btn');
  const nextBtn       = document.getElementById('next-to-step2');
  const analyzeBtn    = document.getElementById('analyze-btn');
  const allChips      = document.querySelectorAll('.symptom-chip[data-symptom]');
  const categories    = document.getElementById('symptom-categories');

  // ─── Step Navigation ──────────────────────────────────────────────────

  window.goToStep = function (n) {
    if (n === 2 && selectedSymptoms.length === 0) {
      return Utils.toast('Please select at least one symptom', 'warning');
    }
    currentStep = n;
    stepsEl.forEach((el, i) => el && el.classList.toggle('hidden', i + 1 !== n));

    // Update step indicators
    stepDots.forEach((dot, i) => {
      if (!dot) return;
      if (i + 1 <= n) { dot.classList.add('active'); }
      else            { dot.classList.remove('active'); }
    });

    // Update progress bars
    if (progressBars[0]) progressBars[0].style.width = n >= 2 ? '100%' : '0%';
    if (progressBars[1]) progressBars[1].style.width = n >= 3 ? '100%' : '0%';

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.resetChecker = function () {
    selectedSymptoms = [];
    currentReport = null;
    allChips.forEach(c => c.classList.remove('active'));
    renderSelected();
    goToStep(1);
  };

  // ─── Chip Click Handling ──────────────────────────────────────────────

  allChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const name = chip.dataset.symptom;
      toggleSymptom(name, chip);
    });
  });

  function toggleSymptom(name, chipEl) {
    const idx = selectedSymptoms.indexOf(name);
    if (idx > -1) {
      // Deselect
      selectedSymptoms.splice(idx, 1);
      if (chipEl) chipEl.classList.remove('active');
    } else {
      // Select
      if (selectedSymptoms.length >= 12) {
        return Utils.toast('Maximum 12 symptoms allowed', 'warning');
      }
      selectedSymptoms.push(name);
      if (chipEl) chipEl.classList.add('active');
    }
    renderSelected();
  }

  // ─── Remove a symptom (from the selected pills) ──────────────────────

  window.removeSymptom = function (name) {
    selectedSymptoms = selectedSymptoms.filter(s => s !== name);
    // Deactivate matching chip if it exists
    const chip = document.querySelector('.symptom-chip[data-symptom="' + CSS.escape(name) + '"]');
    if (chip) chip.classList.remove('active');
    renderSelected();
  };

  // ─── Render Selected Symptoms ────────────────────────────────────────

  function renderSelected() {
    if (!selectedBox) return;
    if (selectedSymptoms.length === 0) {
      selectedBox.innerHTML = '<span class="text-xs italic py-1" style="color:var(--text3)">No symptoms selected yet</span>';
    } else {
      selectedBox.innerHTML = selectedSymptoms.map(s => {
        const escaped = esc(s);
        return '<span class="selected-pill">'
          + escaped
          + ' <button onclick="removeSymptom(\'' + escaped + '\')" title="Remove">&times;</button>'
          + '</span>';
      }).join('');
    }
    // Counter
    if (countLabel) countLabel.textContent = selectedSymptoms.length + ' selected';
    // Clear-all visibility
    if (clearAllBtn) clearAllBtn.classList.toggle('hidden', selectedSymptoms.length === 0);
    // Next button
    if (nextBtn) nextBtn.disabled = selectedSymptoms.length === 0;
  }

  // ─── Clear All ────────────────────────────────────────────────────────

  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', function () {
      selectedSymptoms = [];
      allChips.forEach(function (c) { c.classList.remove('active'); });
      renderSelected();
    });
  }

  // ─── Filter / Search Chips ────────────────────────────────────────────

  if (filterInput) {
    filterInput.addEventListener('input', function () {
      var q = filterInput.value.toLowerCase().trim();
      allChips.forEach(function (chip) {
        var match = !q || chip.dataset.symptom.toLowerCase().includes(q);
        chip.classList.toggle('filter-hidden', !match);
      });
      // Hide entire category sections that have no visible chips
      if (categories) {
        categories.querySelectorAll('[data-category]').forEach(function (cat) {
          var visible = cat.querySelectorAll('.symptom-chip:not(.filter-hidden)');
          cat.style.display = visible.length ? '' : 'none';
        });
      }
    });
  }

  // ─── Custom Symptom Input ────────────────────────────────────────────

  function addCustomSymptom() {
    if (!customInput) return;
    var raw = customInput.value.trim();
    if (!raw) return Utils.toast('Please type a symptom first', 'warning');

    // Capitalize first letter
    var name = raw.charAt(0).toUpperCase() + raw.slice(1);

    if (selectedSymptoms.includes(name)) {
      return Utils.toast('"' + name + '" is already added', 'info');
    }
    if (selectedSymptoms.length >= 12) {
      return Utils.toast('Maximum 12 symptoms allowed', 'warning');
    }

    // Check if a chip exists for this symptom
    var existing = document.querySelector('.symptom-chip[data-symptom="' + CSS.escape(name) + '"]');
    if (existing) existing.classList.add('active');

    selectedSymptoms.push(name);
    customInput.value = '';
    renderSelected();
    Utils.toast('Added "' + name + '"', 'success');
  }

  if (addCustomBtn) addCustomBtn.addEventListener('click', addCustomSymptom);
  if (customInput) {
    customInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addCustomSymptom(); }
    });
  }

  // ─── Next Button (Step 1 → Step 2) ───────────────────────────────────

  if (nextBtn) {
    nextBtn.addEventListener('click', function () { goToStep(2); });
  }

  // ─── Submit for Analysis (Step 2 → Step 3) ──────────────────────────

  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', submitAnalysis);
  }

  async function submitAnalysis() {
    Utils.setLoading(analyzeBtn, true, 'Analyzing…');
    goToStep(3); // Shows loading spinner

    // Try to get patient's location for nearby doctor recommendations
    let locationData = {};
    try {
      const pos = await new Promise((resolve, reject) => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, enableHighAccuracy: false });
        } else { reject(new Error('No geolocation')); }
      });
      locationData = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, radiusKm: 50 };
    } catch (e) { /* Location unavailable — that's fine, we'll still recommend */ }

    var payload = {
      symptoms:        selectedSymptoms,
      patientAge:      document.getElementById('patient-age')  ? document.getElementById('patient-age').value  : undefined,
      patientGender:   document.getElementById('patient-gender')? document.getElementById('patient-gender').value : undefined,
      duration:        document.getElementById('symptom-duration') ? document.getElementById('symptom-duration').value : undefined,
      additionalNotes: document.getElementById('additional-notes') ? document.getElementById('additional-notes').value.trim() : undefined,
      ...locationData,
    };

    try {
      var res = await API.post('/symptoms/analyze', payload);
      currentReport = res.data ? res.data.analysis : null;
      var recommendedDoctors = res.data ? res.data.recommendedDoctors : [];
      renderResults(currentReport);
      renderRecommendedDoctors(recommendedDoctors);
    } catch (err) {
      var msg = err.message || 'Analysis failed. Please try again.';
      // Make common proxy/network errors more user-friendly
      if (msg.includes('Unexpected token') || msg.includes('not valid JSON')) {
        msg = 'The AI service is temporarily unavailable. Please try again in a moment.';
      }
      renderError(msg);
    } finally {
      Utils.setLoading(analyzeBtn, false);
    }
  }

  // ─── Render Results ──────────────────────────────────────────────────

  function renderResults(report) {
    var loadingEl = document.getElementById('results-loading');
    var resultsEl = document.getElementById('results-content');
    if (loadingEl) loadingEl.classList.add('hidden');
    if (resultsEl) resultsEl.classList.remove('hidden');
    if (!report) return;

    var analysis = report.aiAnalysis || report || {};

    // Care guidance banner (calmer language)
    var urgencyLevel = (analysis.urgencyLevel || 'MEDIUM').toUpperCase();
    var urgencyMap = {
      LOW: {
        icon: '✅', color: '#34D399', bg: 'rgba(16,185,129,.08)', border: 'rgba(16,185,129,.2)',
        label: 'Self-care likely okay',
        helper: 'Monitor symptoms and use home care. Reach out to a doctor if things worsen.',
      },
      MEDIUM: {
        icon: '🩺', color: '#FBBF24', bg: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.2)',
        label: 'Plan a doctor review soon',
        helper: 'A routine consultation is recommended to be safe and get personalized treatment.',
      },
      HIGH: {
        icon: '⏱️', color: '#F87171', bg: 'rgba(239,68,68,.08)', border: 'rgba(239,68,68,.2)',
        label: 'Prompt medical care advised',
        helper: 'Please seek in-person care today, especially if symptoms are getting worse.',
      },
      EMERGENCY: {
        icon: '🚨', color: '#EF4444', bg: 'rgba(239,68,68,.15)', border: 'rgba(239,68,68,.3)',
        label: 'Emergency care needed now',
        helper: 'Go to the nearest emergency unit immediately or call local emergency services.',
      },
    };
    var urg = urgencyMap[urgencyLevel] || urgencyMap.MEDIUM;

    var bannerEl = document.getElementById('urgency-banner');
    if (bannerEl) {
      bannerEl.className = 'rounded-2xl p-5 text-center';
      bannerEl.style.background = urg.bg;
      bannerEl.style.border = '2px solid ' + urg.border;
      var iconEl  = document.getElementById('urgency-icon');
      var textEl  = document.getElementById('urgency-text');
      var reasonEl= document.getElementById('urgency-reason');
      if (iconEl)  iconEl.textContent  = urg.icon;
      if (textEl)  { textEl.textContent = urg.label; textEl.className = 'text-xl font-bold'; textEl.style.color = urg.color; }
      if (reasonEl) {
        var reason = analysis.urgencyReason ? analysis.urgencyReason + ' ' : '';
        reasonEl.textContent = reason + urg.helper;
      }
    }

    // Summary
    var summaryEl = document.getElementById('ai-summary');
    if (summaryEl) {
      summaryEl.textContent = analysis.summary || 'Based on what you shared, here are the most likely explanations and helpful next steps.';
    }

    // Possible conditions
    var condList = document.getElementById('conditions-list');
    if (condList) {
      var conditions = analysis.possibleConditions || [];
      if (conditions.length) {
        condList.innerHTML = conditions.map(function (c) {
          var pct = c.confidenceScore != null ? c.confidenceScore : Math.round((c.confidence || 0) * 100);
          var barColor = pct > 70 ? 'var(--red)' : pct > 40 ? 'var(--gold)' : 'var(--green)';
          var confidenceWord = pct >= 75 ? 'Higher likelihood' : pct >= 45 ? 'Possible' : 'Less likely';
          return '<div class="condition-card">'
            + '<div class="flex justify-between items-center mb-1.5">'
            +   '<span class="font-semibold text-sm">' + esc(c.name) + '</span>'
            +   '<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full" style="background:var(--surface1);color:var(--text3);border:1px solid var(--border)">' + confidenceWord + '</span>'
            + '</div>'
            + '<div class="pbar mb-2">'
            +   '<div class="pfill" style="width:' + pct + '%;background:' + barColor + '"></div>'
            + '</div>'
            + '<p class="text-xs" style="color:var(--text3)">' + esc(c.description || 'This is one possible explanation for your symptom pattern.') + '</p>'
            + '</div>';
        }).join('');
      } else {
        condList.innerHTML = '<p class="text-sm" style="color:var(--text3)">No clear pattern was identified. A clinician can help narrow this down.</p>';
      }
    }

    // Recommended actions
    var actList = document.getElementById('actions-list');
    if (actList) {
      var actions = analysis.recommendedActions || [];
      if (!actions.length) {
        actions = [
          'Rest, hydrate, and monitor symptoms for changes.',
          'Book a consultation if symptoms persist or interfere with daily life.',
          'Seek urgent care quickly if you develop severe warning signs.',
        ];
      }
      actList.innerHTML = actions.map(function (a) {
        return '<li class="flex gap-2 text-sm" style="color:var(--text2)"><span style="color:var(--cyan)" class="mt-0.5">•</span>' + esc(a) + '</li>';
      }).join('');
    }

    // Disclaimer
    var discEl = document.getElementById('disclaimer');
    if (discEl) {
      discEl.textContent = analysis.disclaimer || 'This is educational guidance, not a diagnosis. If you feel worse or worried at any point, contact a qualified healthcare professional.';
    }
  }

  // ─── Render Recommended Doctors ──────────────────────────────────────

  function renderRecommendedDoctors(doctors) {
    // Create or find the recommended doctors section
    var container = document.getElementById('recommended-doctors');
    if (!container) {
      // Create the section dynamically after results
      var resultsEl = document.getElementById('results-content');
      if (!resultsEl) return;
      var section = document.createElement('div');
      section.id = 'recommended-doctors';
      section.className = 'mt-6';
      resultsEl.appendChild(section);
      container = section;
    }

    if (!doctors || !doctors.length) {
      container.innerHTML = '';
      return;
    }

    var html = '<div class="rounded-2xl p-5" style="background:var(--surface2);border:1px solid var(--border)">'
      + '<div class="flex items-center gap-2 mb-4">'
      + '  <span class="text-2xl">👨‍⚕️</span>'
      + '  <h3 class="text-lg font-bold" style="color:var(--text1)">AI-Recommended Doctors</h3>'
      + '</div>'
      + '<p class="text-xs mb-4" style="color:var(--text3)">Based on your symptoms, these doctors are the best match for your condition:</p>'
      + '<div class="space-y-3">';

    doctors.forEach(function (doc) {
      var distanceLabel = doc.distance_km != null ? '<span class="text-xs" style="color:var(--cyan)">📍 ' + doc.distance_km.toFixed(1) + ' km away</span>' : '';
      var hospitalLabel = '';
      if (doc.hospitals && doc.hospitals.length) {
        hospitalLabel = '<span class="text-xs" style="color:var(--text3)">🏥 ' + doc.hospitals.map(function(h) { return esc(h.name); }).join(', ') + '</span>';
      } else if (doc.hospital_affiliation) {
        hospitalLabel = '<span class="text-xs" style="color:var(--text3)">🏥 ' + esc(doc.hospital_affiliation) + '</span>';
      }
      var matchBar = doc.matchScore ? '<div class="pbar mt-1 mb-1" style="height:4px"><div class="pfill" style="width:' + doc.matchScore + '%;background:var(--cyan)"></div></div>' : '';

      html += '<div class="rounded-xl p-4" style="background:var(--surface1);border:1px solid var(--border);cursor:pointer" onclick="window.location.href=\'/pages/patient/find-doctors.html?doctorId=' + doc.id + '\'">'
        + '<div class="flex items-start justify-between gap-3">'
        + '  <div class="flex items-center gap-3 flex-1">'
        + '    <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg" style="background:var(--surface2)">'
        + (doc.avatar_url ? '<img src="' + esc(doc.avatar_url) + '" class="w-10 h-10 rounded-full object-cover">' : '👨‍⚕️')
        + '    </div>'
        + '    <div class="flex-1">'
        + '      <p class="font-semibold text-sm" style="color:var(--text1)">Dr. ' + esc(doc.first_name || '') + ' ' + esc(doc.last_name || '') + '</p>'
        + '      <p class="text-xs" style="color:var(--cyan)">' + esc(doc.specialization || 'General Practice') + '</p>'
        + '      <div class="flex flex-wrap gap-2 mt-1">'
        + distanceLabel
        + hospitalLabel
        + '      </div>'
        + '      <p class="text-xs mt-1" style="color:var(--text3)">' + esc(doc.matchReason || '') + '</p>'
        + matchBar
        + '    </div>'
        + '  </div>'
        + '  <div class="text-right flex-shrink-0">'
        + '    <div class="flex items-center gap-1">'
        + '      <span style="color:#FBBF24">⭐</span>'
        + '      <span class="text-sm font-bold" style="color:var(--text1)">' + (doc.rating ? parseFloat(doc.rating).toFixed(1) : 'New') + '</span>'
        + '    </div>'
        + '    <p class="text-xs mt-1" style="color:var(--text3)">' + (doc.consultation_fee ? '$' + parseFloat(doc.consultation_fee).toFixed(0) : 'Free') + '</p>'
        + '    <span class="text-xs font-bold" style="color:var(--green)">' + (doc.matchScore || 0) + '% match</span>'
        + '  </div>'
        + '</div>'
        + '<div class="flex gap-2 mt-3">'
        + '  <a href="/pages/patient/appointments.html?doctorId=' + doc.id + '" class="btn-teal text-xs px-3 py-1.5 rounded-lg flex-1 text-center" onclick="event.stopPropagation()">📅 Book Now</a>'
        + '  <a href="/pages/patient/find-doctors.html?doctorId=' + doc.id + '" class="text-xs px-3 py-1.5 rounded-lg flex-1 text-center" style="background:var(--surface2);color:var(--text2);border:1px solid var(--border)" onclick="event.stopPropagation()">View Profile</a>'
        + '</div>'
        + '</div>';
    });

    html += '</div></div>';
    container.innerHTML = html;
  }

  function renderError(message) {
    var loadingEl = document.getElementById('results-loading');
    var resultsEl = document.getElementById('results-content');
    if (loadingEl) loadingEl.classList.add('hidden');
    if (resultsEl) {
      resultsEl.classList.remove('hidden');
      resultsEl.innerHTML =
        '<div class="rounded-[18px] p-10 text-center" style="background:var(--surface2);border:1px solid var(--border)">'
        + '<div class="text-4xl mb-3">⚠️</div>'
        + '<h3 class="text-lg font-bold mb-2">Analysis Failed</h3>'
        + '<p class="text-sm mb-5" style="color:var(--text3)">' + esc(message) + '</p>'
        + '<button onclick="resetChecker()" class="btn-teal font-semibold px-6 py-2.5">Try Again</button>'
        + '</div>';
    }
  }

  // ─── Load existing report from URL ───────────────────────────────────
  var params = new URLSearchParams(window.location.search);
  var reportId = params.get('reportId');
  if (reportId) {
    try {
      var res = await API.get('/symptoms/report/' + reportId);
      currentReport = res.data ? res.data.report : null;
      if (currentReport) {
        selectedSymptoms = currentReport.symptoms || [];
        renderSelected();
        // Activate matching chips
        selectedSymptoms.forEach(function (s) {
          var chip = document.querySelector('.symptom-chip[data-symptom="' + CSS.escape(s) + '"]');
          if (chip) chip.classList.add('active');
        });
        goToStep(3);
        renderResults(currentReport);
      }
    } catch (e) { /* ignore */ }
  }

  // ─── Helper ──────────────────────────────────────────────────────────
  function esc(str) {
    var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(str).replace(/[&<>"']/g, function (m) { return map[m]; });
  }

  // ─── Init ─────────────────────────────────────────────────────────────
  renderSelected();
})();
