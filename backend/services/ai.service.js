const { openai, AI_CONFIG, MEDICAL_SYSTEM_PROMPT } = require('../config/openai');
const logger = require('../utils/logger.util');

// ─── Symptom Analysis ─────────────────────────────────────────────────────
async function analyzeSymptoms(context) {
  const {
    symptoms, patientAge, patientGender, bloodType,
    chronicConditions, allergies, duration, additionalNotes, region,
  } = context;

  if (!openai) {
    logger.warn('AI analysis skipped — AI provider not configured');
    return getFallbackAnalysis(symptoms);
  }

  const userPrompt = buildSymptomPrompt({
    symptoms, patientAge, patientGender, bloodType,
    chronicConditions, allergies, duration, additionalNotes, region,
  });

  try {
    // Build request options — HF free models don't support response_format
    const requestOpts = {
      model      : AI_CONFIG.model,
      max_tokens : AI_CONFIG.maxTokens,
      temperature: AI_CONFIG.temperature,
      messages   : [
        { role: 'system', content: MEDICAL_SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
      ],
    };

    // Only add response_format for OpenAI (HF free tier doesn't support it)
    if (AI_CONFIG.provider === 'openai') {
      requestOpts.response_format = { type: 'json_object' };
    }

    const response = await openai.chat.completions.create(requestOpts);

    const raw    = response.choices[0].message.content;
    const result = extractJSON(raw);

    // Safety guardrail — ensure disclaimer is always present
    if (!result.disclaimer) {
      result.disclaimer = 'This analysis is for informational purposes only and does not constitute medical advice. Please consult a qualified healthcare professional for a proper diagnosis and treatment.';
    }

    // Ensure urgency level is valid
    const validUrgency = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];
    if (!validUrgency.includes(result.urgencyLevel)) {
      result.urgencyLevel = 'MEDIUM';
    }

    logger.info(`AI analysis complete. Conditions: ${result.possibleConditions?.length || 0}. Urgency: ${result.urgencyLevel}`);
    return result;
  } catch (err) {
    logger.error(`AI API error (${AI_CONFIG.provider}):`, err.message);
    // Fallback response when AI is unavailable
    return getFallbackAnalysis(symptoms);
  }
}

// ─── Follow-up Questions ──────────────────────────────────────────────────
async function generateFollowUpQuestions(symptoms, previousAnswers = {}) {
  if (!openai) {
    return {
      questions: [
        { id: 'q1', question: 'How long have you had these symptoms?', type: 'select', options: ['<24 hours', '1-3 days', '4-7 days', '>1 week'] },
        { id: 'q2', question: 'On a scale of 1-10, how severe are your symptoms?', type: 'select', options: ['1-3 (Mild)', '4-6 (Moderate)', '7-10 (Severe)'] },
        { id: 'q3', question: 'Have you experienced these symptoms before?', type: 'boolean', options: ['Yes', 'No'] },
      ],
    };
  }
  try {
    const prompt = `
Based on these symptoms: ${symptoms.join(', ')}
${Object.keys(previousAnswers).length ? `Patient already answered: ${JSON.stringify(previousAnswers)}` : ''}

Generate 3-5 targeted follow-up questions to better understand the patient's condition.
Return JSON: { "questions": [{ "id": "q1", "question": "...", "type": "text|select|boolean", "options": [] }] }
`;
    const requestOpts = {
      model      : AI_CONFIG.model,
      max_tokens : 500,
      temperature: 0.4,
      messages   : [
        { role: 'system', content: 'You are a medical intake assistant. Generate follow-up questions to clarify symptoms. Always respond with valid JSON only.' },
        { role: 'user',   content: prompt },
      ],
    };

    if (AI_CONFIG.provider === 'openai') {
      requestOpts.response_format = { type: 'json_object' };
    }

    const response = await openai.chat.completions.create(requestOpts);

    return extractJSON(response.choices[0].message.content);
  } catch (err) {
    logger.error('Follow-up generation error:', err.message);
    return {
      questions: [
        { id: 'q1', question: 'How long have you had these symptoms?', type: 'select', options: ['<24 hours', '1-3 days', '4-7 days', '>1 week'] },
        { id: 'q2', question: 'On a scale of 1-10, how severe are your symptoms?', type: 'select', options: ['1-3 (Mild)', '4-6 (Moderate)', '7-10 (Severe)'] },
        { id: 'q3', question: 'Have you experienced these symptoms before?', type: 'boolean', options: ['Yes', 'No'] },
      ],
    };
  }
}

