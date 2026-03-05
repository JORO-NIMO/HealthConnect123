const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../config/database');

class WaitlistModel {
  // ─── Join Waitlist ────────────────────────────────────────────────────
  static async join({ patientId, doctorId, preferredDate, preferredTime, type, notes }) {
    // Check for existing active waitlist entry
    const existing = await queryOne(
      `SELECT id FROM appointment_waitlist
       WHERE patient_id = ? AND doctor_id = ? AND preferred_date = ? AND status = 'waiting'`,
      [patientId, doctorId, preferredDate]
    );
    if (existing) return { alreadyWaiting: true, ...(await this.findById(existing.id)) };

    const id = uuidv4();
    // Expires 24 hours after the preferred date
    const expiresAt = new Date(preferredDate);
    expiresAt.setDate(expiresAt.getDate() + 1);
    expiresAt.setHours(23, 59, 59);

    await query(
      `INSERT INTO appointment_waitlist
         (id, patient_id, doctor_id, preferred_date, preferred_time, type, notes, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', ?)`,
      [id, patientId, doctorId, preferredDate, preferredTime || null, type || 'video', notes || null, expiresAt]
    );
    return this.findById(id);
  }

  // ─── Find by ID ──────────────────────────────────────────────────────
  static async findById(id) {
    return queryOne(
      `SELECT w.*, u.first_name AS doctor_first_name, u.last_name AS doctor_last_name, d.specialization
       FROM appointment_waitlist w
       JOIN doctors d ON d.id = w.doctor_id
       JOIN users u ON u.id = d.user_id
       WHERE w.id = ?`,
      [id]
    );
  }

  // ─── List by Patient ─────────────────────────────────────────────────
  static async listByPatient(patientId) {
    return query(
      `SELECT w.*, u.first_name AS doctor_first_name, u.last_name AS doctor_last_name, d.specialization
       FROM appointment_waitlist w
       JOIN doctors d ON d.id = w.doctor_id
       JOIN users u ON u.id = d.user_id
       WHERE w.patient_id = ? AND w.status IN ('waiting', 'offered')
       ORDER BY w.preferred_date ASC`,
      [patientId]
    );
  }

  // ─── List by Doctor (for a date) ─────────────────────────────────────
  static async listByDoctor(doctorId, date) {
    let sql = `
      SELECT w.*, up.first_name AS patient_first_name, up.last_name AS patient_last_name
      FROM appointment_waitlist w
      JOIN patients p ON p.id = w.patient_id
      JOIN users up ON up.id = p.user_id
      WHERE w.doctor_id = ? AND w.status = 'waiting'
    `;
    const params = [doctorId];
    if (date) { sql += ' AND w.preferred_date = ?'; params.push(date); }
    sql += ' ORDER BY w.created_at ASC';
    return query(sql, params);
  }

  // ─── Get next in line (for auto-fill when slot opens) ────────────────
  static async getNextInLine(doctorId, date) {
    return queryOne(
      `SELECT w.*, p.user_id AS patient_user_id
       FROM appointment_waitlist w
       JOIN patients p ON p.id = w.patient_id
       WHERE w.doctor_id = ? AND w.preferred_date = ? AND w.status = 'waiting'
       ORDER BY w.created_at ASC
       LIMIT 1`,
      [doctorId, date]
    );
  }

  // ─── Update Status ───────────────────────────────────────────────────
  static async updateStatus(id, status) {
    await query(
      'UPDATE appointment_waitlist SET status = ?, notified_at = IF(? = "offered", NOW(), notified_at) WHERE id = ?',
      [status, status, id]
    );
    return this.findById(id);
  }

  // ─── Cancel ──────────────────────────────────────────────────────────
  static async cancel(id, patientId) {
    const result = await query(
      'UPDATE appointment_waitlist SET status = "cancelled" WHERE id = ? AND patient_id = ?',
      [id, patientId]
    );
    return result.affectedRows > 0;
  }

  // ─── Expire old entries ──────────────────────────────────────────────
  static async expireOld() {
    const result = await query(
      `UPDATE appointment_waitlist SET status = 'expired'
       WHERE status = 'waiting' AND expires_at < NOW()`
    );
    return result.affectedRows;
  }

  // ─── Count waiting for a doctor/date ──────────────────────────────────
  static async countWaiting(doctorId, date) {
    const row = await queryOne(
      `SELECT COUNT(*) AS total FROM appointment_waitlist
       WHERE doctor_id = ? AND preferred_date = ? AND status = 'waiting'`,
      [doctorId, date]
    );
    return row?.total || 0;
  }
}

module.exports = WaitlistModel;
