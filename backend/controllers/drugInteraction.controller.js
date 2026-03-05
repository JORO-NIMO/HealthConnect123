const DrugInteractionService = require('../services/drugInteraction.service');
const PatientModel           = require('../models/Patient.model');
const { sendSuccess, sendError } = require('../utils/response.util');
const logger = require('../utils/logger.util');

// ─── Check Drug Interactions ──────────────────────────────────────────────
exports.checkInteractions = async (req, res, next) => {
  try {
    const { medications } = req.body;

    if (!medications || !Array.isArray(medications) || medications.length < 2) {
      return sendError(res, 400, 'Please provide at least 2 medications to check for interactions.');
    }

    // Get patient context if authenticated patient
    let patientContext = {};
    if (req.user) {
      const patient = await PatientModel.findByUserId(req.user.id);
      if (patient) {
        patientContext = {
          age: patient.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth)) / 31557600000) : null,
          gender: patient.gender,
          weight: patient.weight_kg,
          conditions: patient.chronic_conditions,
          allergies: patient.allergies,
        };
      }
    }

    const result = await DrugInteractionService.checkInteractions(medications, patientContext);

    // Save the check
    let checkId = null;
    if (req.user) {
      const patient = await PatientModel.findByUserId(req.user.id);
      checkId = await DrugInteractionService.saveInteractionCheck({
        patientId: patient?.id,
        medications,
        interactions: result,
        severity: result.overallSeverity,
        checkedBy: req.user.id,
      });
    }

    logger.info(`Drug interaction check: ${medications.length} medications, severity: ${result.overallSeverity}`);

    return sendSuccess(res, 200, 'Drug interaction analysis complete.', {
      checkId,
      ...result,
    });
  } catch (err) { next(err); }
};

// ─── Get Interaction History ──────────────────────────────────────────────
exports.getHistory = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { query: dbQuery } = require('../config/database');
    const checks = await dbQuery(
      `SELECT * FROM drug_interaction_checks WHERE patient_id = ? ORDER BY created_at DESC LIMIT 20`,
      [patient.id]
    );

    const parsed = checks.map(c => ({
      ...c,
      medications: JSON.parse(c.medications),
      interactions: JSON.parse(c.interactions),
    }));

    return sendSuccess(res, 200, 'Interaction history retrieved.', { checks: parsed });
  } catch (err) { next(err); }
};
