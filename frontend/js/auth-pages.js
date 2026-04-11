/**
 * HealthConnect — Auth Page Logic


























































































































</html></body>  </script>    })();      document.getElementById('logout-btn').addEventListener('click', () => Auth.logout());      // Logout      });        }          document.getElementById('status-message').textContent = 'Could not check status. Please try again.';        } catch (err) {          }            document.getElementById('status-message').textContent = 'Still under review. Check back soon!';          if (vs === 'pending') {          render(vs);          Auth.saveUser(me);          me.verificationStatus = vs;          // Update stored user          }            } catch { vs = 'pending'; }              vs = hRes.data?.hospital?.verification_status || 'pending';              const hRes = await API.get('/hospitals/my-hospital');            try {          } else if (me.role === 'hospital_admin') {            vs = dRes.data?.doctor?.verification_status || 'pending';            const dRes = await API.get('/doctors/me/profile');          if (me.role === 'doctor') {          let vs = 'pending';          // Determine verification status from profile          const me  = res.data.user;          const res = await API.get('/auth/me');        try {      document.getElementById('check-status-btn').addEventListener('click', async () => {      // Check status button      render(user.verificationStatus);      // Render initial state from stored user      }        }          if (note) { noteEl.textContent = 'Admin note: ' + note; noteEl.style.display = 'block'; }          pill.textContent  = '❌ Rejected';          pill.className    = 'status-pill pill-rejected';          msg.textContent   = 'Unfortunately your account verification was not approved. Please review the note below or contact support.';          title.textContent = 'Verification Declined';          icon.textContent  = '❌';        if (status === 'rejected') {        }          return;          Auth.redirectToDashboard(user.role);        if (status === 'verified') {        const noteEl  = document.getElementById('rejected-note');        const pill    = document.getElementById('status-pill');        const msg     = document.getElementById('status-message');        const title   = document.getElementById('status-title');        const icon    = document.getElementById('status-icon');      function render(status, note) {      }        return;        Auth.redirectToDashboard(user.role);      if (user.verificationStatus === 'verified') {      // If already verified, redirect      }        return;        Auth.redirectToDashboard(user.role);      if (user.role === 'patient' || user.role === 'admin') {      // Patients and admins don't need verification      if (!user) { window.location.href = '/pages/auth/login.html'; return; }      const user = Auth.getUser();    (async () => {  <script>  <script src="/js/auth.js"></script>  <script src="/js/api.js"></script>  <script src="/js/config.js"></script>  </div>    </div>      <button class="btn btn-ghost" id="logout-btn">Sign Out</button>      <button class="btn btn-ghost" id="check-status-btn">🔄 Check Status</button>      <a href="/" class="btn btn-primary">← Back to Home</a>    <div class="actions">    <div id="rejected-note" class="rejected-msg" style="display:none;"></div>    </div>      <span class="status-pill pill-pending" id="status-pill">⏳ Pending Verification</span>    <div id="status-pill-wrap">    </p>      This usually takes 24–48 hours. You'll receive a notification once your account is approved.      Your account has been submitted and is awaiting admin verification.    <p class="sub" id="status-message">    <h1 id="status-title">Account Under Review</h1>    <div class="icon" id="status-icon">⏳</div>  <div class="card" id="verification-card"><body></head>  </style>    .rejected-msg { margin-top: 16px; padding: 16px; border-radius: 12px; background: rgba(239,68,68,.06); border: 1px solid rgba(239,68,68,.15); color: #EF4444; font-size: 14px; text-align: left; }    .btn-ghost { background: transparent; color: var(--text3); border: 1px solid var(--border); }    .btn-primary { background: var(--primary); color: #fff; }    .btn { padding: 12px 24px; border-radius: 12px; font-weight: 600; font-size: 14px; text-decoration: none; display: inline-block; cursor: pointer; border: none; }    .actions { margin-top: 32px; display: flex; flex-direction: column; gap: 12px; }    .pill-rejected { background: rgba(239,68,68,.1);  color: #EF4444; border: 1px solid rgba(239,68,68,.25); }    .pill-pending  { background: rgba(133,203,238,.1); color: #85CBEE; border: 1px solid rgba(133,203,238,.25); }    .status-pill { display: inline-flex; align-items: center; gap: 6px; padding: 8px 20px; border-radius: 99px; font-size: 14px; font-weight: 600; }    .sub { color: var(--text3); font-size: 15px; line-height: 1.7; margin-bottom: 28px; }    h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }    .icon { font-size: 56px; margin-bottom: 16px; }    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; max-width: 480px; width: 100%; padding: 48px 36px; text-align: center; }    body { background: var(--bg); color: var(--text); min-height: 100vh; display: flex; align-items: center; justify-content: center; }  <style>  <link rel="stylesheet" href="/css/main.css" />  <title>Pending Verification — HealthConnect</title>  <meta name="viewport" content="width=device-width, initial-scale=1.0" />  <meta charset="UTF-8" /><head> * Handles login form, OTP flow, Google OAuth, and registration
 */

