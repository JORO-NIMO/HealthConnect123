(function initSupportChatbot() {
  if (window.__HC_SUPPORT_CHATBOT_INIT__) return;
  window.__HC_SUPPORT_CHATBOT_INIT__ = true;

  const TOKEN_KEY = (window.CONFIG && window.CONFIG.STORAGE && window.CONFIG.STORAGE.ACCESS_TOKEN)
    ? window.CONFIG.STORAGE.ACCESS_TOKEN
    : 'healthconnect_access_token';
  const USER_KEY = (window.CONFIG && window.CONFIG.STORAGE && window.CONFIG.STORAGE.USER)
    ? window.CONFIG.STORAGE.USER
    : 'healthconnect_user';
  const API_BASE = (window.CONFIG && window.CONFIG.API_BASE) || (window.location.origin + '/api/v1');

  const ROLE_VARIANTS = {
    anonymous: {
      subtitle: 'General guidance for visitors and new users',
      greeting: 'Hi, I can help you understand HealthConnect and how to get started.',
      actions: [
        'How do I create an account?',
        'How do I register as a doctor?',
        'What can I do before logging in?',
      ],
    },
    patient: {
      subtitle: 'Patient support for symptoms, bookings, records, and payments',
      greeting: 'Hi, I can help with your patient tasks like booking doctors, symptom checks, records, and payments.',
      actions: [
        'How do I book an appointment?',
        'Where do I upload medical documents?',
        'How do I track payment status?',
      ],
    },
    doctor: {
      subtitle: 'Doctor support for schedule, consultations, and profile setup',
      greeting: 'Hi Doctor, I can help with schedule setup, appointment requests, consultation room, and profile updates.',
      actions: [
        'How do I set my availability schedule?',
        'How do I accept appointment requests?',
        'How do I join the consultation room?',
      ],
    },
    hospital_admin: {
      subtitle: 'Hospital portal support and workflow guidance',
      greeting: 'Hi, I can help with hospital-admin workflows and dashboard actions.',
      actions: [
        'How do I manage hospital operations?',
        'How do I review hospital requests?',
        'How do I update hospital profile information?',
      ],
    },
    admin: {
      subtitle: 'Admin support for platform operations and verification',
      greeting: 'Hi Admin, I can help with verification and platform management workflows.',
      actions: [
        'How do I review pending verifications?',
        'How do I manage users?',
        'How do I monitor platform status?',
      ],
    },
  };

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY)) || null;
    } catch {
      return null;
    }
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function shouldRender() {
    const pathname = String(window.location.pathname || '').toLowerCase();

    if (window.DISABLE_SUPPORT_CHATBOT === true) return false;
    if (document.body && document.body.dataset && document.body.dataset.supportChatbot === 'off') return false;
    if (pathname.startsWith('/pages/auth/')) return false;

    // Keep consultation UIs distraction-free.
    if (pathname.endsWith('/consultation.html')) return false;

    return true;
  }

  function getRole() {
    const user = getUser();
    const role = String(user && user.role ? user.role : '').toLowerCase();
    if (role) return role;

    const p = window.location.pathname.toLowerCase();
    if (p.includes('/pages/doctor/')) return 'doctor';
    if (p.includes('/pages/patient/')) return 'patient';
    if (p.includes('/pages/hospital/')) return 'hospital_admin';
    if (p.includes('/pages/admin/')) return 'admin';
    return 'anonymous';
  }

  if (!shouldRender()) return;

  let currentRole = getRole();
  function getVariant(role) {
    return ROLE_VARIANTS[role] || ROLE_VARIANTS.anonymous;
  }

  const style = document.createElement('style');
  style.textContent = `
    .hc-chatbot-shell {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 1300;
      font-family: "Plus Jakarta Sans", "Inter", system-ui, sans-serif;
    }
    .hc-chatbot-toggle {
      width: 58px;
      height: 58px;
      border-radius: 999px;
      border: 1px solid rgba(78, 216, 185, 0.32);
      background: linear-gradient(150deg, #4ed8b9 0%, #1a9090 100%);
      color: #ffffff;
      font-size: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 16px 32px rgba(26, 144, 144, 0.3);
      cursor: pointer;
    }
    .hc-chatbot-panel {
      width: min(380px, calc(100vw - 24px));
      height: min(560px, calc(100vh - 100px));
      margin-bottom: 12px;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(78, 216, 185, 0.2);
      background: #183a40;
      color: #e8fbff;
      display: none;
      flex-direction: column;
      box-shadow: 0 24px 50px rgba(4, 20, 22, 0.45);
    }
    .hc-chatbot-panel.open {
      display: flex;
      animation: hcChatRise .2s ease-out;
    }
    @keyframes hcChatRise {
      from { opacity: 0; transform: translateY(8px) scale(.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .hc-chatbot-header {
      padding: 12px 14px;
      background: linear-gradient(140deg, #214a50 0%, #1a9090 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    }
    .hc-chatbot-title {
      font-size: 14px;
      font-weight: 700;
      margin: 0;
      line-height: 1.3;
      color: #ffffff;
    }
    .hc-chatbot-subtitle {
      font-size: 11px;
      margin: 3px 0 0;
      color: rgba(255, 255, 255, 0.78);
    }
    .hc-chatbot-messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      background: radial-gradient(circle at top right, rgba(78, 216, 185, 0.11), transparent 38%);
    }
    .hc-chat-msg {
      max-width: 85%;
      margin-bottom: 10px;
      padding: 10px 12px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.45;
      white-space: pre-wrap;
    }
    .hc-chat-msg.user {
      margin-left: auto;
      background: #4ed8b9;
      color: #06373a;
      border-bottom-right-radius: 4px;
      font-weight: 600;
    }
    .hc-chat-msg.bot {
      margin-right: auto;
      background: rgba(255, 255, 255, 0.08);
      color: #f4feff;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-bottom-left-radius: 4px;
    }
    .hc-chat-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 4px 0 10px;
    }
    .hc-chat-action {
      border: 1px solid rgba(78, 216, 185, 0.3);
      background: rgba(78, 216, 185, 0.12);
      color: #d9fffa;
      border-radius: 999px;
      padding: 5px 10px;
      font-size: 11px;
      cursor: pointer;
    }
    .hc-chatbot-input-wrap {
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding: 10px;
      display: flex;
      gap: 8px;
      background: rgba(0, 0, 0, 0.15);
    }
    .hc-chatbot-input {
      flex: 1;
      border-radius: 10px;
      border: 1px solid rgba(78, 216, 185, 0.2);
      background: rgba(255, 255, 255, 0.08);
      color: #f2fdff;
      padding: 10px;
      font-size: 13px;
      outline: none;
    }
    .hc-chatbot-input::placeholder {
      color: rgba(228, 252, 255, 0.6);
    }
    .hc-chatbot-send {
      border: 1px solid rgba(78, 216, 185, 0.35);
      background: #4ed8b9;
      color: #06373a;
      border-radius: 10px;
      padding: 0 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .hc-chat-meta {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.68);
      padding: 0 12px 8px;
      background: rgba(0, 0, 0, 0.15);
    }
  `;
  document.head.appendChild(style);

  const shell = document.createElement('div');
  shell.className = 'hc-chatbot-shell';

  const panel = document.createElement('section');
  panel.className = 'hc-chatbot-panel';
  panel.setAttribute('aria-label', 'HealthConnect support assistant');

  panel.innerHTML = `
    <header class="hc-chatbot-header">
      <h2 class="hc-chatbot-title">HealthConnect Help Assistant</h2>
      <p class="hc-chatbot-subtitle">${getVariant(currentRole).subtitle}</p>
    </header>
    <div class="hc-chatbot-messages" id="hc-chatbot-messages"></div>
    <div class="hc-chatbot-input-wrap">
      <input class="hc-chatbot-input" id="hc-chatbot-input" maxlength="1500" placeholder="Ask about any platform feature..." />
      <button class="hc-chatbot-send" id="hc-chatbot-send" type="button">Send</button>
    </div>
    <div class="hc-chat-meta">This assistant gives platform guidance. Medical emergencies: contact local emergency services.</div>
  `;

  const toggle = document.createElement('button');
  toggle.className = 'hc-chatbot-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Open support assistant');
  toggle.textContent = '💬';

  shell.appendChild(panel);
  shell.appendChild(toggle);
  document.body.appendChild(shell);

  const messagesEl = panel.querySelector('#hc-chatbot-messages');
  const inputEl = panel.querySelector('#hc-chatbot-input');
  const sendEl = panel.querySelector('#hc-chatbot-send');

  const chatHistory = [];

  function addMessage(role, content) {
    const msg = document.createElement('div');
    msg.className = `hc-chat-msg ${role}`;
    msg.textContent = content;
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msg;
  }

  function addActions(actions) {
    if (!Array.isArray(actions) || !actions.length) return;
    const row = document.createElement('div');
    row.className = 'hc-chat-actions';

    actions.slice(0, 3).forEach((action) => {
      const btn = document.createElement('button');
      btn.className = 'hc-chat-action';
      btn.type = 'button';
      btn.textContent = action;
      btn.addEventListener('click', () => {
        inputEl.value = action;
        inputEl.focus();
      });
      row.appendChild(btn);
    });

    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function postQuestion(question) {
    const token = getToken();
    const user = getUser();

    const res = await fetch(`${API_BASE}/support/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message: question,
        history: chatHistory.slice(-8),
        pageContext: {
          path: window.location.pathname,
          title: document.title,
          role: currentRole,
        },
      }),
    });

    const data = await res.json().catch(() => ({ success: false, message: `HTTP ${res.status}` }));
    if (!res.ok || !data.success) {
      const msg = data && data.message ? data.message : `Request failed (${res.status})`;
      throw new Error(msg);
    }

    return data.data || {};
  }

  async function sendCurrentMessage() {
    const question = inputEl.value.trim();
    if (!question) return;

    inputEl.value = '';
    addMessage('user', question);
    chatHistory.push({ role: 'user', content: question });

    const typing = addMessage('bot', 'Thinking...');

    try {
      const result = await postQuestion(question);
      typing.remove();

      if (result && typeof result.role === 'string' && result.role.trim()) {
        currentRole = result.role.trim();
        const subtitleEl = panel.querySelector('.hc-chatbot-subtitle');
        if (subtitleEl) subtitleEl.textContent = getVariant(currentRole).subtitle;
      }

      const reply = typeof result.reply === 'string' && result.reply.trim()
        ? result.reply.trim()
        : 'I could not generate a response right now. Please try again.';

      addMessage('bot', reply);
      chatHistory.push({ role: 'assistant', content: reply });

      if (Array.isArray(result.suggestedActions) && result.suggestedActions.length) {
        addActions(result.suggestedActions);
      }
    } catch (err) {
      typing.remove();
      const message = `I ran into a problem: ${err.message}. Please try again or contact support@healthconnect.health.`;
      addMessage('bot', message);
      chatHistory.push({ role: 'assistant', content: message });
    }
  }

  toggle.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      inputEl.focus();
    }
  });

  sendEl.addEventListener('click', sendCurrentMessage);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendCurrentMessage();
    }
  });

  addMessage('bot', getVariant(currentRole).greeting);
  addActions(getVariant(currentRole).actions);
})();
