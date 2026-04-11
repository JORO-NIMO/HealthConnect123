const fs = require('fs');
const path = require('path');
const { openai, AI_CONFIG } = require('../config/openai');
const logger = require('../utils/logger.util');

const PLATFORM_DOC_FILES = [
  'README.md',
  'README_PATIENT.md',
  'README_DOCTOR.md',
  'README_HOSPITAL.md',
  'README_TECHNICAL.md',
  'GOOGLE_OAUTH_SETUP.md',
  'GOOGLE_OAUTH_INTEGRATION_COMPLETE.md',
  'MOBILE_OPTIMIZATION.md',
  'POLICIES_READTHROUGH.md',
];

let cachedKnowledge = null;

function inferRole(userContext = {}, pageContext = {}) {
  const directRole = String(userContext?.role || '').toLowerCase();
  const knownRoles = new Set(['anonymous', 'patient', 'doctor', 'admin', 'hospital_admin']);
  if (knownRoles.has(directRole)) return directRole;

  const pathValue = String(pageContext?.path || '').toLowerCase();
  if (pathValue.includes('/pages/doctor/')) return 'doctor';
  if (pathValue.includes('/pages/patient/')) return 'patient';
  if (pathValue.includes('/pages/hospital/')) return 'hospital_admin';
  if (pathValue.includes('/pages/admin/')) return 'admin';

  return 'anonymous';
}

function getRolePlaybook(role) {
  const map = {
    anonymous: {
      label: 'Anonymous visitor',
      capabilities: [
        'Can browse landing, legal pages, and public information.',
        'Cannot access protected dashboards without logging in.',
      ],
      focusAreas: [
        'How to get started',
        'How to register',
        'General platform overview',
      ],
      starterActions: [
        'How do I create an account?',
        'How do I register as a doctor?',
        'What can I do before logging in?',
      ],
    },
    patient: {
      label: 'Patient user',
      capabilities: [
        'Can use symptom checker, appointments, records, vitals, emergency, and payments.',
        'Can find doctors and manage patient profile data.',
      ],
      focusAreas: [
        'Symptom checker flow',
        'Booking consultations',
        'Uploading documents and checking results',
      ],
      starterActions: [
        'How do I book an appointment?',
        'How do I upload medical documents?',
        'How do I check my payment status?',
      ],
    },
    doctor: {
      label: 'Doctor user',
      capabilities: [
        'Can manage schedule, profile, consultation room, and assigned appointments.',
        'Can interact with patients through doctor-side workflows.',
      ],
      focusAreas: [
        'Managing schedule and availability',
        'Handling appointment requests',
        'Using consultation room and doctor dashboard',
      ],
      starterActions: [
        'How do I set my availability schedule?',
        'How do I accept or reject appointment requests?',
        'How do I join the consultation room?',
      ],
    },
    admin: {
      label: 'Admin user',
      capabilities: ['Can manage platform administration and verifications.'],
      focusAreas: ['Admin dashboard operations'],
      starterActions: ['How do I review pending verifications?'],
    },
    hospital_admin: {
      label: 'Hospital admin user',
      capabilities: ['Can manage hospital-side workflows and resources.'],
      focusAreas: ['Hospital dashboard operations'],
      starterActions: ['How do I manage hospital operations in the dashboard?'],
    },
  };

  return map[role] || map.anonymous;
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getPlatformKnowledge() {
  if (cachedKnowledge) return cachedKnowledge;

  const repoRoot = path.resolve(__dirname, '..', '..');
  const maxPerFileChars = 1800;
  const snippets = [];

  for (const relPath of PLATFORM_DOC_FILES) {
    const absPath = path.join(repoRoot, relPath);
    if (!fs.existsSync(absPath)) continue;

    try {
      const raw = fs.readFileSync(absPath, 'utf8');
      const condensed = normalizeText(raw).slice(0, maxPerFileChars);
      snippets.push(`## ${relPath}\n${condensed}`);
    } catch (err) {
      logger.warn(`Support chatbot: failed to read ${relPath}: ${err.message}`);
    }
  }

  if (!snippets.length) {
    cachedKnowledge = [
      'HealthConnect platform summary:',
      '- Supports patient, doctor, admin, and hospital admin roles.',
      '- Core modules include auth, appointments, consultations, symptom checker, vitals, documents, payments, and notifications.',
      '- AI outputs are support tools and must not be presented as definitive medical diagnosis.',
      '- Users should contact human support for billing, account lockout, or unresolved technical issues.',
    ].join('\n');
    return cachedKnowledge;
  }

  cachedKnowledge = snippets.join('\n\n');
  return cachedKnowledge;
}

function extractJSON(text) {
  try { return JSON.parse(text); } catch (_) {}

  const fenceMatch = String(text || '').match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch (_) {}
  }

  const braceMatch = String(text || '').match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch (_) {}
  }

  throw new Error('Could not parse chatbot JSON response');
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];

  const allowedRoles = new Set(['user', 'assistant']);
  return history
    .filter((item) => item && allowedRoles.has(item.role) && typeof item.content === 'string')
    .slice(-8)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, 1000),
    }))
    .filter((item) => item.content.length > 0);
}

