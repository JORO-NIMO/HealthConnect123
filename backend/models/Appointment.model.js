const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../config/database');

class AppointmentModel {
  static async create({ patientId, doctorId, appointmentDate, appointmentTime, type = 'video', notes, symptomReportId }) {
    const id = uuidv4();
    await query(
      `INSERT INTO appointments
         (id, patient_id, doctor_id, appointment_date, appointment_time, type, notes, symptom_report_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [id, patientId, doctorId, appointmentDate, appointmentTime, type, notes || null, symptomReportId || null]
    );
    return this.findById(id);
  }

  static async findById(id) {
    return queryOne(
      `SELECT a.*,
              up.first_name AS patient_first_name, up.last_name AS patient_last_name, 
              up.email AS patient_email, up.phone AS patient_phone,
              ud.first_name AS doctor_first_name,  ud.last_name AS doctor_last_name,
              ud.phone AS doctor_phone,
              d.specialization, d.consultation_fee
       FROM appointments a
       JOIN patients   p  ON p.id   = a.patient_id
       JOIN users      up ON up.id  = p.user_id
       JOIN doctors    d  ON d.id   = a.doctor_id
       JOIN users      ud ON ud.id  = d.user_id
       WHERE a.id = ?`,
      [id]
    );
  }

  static async listByPatient(patientId, { status, limit = 20, offset = 0 } = {}) {
    let sql = `
      SELECT a.*,
             ud.first_name AS doctor_first_name, ud.last_name AS doctor_last_name,
             d.specialization, d.consultation_fee
      FROM appointments a
      JOIN doctors d  ON d.id  = a.doctor_id
      JOIN users   ud ON ud.id = d.user_id
      WHERE a.patient_id = ?
    `;
    const params = [patientId];
    if (status) { sql += ' AND a.status = ?'; params.push(status); }
    sql += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return query(sql, params);
  }

  static async listByDoctor(doctorId, { status, date, limit = 20, offset = 0 } = {}) {
    let sql = `
      SELECT a.*,
             up.first_name AS patient_first_name, up.last_name AS patient_last_name
      FROM appointments a
      JOIN patients p  ON p.id  = a.patient_id
      JOIN users    up ON up.id = p.user_id
      WHERE a.doctor_id = ?
    `;
    const params = [doctorId];
    if (status) { sql += ' AND a.status = ?'; params.push(status); }
    if (date)   { sql += ' AND a.appointment_date = ?'; params.push(date); }
    sql += ' ORDER BY a.appointment_date ASC, a.appointment_time ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return query(sql, params);
  }

  static async updateStatus(id, status) {
    await query('UPDATE appointments SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);
    return this.findById(id);
  }

  static async cancel(id, cancelledBy, reason) {
    await query(
      'UPDATE appointments SET status = "cancelled", cancelled_by = ?, cancellation_reason = ?, updated_at = NOW() WHERE id = ?',
      [cancelledBy, reason || null, id]
    );
  }

  // Check if a doctor slot is already booked
  static async isSlotTaken(doctorId, date, time) {
    const row = await queryOne(
      `SELECT id FROM appointments
       WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ?
         AND status NOT IN ('cancelled', 'completed')`,
      [doctorId, date, time]
    );
    return !!row;
  }
}

module.exports = AppointmentModel;