// ─── JSON Extraction Helper ───────────────────────────────────────────────
// HF free-tier models may wrap JSON in markdown fences or extra text.
// This helper robustly extracts the first valid JSON object from any response.
function extractJSON(text) {
  // Try direct parse first
  try { return JSON.parse(text); } catch (_) { /* continue */ }

  // Try extracting from markdown code fences ```json ... ``` or ``` ... ```
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch (_) { /* continue */ }
  }

  // Try finding first { ... } block (greedy)
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch (_) { /* continue */ }
  }

  // Nothing worked — throw so caller can fall back
  throw new Error('Could not extract valid JSON from AI response');
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function buildSymptomPrompt({ symptoms, patientAge, patientGender, bloodType, chronicConditions, allergies, duration, additionalNotes, region }) {
  return `
Patient Symptoms Report:
━━━━━━━━━━━━━━━━━━━━━━
Symptoms       : ${symptoms.join(', ')}
Duration       : ${duration || 'Not specified'}
Patient Age    : ${patientAge || 'Not specified'}
Patient Gender : ${patientGender || 'Not specified'}
Blood Type     : ${bloodType || 'Unknown'}
Chronic Conditions: ${chronicConditions || 'None reported'}
Allergies      : ${allergies || 'None reported'}
Region         : ${region || 'Africa'}
Additional Notes: ${additionalNotes || 'None'}
━━━━━━━━━━━━━━━━━━━━━━

Please analyze these symptoms and return a structured JSON response following the format specified in your instructions.
Base your analysis strictly on the reported symptoms. Only suggest conditions whose known clinical presentation matches the symptoms described. Do not assume or default to any particular diseases.
`;
}

function getFallbackAnalysis(symptoms) {
  return {
    possibleConditions: [
      {
        name           : 'Unable to analyze at this time',
        icd10Code      : null,
        probability    : 'medium',
        confidenceScore: 0,
        description    : 'The AI analysis service is temporarily unavailable. Please try again or consult a doctor directly.',
        symptoms,
      },
    ],
    urgencyLevel      : 'MEDIUM',
    urgencyReason     : 'Unable to determine urgency. Please consult a healthcare provider.',
    recommendedActions: ['Consult a qualified doctor immediately', 'Visit the nearest health facility if symptoms are severe'],
    followUpQuestions : [],
    disclaimer        : 'This analysis is for informational purposes only. Please consult a qualified healthcare professional.',
    summary           : 'Analysis temporarily unavailable. Please book a consultation with a doctor.',
  };
}

// ─── Smart Doctor Recommendation ──────────────────────────────────────────
async function recommendDoctors(symptoms, availableDoctors, patientContext = {}) {
  if (!openai || !availableDoctors.length) {
    // Fallback: rank by rating and review count
    return availableDoctors
      .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.total_reviews || 0) - (a.total_reviews || 0))
      .slice(0, 5)
      .map(d => ({ ...d, matchScore: 70, matchReason: 'Recommended based on ratings and experience.' }));
  }

  const doctorList = availableDoctors.map(d => ({
    id: d.id,
    name: `${d.first_name} ${d.last_name}`,
    specialization: d.specialization,
    experience: d.years_experience,
    rating: d.rating,
    reviews: d.total_reviews,
    fee: d.consultation_fee,
    languages: d.languages,
  }));

  try {
    const requestOpts = {
      model: AI_CONFIG.model,
      max_tokens: 800,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are a medical triage assistant. Given patient symptoms and a list of available doctors, recommend the best matches.
Return valid JSON only: { "recommendations": [{ "doctorId": "...", "matchScore": 0-100, "matchReason": "Brief explanation" }] }
Rank by specialization relevance, experience, and ratings. Return top 5 max.`,
        },
        {
          role: 'user',
          content: `Patient symptoms: ${symptoms.join(', ')}
${patientContext.age ? `Age: ${patientContext.age}` : ''}
${patientContext.gender ? `Gender: ${patientContext.gender}` : ''}
${patientContext.conditions ? `Existing conditions: ${patientContext.conditions}` : ''}

Available doctors:
${JSON.stringify(doctorList, null, 2)}`,
        },
      ],
    };

    if (AI_CONFIG.provider === 'openai') {
      requestOpts.response_format = { type: 'json_object' };
    }

    const response = await openai.chat.completions.create(requestOpts);
    const result = extractJSON(response.choices[0].message.content);

    // Merge AI recommendations with full doctor data
    return (result.recommendations || []).map(rec => {
      const doc = availableDoctors.find(d => d.id === rec.doctorId);
      return doc ? { ...doc, matchScore: rec.matchScore, matchReason: rec.matchReason } : null;
    }).filter(Boolean);
  } catch (err) {
    logger.error('Doctor recommendation AI error:', err.message);
    return availableDoctors
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 5)
      .map(d => ({ ...d, matchScore: 70, matchReason: 'Recommended based on ratings.' }));
  }
}

module.exports = { analyzeSymptoms, generateFollowUpQuestions, recommendDoctors };