function fallbackAnswer(message, role = 'anonymous') {
  const q = String(message || '').toLowerCase();
  const playbook = getRolePlaybook(role);

  if (role === 'doctor' && (q.includes('appointment') || q.includes('consult') || q.includes('schedule'))) {
    return {
      answer: 'As a doctor, use the Doctor Dashboard to review requests, then update availability in Schedule. You can join active sessions from Consultation Room links on confirmed appointments.',
      suggestedActions: [
        'Open Doctor Dashboard and review pending requests',
        'Set availability in Schedule',
        'Join consultation from a confirmed appointment',
      ],
      needsHumanSupport: false,
      category: 'appointments',
    };
  }

  if (role === 'patient' && (q.includes('book') || q.includes('appointment') || q.includes('consult'))) {
    return {
      answer: 'To book a consultation, open Appointments, select a verified doctor, choose date/time, and submit. You can track status from your appointments list.',
      suggestedActions: [
        'Open Appointments and tap Book New',
        'Use Find Doctors to filter by specialty',
        'Track status in Upcoming Appointments',
      ],
      needsHumanSupport: false,
      category: 'appointments',
    };
  }

  if (role === 'anonymous' && (q.includes('book') || q.includes('appointment') || q.includes('consult'))) {
    return {
      answer: 'Booking is available after account sign-in. Create an account, then use the patient dashboard to access Appointments and Find Doctors.',
      suggestedActions: [
        'Create a patient account',
        'Log in to access patient dashboard',
        'Open Appointments after login',
      ],
      needsHumanSupport: false,
      category: 'appointments',
    };
  }

  if (q.includes('book') || q.includes('appointment') || q.includes('consult')) {
    return {
      answer: 'To book a consultation, open the Appointments section and choose a verified doctor. You can pick chat or video based on availability.',
      suggestedActions: [
        'Open Appointments and tap Book',
        'Use Find Doctors to filter by specialty',
        'Check your schedule for confirmed slots',
      ],
      needsHumanSupport: false,
      category: 'appointments',
    };
  }

  if (q.includes('password') || q.includes('login') || q.includes('sign in') || q.includes('account')) {
    return {
      answer: 'For account issues, use the login and password recovery flow first. If you still cannot access your account, contact support for manual verification.',
      suggestedActions: [
        'Try login again and confirm your email',
        'Use password recovery if available',
        'Contact support@healthconnect.health with your registered email',
      ],
      needsHumanSupport: true,
      category: 'account',
    };
  }

  if (role === 'doctor') {
    return {
      answer: 'I can help with doctor workflows like schedule setup, appointment handling, consultation room usage, and profile updates.',
      suggestedActions: playbook.starterActions,
      needsHumanSupport: false,
      category: 'general',
    };
  }

  if (role === 'patient') {
    return {
      answer: 'I can help with patient workflows like symptom checks, doctor booking, records, vitals, and payment tracking.',
      suggestedActions: playbook.starterActions,
      needsHumanSupport: false,
      category: 'general',
    };
  }

  if (role === 'anonymous') {
    return {
      answer: 'I can help you understand HealthConnect and how to get started. Once you register and log in, you can access patient or doctor dashboards with more features.',
      suggestedActions: playbook.starterActions,
      needsHumanSupport: false,
      category: 'general',
    };
  }

  return {
    answer: 'I can help with platform usage like appointments, records, payments, symptoms, and account navigation. Ask a specific question and I will guide you step by step.',
    suggestedActions: playbook.starterActions,
    needsHumanSupport: false,
    category: 'general',
  };
}

