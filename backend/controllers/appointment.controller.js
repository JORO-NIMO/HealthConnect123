const AppointmentModel  = require('../models/Appointment.model');
const ConsultationModel = require('../models/Consultation.model');
const PatientModel      = require('../models/Patient.model');
const DoctorModel       = require('../models/Doctor.model');
const PaymentModel      = require('../models/Payment.model');
const { sendSuccess, sendError }      = require('../utils/response.util');
const { sendAppointmentConfirmation } = require('../services/email.service');
const { sendAppointmentSMS }          = require('../services/sms.service');
const logger = require('../utils/logger.util');

// ─── Book Appointment ─────────────────────────────────────────────────────
exports.book = async (req, res, next) => {
  try {
    const { doctorId, appointmentDate, appointmentTime, type, notes, symptomReportId } = req.body;

    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const doctor = await DoctorModel.findById(doctorId);
    if (!doctor || doctor.verification_status !== 'verified') {
      return sendError(res, 404, 'Doctor not found or not verified.');
    }

    // Check slot availability
    const taken = await AppointmentModel.isSlotTaken(doctorId, appointmentDate, appointmentTime);
    if (taken) return sendError(res, 409, 'This time slot is already booked. Please choose another time.');

    const appointment = await AppointmentModel.create({
      patientId    : patient.id,
      doctorId,
      appointmentDate,
      appointmentTime,
      type         : type || 'video',
      notes,
      symptomReportId,
    });

    // Create payment record
    await PaymentModel.create({
      patientId    : patient.id,
      appointmentId: appointment.id,
      amount       : doctor.consultation_fee || 0,
      currency     : 'USD',
      method       : 'pending',
    });

    // Notifications (non-blocking)
    sendAppointmentConfirmation(appointment).catch(e => logger.warn('Email failed:', e.message));
    sendAppointmentSMS(appointment).catch(e => logger.warn('SMS failed:', e.message));

    return sendSuccess(res, 201, 'Appointment booked successfully.', { appointment });
  } catch (err) { next(err); }
};

// ─── Get Appointment ──────────────────────────────────────────────────────
exports.getAppointment = async (req, res, next) => {
  try {
    const appointment = await AppointmentModel.findById(req.params.id);
    if (!appointment) return sendError(res, 404, 'Appointment not found.');

    // Ownership check: only the patient, doctor, or admin can view
    if (req.user.role !== 'admin') {
      const patient = await PatientModel.findByUserId(req.user.id);
      const doctor = await DoctorModel.findByUserId(req.user.id);
      if (
        (!patient || appointment.patient_id !== patient.id) &&
        (!doctor || appointment.doctor_id !== doctor.id)
      ) {
        return sendError(res, 403, 'Access denied. This is not your appointment.');
      }
    }

    return sendSuccess(res, 200, 'Appointment retrieved.', { appointment });
  } catch (err) { next(err); }
};

// ─── List Patient Appointments ────────────────────────────────────────────
exports.listPatientAppointments = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { status, limit = 20, offset = 0 } = req.query;
    const appointments = await AppointmentModel.listByPatient(patient.id, {
      status, limit: parseInt(limit), offset: parseInt(offset),
    });
    return sendSuccess(res, 200, 'Appointments retrieved.', { appointments });
  } catch (err) { next(err); }
};

// ─── List Doctor Appointments ─────────────────────────────────────────────
exports.listDoctorAppointments = async (req, res, next) => {
  try {
    const doctor = await DoctorModel.findByUserId(req.user.id);
    if (!doctor) return sendError(res, 404, 'Doctor profile not found.');

    const { status, date, limit = 20, offset = 0 } = req.query;
    const appointments = await AppointmentModel.listByDoctor(doctor.id, {
      status, date, limit: parseInt(limit), offset: parseInt(offset),
    });
    return sendSuccess(res, 200, 'Appointments retrieved.', { appointments });
  } catch (err) { next(err); }
};

// ─── Cancel Appointment ───────────────────────────────────────────────────
exports.cancel = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const appointment = await AppointmentModel.findById(req.params.id);
    if (!appointment) return sendError(res, 404, 'Appointment not found.');

    // Ownership check: only the patient, their doctor, or admin can cancel
    if (req.user.role !== 'admin') {
      const patient = await PatientModel.findByUserId(req.user.id);
      const doctor = await DoctorModel.findByUserId(req.user.id);
      if (
        (!patient || appointment.patient_id !== patient.id) &&
        (!doctor || appointment.doctor_id !== doctor.id)
      ) {
        return sendError(res, 403, 'Access denied. You cannot cancel this appointment.');
      }
    }

    if (['completed', 'cancelled'].includes(appointment.status)) {
      return sendError(res, 400, `Cannot cancel an appointment that is already ${appointment.status}.`);
    }

    await AppointmentModel.cancel(req.params.id, req.user.id, reason);
    return sendSuccess(res, 200, 'Appointment cancelled.');
  } catch (err) { next(err); }
};

// ─── Confirm Appointment (Doctor) ─────────────────────────────────────────
exports.confirm = async (req, res, next) => {
  try {
    const appointment = await AppointmentModel.findById(req.params.id);
    if (!appointment) return sendError(res, 404, 'Appointment not found.');

    // Only the assigned doctor or admin can confirm
    if (req.user.role !== 'admin') {
      const doctor = await DoctorModel.findByUserId(req.user.id);
      if (!doctor || appointment.doctor_id !== doctor.id) {
        return sendError(res, 403, 'Access denied. This is not your appointment to confirm.');
      }
    }

    const updated = await AppointmentModel.updateStatus(req.params.id, 'confirmed');

    // Send confirmation notifications
    sendAppointmentConfirmation(updated).catch(e => logger.warn('Confirm email failed:', e.message));
    sendAppointmentSMS(updated).catch(e => logger.warn('Confirm SMS failed:', e.message));

    return sendSuccess(res, 200, 'Appointment confirmed.', { appointment: updated });
  } catch (err) { next(err); }
};

// ─── Start Consultation ───────────────────────────────────────────────────
exports.startConsultation = async (req, res, next) => {
  try {
    const appointment = await AppointmentModel.findById(req.params.id);
    if (!appointment) return sendError(res, 404, 'Appointment not found.');

    // Only the assigned doctor can start a consultation
    const doctor = await DoctorModel.findByUserId(req.user.id);
    if (!doctor || appointment.doctor_id !== doctor.id) {
      return sendError(res, 403, 'Access denied. Only the assigned doctor can start this consultation.');
    }

    if (appointment.status === 'completed') return sendError(res, 400, 'Appointment already completed.');

    await AppointmentModel.updateStatus(req.params.id, 'in_progress');
    const consultation = await ConsultationModel.create(req.params.id);

    return sendSuccess(res, 201, 'Consultation started.', { consultation });
  } catch (err) { next(err); }
};
