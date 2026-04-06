const { body, param, query, validationResult } = require('express-validator');
const { sendError } = require('../utils/response.util');

/**
 * Middleware to check validation results and return errors
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, 'Validation failed', { errors: errors.array() });
  }
  next();
};

// ═══════════════════════════════════════════════════════════════════════════
// AUTH VALIDATIONS
// ═══════════════════════════════════════════════════════════════════════════

const validateRegister = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('role').optional().isIn(['patient', 'doctor', 'admin']).withMessage('Invalid role'),
  validate,
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

const validateOTP = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('code').optional().isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  validate,
];

// ═══════════════════════════════════════════════════════════════════════════
// HOSPITAL VALIDATIONS
// ═══════════════════════════════════════════════════════════════════════════

const validateHospitalCreate = [
  body('name').trim().notEmpty().withMessage('Hospital name is required'),
  body('type').optional().isIn(['general', 'specialized', 'clinic', 'diagnostic']).withMessage('Invalid hospital type'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Invalid email'),
  body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('emergencyAvailable').optional().isBoolean().withMessage('Emergency available must be true/false'),
  body('bedCount').optional().isInt({ min: 0 }).withMessage('Bed count must be a positive number'),
  validate,
];

const validateHospitalUpdate = [
  body('name').optional().trim().notEmpty().withMessage('Hospital name cannot be empty'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Invalid email'),
  body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  validate,
];

const validateTestResult = [
  body('patientId').notEmpty().withMessage('Patient ID is required'),
  body('testName').trim().notEmpty().withMessage('Test name is required'),
  body('testType').optional().isIn([
    'blood', 'urine', 'imaging', 'biopsy', 'other',
    'lab', 'pathology', 'cardiology', 'blood_test', 'urine_test', 'genetic',
  ]).withMessage('Invalid test type'),
  body('isCritical').optional().isBoolean().withMessage('Is critical must be true/false'),
  validate,
];

// ═══════════════════════════════════════════════════════════════════════════
// APPOINTMENT VALIDATIONS
// ═══════════════════════════════════════════════════════════════════════════

const validateAppointmentCreate = [
  body('doctorId').notEmpty().withMessage('Doctor ID is required'),
  body('appointmentDate').isISO8601().withMessage('Valid appointment date is required'),
  body('appointmentTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid time format required (HH:MM)'),
  body('type').optional().isIn(['video', 'chat', 'in_person']).withMessage('Invalid appointment type'),
  validate,
];

const validateAppointmentUpdate = [
  body('status').optional().isIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).withMessage('Invalid status'),
  validate,
];

// ═══════════════════════════════════════════════════════════════════════════
// DOCTOR VALIDATIONS
// ═══════════════════════════════════════════════════════════════════════════

const validateDoctorProfile = [
  body('specialization').optional().trim().notEmpty().withMessage('Specialization cannot be empty'),
  body('yearsExperience').optional().isInt({ min: 0 }).withMessage('Years of experience must be a positive number'),
  body('licenseNumber').optional().trim().notEmpty().withMessage('License number cannot be empty'),
  body('consultationFee').optional().isFloat({ min: 0 }).withMessage('Consultation fee must be a positive number'),
  body('languages').optional().isArray().withMessage('Languages must be an array'),
  validate,
];

// ═══════════════════════════════════════════════════════════════════════════
// PATIENT VALIDATIONS
// ═══════════════════════════════════════════════════════════════════════════

const validatePatientProfile = [
  body('dateOfBirth').optional().isISO8601().withMessage('Valid date of birth required'),
  body('gender').optional().isIn(['male', 'female', 'other', 'prefer_not_to_say']).withMessage('Invalid gender'),
  body('bloodType').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).withMessage('Invalid blood type'),
  body('weightKg').optional().isFloat({ min: 0 }).withMessage('Weight must be a positive number'),
  body('heightCm').optional().isFloat({ min: 0 }).withMessage('Height must be a positive number'),
  validate,
];

// ═══════════════════════════════════════════════════════════════════════════
// VITAL SIGNS VALIDATIONS
// ═══════════════════════════════════════════════════════════════════════════

const validateVitals = [
  body('systolicBp').optional().isInt({ min: 0, max: 300 }).withMessage('Invalid systolic BP'),
  body('diastolicBp').optional().isInt({ min: 0, max: 200 }).withMessage('Invalid diastolic BP'),
  body('heartRate').optional().isInt({ min: 0, max: 300 }).withMessage('Invalid heart rate'),
  body('temperature').optional().isFloat({ min: 30, max: 45 }).withMessage('Invalid temperature'),
  body('oxygenSat').optional().isInt({ min: 0, max: 100 }).withMessage('Invalid oxygen saturation'),
  body('respiratoryRate').optional().isInt({ min: 0, max: 100 }).withMessage('Invalid respiratory rate'),
  body('bloodSugar').optional().isFloat({ min: 0 }).withMessage('Invalid blood sugar'),
  validate,
];

// ═══════════════════════════════════════════════════════════════════════════
// EMERGENCY VALIDATIONS
// ═══════════════════════════════════════════════════════════════════════════

const validateSOS = [
  body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  body('address').optional().isString().isLength({ max: 500 }).withMessage('Address too long (max 500 characters)'),
  body('symptoms').optional().isArray({ max: 20 }).withMessage('Symptoms must be an array (max 20)'),
  body('symptoms.*').optional().isString().trim().isLength({ min: 1, max: 120 }).withMessage('Each symptom must be 1-120 characters'),
  body().custom((value) => {
    const hasLat = value.latitude !== undefined && value.latitude !== null && value.latitude !== '';
    const hasLng = value.longitude !== undefined && value.longitude !== null && value.longitude !== '';
    if (hasLat !== hasLng) {
      throw new Error('Latitude and longitude must be provided together');
    }
    return true;
  }),
  validate,
];

// ═══════════════════════════════════════════════════════════════════════════
// CONSULTATION VALIDATIONS
// ═══════════════════════════════════════════════════════════════════════════

const validateConsultationCreate = [
  body('appointmentId').notEmpty().withMessage('Appointment ID is required'),
  validate,
];

const validateConsultationNote = [
  body('diagnosis').optional().trim().notEmpty().withMessage('Diagnosis cannot be empty'),
  body('symptoms').optional().isArray().withMessage('Symptoms must be an array'),
  body('prescription').optional().isObject().withMessage('Prescription must be an object'),
  validate,
];

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT VALIDATIONS
// ═══════════════════════════════════════════════════════════════════════════

const validatePayment = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('paymentMethod').isIn(['stripe', 'mtn_momo', 'cash']).withMessage('Invalid payment method'),
  body('appointmentId').optional().notEmpty().withMessage('Appointment ID cannot be empty'),
  validate,
];

// ═══════════════════════════════════════════════════════════════════════════
// REVIEW VALIDATIONS
// ═══════════════════════════════════════════════════════════════════════════

const validateReview = [
  body('doctorId').notEmpty().withMessage('Doctor ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim().isLength({ max: 1000 }).withMessage('Comment too long (max 1000 characters)'),
  validate,
];

// ═══════════════════════════════════════════════════════════════════════════
// QUERY PARAMETER VALIDATIONS
// ═══════════════════════════════════════════════════════════════════════════

const validatePagination = [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  validate,
];

const validateDateRange = [
  query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  validate,
];

// ═══════════════════════════════════════════════════════════════════════════
// ID PARAMETER VALIDATIONS
// ═══════════════════════════════════════════════════════════════════════════

const validateUUID = [
  param('id').isUUID().withMessage('Invalid ID format'),
  validate,
];

module.exports = {
  validate,
  
  // Auth
  validateRegister,
  validateLogin,
  validateOTP,
  
  // Hospital
  validateHospitalCreate,
  validateHospitalUpdate,
  validateTestResult,
  
  // Appointment
  validateAppointmentCreate,
  validateAppointmentUpdate,
  
  // Doctor
  validateDoctorProfile,
  
  // Patient
  validatePatientProfile,
  
  // Vitals
  validateVitals,

  // Emergency
  validateSOS,
  
  // Consultation
  validateConsultationCreate,
  validateConsultationNote,
  
  // Payment
  validatePayment,
  
  // Review
  validateReview,
  
  // Query params
  validatePagination,
  validateDateRange,
  validateUUID,
};
