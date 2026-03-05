const { openai, AI_CONFIG, MEDICAL_SYSTEM_PROMPT } = require('../config/openai');
const { v4: uuidv4 } = require('uuid');
const { query }       = require('../config/database');
const logger          = require('../utils/logger.util');

/**
 * AI-powered Drug Interaction Checker
 * Checks medications for potential interactions, contraindications,
 * and provides safety warnings.
 */
async function checkInteractions(medications, patientContext = {}) {
  if (!medications || medications.length < 2) {
    return {
      interactions: [],
      severity: 'none',
      summary: 'At least two medications are needed to check for interactions.',
      safetyScore: 100,
    };
  }

  if (!openai) {
    logger.warn('Drug interaction check skipped — AI provider not configured');
    return getFallbackInteractionResult(medications);
  }

  const prompt = buildInteractionPrompt(medications, patientContext);

  try {
    const requestOpts = {
      model      : AI_CONFIG.model,
      max_tokens : AI_CONFIG.maxTokens,
      temperature: 0.2,
      messages   : [
        {
          role: 'system',
          content: `You are a pharmaceutical safety expert AI. Analyze drug interactions between medications.
Always respond with valid JSON only. Be thorough but note this is informational — always recommend pharmacist consultation.

Response format:
{
  "interactions": [
    {
      "drug1": "Medication A",
      "drug2": "Medication B",
      "severity": "mild|moderate|severe|contraindicated",
      "type": "pharmacokinetic|pharmacodynamic|additive|synergistic|antagonistic",
      "description": "Clear explanation of the interaction",
      "mechanism": "How the interaction occurs",
      "clinicalEffect": "What the patient might experience",
      "recommendation": "What to do about it",
      "evidenceLevel": "well-established|probable|possible|theoretical"
    }
  ],
  "overallSeverity": "none|mild|moderate|severe|contraindicated",
  "safetyScore": 0-100,
  "summary": "Brief overall summary",
  "warnings": ["Important warning 1", ...],
  "recommendations": ["Recommendation 1", ...],
  "disclaimer": "Standard medical disclaimer"
}`,
        },
        { role: 'user', content: prompt },
      ],
    };

    if (AI_CONFIG.provider === 'openai') {
      requestOpts.response_format = { type: 'json_object' };
    }

    const response = await openai.chat.completions.create(requestOpts);
    const raw      = response.choices[0].message.content;
    const result   = extractJSON(raw);

    // Ensure required fields
    if (!result.disclaimer) {
      result.disclaimer = 'This drug interaction check is for informational purposes only. Always consult your pharmacist or healthcare provider before making changes to your medication regimen.';
    }

    const validSeverity = ['none', 'mild', 'moderate', 'severe', 'contraindicated'];
    if (!validSeverity.includes(result.overallSeverity)) {
      result.overallSeverity = 'moderate';
    }

    logger.info(`Drug interaction check: ${medications.length} meds, severity: ${result.overallSeverity}`);
    return result;
  } catch (err) {
    logger.error('Drug interaction API error:', err.message);
    return getFallbackInteractionResult(medications);
  }
}

/**
 * Save interaction check to database
 */
async function saveInteractionCheck({ patientId, medications, interactions, severity, checkedBy }) {
  const id = uuidv4();
  await query(
    `INSERT INTO drug_interaction_checks (id, patient_id, medications, interactions, severity, checked_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, patientId || null, JSON.stringify(medications), JSON.stringify(interactions), severity, checkedBy || null]
  );
  return id;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function buildInteractionPrompt(medications, context) {
  let prompt = `Check for drug interactions between these medications:\n`;
  prompt += medications.map((m, i) => `${i + 1}. ${m}`).join('\n');

  if (context.age)    prompt += `\n\nPatient age: ${context.age}`;
  if (context.gender) prompt += `\nPatient gender: ${context.gender}`;
  if (context.weight) prompt += `\nPatient weight: ${context.weight} kg`;
  if (context.conditions) prompt += `\nExisting conditions: ${context.conditions}`;
  if (context.allergies)  prompt += `\nKnown allergies: ${context.allergies}`;

  prompt += `\n\nAnalyze ALL possible pairwise interactions between these medications. Consider both pharmacokinetic and pharmacodynamic interactions. Include common and serious interactions.`;

  return prompt;
}

function extractJSON(text) {
  try { return JSON.parse(text); } catch (_) { /* continue */ }
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) { try { return JSON.parse(fenceMatch[1].trim()); } catch (_) { /* continue */ } }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) { try { return JSON.parse(braceMatch[0]); } catch (_) { /* continue */ } }
  throw new Error('Could not extract valid JSON from AI response');
}

function getFallbackInteractionResult(medications) {
  return {
    interactions: [],
    overallSeverity: 'moderate',
    safetyScore: 50,
    summary: 'Unable to perform AI-powered interaction analysis at this time. Please consult your pharmacist or healthcare provider directly.',
    warnings: ['AI analysis service temporarily unavailable', 'Always consult a pharmacist when taking multiple medications'],
    recommendations: [
      'Show this medication list to your pharmacist',
      'Do not start or stop medications without medical advice',
      'Report any unusual symptoms to your doctor immediately',
    ],
    disclaimer: 'This service is temporarily unavailable. Please consult a qualified healthcare professional for drug interaction information.',
  };
}

module.exports = { checkInteractions, saveInteractionCheck };
