const AIService     = require('../services/ai.service');
const SymptomReport = require('../models/SymptomReport.model');
const PatientModel  = require('../models/Patient.model');
const DoctorModel   = require('../models/Doctor.model');
const HospitalModel = require('../models/Hospital.model');
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
      latitude,         // Patient's current location (optional)
      longitude,
      radiusKm,         // Search radius in km (default 50)
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

    // ─── AUTO-RECOMMEND DOCTORS based on analysis + location ───────────
    let recommendedDoctors = [];
    try {
      const patLat = latitude  || patient?.latitude;
      const patLng = longitude || patient?.longitude;
      const radius  = parseInt(radiusKm) || 50;

      // Fetch doctors: prefer nearby if location is available
      let availableDoctors;
      if (patLat && patLng) {
        availableDoctors = await DoctorModel.findNearby(parseFloat(patLat), parseFloat(patLng), radius, { limit: 30 });
      } else {
        availableDoctors = await DoctorModel.listWithLocation({ limit: 30, availableOnly: true });
      }

      // Build patient context for AI matching
      const patientContext = {
        age: patient?.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth)) / 31557600000) : null,
        gender: patient?.gender,
        conditions: patient?.chronic_conditions,
        city: patient?.city,
        latitude: patLat,
        longitude: patLng,
      };

      // AI-powered recommendation
      recommendedDoctors = await AIService.recommendDoctorsForReport(analysis, availableDoctors, patientContext);

      // Also find nearby hospitals that match the specializations needed
      let nearbyHospitals = [];
      if (patLat && patLng) {
        nearbyHospitals = await HospitalModel.findNearby(parseFloat(patLat), parseFloat(patLng), radius, 5);
      }

      // Attach hospital info to recommended doctors
      for (const doc of recommendedDoctors) {
        const hospitals = await HospitalModel.getDoctorHospitals(doc.id);
        doc.hospitals = hospitals.map(h => ({ id: h.id, name: h.name, city: h.city, type: h.type }));
      }

      logger.info(`Auto-recommended ${recommendedDoctors.length} doctors for patient ${req.user.id}`);
    } catch (recErr) {
      logger.warn('Doctor auto-recommendation failed (non-blocking):', recErr.message);
    }

    return sendSuccess(res, 200, 'Symptom analysis complete.', {
      reportId: report.id,
      analysis,
      recommendedDoctors,
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
