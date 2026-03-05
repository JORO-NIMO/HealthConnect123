const WaitlistModel     = require('../models/Waitlist.model');
const PatientModel      = require('../models/Patient.model');
const DoctorModel       = require('../models/Doctor.model');
const NotificationModel = require('../models/Notification.model');
const { sendSuccess, sendError } = require('../utils/response.util');
const logger = require('../utils/logger.util');

// ─── Join Waitlist ────────────────────────────────────────────────────────
exports.join = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { doctorId, preferredDate, preferredTime, type, notes } = req.body;
    if (!doctorId || !preferredDate) {
      return sendError(res, 400, 'Doctor ID and preferred date are required.');
    }

    const doctor = await DoctorModel.findById(doctorId);
    if (!doctor) return sendError(res, 404, 'Doctor not found.');

    const entry = await WaitlistModel.join({
      patientId: patient.id, doctorId, preferredDate, preferredTime, type, notes,
    });

    if (entry.alreadyWaiting) {
      return sendSuccess(res, 200, 'You are already on the waitlist for this date.', { waitlist: entry });
    }

    // Get position
    const position = await WaitlistModel.countWaiting(doctorId, preferredDate);

    logger.info(`Patient ${patient.id} joined waitlist for Dr ${doctorId} on ${preferredDate}`);
    return sendSuccess(res, 201, 'Added to waitlist.', { waitlist: entry, position });
  } catch (err) { next(err); }
};

// ─── My Waitlist Entries ──────────────────────────────────────────────────
exports.myWaitlist = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const entries = await WaitlistModel.listByPatient(patient.id);
    return sendSuccess(res, 200, 'Waitlist entries retrieved.', { waitlist: entries });
  } catch (err) { next(err); }
};

// ─── Cancel Waitlist Entry ────────────────────────────────────────────────
exports.cancel = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const cancelled = await WaitlistModel.cancel(req.params.id, patient.id);
    if (!cancelled) return sendError(res, 404, 'Waitlist entry not found.');

    return sendSuccess(res, 200, 'Removed from waitlist.');
  } catch (err) { next(err); }
};

// ─── Doctor: View Waitlist ────────────────────────────────────────────────
exports.doctorViewWaitlist = async (req, res, next) => {
  try {
    const doctor = await DoctorModel.findByUserId(req.user.id);
    if (!doctor) return sendError(res, 404, 'Doctor profile not found.');

    const { date } = req.query;
    const entries = await WaitlistModel.listByDoctor(doctor.id, date);
    return sendSuccess(res, 200, 'Waitlist retrieved.', { waitlist: entries });
  } catch (err) { next(err); }
};

// ─── Get Waitlist Count (public — for patient to see how many are waiting) ──
exports.getCount = async (req, res, next) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) return sendError(res, 400, 'Doctor ID and date are required.');
    const count = await WaitlistModel.countWaiting(doctorId, date);
    return sendSuccess(res, 200, 'Waitlist count.', { count });
  } catch (err) { next(err); }
};
