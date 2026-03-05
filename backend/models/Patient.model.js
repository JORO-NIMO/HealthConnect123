const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../config/database');

class PatientModel {
  static async create(userId) {
    const id = uuidv4();
    await query(
      `INSERT INTO patients (id, user_id, created_at) VALUES (?, ?, NOW())`,
      [id, userId]
    );
    return this.findByUserId(userId);
  }

  static async findByUserId(userId) {
    return queryOne(
      `SELECT p.*, u.first_name, u.last_name, u.email, u.phone, u.avatar_url
       FROM patients p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = ?`,
      [userId]
    );
  }

  static async findById(id) {
    return queryOne(
      `SELECT p.*, u.first_name, u.last_name, u.email, u.phone, u.avatar_url
       FROM patients p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = ?`,
      [id]
    );
  }

  static async update(userId, fields) {
    const allowed = [
      'date_of_birth', 'gender', 'blood_type', 'allergies',
      'chronic_conditions', 'emergency_contact_name',
      'emergency_contact_phone', 'address', 'insurance_number',
      'weight_kg', 'height_cm',
    ];
    const keys = Object.keys(fields).filter(k => allowed.includes(k));
    if (!keys.length) return this.findByUserId(userId);

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values    = [...keys.map(k => fields[k]), userId];

    await query(`UPDATE patients SET ${setClause}, updated_at = NOW() WHERE user_id = ?`, values);
    return this.findByUserId(userId);
  }

  // ─── Medical History ─────────────────────────────────────────────────────
  static async getMedicalHistory(patientId, { limit = 20, offset = 0 } = {}) {
    return query(
      `SELECT sr.*, 
              COUNT(srd.id) AS condition_count
       FROM symptom_reports sr
       LEFT JOIN symptom_report_details srd ON srd.report_id = sr.id
       WHERE sr.patient_id = ?
       GROUP BY sr.id
       ORDER BY sr.created_at DESC
       LIMIT ? OFFSET ?`,
      [patientId, limit, offset]
    );
  }

  // ─── Stats ────────────────────────────────────────────────────────────────
  static async getStats(patientId) {
    const [stats] = await query(
      `SELECT
         (SELECT COUNT(*) FROM symptom_reports  WHERE patient_id = ?) AS total_symptom_reports,
         (SELECT COUNT(*) FROM appointments     WHERE patient_id = ?) AS total_appointments,
         (SELECT COUNT(*) FROM consultations c
          JOIN appointments a ON a.id = c.appointment_id
          WHERE a.patient_id = ?)                                      AS total_consultations,
         (SELECT COUNT(*) FROM prescriptions    WHERE patient_id = ?) AS total_prescriptions`,
      [patientId, patientId, patientId, patientId]
    );
    return stats;
  }
}

module.exports = PatientModel;
