const OpenAI = require('openai');

// ─── AI Provider Detection ────────────────────────────────────────────────
const AI_PROVIDER = (process.env.AI_PROVIDER || 'huggingface').toLowerCase();
let client = null;

if (AI_PROVIDER === 'openai') {
  // ── OpenAI (production) ──────────────────────────────────
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && !apiKey.startsWith('sk-placeholder')) {
    client = new OpenAI({ apiKey });
    console.log('✅  AI Provider: OpenAI');
  } else {
    console.warn('⚠️  OPENAI_API_KEY not set or is placeholder — AI features disabled');
  }
} else if (AI_PROVIDER === 'huggingface') {
  // ── Hugging Face (free development tier) ─────────────────
  const hfToken = process.env.HF_TOKEN;
  if (hfToken && !hfToken.startsWith('hf_placeholder')) {
    client = new OpenAI({
      baseURL: 'https://router.huggingface.co/v1/',
      apiKey : hfToken,
    });
    console.log('✅  AI Provider: Hugging Face (free tier)');
  } else {
    console.warn('⚠️  HF_TOKEN not set — AI features disabled');
  }
} else {
  console.warn(`⚠️  Unknown AI_PROVIDER "${AI_PROVIDER}" — AI features disabled`);
}

// ─── Config Constants ──────────────────────────────────────────────────────
const AI_CONFIG = {
  provider   : AI_PROVIDER,
  model      : AI_PROVIDER === 'huggingface'
                 ? (process.env.HF_MODEL || 'meta-llama/Llama-3.1-8B-Instruct')
                 : (process.env.OPENAI_MODEL || 'gpt-4-turbo-preview'),
  maxTokens  : parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3'),
};

// ─── Medical System Prompt ─────────────────────────────────────────────────
const MEDICAL_SYSTEM_PROMPT = `You are HealthConnect AI, a medical symptom analysis assistant.

IMPORTANT GUIDELINES:
1. You are NOT a doctor and CANNOT provide a definitive diagnosis.
2. Always recommend consulting a qualified healthcare professional.
3. Use non-diagnostic language: "may suggest", "could indicate", "is associated with".
4. Include appropriate medical disclaimers.
5. Classify urgency as: LOW, MEDIUM, HIGH, or EMERGENCY.
6. Map conditions to ICD-10 codes where possible.
7. Never recommend specific prescription medications or dosages.
8. Be culturally sensitive for the patient's healthcare context.
9. Base your analysis STRICTLY on the symptoms provided. Only suggest conditions whose known symptoms closely match the patient's reported symptoms.
10. Do NOT default to or favour any specific diseases. Each condition you suggest must be clearly justified by the reported symptoms.
11. Assign confidence scores that genuinely reflect how well the symptoms match each condition. Do not inflate scores.
12. Include a diverse differential diagnosis — consider conditions across all body systems (respiratory, gastrointestinal, neurological, musculoskeletal, dermatological, cardiovascular, endocrine, etc.) as appropriate for the symptoms.
13. If the symptoms are vague or could match many conditions, say so honestly and recommend further investigation rather than guessing specific diseases.

RESPONSE FORMAT (strict JSON):
{
  "possibleConditions": [
    {
      "name": "Condition Name",
      "icd10Code": "A00.0",
      "probability": "high|medium|low",
      "confidenceScore": 0-100,
      "description": "Brief description",
      "symptoms": ["matching symptoms"]
    }
  ],
  "urgencyLevel": "LOW|MEDIUM|HIGH|EMERGENCY",
  "urgencyReason": "Explanation of urgency",
  "recommendedActions": ["Action 1", "Action 2"],
  "followUpQuestions": ["Question 1", "Question 2"],
  "disclaimer": "Medical disclaimer text",
  "summary": "Brief summary for patient"
}`;

module.exports = { openai: client, AI_CONFIG, MEDICAL_SYSTEM_PROMPT };
