const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../config/database');

class DoctorModel {
  static async create(userId) {
    const id = uuidv4();
    await query(
      `INSERT INTO doctors (id, user_id, verification_status, created_at) VALUES (?, ?, 'pending', NOW())`,
      [id, userId]
    );
    return this.findByUserId(userId);
  }

  static async findByUserId(userId) {
    return queryOne(
      `SELECT d.*, u.first_name, u.last_name, u.email, u.phone, u.avatar_url
       FROM doctors d
       JOIN users u ON u.id = d.user_id
       WHERE d.user_id = ?`,
      [userId]
    );
  }

  static async findById(id) {
    return queryOne(
      `SELECT d.*, u.first_name, u.last_name, u.email, u.phone, u.avatar_url
       FROM doctors d
       JOIN users u ON u.id = d.user_id
       WHERE d.id = ?`,
      [id]
    );
  }

  static async list({ specialization, limit = 20, offset = 0, verifiedOnly = true, availableOnly = false } = {}) {
    let sql = `
      SELECT d.id, d.specialization, d.years_experience, d.consultation_fee,
             d.rating, d.total_reviews, d.verification_status, d.bio,
             d.languages, d.hospital_affiliation, d.is_available,
             u.first_name, u.last_name, u.avatar_url
      FROM doctors d
      JOIN users u ON u.id = d.user_id
      WHERE u.is_active = 1
    `;
    const params = [];
    // TODO: restore for production
    // if (verifiedOnly) { sql += ` AND d.verification_status IN ('verified', 'pending')`; }
    if (availableOnly) { sql += ' AND d.is_available = 1'; }
    if (specialization) { sql += ' AND d.specialization = ?'; params.push(specialization); }
    sql += ' ORDER BY d.rating DESC, d.total_reviews DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return query(sql, params);
  }

  static async update(userId, fields) {
    const allowed = [
      'specialization', 'years_experience', 'bio', 'consultation_fee',
      'license_number', 'hospital_affiliation', 'languages', 'is_available',
      'latitude', 'longitude', 'city', 'state', 'country', 'accepts_in_person',
    ];
    const keys = Object.keys(fields).filter(k => allowed.includes(k));
    if (!keys.length) return this.findByUserId(userId);

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values    = [...keys.map(k => fields[k]), userId];
    await query(`UPDATE doctors SET ${setClause}, updated_at = NOW() WHERE user_id = ?`, values);
    return this.findByUserId(userId);
  }

  static async setVerificationStatus(doctorId, status, adminNote = null) {
    await query(
      'UPDATE doctors SET verification_status = ?, admin_note = ?, updated_at = NOW() WHERE id = ?',
      [status, adminNote, doctorId]
    );
  }

  // ─── Availability ─────────────────────────────────────────────────────────
  static async getAvailability(doctorId) {
    return query(
      'SELECT * FROM doctor_availability WHERE doctor_id = ? ORDER BY day_of_week, start_time',
      [doctorId]
    );
  }

  static async setAvailability(doctorId, slots) {
    // slots: [{ dayOfWeek, startTime, endTime, isAvailable }]
    await query('DELETE FROM doctor_availability WHERE doctor_id = ?', [doctorId]);
    if (!slots.length) return;
    const values = slots.map(s => [uuidv4(), doctorId, s.dayOfWeek, s.startTime, s.endTime, s.isAvailable !== false ? 1 : 0]);
    const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    await query(
      `INSERT INTO doctor_availability (id, doctor_id, day_of_week, start_time, end_time, is_available) VALUES ${placeholders}`,
      values.flat()
    );
  }

  // ─── Location-Based Search ────────────────────────────────────────────────
  static async findNearby(latitude, longitude, radiusKm = 50, { specialization, limit = 20 } = {}) {
    let sql = `
      SELECT d.id, d.specialization, d.years_experience, d.consultation_fee,
             d.rating, d.total_reviews, d.verification_status, d.bio,
             d.languages, d.hospital_affiliation, d.is_available,
             d.latitude, d.longitude, d.city, d.state, d.country,
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
    const params = [latitude, longitude, latitude];
    if (specialization) { sql += ' AND d.specialization = ?'; params.push(specialization); }
    sql += ' HAVING distance_km <= ? ORDER BY distance_km ASC LIMIT ?';
    params.push(radiusKm, limit);
    return query(sql, params);
  }

  static async listWithLocation({ specialization, limit = 20, offset = 0, availableOnly = true } = {}) {
    let sql = `
      SELECT d.id, d.specialization, d.years_experience, d.consultation_fee,
             d.rating, d.total_reviews, d.verification_status, d.bio,
             d.languages, d.hospital_affiliation, d.is_available,
             d.latitude, d.longitude, d.city, d.state, d.country,
             u.first_name, u.last_name, u.avatar_url
      FROM doctors d
      JOIN users u ON u.id = d.user_id
      WHERE u.is_active = 1
    `;
    const params = [];
    if (availableOnly) { sql += ' AND d.is_available = 1'; }
    if (specialization) { sql += ' AND d.specialization = ?'; params.push(specialization); }
    sql += ' ORDER BY d.rating DESC, d.total_reviews DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return query(sql, params);
  }

  // ─── Rating ───────────────────────────────────────────────────────────────
  static async updateRating(doctorId) {
    await query(
      `UPDATE doctors d SET
         d.rating = (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.doctor_id = d.id),
         d.total_reviews = (SELECT COUNT(*) FROM reviews r WHERE r.doctor_id = d.id)
       WHERE d.id = ?`,
      [doctorId]
    );
  }
}

module.exports = DoctorModel;
