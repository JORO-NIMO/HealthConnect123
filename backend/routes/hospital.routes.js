const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/hospital.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize }    = require('../middleware/rbac.middleware');
const {
  validateHospitalCreate,
  validateHospitalUpdate,
  validateTestResult,
  validatePagination,
  validateUUID,
} = require('../middleware/validation.middleware');

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC — Anyone can browse hospitals
// ═══════════════════════════════════════════════════════════════════════════
router.get('/',                validatePagination,       ctrl.listHospitals);
router.get('/nearby',          validatePagination,       ctrl.searchNearby);
router.get('/:id',             validateUUID,             ctrl.getPublicProfile);
router.get('/:id/doctors',     validateUUID,             ctrl.getHospitalDoctors);

// ═══════════════════════════════════════════════════════════════════════════
// AUTHENTICATED ROUTES
// ═══════════════════════════════════════════════════════════════════════════
router.use(authenticate);

// ─── Hospital Admin ───────────────────────────────────────────────────────
router.post('/register',                             authorize('hospital_admin', 'admin'), validateHospitalCreate,  ctrl.registerHospital);
router.get('/me/hospital',                           authorize('hospital_admin', 'admin'),                           ctrl.getMyHospital);
router.put('/me/hospital',                           authorize('hospital_admin', 'admin'), validateHospitalUpdate,  ctrl.updateHospital);
router.get('/me/stats',                              authorize('hospital_admin', 'admin'),                           ctrl.getStats);

// Doctor management
router.post('/me/doctors',                           authorize('hospital_admin', 'admin'),                           ctrl.addDoctor);
router.get('/me/doctors',                            authorize('hospital_admin', 'admin'), validatePagination,       ctrl.listMyDoctors);
router.delete('/me/doctors/:doctorId',               authorize('hospital_admin', 'admin'), validateUUID,             ctrl.removeDoctor);

// Patient management
router.post('/me/patients',                          authorize('hospital_admin', 'admin'),                           ctrl.addPatient);
router.get('/me/patients',                           authorize('hospital_admin', 'admin'), validatePagination,       ctrl.listMyPatients);
router.delete('/me/patients/:patientId',             authorize('hospital_admin', 'admin'), validateUUID,             ctrl.removePatient);

// Test results management
router.post('/me/test-results',                      authorize('hospital_admin', 'admin'), validateTestResult,       ctrl.createTestResult);
router.put('/me/test-results/:id',                   authorize('hospital_admin', 'admin'), validateUUID,             ctrl.updateTestResult);
router.get('/me/test-results',                       authorize('hospital_admin', 'admin'), validatePagination,       ctrl.listTestResults);

// ─── Patient Routes ──────────────────────────────────────────────────────
router.get('/patient/my-hospitals',                  authorize('patient'),                 validatePagination,       ctrl.getMyHospitals);
router.get('/patient/test-results',                  authorize('patient'),                 validatePagination,       ctrl.getMyTestResults);
router.get('/patient/test-results/:id',              authorize('patient', 'hospital_admin', 'admin'), validateUUID, ctrl.getTestResult);

// ─── Doctor Routes ───────────────────────────────────────────────────────
router.get('/doctor/my-hospitals',                   authorize('doctor'),                                            ctrl.getDoctorHospitals);

module.exports = router;
