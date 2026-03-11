const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../config/database');

class HospitalModel {
  // ─── Create ──────────────────────────────────────────────────────────────
  static async create(data) {
    const id = uuidv4();
    await query(
      `INSERT INTO hospitals (id, admin_user_id, name, registration_number, type, description,
        phone, email, website, logo_url, address, city, state, country, latitude, longitude,
        specializations, services, operating_hours, emergency_available, bed_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id, data.adminUserId || null, data.name, data.registrationNumber || null,
        data.type || 'general', data.description || null,
        data.phone || null, data.email || null, data.website || null, data.logoUrl || null,
        data.address || null, data.city || null, data.state || null, data.country || 'Uganda',
        data.latitude || null, data.longitude || null,
        data.specializations ? JSON.stringify(data.specializations) : null,
        data.services ? JSON.stringify(data.services) : null,
        data.operatingHours ? JSON.stringify(data.operatingHours) : null,
        data.emergencyAvailable ? 1 : 0, data.bedCount || 0,
      ]
    );
    return this.findById(id);
  }

  // ─── Find ──────────────────────────────────────────────────────────────
  static async findById(id) {
    return queryOne('SELECT * FROM hospitals WHERE id = ?', [id]);
  }

  static async findByAdminUserId(userId) {
    return queryOne('SELECT * FROM hospitals WHERE admin_user_id = ?', [userId]);
  }

  // ─── List ──────────────────────────────────────────────────────────────
  static async list({ type, city, limit = 20, offset = 0, verifiedOnly = false, activeOnly = true } = {}) {
    let sql = 'SELECT * FROM hospitals WHERE 1=1';
    const params = [];

    if (verifiedOnly) { sql += ` AND verification_status = 'verified'`; }
    if (activeOnly)   { sql += ' AND is_active = 1'; }
    if (type)         { sql += ' AND type = ?'; params.push(type); }
    if (city)         { sql += ' AND city = ?'; params.push(city); }

    sql += ' ORDER BY rating DESC, name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return query(sql, params);
  }

  // ─── Search nearby by coordinates ───────────────────────────────────────
  static async findNearby(latitude, longitude, radiusKm = 50, limit = 20) {
    // Haversine formula for distance in km
    const sql = `
      SELECT *, (
        6371 * ACOS(
          COS(RADIANS(?)) * COS(RADIANS(latitude))
          * COS(RADIANS(longitude) - RADIANS(?))
          + SIN(RADIANS(?)) * SIN(RADIANS(latitude))
        )
      ) AS distance_km
      FROM hospitals
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND is_active = 1
      HAVING distance_km <= ?
      ORDER BY distance_km ASC
      LIMIT ?
    `;
    return query(sql, [latitude, longitude, latitude, radiusKm, limit]);
  }

  // ─── Update ─────────────────────────────────────────────────────────────
  static async update(id, fields) {
    const allowed = [
      'name', 'registration_number', 'type', 'description', 'phone', 'email',
      'website', 'logo_url', 'address', 'city', 'state', 'country',
      'latitude', 'longitude', 'specializations', 'services', 'operating_hours',
      'emergency_available', 'bed_count', 'is_active',
    ];
    const keys = Object.keys(fields).filter(k => allowed.includes(k));
    if (!keys.length) return this.findById(id);

    // JSON fields need stringifying
    const jsonFields = ['specializations', 'services', 'operating_hours'];
    const values = keys.map(k => jsonFields.includes(k) && typeof fields[k] === 'object' ? JSON.stringify(fields[k]) : fields[k]);

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    values.push(id);
    await query(`UPDATE hospitals SET ${setClause}, updated_at = NOW() WHERE id = ?`, values);
    return this.findById(id);
  }

  // ─── Verification (admin) ──────────────────────────────────────────────
  static async setVerificationStatus(id, status, adminNote = null) {
    await query(
      'UPDATE hospitals SET verification_status = ?, admin_note = ?, updated_at = NOW() WHERE id = ?',
      [status, adminNote, id]
    );
  }

  // ─── Doctor Management ─────────────────────────────────────────────────
  static async addDoctor(hospitalId, doctorId, data = {}) {
    const id = uuidv4();
    await query(
      `INSERT INTO hospital_doctors (id, hospital_id, doctor_id, department, position, employment_type, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE status = VALUES(status), department = VALUES(department), position = VALUES(position), updated_at = NOW()`,
      [id, hospitalId, doctorId, data.department || null, data.position || null, data.employmentType || 'full_time', data.status || 'pending']
    );
  }

  static async removeDoctor(hospitalId, doctorId) {
    await query(
      `UPDATE hospital_doctors SET status = 'inactive', left_at = NOW(), updated_at = NOW() WHERE hospital_id = ? AND doctor_id = ?`,
      [hospitalId, doctorId]
    );
  }

  static async getDoctors(hospitalId, { status = 'active', limit = 50, offset = 0 } = {}) {
    return query(
      `SELECT hd.*, d.specialization, d.years_experience, d.consultation_fee,
              d.rating, d.total_reviews, d.is_available, d.latitude, d.longitude, d.city,
              u.first_name, u.last_name, u.avatar_url, u.email, u.phone
       FROM hospital_doctors hd
       JOIN doctors d ON d.id = hd.doctor_id
       JOIN users u ON u.id = d.user_id
       WHERE hd.hospital_id = ? AND hd.status = ?
       ORDER BY hd.position, u.last_name
       LIMIT ? OFFSET ?`,
      [hospitalId, status, limit, offset]
    );
  }

  static async getDoctorHospitals(doctorId) {
    return query(
      `SELECT h.*, hd.department, hd.position, hd.employment_type, hd.status AS link_status
       FROM hospital_doctors hd
       JOIN hospitals h ON h.id = hd.hospital_id
       WHERE hd.doctor_id = ? AND hd.status = 'active'
       ORDER BY h.name`,
      [doctorId]
    );
  }

  // ─── Patient Management ────────────────────────────────────────────────
  static async addPatient(hospitalId, patientId, hospitalNumber = null) {
    const id = uuidv4();
    await query(
      `INSERT INTO hospital_patients (id, hospital_id, patient_id, hospital_number, status, created_at)
       VALUES (?, ?, ?, ?, 'active', NOW())
       ON DUPLICATE KEY UPDATE status = 'active', hospital_number = COALESCE(VALUES(hospital_number), hospital_number), updated_at = NOW()`,
      [id, hospitalId, patientId, hospitalNumber]
    );
  }

  static async removePatient(hospitalId, patientId) {
    await query(
      `UPDATE hospital_patients SET status = 'inactive', updated_at = NOW() WHERE hospital_id = ? AND patient_id = ?`,
      [hospitalId, patientId]
    );
  }

  static async getPatients(hospitalId, { status = 'active', limit = 50, offset = 0 } = {}) {
    return query(
      `SELECT hp.*, p.date_of_birth, p.gender, p.blood_type,
              u.first_name, u.last_name, u.avatar_url, u.email, u.phone
       FROM hospital_patients hp
       JOIN patients p ON p.id = hp.patient_id
       JOIN users u ON u.id = p.user_id
       WHERE hp.hospital_id = ? AND hp.status = ?
       ORDER BY u.last_name
       LIMIT ? OFFSET ?`,
      [hospitalId, status, limit, offset]
    );
  }

  static async getPatientHospitals(patientId) {
    return query(
      `SELECT h.*, hp.hospital_number, hp.status AS link_status, hp.registered_at, hp.last_visit
       FROM hospital_patients hp
       JOIN hospitals h ON h.id = hp.hospital_id
       WHERE hp.patient_id = ? AND hp.status = 'active'
       ORDER BY h.name`,
      [patientId]
    );
  }

  // ─── Test Results ──────────────────────────────────────────────────────
  static async createTestResult(data) {
    const id = uuidv4();
    await query(
      `INSERT INTO hospital_test_results (id, hospital_id, patient_id, doctor_id, test_type, test_name,
        description, results, result_summary, file_url, status, notes, is_critical, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id, data.hospitalId, data.patientId, data.doctorId || null,
        data.testType || 'lab', data.testName, data.description || null,
        data.results ? JSON.stringify(data.results) : null,
        data.resultSummary || null, data.fileUrl || null,
        data.status || 'ordered', data.notes || null, data.isCritical ? 1 : 0,
      ]
    );
    return this.getTestResult(id);
  }

  static async getTestResult(id) {
    return queryOne(
      `SELECT htr.*, h.name AS hospital_name,
              u.first_name AS doctor_first_name, u.last_name AS doctor_last_name,
              CONCAT(u.first_name, ' ', u.last_name) AS doctor_name
       FROM hospital_test_results htr
       JOIN hospitals h ON h.id = htr.hospital_id
       LEFT JOIN doctors d ON d.id = htr.doctor_id
       LEFT JOIN users u ON u.id = d.user_id
       WHERE htr.id = ?`,
      [id]
    );
  }

  static async updateTestResult(id, fields) {
    const allowed = ['test_type', 'test_name', 'description', 'results', 'result_summary',
      'file_url', 'status', 'notes', 'is_critical', 'completed_at'];
    const keys = Object.keys(fields).filter(k => allowed.includes(k));
    if (!keys.length) return this.getTestResult(id);

    const values = keys.map(k => k === 'results' && typeof fields[k] === 'object' ? JSON.stringify(fields[k]) : fields[k]);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    values.push(id);

    await query(`UPDATE hospital_test_results SET ${setClause}, updated_at = NOW() WHERE id = ?`, values);
    return this.getTestResult(id);
  }

  static async getPatientTestResults(patientId, { hospitalId, status, testType, limit = 20, offset = 0 } = {}) {
    let sql = `
      SELECT htr.*, h.name AS hospital_name,
             u.first_name AS doctor_first_name, u.last_name AS doctor_last_name,
             CONCAT(u.first_name, ' ', u.last_name) AS doctor_name
      FROM hospital_test_results htr
      JOIN hospitals h ON h.id = htr.hospital_id
      LEFT JOIN doctors d ON d.id = htr.doctor_id
      LEFT JOIN users u ON u.id = d.user_id
      WHERE htr.patient_id = ?
    `;
    const params = [patientId];
    if (hospitalId) { sql += ' AND htr.hospital_id = ?'; params.push(hospitalId); }
    if (status)     { sql += ' AND htr.status = ?'; params.push(status); }
    if (testType)   { sql += ' AND htr.test_type = ?'; params.push(testType); }
    sql += ' ORDER BY htr.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return query(sql, params);
  }

  static async getHospitalTestResults(hospitalId, { status, limit = 20, offset = 0 } = {}) {
    let sql = `
      SELECT htr.*, 
             CONCAT(pu.first_name, ' ', pu.last_name) AS patient_name,
             CONCAT(du.first_name, ' ', du.last_name) AS doctor_name
      FROM hospital_test_results htr
      JOIN patients p ON p.id = htr.patient_id
      JOIN users pu ON pu.id = p.user_id
      LEFT JOIN doctors d ON d.id = htr.doctor_id
      LEFT JOIN users du ON du.id = d.user_id
      WHERE htr.hospital_id = ?
    `;
    const params = [hospitalId];
    if (status) { sql += ' AND htr.status = ?'; params.push(status); }
    sql += ' ORDER BY htr.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return query(sql, params);
  }

  static async markTestViewed(id) {
    await query('UPDATE hospital_test_results SET viewed_by_patient = 1, updated_at = NOW() WHERE id = ?', [id]);
  }

  // ─── Stats ────────────────────────────────────────────────────────────
  static async getStats(hospitalId) {
    const [stats] = await query(
      `SELECT
         (SELECT COUNT(*) FROM hospital_doctors  WHERE hospital_id = ? AND status = 'active') AS total_doctors,
         (SELECT COUNT(*) FROM hospital_patients WHERE hospital_id = ? AND status = 'active') AS total_patients,
         (SELECT COUNT(*) FROM hospital_test_results WHERE hospital_id = ?) AS total_tests,
         (SELECT COUNT(*) FROM hospital_test_results WHERE hospital_id = ? AND status = 'completed') AS completed_tests,
         (SELECT COUNT(*) FROM appointments WHERE hospital_id = ?) AS total_appointments`,
      [hospitalId, hospitalId, hospitalId, hospitalId, hospitalId]
    );
    return stats;
  }

  // ─── Rating ───────────────────────────────────────────────────────────
  static async updateRating(hospitalId) {
    await query(
      `UPDATE hospitals h SET
         h.rating = (SELECT COALESCE(AVG(r.rating), 0) FROM hospital_reviews r WHERE r.hospital_id = h.id),
         h.total_reviews = (SELECT COUNT(*) FROM hospital_reviews r WHERE r.hospital_id = h.id)
       WHERE h.id = ?`,
      [hospitalId]
    );
  }
}

module.exports = HospitalModel;
