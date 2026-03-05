/**
 * payment.js — Payment Checkout & History
 */
(async () => {
  Auth.requireRole('patient');

  let selectedMethod = 'card';
  let selectedAppointment = null;
  let appointments = [];
  let stripe = null;
  let cardElement = null;

  // ─── Stripe Setup ──────────────────────────────────────────────────────
  async function initStripe() {
    try {
      // Load Stripe.js dynamically
      if (!window.Stripe) {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.async = true;
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      // Stripe publishable key from config or fallback
      const pk = (typeof CONFIG !== 'undefined' && CONFIG.STRIPE_PK) || 'pk_test_placeholder';
      stripe = window.Stripe(pk);
      const elements = stripe.elements({
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#22D3EE',
            colorBackground: '#0B1120',
            colorText: '#E2E8F0',
            borderRadius: '12px',
            fontFamily: 'Plus Jakarta Sans, Inter, system-ui, sans-serif',
          },
        },
      });

      cardElement = elements.create('card', {
        style: {
          base: { fontSize: '14px', color: '#E2E8F0', '::placeholder': { color: '#64748B' } },
          invalid: { color: '#EF4444' },
        },
      });
      cardElement.mount('#stripe-card-element');
      cardElement.on('change', (event) => {
        const errDiv = document.getElementById('card-errors');
        errDiv.textContent = event.error ? event.error.message : '';
      });
    } catch (err) {
      console.warn('Stripe not available:', err.message);
      const el = document.getElementById('stripe-card-element');
      if (el) el.innerHTML = '<p class="text-xs" style="color:var(--text3)">Card payments are not configured yet. Use Mobile Money instead.</p>';
    }
  }

  // ─── Load Appointments (unpaid / confirmed) ────────────────────────────
  async function loadAppointments() {
    try {
      const res = await API.get('/appointments');
      const all = res.data?.appointments || [];
      // Show appointments that are confirmed/pending and don't have paid status
      appointments = all.filter(a => ['pending', 'confirmed', 'scheduled'].includes(a.status));
      const select = document.getElementById('appointment-select');
      if (!appointments.length) {
        select.innerHTML = '<option value="">No appointments to pay for</option>';
        return;
      }
      select.innerHTML = '<option value="">— Choose an appointment —</option>' +
        appointments.map(a => {
          const doc = `Dr. ${a.doctor_first_name || ''} ${a.doctor_last_name || ''}`.trim();
          const date = Utils.formatDate(a.appointment_date);
          const fee = a.consultation_fee ? Utils.formatCurrency(a.consultation_fee) : 'N/A';
          return `<option value="${a.id}">${doc} — ${date} (${fee})</option>`;
        }).join('');
    } catch {}
  }

  // ─── On Appointment Selected ───────────────────────────────────────────
  window.onAppointmentSelected = function () {
    const id = document.getElementById('appointment-select').value;
    const details = document.getElementById('appointment-details');
    const payBtn = document.getElementById('pay-btn');

    if (!id) {
      details.classList.add('hidden');
      payBtn.disabled = true;
      selectedAppointment = null;
      return;
    }

    selectedAppointment = appointments.find(a => a.id === id);
    if (!selectedAppointment) return;

    const docName = `Dr. ${selectedAppointment.doctor_first_name || ''} ${selectedAppointment.doctor_last_name || ''}`.trim();
    document.getElementById('appt-avatar').textContent = Utils.initials(docName);
    document.getElementById('appt-doctor').textContent = docName;
    document.getElementById('appt-info').textContent =
      `${Utils.formatDate(selectedAppointment.appointment_date)} · ${selectedAppointment.type || 'video'}`;
    document.getElementById('appt-amount').textContent =
      Utils.formatCurrency(selectedAppointment.consultation_fee || 0);

    details.classList.remove('hidden');
    payBtn.disabled = false;
    updatePayBtnText();
  };

  function updatePayBtnText() {
    const btn = document.getElementById('pay-btn');
    if (!selectedAppointment) { btn.textContent = 'Pay Now'; return; }
    const amt = Utils.formatCurrency(selectedAppointment.consultation_fee || 0);
    const label = selectedMethod === 'card' ? `💳 Pay ${amt} with Card` : `📱 Pay ${amt} with MoMo`;
    btn.textContent = label;
  }

  // ─── Payment Method Selection ──────────────────────────────────────────
  window.selectMethod = function (method) {
    selectedMethod = method;
    document.getElementById('method-card').classList.toggle('selected', method === 'card');
    document.getElementById('method-momo').classList.toggle('selected', method === 'momo');
    document.getElementById('card-form-section').classList.toggle('hidden', method !== 'card');
    document.getElementById('momo-form-section').classList.toggle('hidden', method !== 'momo');
    updatePayBtnText();
  };

  // ─── Submit Payment ────────────────────────────────────────────────────
  window.submitPayment = async function () {
    if (!selectedAppointment) return;

    const btn = document.getElementById('pay-btn');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Processing...';

    try {
      if (selectedMethod === 'card') {
        await payWithCard();
      } else {
        await payWithMoMo();
      }
    } catch (err) {
      Utils.showAlert('pay-alert', err.message || 'Payment failed. Please try again.', 'error');
      btn.disabled = false;
      btn.textContent = origText;
    }
  };

  async function payWithCard() {
    if (!stripe || !cardElement) {
      throw new Error('Card payments are not configured. Please use Mobile Money.');
    }

    // 1. Create payment intent
    const res = await API.post('/payments/create-intent', {
      appointmentId: selectedAppointment.id,
      amount: selectedAppointment.consultation_fee || 0,
      currency: 'usd',
    });

    const clientSecret = res.data?.clientSecret;
    if (!clientSecret) throw new Error('Could not create payment intent.');

    // 2. Confirm with Stripe
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement },
    });

    if (error) throw new Error(error.message);

    if (paymentIntent.status === 'succeeded') {
      Utils.showAlert('pay-alert', '✅ Payment successful! Your appointment is confirmed.', 'success');
      document.getElementById('pay-btn').textContent = '✅ Paid';
      // Reload appointments to remove paid one
      setTimeout(() => loadAppointments(), 2000);
    }
  }

  async function payWithMoMo() {
    const phone = document.getElementById('momo-phone').value.trim();
    if (!phone) throw new Error('Please enter your Mobile Money phone number.');

    const res = await API.post('/payments/momo', {
      appointmentId: selectedAppointment.id,
      phone,
      amount: selectedAppointment.consultation_fee || 0,
      currency: 'UGX',
    });

    Utils.showAlert('pay-alert', '📱 Payment request sent! Check your phone to approve the transaction.', 'success');
    document.getElementById('pay-btn').textContent = '⏳ Awaiting Approval';
  }

  // ─── Tab Switching ─────────────────────────────────────────────────────
  window.switchTab = function (tab) {
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.getElementById('tab-checkout').classList.toggle('hidden', tab !== 'checkout');
    document.getElementById('tab-history').classList.toggle('hidden', tab !== 'history');
    if (tab === 'history') loadHistory();
  };

  // ─── Payment History ──────────────────────────────────────────────────
  async function loadHistory() {
    const container = document.getElementById('payment-history');
    try {
      const res = await API.get('/payments/history');
      const payments = res.data?.payments || [];

      if (!payments.length) {
        container.innerHTML = `
          <div class="text-center py-10" style="color:var(--text3)">
            <div class="text-4xl mb-3">💳</div>
            <p class="text-sm">No payments yet</p>
          </div>`;
        return;
      }

      container.innerHTML = payments.map(p => {
        const statusMap = {
          succeeded: { cls: 'b-green', icon: '✅', label: 'Paid' },
          completed: { cls: 'b-green', icon: '✅', label: 'Paid' },
          pending:   { cls: 'b-yellow', icon: '⏳', label: 'Pending' },
          failed:    { cls: 'b-red', icon: '❌', label: 'Failed' },
          refunded:  { cls: 'b-purple', icon: '↩️', label: 'Refunded' },
        };
        const s = statusMap[p.status] || statusMap.pending;
        const methodIcon = p.method === 'mtn_momo' ? '📱' : '💳';
        const methodLabel = p.method === 'mtn_momo' ? 'MTN MoMo' : 'Card';

        return `
          <div class="history-row mb-2 flex items-center gap-3">
            <div class="text-xl">${methodIcon}</div>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-sm truncate">${Utils.formatCurrency(p.amount, p.currency)}</div>
              <div class="text-xs" style="color:var(--text3)">${methodLabel} · ${Utils.formatDate(p.created_at)}</div>
            </div>
            <span class="badge ${s.cls} text-[10px] whitespace-nowrap">${s.icon} ${s.label}</span>
          </div>`;
      }).join('');
    } catch {
      container.innerHTML = '<p class="text-sm text-center py-6" style="color:var(--text3)">Failed to load history.</p>';
    }
  }

  // ─── Init ──────────────────────────────────────────────────────────────
  await loadAppointments();
  initStripe();

  // Check URL params — allow linking directly with appointmentId
  const params = new URLSearchParams(window.location.search);
  const preselect = params.get('appointmentId');
  if (preselect) {
    const select = document.getElementById('appointment-select');
    select.value = preselect;
    onAppointmentSelected();
  }
})();
