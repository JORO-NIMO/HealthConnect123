const { v4: uuidv4 }  = require('uuid');
const { query, queryOne } = require('../config/database');
const DoctorModel      = require('../models/Doctor.model');
const PatientModel     = require('../models/Patient.model');
const NotificationModel = require('../models/Notification.model');
const { sendSuccess, sendError } = require('../utils/response.util');

// ─── Submit Review ────────────────────────────────────────────────────────
exports.submitReview = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { doctorId, rating, comment } = req.body;

    if (!doctorId || !rating) return sendError(res, 400, 'Doctor ID and rating are required.');
    if (rating < 1 || rating > 5)  return sendError(res, 400, 'Rating must be between 1 and 5.');

    // Check if already reviewed
    const existing = await queryOne(
      'SELECT id FROM reviews WHERE doctor_id = ? AND patient_id = ?',
      [doctorId, patient.id]
    );
    if (existing) return sendError(res, 409, 'You have already reviewed this doctor. You can update your review instead.');

    // Verify the patient had a completed appointment with this doctor
    const appointment = await queryOne(
      `SELECT id FROM appointments
       WHERE patient_id = ? AND doctor_id = ? AND status = 'completed'
       LIMIT 1`,
      [patient.id, doctorId]
    );
    if (!appointment) {
      return sendError(res, 403, 'You can only review doctors you have had a completed appointment with.');
    }

    const id = uuidv4();
    await query(
      `INSERT INTO reviews (id, doctor_id, patient_id, rating, comment, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [id, doctorId, patient.id, rating, comment || null]
    );

    // Update doctor's aggregate rating
    const stats = await queryOne(
      'SELECT AVG(rating) AS avg_rating, COUNT(*) AS total FROM reviews WHERE doctor_id = ?',
      [doctorId]
    );
    await query(
      'UPDATE doctors SET rating = ?, total_reviews = ? WHERE id = ?',
      [Math.round(stats.avg_rating * 10) / 10, stats.total, doctorId]
    );

    // Notify the doctor
    const doctor = await DoctorModel.findById(doctorId);
    if (doctor) {
      await NotificationModel.create({
        userId: doctor.user_id,
        title: '⭐ New Patient Review',
        message: `A patient gave you a ${rating}-star review${comment ? `: "${comment}"` : '.'}`,
        type: 'review',
        metadata: { reviewId: id, rating },
      });
    }

    const review = await queryOne('SELECT * FROM reviews WHERE id = ?', [id]);
    return sendSuccess(res, 201, 'Review submitted.', { review });
  } catch (err) { next(err); }
};

// ─── Update Review ────────────────────────────────────────────────────────
exports.updateReview = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const { rating, comment } = req.body;
    if (rating && (rating < 1 || rating > 5)) return sendError(res, 400, 'Rating must be between 1 and 5.');

    const review = await queryOne(
      'SELECT * FROM reviews WHERE id = ? AND patient_id = ?',
      [req.params.id, patient.id]
    );
    if (!review) return sendError(res, 404, 'Review not found.');

    await query(
      'UPDATE reviews SET rating = COALESCE(?, rating), comment = COALESCE(?, comment) WHERE id = ?',
      [rating || null, comment !== undefined ? comment : null, req.params.id]
    );

    // Recalculate doctor's average
    const stats = await queryOne(
      'SELECT AVG(rating) AS avg_rating, COUNT(*) AS total FROM reviews WHERE doctor_id = ?',
      [review.doctor_id]
    );
    await query(
      'UPDATE doctors SET rating = ?, total_reviews = ? WHERE id = ?',
      [Math.round(stats.avg_rating * 10) / 10, stats.total, review.doctor_id]
    );

    const updated = await queryOne('SELECT * FROM reviews WHERE id = ?', [req.params.id]);
    return sendSuccess(res, 200, 'Review updated.', { review: updated });
  } catch (err) { next(err); }
};

// ─── Get Doctor Reviews ───────────────────────────────────────────────────
exports.getDoctorReviews = async (req, res, next) => {
  try {
    const { doctorId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const reviews = await query(
      `SELECT r.*, u.first_name, u.last_name
       FROM reviews r
       JOIN patients p ON p.id = r.patient_id
       JOIN users u ON u.id = p.user_id
       WHERE r.doctor_id = ?
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [doctorId, parseInt(limit), parseInt(offset)]
    );

    const stats = await queryOne(
      `SELECT AVG(rating) AS avg_rating, COUNT(*) AS total,
              SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS five_star,
              SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS four_star,
              SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS three_star,
              SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS two_star,
              SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS one_star
       FROM reviews WHERE doctor_id = ?`,
      [doctorId]
    );

    return sendSuccess(res, 200, 'Reviews retrieved.', { reviews, stats });
  } catch (err) { next(err); }
};

// ─── Delete Review ────────────────────────────────────────────────────────
exports.deleteReview = async (req, res, next) => {
  try {
    const patient = await PatientModel.findByUserId(req.user.id);
    if (!patient) return sendError(res, 404, 'Patient profile not found.');

    const review = await queryOne(
      'SELECT * FROM reviews WHERE id = ? AND patient_id = ?',
      [req.params.id, patient.id]
    );
    if (!review) return sendError(res, 404, 'Review not found.');

    await query('DELETE FROM reviews WHERE id = ?', [req.params.id]);

    // Recalculate
    const stats = await queryOne(
      'SELECT AVG(rating) AS avg_rating, COUNT(*) AS total FROM reviews WHERE doctor_id = ?',
      [review.doctor_id]
    );
    await query(
      'UPDATE doctors SET rating = COALESCE(?, 0), total_reviews = COALESCE(?, 0) WHERE id = ?',
      [stats?.avg_rating ? Math.round(stats.avg_rating * 10) / 10 : 0, stats?.total || 0, review.doctor_id]
    );

    return sendSuccess(res, 200, 'Review deleted.');
  } catch (err) { next(err); }
};