// ─── Login Page ───────────────────────────────────────────────────────────

if (document.getElementById('login-form')) {
  Auth.redirectIfLoggedIn();
  Auth.handleOAuthCallback() && Auth.redirectToDashboard(Auth.getUser().role);

  const loginForm     = document.getElementById('login-form');
  const otpSection    = document.getElementById('otp-section');
  const loginSection  = document.getElementById('login-section');
  const toggleOtp     = document.getElementById('toggle-otp');
  const loginBtn      = document.getElementById('login-btn');
  const togglePwd     = document.getElementById('toggle-password');
  const pwdInput      = document.getElementById('password');

  // Expired session banner
  if (Utils.getParam('expired')) Utils.showAlert('login-alert', 'Session expired. Please log in again.', 'warning');

  // Toggle password visibility
  if (togglePwd && pwdInput) {
    togglePwd.addEventListener('click', () => {
      pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
      togglePwd.textContent = pwdInput.type === 'password' ? '👁' : '🙈';
    });
  }

  // Switch to OTP mode
  if (toggleOtp) {
    toggleOtp.addEventListener('click', () => {
      loginSection.classList.toggle('hidden');
      otpSection.classList.toggle('hidden');
    });
  }

  // Email/Password Login
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    Utils.hideAlert('login-alert');
    Utils.setLoading(loginBtn, true, 'Signing in…');

    try {
      const data = await API.post('/auth/login', {
        email:    document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
      });
      Auth.saveSession(data.data.tokens, data.data.user);

      // Check if doctor/hospital is pending verification
      const vs = data.data.user.verificationStatus;
      if ((data.data.user.role === 'doctor' || data.data.user.role === 'hospital_admin') && vs && vs !== 'verified') {
        window.location.href = '/pages/auth/pending-verification.html';
        return;
      }

      Auth.redirectToDashboard(data.data.user.role);
    } catch (err) {
      Utils.showAlert('login-alert', err.message || 'Invalid credentials', 'error');
      Utils.setLoading(loginBtn, false);
    }
  });

  // Send OTP
  const sendOtpBtn = document.getElementById('send-otp-btn');
  if (sendOtpBtn) {
    sendOtpBtn.addEventListener('click', async () => {
      const phone = document.getElementById('otp-phone')?.value?.trim();
      if (!phone) return Utils.showAlert('otp-alert', 'Enter your phone number', 'error');
      Utils.setLoading(sendOtpBtn, true, 'Sending…');
      try {
        await API.post('/auth/send-otp', { phone });
        document.getElementById('otp-verify-row')?.classList.remove('hidden');
        Utils.showAlert('otp-alert', 'OTP sent to your phone!', 'success');
      } catch (err) {
        Utils.showAlert('otp-alert', err.message, 'error');
      } finally {
        Utils.setLoading(sendOtpBtn, false);
      }
    });
  }

  // Verify OTP
  const verifyOtpBtn = document.getElementById('verify-otp-btn');
  if (verifyOtpBtn) {
    verifyOtpBtn.addEventListener('click', async () => {
      const phone = document.getElementById('otp-phone')?.value?.trim();
      const otp   = document.getElementById('otp-code')?.value?.trim();
      Utils.setLoading(verifyOtpBtn, true, 'Verifying…');
      try {
        const data = await API.post('/auth/verify-otp', { phone, otp });
        Auth.saveSession(data.data.tokens, data.data.user);
        Auth.redirectToDashboard(data.data.user.role);
      } catch (err) {
        Utils.showAlert('otp-alert', err.message, 'error');
        Utils.setLoading(verifyOtpBtn, false);
      }
    });
  }

  // Google login
  document.getElementById('google-login-btn')?.addEventListener('click', Auth.loginWithGoogle);
}

