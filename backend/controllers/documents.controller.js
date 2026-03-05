const path = require('path');
const fs   = require('fs');
const MedicalDocumentModel = require('../models/MedicalDocument.model');
const PatientModel         = require('../models/Patient.model');
const NotificationModel    = require('../models/Notification.model');
const { sendSuccess, sendError } = require('../utils/response.util');
const logger = require('../utils/logger.util');

// ─── Upload Document ──────────────────────────────────────────────────────
exports.uploadDocument = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    if (!req.file) return sendError(res, 400, 'No file provided.');

    const { title, description, docType, docDate, facility, doctorName, tags, isSensitive } = req.body;

    if (!title) return sendError(res, 400, 'Document title is required.');

    const doc = await MedicalDocumentModel.create({
      patientId:  patient.id,
      uploadedBy: req.user.id,
      title,
      description,
      docType:    docType || 'other',
      fileUrl:    `/uploads/documents/${req.file.filename}`,
      fileName:   req.file.originalname,
      fileSize:   req.file.size,
      mimeType:   req.file.mimetype,
      docDate,
      facility,
      doctorName,
      tags:       tags ? (typeof tags === 'string' ? JSON.parse(tags) : tags) : null,
      isSensitive: isSensitive === 'true' || isSensitive === true,
    });

    logger.info(`Document uploaded: ${doc.id} by patient ${patient.id}`);
    return sendSuccess(res, 201, 'Document uploaded successfully.', { document: doc });
  } catch (err) { next(err); }
};

// ─── List Documents ───────────────────────────────────────────────────────
exports.listDocuments = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { limit = 50, offset = 0, docType, search } = req.query;
    const documents = await MedicalDocumentModel.listByPatient(patient.id, {
      limit: parseInt(limit), offset: parseInt(offset), docType, search,
    });

    const stats = await MedicalDocumentModel.getStatsByPatient(patient.id);

    return sendSuccess(res, 200, 'Documents retrieved.', { documents, stats });
  } catch (err) { next(err); }
};

// ─── Get Document ─────────────────────────────────────────────────────────
exports.getDocument = async (req, res, next) => {
  try {
    const doc = await MedicalDocumentModel.findById(req.params.id);
    if (!doc) return sendError(res, 404, 'Document not found.');

    // Verify ownership (patient or their doctor)
    const patient = await PatientModel.findByUserId(req.user.id);
    if (req.user.role === 'patient' && doc.patient_id !== patient?.id) {
      return sendError(res, 403, 'Access denied.');
    }

    return sendSuccess(res, 200, 'Document retrieved.', { document: doc });
  } catch (err) { next(err); }
};

// ─── Update Document ──────────────────────────────────────────────────────
exports.updateDocument = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const existing = await MedicalDocumentModel.findById(req.params.id);
    if (!existing || existing.patient_id !== patient.id) {
      return sendError(res, 404, 'Document not found.');
    }

    const doc = await MedicalDocumentModel.update(req.params.id, req.body);
    return sendSuccess(res, 200, 'Document updated.', { document: doc });
  } catch (err) { next(err); }
};

// ─── Delete Document ──────────────────────────────────────────────────────
exports.deleteDocument = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const doc = await MedicalDocumentModel.findById(req.params.id);
    if (!doc || doc.patient_id !== patient.id) {
      return sendError(res, 404, 'Document not found.');
    }

    // Delete actual file
    const filePath = path.join(__dirname, '../../frontend', doc.file_url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await MedicalDocumentModel.delete(req.params.id, patient.id);
    return sendSuccess(res, 200, 'Document deleted.');
  } catch (err) { next(err); }
};

// ─── Doctor: Get Patient Documents ────────────────────────────────────────
exports.getPatientDocuments = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const { limit = 50, offset = 0, docType } = req.query;

    const documents = await MedicalDocumentModel.listByPatient(patientId, {
      limit: parseInt(limit), offset: parseInt(offset), docType,
    });

    return sendSuccess(res, 200, 'Patient documents retrieved.', { documents });
  } catch (err) { next(err); }
};
