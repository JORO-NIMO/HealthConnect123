const DoctorModel       = require('../models/Doctor.model');
const UserModel         = require('../models/User.model');
const PrescriptionModel = require('../models/Prescription.model');
const AppointmentModel  = require('../models/Appointment.model');
const AIService         = require('../services/ai.service');
const PatientModel      = require('../models/Patient.model');
const HospitalModel     = require('../models/Hospital.model');
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
    if (!doctor) {
      return sendError(res, 404, 'Doctor not found.');
    }
    // TODO: restore for production
    // if (doctor.verification_status === 'rejected') return sendError(res, 404, 'Doctor not found.');
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
      availableOnly: true,
    });
    return sendSuccess(res, 200, 'Doctors retrieved.', { doctors });
  } catch (err) { next(err); }
};

// ─── Nearby Doctors ───────────────────────────────────────────────────────
exports.nearbyDoctors = async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 50, specialization, limit = 20 } = req.query;
    if (!latitude || !longitude) {
      return sendError(res, 400, 'Latitude and longitude are required.');
    }
    const doctors = await DoctorModel.findNearby(
      parseFloat(latitude), parseFloat(longitude), parseFloat(radius),
      { specialization, limit: parseInt(limit) }
    );

    // Enrich with hospital info
    for (const doc of doctors) {
      const hospitals = await HospitalModel.getDoctorHospitals(doc.id);
      doc.hospitals = hospitals.map(h => ({ id: h.id, name: h.name, city: h.city }));
    }

    return sendSuccess(res, 200, 'Nearby doctors found.', { doctors });
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
    const { symptoms, latitude, longitude, radiusKm } = req.body;
    if (!symptoms || !Array.isArray(symptoms) || !symptoms.length) {
      return sendError(res, 400, 'Please provide symptoms to get doctor recommendations.');
    }

    // Get patient context if authenticated
    let patientContext = {};
    let patLat = latitude, patLng = longitude;
    if (req.user) {
      const patient = await PatientModel.findByUserId(req.user.id);
      if (patient) {
        patientContext = {
          age: patient.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth)) / 31557600000) : null,
          gender: patient.gender,
          conditions: patient.chronic_conditions,
          city: patient.city,
          latitude: patLat || patient.latitude,
          longitude: patLng || patient.longitude,
        };
        patLat = patLat || patient.latitude;
        patLng = patLng || patient.longitude;
      }
    }

    const radius = parseInt(radiusKm) || 50;

    // Fetch doctors: prefer nearby if location available
    let doctors;
    if (patLat && patLng) {
      doctors = await DoctorModel.findNearby(parseFloat(patLat), parseFloat(patLng), radius, { limit: 30 });
    } else {
      doctors = await DoctorModel.listWithLocation({ limit: 30, availableOnly: true });
    }

    const recommended = await AIService.recommendDoctors(symptoms, doctors, patientContext);

    // Enrich with hospital affiliation info
    for (const doc of recommended) {
      const hospitals = await HospitalModel.getDoctorHospitals(doc.id);
      doc.hospitals = hospitals.map(h => ({ id: h.id, name: h.name, city: h.city, type: h.type }));
    }

    return sendSuccess(res, 200, 'Doctor recommendations generated.', { doctors: recommended });
  } catch (err) { next(err); }
};

// ─── Search Doctors (enhanced with filters) ───────────────────────────────
exports.searchDoctors = async (req, res, next) => {
  try {
    const { q, specialization, minRating, maxFee, language, latitude, longitude, radiusKm, limit = 20, offset = 0 } = req.query;
    const { query: dbQuery } = require('../config/database');

    // If location provided, use distance-based search
    if (latitude && longitude) {
      let sql = `
        SELECT d.id, d.specialization, d.years_experience, d.consultation_fee,
               d.rating, d.total_reviews, d.verification_status, d.bio, d.languages,
               d.hospital_affiliation, d.is_available, d.latitude, d.longitude,
               d.city, d.state, d.country,
               u.first_name, u.last_name, u.avatar_url,
               (
                 6371 * ACOS(
                   COS(RADIANS(?)) * COS(RADIANS(d.latitude))
                   * COS(RADIANS(d.longitude) - RADIANS(?))
                   + SIN(RADIANS(?)) * SIN(RADIANS(d.latitude))
                 )
               ) AS distance_km
        FROM doctors d
        JOIN users u ON u.id = d.user_id
        WHERE u.is_active = 1
          AND d.is_available = 1
          AND d.latitude IS NOT NULL
          AND d.longitude IS NOT NULL
      `;
      const params = [parseFloat(latitude), parseFloat(longitude), parseFloat(latitude)];

      if (q) {
        sql += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR d.specialization LIKE ? OR d.bio LIKE ?)`;
        const like = `%${q}%`;
        params.push(like, like, like, like, like);
      }
      if (specialization) { sql += ' AND d.specialization = ?'; params.push(specialization); }
      if (minRating)      { sql += ' AND d.rating >= ?'; params.push(parseFloat(minRating)); }
      if (maxFee)         { sql += ' AND d.consultation_fee <= ?'; params.push(parseFloat(maxFee)); }
      if (language)       { sql += ' AND d.languages LIKE ?'; params.push(`%${language}%`); }

      const radius = parseInt(radiusKm) || 50;
      sql += ' HAVING distance_km <= ? ORDER BY distance_km ASC LIMIT ? OFFSET ?';
      params.push(radius, parseInt(limit), parseInt(offset));

      const doctors = await dbQuery(sql, params);
      const specs = await dbQuery(
        `SELECT DISTINCT specialization FROM doctors WHERE specialization IS NOT NULL ORDER BY specialization`
      );
      return sendSuccess(res, 200, 'Nearby doctors found.', { doctors, specializations: specs.map(s => s.specialization) });
    }

    // Default: non-location search
    let sql = `
      SELECT d.id, d.specialization, d.years_experience, d.consultation_fee,
             d.rating, d.total_reviews, d.verification_status, d.bio, d.languages,
             d.hospital_affiliation, d.is_available,
             u.first_name, u.last_name, u.avatar_url
      FROM doctors d
      JOIN users u ON u.id = d.user_id
      WHERE u.is_active = 1
        -- TODO: restore verification filter for production
        -- AND d.verification_status IN ('verified', 'pending')
        AND d.is_available = 1
    `;
    const params = [];

    if (q) {
      sql += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR d.specialization LIKE ? OR d.bio LIKE ?)`;
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
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
       WHERE specialization IS NOT NULL
       -- TODO: restore for production: AND verification_status IN ('verified', 'pending')
       ORDER BY specialization`
    );

    return sendSuccess(res, 200, 'Doctors found.', {
      doctors,
      specializations: specs.map(s => s.specialization),
    });
  } catch (err) { next(err); }
};
