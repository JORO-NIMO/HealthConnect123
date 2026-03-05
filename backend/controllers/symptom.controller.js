const AIService     = require('../services/ai.service');
const SymptomReport = require('../models/SymptomReport.model');
const PatientModel  = require('../models/Patient.model');
const { sendSuccess, sendError } = require('../utils/response.util');
const logger = require('../utils/logger.util');

// ─── Analyze Symptoms ─────────────────────────────────────────────────────
exports.analyzeSymptoms = async (req, res, next) => {
  try {
    const {
      symptoms,         // Array of symptom strings
      patientAge,
      patientGender,
      duration,         // How long symptoms have been present
      additionalNotes,
      sessionId,
    } = req.body;

    if (!symptoms || !symptoms.length) {
      return sendError(res, 400, 'At least one symptom is required.');
    }

    // Get patient profile for better context
    const patient = await PatientModel.findByUserId(req.user.id);

    const context = {
      symptoms,
      patientAge      : patientAge      || null,
      patientGender   : patientGender   || patient?.gender    || null,
      bloodType       : patient?.blood_type                    || null,
      chronicConditions: patient?.chronic_conditions           || null,
      allergies       : patient?.allergies                     || null,
      duration,
      additionalNotes,
      region          : 'Africa', // Contextual for African disease patterns
    };

    logger.info(`AI analysis started for patient: ${req.user.id}`);
    const analysis = await AIService.analyzeSymptoms(context);

    // Persist the report
    const report = await SymptomReport.create({
      patientId  : patient.id,
      symptoms,
      aiAnalysis : analysis,
      urgencyLevel: analysis.urgencyLevel,
      sessionId,
    });

    logger.info(`AI analysis complete. Urgency: ${analysis.urgencyLevel} | Patient: ${req.user.id}`);

    return sendSuccess(res, 200, 'Symptom analysis complete.', {
      reportId: report.id,
      analysis,
    });
  } catch (err) { next(err); }
};

// ─── Follow-up Questions ──────────────────────────────────────────────────
exports.getFollowUp = async (req, res, next) => {
  try {
    const { symptoms, previousAnswers } = req.body;
    const questions = await AIService.generateFollowUpQuestions(symptoms, previousAnswers);
    return sendSuccess(res, 200, 'Follow-up questions generated.', { questions });
  } catch (err) { next(err); }
};

// ─── Get Report ───────────────────────────────────────────────────────────
exports.getReport = async (req, res, next) => {
  try {
    const report = await SymptomReport.findById(req.params.id);
    if (!report) return sendError(res, 404, 'Report not found.');
    return sendSuccess(res, 200, 'Report retrieved.', { report });
  } catch (err) { next(err); }
};

// ─── Get Symptom History ──────────────────────────────────────────────────
exports.getHistory = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { limit = 20, offset = 0 } = req.query;
    const reports = await SymptomReport.listByPatient(patient.id, {
      limit : parseInt(limit),
      offset: parseInt(offset),
    });
    return sendSuccess(res, 200, 'Symptom history retrieved.', { reports });
  } catch (err) { next(err); }
};

// ─── Get Symptom List ─────────────────────────────────────────────────────
exports.getSymptomList = async (req, res, next) => {
  try {
    const symptoms = await SymptomReport.getSymptomList();
    return sendSuccess(res, 200, 'Symptoms list retrieved.', { symptoms });
  } catch (err) { next(err); }
};
