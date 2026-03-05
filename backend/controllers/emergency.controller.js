const EmergencyModel    = require('../models/Emergency.model');
const VitalSignModel    = require('../models/VitalSign.model');
const PatientModel      = require('../models/Patient.model');
const NotificationModel = require('../models/Notification.model');
const SMSService        = require('../services/sms.service');
const { sendSuccess, sendError } = require('../utils/response.util');
const logger = require('../utils/logger.util');

// ─── Trigger Emergency SOS ────────────────────────────────────────────────
exports.triggerSOS = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { latitude, longitude, address, symptoms } = req.body;

    // Get latest vitals as snapshot
    const latestVitals = await VitalSignModel.getLatest(patient.id);

    const sos = await EmergencyModel.triggerSOS({
      patientId: patient.id,
      latitude, longitude, address, symptoms,
      vitalsSnapshot: latestVitals || null,
    });

    // Notify emergency contacts via SMS
    const contacts = await EmergencyModel.listContacts(patient.id);
    const user = req.user;
    const locationUrl = latitude && longitude
      ? `https://maps.google.com/?q=${latitude},${longitude}`
      : 'Location unavailable';

    for (const contact of contacts) {
      if (contact.notify_on_emergency && contact.phone) {
        SMSService.sendSMS(
          contact.phone,
          `🚨 EMERGENCY ALERT from HealthConnect!\n${user.first_name} ${user.last_name} has triggered an emergency SOS.\n${symptoms?.length ? `Symptoms: ${symptoms.join(', ')}` : ''}\nLocation: ${locationUrl}\nPlease check on them immediately.`
        ).catch(err => logger.error(`SOS SMS failed for ${contact.phone}:`, err.message));
      }
    }

    // Notify all admins and available doctors
    const io = req.app.get('io');
    if (io) {
      io.emit('emergency-sos', {
        sosId: sos.id,
        patientName: `${user.first_name} ${user.last_name}`,
        location: { latitude, longitude, address },
        symptoms,
        timestamp: new Date().toISOString(),
      });
    }

    logger.warn(`🚨 EMERGENCY SOS triggered by ${user.first_name} ${user.last_name} (${patient.id})`);

    return sendSuccess(res, 201, 'Emergency SOS triggered. Help is on the way.', { sos });
  } catch (err) { next(err); }
};

// ─── Emergency Contacts CRUD ──────────────────────────────────────────────
exports.addContact = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { name, relationship, phone, email, isPrimary, notifyOnEmergency } = req.body;
    if (!name || !relationship || !phone) {
      return sendError(res, 400, 'Name, relationship, and phone are required.');
    }

    const contact = await EmergencyModel.addContact({
      patientId: patient.id, name, relationship, phone, email, isPrimary, notifyOnEmergency,
    });

    return sendSuccess(res, 201, 'Emergency contact added.', { contact });
  } catch (err) { next(err); }
};

exports.listContacts = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const contacts = await EmergencyModel.listContacts(patient.id);
    return sendSuccess(res, 200, 'Emergency contacts retrieved.', { contacts });
  } catch (err) { next(err); }
};

exports.updateContact = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const contact = await EmergencyModel.updateContact(req.params.id, patient.id, req.body);
    if (!contact) return sendError(res, 404, 'Contact not found.');

    return sendSuccess(res, 200, 'Contact updated.', { contact });
  } catch (err) { next(err); }
};

exports.deleteContact = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const deleted = await EmergencyModel.deleteContact(req.params.id, patient.id);
    if (!deleted) return sendError(res, 404, 'Contact not found.');

    return sendSuccess(res, 200, 'Contact deleted.');
  } catch (err) { next(err); }
};

// ─── Get SOS History ──────────────────────────────────────────────────────
exports.getSOSHistory = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const history = await EmergencyModel.listSOSByPatient(patient.id);
    return sendSuccess(res, 200, 'SOS history retrieved.', { history });
  } catch (err) { next(err); }
};

// ─── Admin/Doctor: Active Emergencies ─────────────────────────────────────
exports.getActiveEmergencies = async (req, res, next) => {
  try {
    const active = await EmergencyModel.listActiveSOS();
    return sendSuccess(res, 200, 'Active emergencies.', { emergencies: active });
  } catch (err) { next(err); }
};

// ─── Admin/Doctor: Respond to SOS ─────────────────────────────────────────
exports.respondToSOS = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const sos = await EmergencyModel.respondToSOS(req.params.id, req.user.id, status || 'acknowledged', notes);
    if (!sos) return sendError(res, 404, 'SOS not found.');

    // Notify the patient
    if (sos.patient_id) {
      const patient = await PatientModel.findById(sos.patient_id);
      if (patient) {
        await NotificationModel.create({
          userId: patient.user_id,
          title: '🆘 Emergency Response',
          message: `A healthcare provider has acknowledged your emergency. ${notes || 'Help is on the way.'}`,
          type: 'emergency',
          metadata: { sosId: sos.id },
        });
      }
    }

    return sendSuccess(res, 200, 'SOS response recorded.', { sos });
  } catch (err) { next(err); }
};
