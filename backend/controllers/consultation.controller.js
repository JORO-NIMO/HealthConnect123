const ConsultationModel = require('../models/Consultation.model');
const PrescriptionModel = require('../models/Prescription.model');
const AppointmentModel  = require('../models/Appointment.model');
const DoctorModel       = require('../models/Doctor.model');
const PatientModel      = require('../models/Patient.model');
const { sendSuccess, sendError } = require('../utils/response.util');
const logger = require('../utils/logger.util');

async function hasConsultationAccess(req, consultation) {
  if (!consultation || req.user.role === 'admin') return true;

  if (req.user.role === 'doctor') {
    const doctor = await DoctorModel.findByUserId(req.user.id);
    return !!doctor && doctor.id === consultation.doctor_id;
  }

  if (req.user.role === 'patient') {
    const patient = await PatientModel.findByUserId(req.user.id);
    return !!patient && patient.id === consultation.patient_id;
  }

  return false;
}

// ─── Get Consultation ─────────────────────────────────────────────────────
exports.getConsultation = async (req, res, next) => {
  try {
    const consultation = await ConsultationModel.findById(req.params.id);
    if (!consultation) return sendError(res, 404, 'Consultation not found.');
    const allowed = await hasConsultationAccess(req, consultation);
    if (!allowed) return sendError(res, 403, 'Access denied. This consultation is not assigned to you.');
    return sendSuccess(res, 200, 'Consultation retrieved.', { consultation });
  } catch (err) { next(err); }
};

// ─── End Consultation ─────────────────────────────────────────────────────
exports.end = async (req, res, next) => {
  try {
    const { notes } = req.body;
    const consultation = await ConsultationModel.findById(req.params.id);
    if (!consultation) return sendError(res, 404, 'Consultation not found.');
    const allowed = await hasConsultationAccess(req, consultation);
    if (!allowed) return sendError(res, 403, 'Access denied. This consultation is not assigned to you.');
    if (consultation.status === 'completed') return sendError(res, 400, 'Consultation already ended.');

    await ConsultationModel.end(req.params.id, notes);
    await AppointmentModel.updateStatus(consultation.appointment_id, 'completed');

    return sendSuccess(res, 200, 'Consultation ended successfully.');
  } catch (err) { next(err); }
};

// ─── Send Message ─────────────────────────────────────────────────────────
exports.sendMessage = async (req, res, next) => {
  try {
    const { content, messageType = 'text', fileUrl } = req.body;
    const consultation = await ConsultationModel.findById(req.params.id);
    if (!consultation) return sendError(res, 404, 'Consultation not found.');
    const allowed = await hasConsultationAccess(req, consultation);
    if (!allowed) return sendError(res, 403, 'Access denied. This consultation is not assigned to you.');
    if (consultation.status === 'completed') return sendError(res, 400, 'Consultation has ended.');

    const message = await ConsultationModel.addMessage({
      consultationId: req.params.id,
      senderId       : req.user.id,
      senderRole     : req.user.role,
      messageType,
      content,
      fileUrl,
    });

    // Emit to Socket.IO room
    const io = req.app.get('io');
    if (io) {
      io.to(consultation.room_id).emit('receive-message', message);
    }

    return sendSuccess(res, 201, 'Message sent.', { message });
  } catch (err) { next(err); }
};

// ─── Get Messages ─────────────────────────────────────────────────────────
exports.getMessages = async (req, res, next) => {
  try {
    const consultation = await ConsultationModel.findById(req.params.id);
    if (!consultation) return sendError(res, 404, 'Consultation not found.');
    const allowed = await hasConsultationAccess(req, consultation);
    if (!allowed) return sendError(res, 403, 'Access denied. This consultation is not assigned to you.');

    const { limit = 100, before } = req.query;
    const messages = await ConsultationModel.getMessages(req.params.id, {
      limit: parseInt(limit),
      before,
    });
    return sendSuccess(res, 200, 'Messages retrieved.', { messages });
  } catch (err) { next(err); }
};

// ─── Write Prescription ───────────────────────────────────────────────────
exports.writePrescription = async (req, res, next) => {
  try {
    const { diagnosis, medications, notes, validUntil } = req.body;
    const consultation = await ConsultationModel.findById(req.params.id);
    if (!consultation) return sendError(res, 404, 'Consultation not found.');
    const allowed = await hasConsultationAccess(req, consultation);
    if (!allowed) return sendError(res, 403, 'Access denied. This consultation is not assigned to you.');

    const doctor = await DoctorModel.findByUserId(req.user.id);
    if (!doctor) return sendError(res, 403, 'Only doctors can write prescriptions.');

    const prescription = await PrescriptionModel.create({
      patientId     : consultation.patient_id,
      doctorId      : doctor.id,
      consultationId: req.params.id,
      diagnosis,
      medications,
      notes,
      validUntil,
    });

    logger.info(`Prescription written by Dr. ${req.user.id} for patient ${consultation.patient_id}`);
    return sendSuccess(res, 201, 'Prescription created.', { prescription });
  } catch (err) { next(err); }
};
