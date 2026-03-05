const HealthRecordModel = require('../models/HealthRecord.model');
const PatientModel     = require('../models/Patient.model');
const DoctorModel      = require('../models/Doctor.model');
const { sendSuccess, sendError } = require('../utils/response.util');
const logger = require('../utils/logger.util');

// ─── Create Health Record ─────────────────────────────────────────────────
exports.create = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { recordType, title, description, providerName, facilityName, recordDate, icd10Code, severity, status, metadata } = req.body;
    if (!recordType || !title || !recordDate) {
      return sendError(res, 400, 'Record type, title, and date are required.');
    }

    const record = await HealthRecordModel.create({
      patientId: patient.id,
      recordType, title, description, providerName, facilityName,
      recordDate, icd10Code, severity, status, metadata,
      createdBy: req.user.id,
    });

    logger.info(`Health record created: ${record.id} (${recordType}) for patient ${patient.id}`);
    return sendSuccess(res, 201, 'Health record created.', { record });
  } catch (err) { next(err); }
};

// ─── List Patient Records ─────────────────────────────────────────────────
exports.list = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { type, status, limit = 50, offset = 0 } = req.query;
    const records = await HealthRecordModel.listByPatient(patient.id, {
      recordType: type, status, limit: parseInt(limit), offset: parseInt(offset),
    });

    return sendSuccess(res, 200, 'Health records retrieved.', { records });
  } catch (err) { next(err); }
};

// ─── Get Single Record ────────────────────────────────────────────────────
exports.getRecord = async (req, res, next) => {
  try {
    const record = await HealthRecordModel.findById(req.params.id);
    if (!record) return sendError(res, 404, 'Record not found.');
    return sendSuccess(res, 200, 'Record retrieved.', { record });
  } catch (err) { next(err); }
};

// ─── Get Timeline ─────────────────────────────────────────────────────────
exports.getTimeline = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const timeline = await HealthRecordModel.getTimeline(patient.id);
    return sendSuccess(res, 200, 'Timeline retrieved.', { timeline });
  } catch (err) { next(err); }
};

// ─── Get Summary ──────────────────────────────────────────────────────────
exports.getSummary = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const summary = await HealthRecordModel.getSummary(patient.id);
    return sendSuccess(res, 200, 'Summary retrieved.', { summary });
  } catch (err) { next(err); }
};

// ─── Update Record ────────────────────────────────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const record = await HealthRecordModel.update(req.params.id, patient.id, req.body);
    if (!record) return sendError(res, 404, 'Record not found.');

    return sendSuccess(res, 200, 'Record updated.', { record });
  } catch (err) { next(err); }
};

// ─── Delete Record ────────────────────────────────────────────────────────
exports.deleteRecord = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const deleted = await HealthRecordModel.delete(req.params.id, patient.id);
    if (!deleted) return sendError(res, 404, 'Record not found.');

    return sendSuccess(res, 200, 'Record deleted.');
  } catch (err) { next(err); }
};

// ─── Grant Access to Doctor ───────────────────────────────────────────────
exports.grantAccess = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { recordId, doctorUserId, accessLevel, expiresAt } = req.body;
    if (!recordId || !doctorUserId) {
      return sendError(res, 400, 'Record ID and doctor user ID are required.');
    }

    // Verify the record belongs to this patient
    const record = await HealthRecordModel.findById(recordId);
    if (!record || record.patient_id !== patient.id) {
      return sendError(res, 404, 'Record not found.');
    }

    const grant = await HealthRecordModel.grantAccess({
      recordId, grantedTo: doctorUserId, grantedBy: req.user.id,
      accessLevel, expiresAt,
    });

    return sendSuccess(res, 201, 'Access granted.', { grant });
  } catch (err) { next(err); }
};

// ─── Revoke Access ────────────────────────────────────────────────────────
exports.revokeAccess = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { recordId, doctorUserId } = req.body;
    const revoked = await HealthRecordModel.revokeAccess(recordId, doctorUserId);
    if (!revoked) return sendError(res, 404, 'Access grant not found.');

    return sendSuccess(res, 200, 'Access revoked.');
  } catch (err) { next(err); }
};

// ─── List Access Grants ──────────────────────────────────────────────────
exports.listAccessGrants = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const grants = await HealthRecordModel.listAccessGrants(patient.id);
    return sendSuccess(res, 200, 'Access grants retrieved.', { grants });
  } catch (err) { next(err); }
};

// ─── Doctor: View Patient Records (with access) ──────────────────────────
exports.doctorViewPatientRecords = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const records = await HealthRecordModel.listAccessibleRecords(req.user.id, patientId);
    return sendSuccess(res, 200, 'Patient records retrieved.', { records });
  } catch (err) { next(err); }
};

// ─── Doctor: Add Record for Patient ──────────────────────────────────────
exports.doctorAddRecord = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const { recordType, title, description, providerName, facilityName, recordDate, icd10Code, severity, status, metadata } = req.body;

    if (!recordType || !title || !recordDate) {
      return sendError(res, 400, 'Record type, title, and date are required.');
    }

    const record = await HealthRecordModel.create({
      patientId, recordType, title, description, providerName, facilityName,
      recordDate, icd10Code, severity, status, metadata,
      createdBy: req.user.id,
    });

    logger.info(`Doctor ${req.user.id} added health record ${record.id} for patient ${patientId}`);
    return sendSuccess(res, 201, 'Health record added.', { record });
  } catch (err) { next(err); }
};