// ─── Register Page ────────────────────────────────────────────────────────

if (document.getElementById('register-form')) {
  Auth.redirectIfLoggedIn();

  // Pre-fill role from URL
  const preRole = Utils.getParam('role');
  if (preRole) {
    document.querySelectorAll('input[name="role"]').forEach(r => {
      r.checked = r.value === preRole;
      r.closest('label')?.classList.toggle('ring-2', r.value === preRole);
      r.closest('label')?.classList.toggle('ring-primary', r.value === preRole);
    });
    toggleDoctorFields(preRole === 'doctor');
  }

  function toggleDoctorFields(show) {
    document.getElementById('doctor-fields')?.classList.toggle('hidden', !show);
  }

  document.querySelectorAll('input[name="role"]').forEach(r => {
    r.addEventListener('change', () => toggleDoctorFields(r.value === 'doctor'));
  });

  // Password strength
  document.getElementById('password')?.addEventListener('input', function () {
    const val = this.value;
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const bar   = document.getElementById('pwd-strength-bar');
    const label = document.getElementById('pwd-strength-label');
    if (!bar) return;
    const levels = [
      { w: '0%',    bg: 'var(--border)',  tc: 'var(--text3)', text: '' },
      { w: '25%',   bg: 'var(--red)',     tc: 'var(--red)',   text: 'Weak' },
      { w: '50%',   bg: '#F97316',        tc: '#F97316',      text: 'Fair' },
      { w: '75%',   bg: 'var(--gold)',    tc: 'var(--gold)',  text: 'Good' },
      { w: '100%',  bg: 'var(--green)',   tc: 'var(--green)', text: 'Strong' },
    ];
    const l = levels[score] || levels[0];
    bar.style.width = l.w;
    bar.className = 'h-full rounded-full transition-all';
    bar.style.background = l.bg;
    if (label) { label.textContent = l.text; label.style.color = l.tc; }
  });

  const registerForm = document.getElementById('register-form');
  const registerBtn  = document.getElementById('register-btn');

  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    Utils.hideAlert('register-alert');

    const role     = document.querySelector('input[name="role"]:checked')?.value || 'patient';
    const password = document.getElementById('password').value;
    const confirm  = document.getElementById('confirm-password')?.value;

    if (confirm !== undefined && password !== confirm) {
      return Utils.showAlert('register-alert', 'Passwords do not match', 'error');
    }

    const payload = {
      firstName:   document.getElementById('first-name').value.trim(),
      lastName:    document.getElementById('last-name').value.trim(),
      email:       document.getElementById('email').value.trim(),
      phone:       document.getElementById('phone')?.value?.trim() || undefined,
      password,
      role,
    };

    if (role === 'doctor') {
      payload.specialization  = document.getElementById('specialization')?.value?.trim();
      payload.licenseNumber   = document.getElementById('license-number')?.value?.trim();
    }

    Utils.setLoading(registerBtn, true, 'Creating account…');

    try {
      const data = await API.post('/auth/register', payload);
      Auth.saveSession(data.data.tokens, data.data.user);

      // Doctors and hospital_admin need admin verification first
      if (role === 'doctor' || role === 'hospital_admin') {
        window.location.href = '/pages/auth/pending-verification.html';
        return;
      }

      Auth.redirectToDashboard(data.data.user.role);
    } catch (err) {
      const msg = err.errors ? err.errors.map(e => e.msg).join(', ') : err.message;
      Utils.showAlert('register-alert', msg, 'error');
      Utils.setLoading(registerBtn, false);
    }
  });

  document.getElementById('google-register-btn')?.addEventListener('click', Auth.loginWithGoogle);
}
