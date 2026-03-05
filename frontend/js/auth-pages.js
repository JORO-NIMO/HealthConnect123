/**
 * HealthConnect — Auth Page Logic
 * Handles login form, OTP flow, Google OAuth, and registration
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
      Auth.redirectToDashboard(data.data.user.role);
    } catch (err) {
      const msg = err.errors ? err.errors.map(e => e.msg).join(', ') : err.message;
      Utils.showAlert('register-alert', msg, 'error');
      Utils.setLoading(registerBtn, false);
    }
  });

  document.getElementById('google-register-btn')?.addEventListener('click', Auth.loginWithGoogle);
}
