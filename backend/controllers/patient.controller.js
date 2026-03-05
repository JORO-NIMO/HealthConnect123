const path              = require('path');
const fs                = require('fs');
const PatientModel      = require('../models/Patient.model');
const UserModel         = require('../models/User.model');
const PrescriptionModel = require('../models/Prescription.model');
const PaymentModel      = require('../models/Payment.model');
const { sendSuccess, sendError } = require('../utils/response.util');

// ─── Get Profile ──────────────────────────────────────────────────────────
exports.getProfile = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');
    return sendSuccess(res, 200, 'Profile retrieved.', { patient });
  } catch (err) { next(err); }
};

// ─── Update Profile ───────────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, ...patientFields } = req.body;

    // Update user table fields
    if (firstName || lastName || phone) {
      await UserModel.update(req.user.id, { first_name: firstName, last_name: lastName, phone });
    }

    // Update patient-specific fields
    const patient = await PatientModel.update(req.user.id, patientFields);
    return sendSuccess(res, 200, 'Profile updated.', { patient });
  } catch (err) { next(err); }
};

// ─── Upload Avatar ───────────────────────────────────────────────────────
exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'No image file provided.');

    // Delete previous avatar file if it was a local upload
    const existing = await UserModel.findById(req.user.id);
    if (existing?.avatar_url?.startsWith('/uploads/avatars/')) {
      const oldPath = path.join(__dirname, '../../frontend', existing.avatar_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await UserModel.update(req.user.id, { avatar_url: avatarUrl });
    return sendSuccess(res, 200, 'Avatar updated.', { avatarUrl });
  } catch (err) { next(err); }
};

// ─── Get Medical History ──────────────────────────────────────────────────
exports.getMedicalHistory = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { limit = 20, offset = 0 } = req.query;
    const history = await PatientModel.getMedicalHistory(patient.id, {
      limit: parseInt(limit), offset: parseInt(offset),
    });
    return sendSuccess(res, 200, 'Medical history retrieved.', { history });
  } catch (err) { next(err); }
};

// ─── Get Prescriptions ────────────────────────────────────────────────────
exports.getPrescriptions = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const prescriptions = await PrescriptionModel.listByPatient(patient.id);
    return sendSuccess(res, 200, 'Prescriptions retrieved.', { prescriptions });
  } catch (err) { next(err); }
};

// ─── Get Dashboard Stats ──────────────────────────────────────────────────
exports.getDashboardStats = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const stats = await PatientModel.getStats(patient.id);
    return sendSuccess(res, 200, 'Stats retrieved.', { stats });
  } catch (err) { next(err); }
};

// ─── Get Payment History ──────────────────────────────────────────────────
exports.getPayments = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const payments = await PaymentModel.listByPatient(patient.id);
    return sendSuccess(res, 200, 'Payment history retrieved.', { payments });
  } catch (err) { next(err); }
};
