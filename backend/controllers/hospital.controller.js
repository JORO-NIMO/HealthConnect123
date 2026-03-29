const HospitalModel = require('../models/Hospital.model');
const DoctorModel   = require('../models/Doctor.model');
const PatientModel  = require('../models/Patient.model');
const UserModel     = require('../models/User.model');
const { sendSuccess, sendError } = require('../utils/response.util');
const logger = require('../utils/logger.util');

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ─── List Hospitals ───────────────────────────────────────────────────────
exports.listHospitals = async (req, res, next) => {
  try {
    const { type, city, state, country, q, limit = 20, offset = 0 } = req.query;
    const hospitals = await HospitalModel.list({
      type,
      city,
      state,
      country,
      q,
      limit: parseInt(limit),
      offset: parseInt(offset),
      activeOnly: true,
    });
    return sendSuccess(res, 200, 'Hospitals retrieved.', { hospitals });
  } catch (err) { next(err); }
};

// ─── Search Nearby Hospitals ──────────────────────────────────────────────
exports.searchNearby = async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 50, limit = 20 } = req.query;
    if (!latitude || !longitude) {
      return sendError(res, 400, 'Latitude and longitude are required.');
    }
    const hospitals = await HospitalModel.findNearby(
      parseFloat(latitude), parseFloat(longitude), parseFloat(radius), parseInt(limit)
    );
    return sendSuccess(res, 200, 'Nearby hospitals found.', { hospitals });
  } catch (err) { next(err); }
};

// ─── Get Hospital Public Profile ──────────────────────────────────────────
exports.getPublicProfile = async (req, res, next) => {
  try {
    const hospital = await HospitalModel.findById(req.params.id);
    if (!hospital || !hospital.is_active) return sendError(res, 404, 'Hospital not found.');
    // Remove admin-only fields
    const { admin_note, admin_user_id, ...publicProfile } = hospital;
    return sendSuccess(res, 200, 'Hospital profile retrieved.', { hospital: publicProfile });
  } catch (err) { next(err); }
};

