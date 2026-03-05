const DoctorModel       = require('../models/Doctor.model');
const UserModel         = require('../models/User.model');
const PrescriptionModel = require('../models/Prescription.model');
const AppointmentModel  = require('../models/Appointment.model');
const AIService         = require('../services/ai.service');
const PatientModel      = require('../models/Patient.model');
const { sendSuccess, sendError } = require('../utils/response.util');

// ─── Get Doctor Profile ───────────────────────────────────────────────────
exports.getProfile = async (req, res, next) => {
  try {
    const doctor = await DoctorModel.findByUserId(req.user.id);
    if (!doctor) return sendError(res, 404, 'Doctor profile not found.');
    return sendSuccess(res, 200, 'Profile retrieved.', { doctor });
  } catch (err) { next(err); }
};

// ─── Get Public Doctor Profile ────────────────────────────────────────────
exports.getPublicProfile = async (req, res, next) => {
  try {
    const doctor = await DoctorModel.findById(req.params.id);
    if (!doctor || doctor.verification_status !== 'verified') {
      return sendError(res, 404, 'Doctor not found.');
    }
    // Remove sensitive fields
    const { license_number, admin_note, ...publicProfile } = doctor;
    return sendSuccess(res, 200, 'Doctor profile retrieved.', { doctor: publicProfile });
  } catch (err) { next(err); }
};

// ─── List Doctors ─────────────────────────────────────────────────────────
exports.listDoctors = async (req, res, next) => {
  try {
    const { specialization, limit = 20, offset = 0 } = req.query;
    const doctors = await DoctorModel.list({
      specialization,
      limit : parseInt(limit),
      offset: parseInt(offset),
    });
    return sendSuccess(res, 200, 'Doctors retrieved.', { doctors });
  } catch (err) { next(err); }
};

// ─── Update Profile ───────────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, isAvailable, ...doctorFields } = req.body;

    if (firstName || lastName || phone) {
      await UserModel.update(req.user.id, { first_name: firstName, last_name: lastName, phone });
    }
    if (isAvailable !== undefined) {
      doctorFields.is_available = isAvailable ? 1 : 0;
    }
    const doctor = await DoctorModel.update(req.user.id, doctorFields);
    return sendSuccess(res, 200, 'Profile updated.', { doctor });
  } catch (err) { next(err); }
};

// ─── Availability ─────────────────────────────────────────────────────────
exports.getAvailability = async (req, res, next) => {
  try {
    const doctorId   = req.params.id || (await DoctorModel.findByUserId(req.user.id))?.id;
    const availability = await DoctorModel.getAvailability(doctorId);
    return sendSuccess(res, 200, 'Availability retrieved.', { availability });
  } catch (err) { next(err); }
};

exports.setAvailability = async (req, res, next) => {
  try {
    const doctor = await DoctorModel.findByUserId(req.user.id);
    if (!doctor) return sendError(res, 404, 'Doctor profile not found.');

    const slots = req.body.slots || req.body.availability || [];
    await DoctorModel.setAvailability(doctor.id, slots);
    return sendSuccess(res, 200, 'Availability updated.');
  } catch (err) { next(err); }
};

// ─── Doctor Prescriptions ─────────────────────────────────────────────────
exports.getPrescriptions = async (req, res, next) => {
  try {
    const doctor = await DoctorModel.findByUserId(req.user.id);
    if (!doctor) return sendError(res, 404, 'Doctor profile not found.');

    const prescriptions = await PrescriptionModel.listByDoctor(doctor.id);
    return sendSuccess(res, 200, 'Prescriptions retrieved.', { prescriptions });
  } catch (err) { next(err); }
};

// ─── AI-Powered Doctor Recommendation ─────────────────────────────────────
exports.recommend = async (req, res, next) => {
  try {
    const { symptoms } = req.body;
    if (!symptoms || !Array.isArray(symptoms) || !symptoms.length) {
      return sendError(res, 400, 'Please provide symptoms to get doctor recommendations.');
    }

    // Get all verified doctors
    const doctors = await DoctorModel.list({ limit: 50, verifiedOnly: true });

    // Get patient context if authenticated
    let patientContext = {};
    if (req.user) {
      const patient = await PatientModel.findByUserId(req.user.id);
      if (patient) {
        patientContext = {
          age: patient.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth)) / 31557600000) : null,
          gender: patient.gender,
          conditions: patient.chronic_conditions,
        };
      }
    }

    const recommended = await AIService.recommendDoctors(symptoms, doctors, patientContext);
    return sendSuccess(res, 200, 'Doctor recommendations generated.', { doctors: recommended });
  } catch (err) { next(err); }
};

// ─── Search Doctors (enhanced with filters) ───────────────────────────────
exports.searchDoctors = async (req, res, next) => {
  try {
    const { q, specialization, minRating, maxFee, language, limit = 20, offset = 0 } = req.query;
    const { query: dbQuery } = require('../config/database');

    let sql = `
      SELECT d.id, d.specialization, d.years_experience, d.consultation_fee,
             d.rating, d.total_reviews, d.verification_status, d.bio, d.languages,
             d.hospital_affiliation,
             u.first_name, u.last_name, u.avatar_url
      FROM doctors d
      JOIN users u ON u.id = d.user_id
      WHERE u.is_active = 1 AND d.verification_status = 'verified'
    `;
    const params = [];

    if (q) {
      sql += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR d.specialization LIKE ? OR d.bio LIKE ?)`;
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    if (specialization) { sql += ' AND d.specialization = ?'; params.push(specialization); }
    if (minRating)      { sql += ' AND d.rating >= ?'; params.push(parseFloat(minRating)); }
    if (maxFee)         { sql += ' AND d.consultation_fee <= ?'; params.push(parseFloat(maxFee)); }
    if (language)       { sql += ' AND d.languages LIKE ?'; params.push(`%${language}%`); }

    sql += ' ORDER BY d.rating DESC, d.total_reviews DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const doctors = await dbQuery(sql, params);

    // Get unique specializations for filter dropdown
    const specs = await dbQuery(
      `SELECT DISTINCT specialization FROM doctors
       WHERE verification_status = 'verified' AND specialization IS NOT NULL
       ORDER BY specialization`
    );

    return sendSuccess(res, 200, 'Doctors found.', {
      doctors,
      specializations: specs.map(s => s.specialization),
    });
  } catch (err) { next(err); }
};
