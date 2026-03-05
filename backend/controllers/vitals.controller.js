const VitalSignModel = require('../models/VitalSign.model');
const PatientModel   = require('../models/Patient.model');
const NotificationModel = require('../models/Notification.model');
const { sendSuccess, sendError } = require('../utils/response.util');
const logger = require('../utils/logger.util');

// ─── Record Vital Signs ──────────────────────────────────────────────────
exports.recordVitals = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const {
      systolicBp, diastolicBp, heartRate, temperature,
      oxygenSat, respiratoryRate, weightKg, heightCm,
      bloodSugar, sugarContext, notes, source, recordedAt,
    } = req.body;

    // At least one vital must be provided
    if (!systolicBp && !heartRate && !temperature && !oxygenSat && !bloodSugar && !weightKg) {
      return sendError(res, 400, 'Please provide at least one vital sign reading.');
    }

    const vital = await VitalSignModel.create({
      patientId: patient.id,
      systolicBp, diastolicBp, heartRate, temperature,
      oxygenSat, respiratoryRate, weightKg, heightCm,
      bloodSugar, sugarContext, notes, source, recordedAt,
    });

    // Check for abnormal readings and create alert notification
    const alerts = [];
    if (systolicBp > 140 || systolicBp < 90) alerts.push(`Blood pressure systolic: ${systolicBp} mmHg`);
    if (diastolicBp > 90 || diastolicBp < 60) alerts.push(`Blood pressure diastolic: ${diastolicBp} mmHg`);
    if (heartRate > 100 || heartRate < 50)     alerts.push(`Heart rate: ${heartRate} bpm`);
    if (temperature > 38.0)                    alerts.push(`Temperature: ${temperature}°C (fever)`);
    if (oxygenSat && oxygenSat < 94)           alerts.push(`Oxygen saturation: ${oxygenSat}% (low)`);
    if (bloodSugar > 200 || bloodSugar < 70)   alerts.push(`Blood sugar: ${bloodSugar} mg/dL`);

    if (alerts.length) {
      await NotificationModel.create({
        userId: req.user.id,
        title: '⚠️ Abnormal Vital Signs Detected',
        message: `The following readings are outside normal range:\n${alerts.join('\n')}\nPlease consult your doctor if symptoms persist.`,
        type: 'vitals',
        actionUrl: '/pages/patient/vitals.html',
        metadata: { vitalId: vital.id, alerts },
      });

      // Emit real-time notification
      const io = req.app.get('io');
      if (io) io.to(`user:${req.user.id}`).emit('notification', { type: 'vitals_alert', alerts });
    }

    logger.info(`Vitals recorded for patient ${patient.id}. Alerts: ${alerts.length}`);
    return sendSuccess(res, 201, 'Vital signs recorded.', { vital, alerts });
  } catch (err) { next(err); }
};

// ─── Get Vitals History ───────────────────────────────────────────────────
exports.getHistory = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { limit = 50, offset = 0, from, to } = req.query;
    const vitals = await VitalSignModel.listByPatient(patient.id, {
      limit: parseInt(limit), offset: parseInt(offset), from, to,
    });

    return sendSuccess(res, 200, 'Vitals history retrieved.', { vitals });
  } catch (err) { next(err); }
};

// ─── Get Latest Reading ───────────────────────────────────────────────────
exports.getLatest = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const latest = await VitalSignModel.getLatest(patient.id);
    return sendSuccess(res, 200, 'Latest vitals retrieved.', { vital: latest });
  } catch (err) { next(err); }
};

// ─── Get Trends (for Charts) ─────────────────────────────────────────────
exports.getTrends = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { metric, days = 30 } = req.query;
    const trends = await VitalSignModel.getTrends(patient.id, {
      metric, days: parseInt(days),
    });

    return sendSuccess(res, 200, 'Trends retrieved.', { trends });
  } catch (err) { next(err); }
};

// ─── Get Averages ─────────────────────────────────────────────────────────
exports.getAverages = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { days = 30 } = req.query;
    const averages = await VitalSignModel.getAverages(patient.id, parseInt(days));
    return sendSuccess(res, 200, 'Averages retrieved.', { averages });
  } catch (err) { next(err); }
};

// ─── Get Alerts (Out-of-Range) ────────────────────────────────────────────
exports.getAlerts = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const alerts = await VitalSignModel.getAlerts(patient.id);
    return sendSuccess(res, 200, 'Alerts retrieved.', { alerts });
  } catch (err) { next(err); }
};

// ─── Delete a Reading ─────────────────────────────────────────────────────
exports.deleteVital = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const deleted = await VitalSignModel.delete(req.params.id, patient.id);
    if (!deleted) return sendError(res, 404, 'Vital sign record not found.');

    return sendSuccess(res, 200, 'Vital sign record deleted.');
  } catch (err) { next(err); }
};

// ─── Doctor: Get Patient Vitals ───────────────────────────────────────────
exports.getPatientVitals = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const { limit = 50, days = 90 } = req.query;

    const [vitals, averages, alerts] = await Promise.all([
      VitalSignModel.listByPatient(patientId, { limit: parseInt(limit) }),
      VitalSignModel.getAverages(patientId, parseInt(days)),
      VitalSignModel.getAlerts(patientId),
    ]);

    return sendSuccess(res, 200, 'Patient vitals retrieved.', { vitals, averages, alerts });
  } catch (err) { next(err); }
};