// ─── List Hospital Doctors (public) ───────────────────────────────────────
exports.getHospitalDoctors = async (req, res, next) => {
  try {
    const doctors = await HospitalModel.getDoctors(req.params.id, { status: 'active' });
    return sendSuccess(res, 200, 'Hospital doctors retrieved.', { doctors });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════
// HOSPITAL ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ─── Register Hospital ────────────────────────────────────────────────────
exports.registerHospital = async (req, res, next) => {
  try {
    const {
      name, registrationNumber, type, description, phone, email, website,
      address, city, state, country, latitude, longitude,
      specializations, services, operatingHours, emergencyAvailable, bedCount,
    } = req.body;

    if (!name) return sendError(res, 400, 'Hospital name is required.');

    // Check if user already manages a hospital
    const existing = await HospitalModel.findByAdminUserId(req.user.id);
    if (existing) return sendError(res, 409, 'You already manage a hospital. Contact support to manage multiple.');

    const hospital = await HospitalModel.create({
      adminUserId: req.user.id,
      name, registrationNumber, type, description, phone, email, website,
      address, city, state, country, latitude, longitude,
      specializations, services, operatingHours, emergencyAvailable, bedCount,
    });

    logger.info(`Hospital registered: ${name} by user ${req.user.id}`);
    return sendSuccess(res, 201, 'Hospital registered successfully. Pending verification.', { hospital });
  } catch (err) { next(err); }
};

// ─── Get My Hospital ──────────────────────────────────────────────────────
exports.getMyHospital = async (req, res, next) => {
  try {
    const hospital = await HospitalModel.findByAdminUserId(req.user.id);
    if (!hospital) return sendError(res, 404, 'No hospital found for your account.');
    const stats = await HospitalModel.getStats(hospital.id);
    return sendSuccess(res, 200, 'Hospital retrieved.', { hospital, stats });
  } catch (err) { next(err); }
};

// ─── Update Hospital ──────────────────────────────────────────────────────
exports.updateHospital = async (req, res, next) => {
  try {
    const hospital = await HospitalModel.findByAdminUserId(req.user.id);
    if (!hospital) return sendError(res, 404, 'No hospital found for your account.');

    const updated = await HospitalModel.update(hospital.id, req.body);
    return sendSuccess(res, 200, 'Hospital updated.', { hospital: updated });
  } catch (err) { next(err); }
};

// ─── Add Doctor to Hospital ───────────────────────────────────────────────
exports.addDoctor = async (req, res, next) => {
  try {
    const hospital = await HospitalModel.findByAdminUserId(req.user.id);
    if (!hospital) return sendError(res, 404, 'No hospital found for your account.');

    const { doctorId, department, position, employmentType } = req.body;
    if (!doctorId) return sendError(res, 400, 'Doctor ID is required.');

    const doctor = await DoctorModel.findById(doctorId);
    if (!doctor) return sendError(res, 404, 'Doctor not found.');

    await HospitalModel.addDoctor(hospital.id, doctorId, { department, position, employmentType });
    logger.info(`Doctor ${doctorId} linked to hospital ${hospital.id}`);
    return sendSuccess(res, 200, 'Doctor added to hospital.');
  } catch (err) { next(err); }
};

// ─── Remove Doctor from Hospital ──────────────────────────────────────────
exports.removeDoctor = async (req, res, next) => {
  try {
    const hospital = await HospitalModel.findByAdminUserId(req.user.id);
    if (!hospital) return sendError(res, 404, 'No hospital found for your account.');

    await HospitalModel.removeDoctor(hospital.id, req.params.doctorId);
    return sendSuccess(res, 200, 'Doctor removed from hospital.');
  } catch (err) { next(err); }
};

// ─── List Hospital Doctors (admin view) ───────────────────────────────────
exports.listMyDoctors = async (req, res, next) => {
  try {
    const hospital = await HospitalModel.findByAdminUserId(req.user.id);
    if (!hospital) return sendError(res, 404, 'No hospital found for your account.');

    const { status = 'active', limit = 50, offset = 0 } = req.query;
    const doctors = await HospitalModel.getDoctors(hospital.id, { status, limit: parseInt(limit), offset: parseInt(offset) });
    return sendSuccess(res, 200, 'Doctors retrieved.', { doctors });
  } catch (err) { next(err); }
};

// ─── Add Patient to Hospital ──────────────────────────────────────────────
exports.addPatient = async (req, res, next) => {
  try {
    const hospital = await HospitalModel.findByAdminUserId(req.user.id);
    if (!hospital) return sendError(res, 404, 'No hospital found for your account.');

    const { patientId, hospitalNumber } = req.body;
    if (!patientId) return sendError(res, 400, 'Patient ID is required.');

    const patient = await PatientModel.findById(patientId);
    if (!patient) return sendError(res, 404, 'Patient not found.');

    await HospitalModel.addPatient(hospital.id, patientId, hospitalNumber);
    logger.info(`Patient ${patientId} linked to hospital ${hospital.id}`);
    return sendSuccess(res, 200, 'Patient registered to hospital.');
  } catch (err) { next(err); }
};

// ─── Remove Patient from Hospital ─────────────────────────────────────────
exports.removePatient = async (req, res, next) => {
  try {
    const hospital = await HospitalModel.findByAdminUserId(req.user.id);
    if (!hospital) return sendError(res, 404, 'No hospital found for your account.');

    await HospitalModel.removePatient(hospital.id, req.params.patientId);
    return sendSuccess(res, 200, 'Patient removed from hospital.');
  } catch (err) { next(err); }
};

// ─── List Hospital Patients ───────────────────────────────────────────────
exports.listMyPatients = async (req, res, next) => {
  try {
    const hospital = await HospitalModel.findByAdminUserId(req.user.id);
    if (!hospital) return sendError(res, 404, 'No hospital found for your account.');

    const { status = 'active', limit = 50, offset = 0 } = req.query;
    const patients = await HospitalModel.getPatients(hospital.id, { status, limit: parseInt(limit), offset: parseInt(offset) });
    return sendSuccess(res, 200, 'Patients retrieved.', { patients });
  } catch (err) { next(err); }
};

// ─── Hospital Stats ───────────────────────────────────────────────────────
exports.getStats = async (req, res, next) => {
  try {
    const hospital = await HospitalModel.findByAdminUserId(req.user.id);
    if (!hospital) return sendError(res, 404, 'No hospital found for your account.');

    const stats = await HospitalModel.getStats(hospital.id);
    return sendSuccess(res, 200, 'Stats retrieved.', { stats });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════
// TEST RESULTS — Hospital sends results to patients
// ═══════════════════════════════════════════════════════════════════════════

// ─── Create Test Result ───────────────────────────────────────────────────
exports.createTestResult = async (req, res, next) => {
  try {
    const hospital = await HospitalModel.findByAdminUserId(req.user.id);
    if (!hospital) return sendError(res, 404, 'No hospital found for your account.');

    const { patientId, doctorId, testType, testName, description, results, resultSummary, notes, isCritical } = req.body;
    if (!patientId || !testName) return sendError(res, 400, 'Patient ID and test name are required.');

    const testResult = await HospitalModel.createTestResult({
      hospitalId: hospital.id, patientId, doctorId,
      testType, testName, description, results, resultSummary, notes, isCritical,
      status: 'ordered',
    });

    // Notify patient (via Socket.IO if available)
    const io = req.app.get('io');
    if (io) {
      const patient = await PatientModel.findById(patientId);
      if (patient) {
        io.to(`user:${patient.user_id}`).emit('notification', {
          type: 'test_result',
          title: 'New Test Order',
          message: `${hospital.name} has ordered a ${testName} test for you.`,
          data: { testResultId: testResult.id },
        });
      }
    }

    logger.info(`Test result created: ${testName} for patient ${patientId} by hospital ${hospital.id}`);
    return sendSuccess(res, 201, 'Test result created.', { testResult });
  } catch (err) { next(err); }
};

// ─── Update Test Result (add results, mark complete) ──────────────────────
exports.updateTestResult = async (req, res, next) => {
  try {
    const hospital = await HospitalModel.findByAdminUserId(req.user.id);
    if (!hospital) return sendError(res, 404, 'No hospital found for your account.');

    const testResult = await HospitalModel.getTestResult(req.params.id);
    if (!testResult || testResult.hospital_id !== hospital.id) {
      return sendError(res, 404, 'Test result not found.');
    }

    const fields = { ...req.body };
    if (fields.status === 'completed' && !testResult.completed_at) {
      fields.completed_at = new Date();
    }
    const updated = await HospitalModel.updateTestResult(req.params.id, fields);

    // Notify patient when results are ready
    if (fields.status === 'completed') {
      const io = req.app.get('io');
      if (io) {
        const patient = await PatientModel.findById(testResult.patient_id);
        if (patient) {
          io.to(`user:${patient.user_id}`).emit('notification', {
            type: 'test_result_ready',
            title: 'Test Results Ready',
            message: `Your ${testResult.test_name} results from ${hospital.name} are ready.`,
            data: { testResultId: testResult.id },
          });
        }
      }
    }

    return sendSuccess(res, 200, 'Test result updated.', { testResult: updated });
  } catch (err) { next(err); }
};

// ─── List Hospital Test Results ───────────────────────────────────────────
exports.listTestResults = async (req, res, next) => {
  try {
    const hospital = await HospitalModel.findByAdminUserId(req.user.id);
    if (!hospital) return sendError(res, 404, 'No hospital found for your account.');

    const { status, limit = 20, offset = 0 } = req.query;
    const results = await HospitalModel.getHospitalTestResults(hospital.id, {
      status, limit: parseInt(limit), offset: parseInt(offset),
    });
    return sendSuccess(res, 200, 'Test results retrieved.', { testResults: results });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════
// PATIENT ROUTES — Patient views their hospital connections & results
// ═══════════════════════════════════════════════════════════════════════════

// ─── Get My Hospitals ─────────────────────────────────────────────────────
exports.getMyHospitals = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const hospitals = await HospitalModel.getPatientHospitals(patient.id);
    return sendSuccess(res, 200, 'Your hospitals retrieved.', { hospitals });
  } catch (err) { next(err); }
};

// ─── Get My Test Results ──────────────────────────────────────────────────
exports.getMyTestResults = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { hospitalId, hospital_id, status, type, limit = 20, offset = 0 } = req.query;
    const results = await HospitalModel.getPatientTestResults(patient.id, {
      hospitalId: hospitalId || hospital_id, status, testType: type,
      limit: parseInt(limit), offset: parseInt(offset),
    });
    return sendSuccess(res, 200, 'Test results retrieved.', { testResults: results });
  } catch (err) { next(err); }
};

// ─── View Specific Test Result ────────────────────────────────────────────
exports.getTestResult = async (req, res, next) => {
  try {
    const testResult = await HospitalModel.getTestResult(req.params.id);
    if (!testResult) return sendError(res, 404, 'Test result not found.');

    // Verify patient owns this result (unless admin/hospital_admin)
    if (req.user.role === 'patient') {
      const patient = await PatientModel.findByUserId(req.user.id);
      if (!patient || testResult.patient_id !== patient.id) {
        return sendError(res, 403, 'Access denied.');
      }
      // Mark as viewed
      await HospitalModel.markTestViewed(req.params.id);
    }

    return sendSuccess(res, 200, 'Test result retrieved.', { testResult });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════════════
// DOCTOR ROUTES — Doctor views their hospital affiliations
// ═══════════════════════════════════════════════════════════════════════════

// ─── Get Doctor's Hospitals ───────────────────────────────────────────────
exports.getDoctorHospitals = async (req, res, next) => {
  try {
    const doctor = await DoctorModel.findByUserId(req.user.id);
    if (!doctor) return sendError(res, 404, 'Doctor profile not found.');

    const hospitals = await HospitalModel.getDoctorHospitals(doctor.id);
    return sendSuccess(res, 200, 'Your hospital affiliations retrieved.', { hospitals });
  } catch (err) { next(err); }
};
