const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../config/database');

class ConsultationModel {
  static async create(appointmentId) {
    const id      = uuidv4();
    const roomId  = `room_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
    await query(
      `INSERT INTO consultations (id, appointment_id, room_id, status, started_at)
       VALUES (?, ?, ?, 'active', NOW())`,
      [id, appointmentId, roomId]
    );
    return this.findById(id);
  }

  static async findById(id) {
    return queryOne(
      `SELECT c.*,
              a.patient_id, a.doctor_id, a.type,
              up.first_name AS patient_first_name, up.last_name AS patient_last_name,
              ud.first_name AS doctor_first_name,  ud.last_name AS doctor_last_name
       FROM consultations c
       JOIN appointments a  ON a.id  = c.appointment_id
       JOIN patients     p  ON p.id  = a.patient_id
       JOIN users        up ON up.id = p.user_id
       JOIN doctors      d  ON d.id  = a.doctor_id
       JOIN users        ud ON ud.id = d.user_id
       WHERE c.id = ?`,
      [id]
    );
  }

  static async findByAppointmentId(appointmentId) {
    return queryOne('SELECT * FROM consultations WHERE appointment_id = ?', [appointmentId]);
  }

  static async end(id, notes) {
    await query(
      'UPDATE consultations SET status = "completed", ended_at = NOW(), notes = ?, updated_at = NOW() WHERE id = ?',
      [notes || null, id]
    );
  }

  // ─── Messages ─────────────────────────────────────────────────────────────
  static async addMessage({ consultationId, senderId, senderRole, messageType = 'text', content, fileUrl }) {
    const id = uuidv4();
    await query(
      `INSERT INTO consultation_messages (id, consultation_id, sender_id, sender_role, message_type, content, file_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, consultationId, senderId, senderRole, messageType, content, fileUrl || null]
    );
    return queryOne('SELECT * FROM consultation_messages WHERE id = ?', [id]);
  }

  static async getMessages(consultationId, { limit = 100, before } = {}) {
    let sql    = 'SELECT * FROM consultation_messages WHERE consultation_id = ?';
    const params = [consultationId];
    if (before) { sql += ' AND created_at < ?'; params.push(before); }
    sql += ' ORDER BY created_at ASC LIMIT ?';
    params.push(limit);
    return query(sql, params);
  }
}

module.exports = ConsultationModel;
