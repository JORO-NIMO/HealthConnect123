const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../config/database');

class EmergencyModel {
  static normalizeIdempotencyKey(rawKey) {
    if (!rawKey || typeof rawKey !== 'string') return null;
    const key = rawKey.trim();
    if (!key) return null;
    return key.substring(0, 128);
  }

  static parseJSON(value) {
    if (!value) return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

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
  static async triggerSOS({ patientId, latitude, longitude, address, symptoms, vitalsSnapshot, idempotencyKey }) {
    const normalizedKey = this.normalizeIdempotencyKey(idempotencyKey);

    if (normalizedKey) {
      const existing = await queryOne(
        `SELECT id
         FROM emergency_sos_logs
         WHERE patient_id = ? AND idempotency_key = ?
         LIMIT 1`,
        [patientId, normalizedKey]
      );
      if (existing?.id) {
        const replay = await this.findSOSById(existing.id);
        if (replay) replay._idempotentReplay = true;
        return replay;
      }
    }

    const id = uuidv4();

    try {
      await query(
        `INSERT INTO emergency_sos_logs
           (id, patient_id, latitude, longitude, address, symptoms, vitals_snapshot, idempotency_key, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'triggered')`,
        [
          id, patientId,
          latitude || null, longitude || null, address || null,
          symptoms ? JSON.stringify(symptoms) : null,
          vitalsSnapshot ? JSON.stringify(vitalsSnapshot) : null,
          normalizedKey,
        ]
      );
    } catch (err) {
      // Duplicate idempotency key: fetch and return previously created SOS.
      if (normalizedKey && err?.errno === 1062) {
        const existing = await queryOne(
          `SELECT id
           FROM emergency_sos_logs
           WHERE patient_id = ? AND idempotency_key = ?
           LIMIT 1`,
          [patientId, normalizedKey]
        );
        if (existing?.id) {
          const replay = await this.findSOSById(existing.id);
          if (replay) replay._idempotentReplay = true;
          return replay;
        }
      }
      throw err;
    }

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
    if (sos?.symptoms) sos.symptoms = this.parseJSON(sos.symptoms);
    if (sos?.vitals_snapshot) sos.vitals_snapshot = this.parseJSON(sos.vitals_snapshot);
    return sos;
  }

  static async listSOSByPatient(patientId, { limit = 20 } = {}) {
    const items = await query(
      'SELECT * FROM emergency_sos_logs WHERE patient_id = ? ORDER BY created_at DESC LIMIT ?',
      [patientId, limit]
    );
    return items.map(s => {
      if (s.symptoms) s.symptoms = this.parseJSON(s.symptoms);
      if (s.vitals_snapshot) s.vitals_snapshot = this.parseJSON(s.vitals_snapshot);
      return s;
    });
  }

  // Batched query to solve the N+1 problem when fetching active SOS logs for multiple hospitals
  static async listActiveSOSForHospitals(hospitalIds, { limit = 50 } = {}) {
    if (!hospitalIds || !hospitalIds.length) return [];

    const uniqueIds = [...new Set(hospitalIds.filter(Boolean))];
    if (!uniqueIds.length) return [];

    const placeholders = uniqueIds.map(() => '?').join(', ');
    const items = await query(
      `SELECT s.*, t.status AS dispatch_status, t.claimed_by, t.claimed_at,
              u.first_name, u.last_name, u.phone, u.email
       FROM emergency_sos_dispatch_targets t
       JOIN emergency_sos_logs s ON s.id = t.sos_id
       JOIN patients p ON p.id = s.patient_id
       JOIN users u ON u.id = p.user_id
       WHERE t.hospital_id IN (${placeholders})
         AND s.status IN ('triggered', 'acknowledged')
         AND t.status IN ('pending', 'claimed')
       ORDER BY s.created_at DESC
       LIMIT ?`,
      [...uniqueIds, limit]
    );

    return items.map(s => {
      if (s.symptoms) s.symptoms = this.parseJSON(s.symptoms);
      if (s.vitals_snapshot) s.vitals_snapshot = this.parseJSON(s.vitals_snapshot);
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
      if (s.symptoms) s.symptoms = this.parseJSON(s.symptoms);
      if (s.vitals_snapshot) s.vitals_snapshot = this.parseJSON(s.vitals_snapshot);
      return s;
    });
  }

  static async upsertDispatchTargets(sosId, hospitalIds = []) {
    if (!hospitalIds.length) return;

    const placeholders = hospitalIds.map(() => '(?, ?, NOW())').join(', ');
    const params = hospitalIds.flatMap(hospitalId => [sosId, hospitalId]);

    await query(
      `INSERT INTO emergency_sos_dispatch_targets (sos_id, hospital_id, dispatched_at)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         dispatched_at = VALUES(dispatched_at),
         updated_at = NOW()`,
      params
    );
  }

  static async listDispatchTargetHospitalIds(sosId) {
    const rows = await query(
      'SELECT hospital_id FROM emergency_sos_dispatch_targets WHERE sos_id = ?',
      [sosId]
    );
    return rows.map(r => r.hospital_id).filter(Boolean);
  }

  static async listActiveSOSForHospital(hospitalId, { limit = 50 } = {}) {
    const items = await query(
      `SELECT s.*, t.status AS dispatch_status, t.claimed_by, t.claimed_at,
              u.first_name, u.last_name, u.phone, u.email
       FROM emergency_sos_dispatch_targets t
       JOIN emergency_sos_logs s ON s.id = t.sos_id
       JOIN patients p ON p.id = s.patient_id
       JOIN users u ON u.id = p.user_id
       WHERE t.hospital_id = ?
         AND s.status IN ('triggered', 'acknowledged')
         AND t.status IN ('pending', 'claimed')
       ORDER BY s.created_at DESC
       LIMIT ?`,
      [hospitalId, limit]
    );

    return items.map(s => {
      if (s.symptoms) s.symptoms = this.parseJSON(s.symptoms);
      if (s.vitals_snapshot) s.vitals_snapshot = this.parseJSON(s.vitals_snapshot);
      return s;
    });
  }

  static async markDispatchClaimedByHospitals(sosId, hospitalIds, responderUserId) {
    if (!Array.isArray(hospitalIds) || !hospitalIds.length) return;

    const placeholders = hospitalIds.map(() => '?').join(', ');
    await query(
      `UPDATE emergency_sos_dispatch_targets
       SET status = 'claimed', claimed_by = ?, claimed_at = NOW(), updated_at = NOW()
       WHERE sos_id = ?
         AND hospital_id IN (${placeholders})`,
      [responderUserId, sosId, ...hospitalIds]
    );
  }

  static async markDispatchStandDownOthers(sosId, excludedHospitalIds = []) {
    const params = [sosId];
    let sql =
      `UPDATE emergency_sos_dispatch_targets
       SET status = 'stand_down', updated_at = NOW()
       WHERE sos_id = ?
         AND status = 'pending'`;

    if (excludedHospitalIds.length) {
      const placeholders = excludedHospitalIds.map(() => '?').join(', ');
      sql += ` AND hospital_id NOT IN (${placeholders})`;
      params.push(...excludedHospitalIds);
    }

    await query(sql, params);
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
