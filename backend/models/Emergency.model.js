const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../config/database');

class EmergencyModel {
  // ─── Add Emergency Contact ────────────────────────────────────────────
  static async addContact({ patientId, name, relationship, phone, email, isPrimary, notifyOnEmergency }) {
    const id = uuidv4();

    // If this is primary, un-primary any existing
    if (isPrimary) {
      await query('UPDATE emergency_contacts SET is_primary = FALSE WHERE patient_id = ?', [patientId]);
    }

    await query(
      `INSERT INTO emergency_contacts
         (id, patient_id, name, relationship, phone, email, is_primary, notify_on_emergency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, patientId, name, relationship, phone, email || null, isPrimary || false, notifyOnEmergency !== false]
    );
    return this.findContactById(id);
  }

  static async findContactById(id) {
    return queryOne('SELECT * FROM emergency_contacts WHERE id = ?', [id]);
  }

  static async listContacts(patientId) {
    return query('SELECT * FROM emergency_contacts WHERE patient_id = ? ORDER BY is_primary DESC, created_at', [patientId]);
  }

  static async updateContact(id, patientId, fields) {
    const allowed = ['name', 'relationship', 'phone', 'email', 'is_primary', 'notify_on_emergency'];
    const updates = [];
    const params = [];

    for (const [key, val] of Object.entries(fields)) {
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowed.includes(col)) {
        updates.push(`${col} = ?`);
        params.push(val);
      }
    }
    if (!updates.length) return this.findContactById(id);

    params.push(id, patientId);
    await query(`UPDATE emergency_contacts SET ${updates.join(', ')} WHERE id = ? AND patient_id = ?`, params);
    return this.findContactById(id);
  }

  static async deleteContact(id, patientId) {
    const result = await query('DELETE FROM emergency_contacts WHERE id = ? AND patient_id = ?', [id, patientId]);
    return result.affectedRows > 0;
  }

  // ─── Trigger SOS ──────────────────────────────────────────────────────
  static async triggerSOS({ patientId, latitude, longitude, address, symptoms, vitalsSnapshot }) {
    const id = uuidv4();
    await query(
      `INSERT INTO emergency_sos_logs
         (id, patient_id, latitude, longitude, address, symptoms, vitals_snapshot, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'triggered')`,
      [
        id, patientId,
        latitude || null, longitude || null, address || null,
        symptoms ? JSON.stringify(symptoms) : null,
        vitalsSnapshot ? JSON.stringify(vitalsSnapshot) : null,
      ]
    );
    return this.findSOSById(id);
  }

  static async findSOSById(id) {
    const sos = await queryOne(
      `SELECT s.*, u.first_name, u.last_name, u.phone, u.email
       FROM emergency_sos_logs s
       JOIN patients p ON p.id = s.patient_id
       JOIN users u ON u.id = p.user_id
       WHERE s.id = ?`,
      [id]
    );
    if (sos?.symptoms) sos.symptoms = JSON.parse(sos.symptoms);
    if (sos?.vitals_snapshot) sos.vitals_snapshot = JSON.parse(sos.vitals_snapshot);
    return sos;
  }

  static async listSOSByPatient(patientId, { limit = 20 } = {}) {
    const items = await query(
      'SELECT * FROM emergency_sos_logs WHERE patient_id = ? ORDER BY created_at DESC LIMIT ?',
      [patientId, limit]
    );
    return items.map(s => {
      if (s.symptoms) s.symptoms = JSON.parse(s.symptoms);
      if (s.vitals_snapshot) s.vitals_snapshot = JSON.parse(s.vitals_snapshot);
      return s;
    });
  }

  // ─── Admin/Doctor: list active SOS ────────────────────────────────────
  static async listActiveSOS({ limit = 50 } = {}) {
    const items = await query(
      `SELECT s.*, u.first_name, u.last_name, u.phone, u.email
       FROM emergency_sos_logs s
       JOIN patients p ON p.id = s.patient_id
       JOIN users u ON u.id = p.user_id
       WHERE s.status IN ('triggered', 'acknowledged')
       ORDER BY s.created_at DESC LIMIT ?`,
      [limit]
    );
    return items.map(s => {
      if (s.symptoms) s.symptoms = JSON.parse(s.symptoms);
      if (s.vitals_snapshot) s.vitals_snapshot = JSON.parse(s.vitals_snapshot);
      return s;
    });
  }

  static async respondToSOS(id, respondedBy, status, notes) {
    await query(
      `UPDATE emergency_sos_logs
       SET status = ?, responded_by = ?, responded_at = NOW(), notes = CONCAT(IFNULL(notes,''), ?)
       WHERE id = ?`,
      [status, respondedBy, notes ? `\n${notes}` : '', id]
    );
    return this.findSOSById(id);
  }

  static async resolveSOS(id, notes) {
    await query(
      `UPDATE emergency_sos_logs SET status = 'resolved', resolved_at = NOW(), notes = CONCAT(IFNULL(notes,''), ?)
       WHERE id = ?`,
      [notes ? `\n${notes}` : '', id]
    );
    return this.findSOSById(id);
  }
}

module.exports = EmergencyModel;