async function answerPlatformQuestion({ message, history = [], userContext = {}, pageContext = {} }) {
  const role = inferRole(userContext, pageContext);
  const playbook = getRolePlaybook(role);

  if (!openai) {
    return {
      ...fallbackAnswer(message, role),
      role,
      source: 'fallback',
    };
  }

  const safeHistory = sanitizeHistory(history);
  const knowledge = getPlatformKnowledge();

  const systemPrompt = `You are HealthConnect Support Assistant.

Mission:
- Help users with questions about the HealthConnect platform only.
- Explain features, navigation, roles, and common workflows clearly.
- If asked for medical diagnosis/treatment, do not diagnose. Redirect to proper medical consultation.
- If asked for legal/compliance certainty, recommend official support/compliance follow-up.

Current role profile:
- Role: ${playbook.label}
- Capabilities: ${playbook.capabilities.join(' ')}
- Typical intents: ${playbook.focusAreas.join(', ')}

Hard rules:
1) Be concise, practical, and action-oriented.
2) Never invent platform features not present in provided knowledge/context.
3) If uncertain, say what you know and ask one clarifying question.
4) For emergencies, advise immediate local emergency services.
5) Keep output JSON only.
6) Tailor instructions to the current role.
7) If role is anonymous, clearly mention when login/registration is required.
8) If role is doctor, prioritize doctor portal workflows.
9) If role is patient, prioritize patient dashboard workflows.

Return strict JSON:
{
  "answer": "string",
  "suggestedActions": ["string", "string"],
  "needsHumanSupport": true,
  "category": "general|account|appointments|payments|records|technical|policy|other"
}`;

  const runtimeContext = {
    userRole: role,
    userId: userContext?.id || null,
    pagePath: pageContext.path || null,
    pageTitle: pageContext.title || null,
  };

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: `Platform knowledge:\n${knowledge}` },
    { role: 'system', content: `Runtime context: ${JSON.stringify(runtimeContext)}` },
    ...safeHistory,
    { role: 'user', content: String(message || '').trim().slice(0, 1500) },
  ];

  const requestOpts = {
    model: AI_CONFIG.model,
    max_tokens: Math.min(AI_CONFIG.maxTokens || 800, 800),
    temperature: 0.2,
    messages,
  };

  if (AI_CONFIG.provider === 'openai') {
    requestOpts.response_format = { type: 'json_object' };
  }

  try {
    const response = await Promise.race([
      openai.chat.completions.create(requestOpts),
      new Promise((_, reject) => setTimeout(() => reject(new Error('SUPPORT_AI_TIMEOUT')), 18000)),
    ]);

    const raw = response?.choices?.[0]?.message?.content || '{}';
    const parsed = extractJSON(raw);

    const answer = typeof parsed.answer === 'string' && parsed.answer.trim().length
      ? parsed.answer.trim()
      : fallbackAnswer(message, role).answer;

    const suggestedActions = Array.isArray(parsed.suggestedActions)
      ? parsed.suggestedActions.filter((x) => typeof x === 'string' && x.trim()).slice(0, 4)
      : playbook.starterActions;

    const allowedCategories = new Set(['general', 'account', 'appointments', 'payments', 'records', 'technical', 'policy', 'other']);
    const category = allowedCategories.has(parsed.category) ? parsed.category : 'general';

    return {
      answer,
      suggestedActions,
      needsHumanSupport: Boolean(parsed.needsHumanSupport),
      category,
      role,
      source: 'ai',
    };
  } catch (err) {
    logger.error(`Support chatbot error: ${err.message}`);
    return {
      ...fallbackAnswer(message, role),
      role,
      source: 'fallback',
    };
  }
}

module.exports = {
  answerPlatformQuestion,
};
