const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../config/database');

class HealthRecordModel {
  // ─── Create Record ────────────────────────────────────────────────────
  static async create({ patientId, recordType, title, description, providerName, facilityName, recordDate, icd10Code, severity, status, metadata, createdBy }) {
    const id = uuidv4();
    // Use column names compatible with both old schema (icd_code, doctor_id) 
    // and new schema (icd10_code, provider_name, facility_name, created_by)
    // Try new columns first; if they don't exist, fall back to old ones
    try {
      await query(
        `INSERT INTO health_records
           (id, patient_id, record_type, title, description, provider_name, facility_name,
            record_date, icd10_code, severity, status, metadata, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, patientId, recordType, title, description || null,
          providerName || null, facilityName || null, recordDate,
          icd10Code || null, severity || null, status || 'active',
          metadata ? JSON.stringify(metadata) : null, createdBy || null,
        ]
      );
    } catch (colErr) {
      // Fallback for old schema without provider_name, facility_name, icd10_code, created_by
      if (colErr.code === 'ER_BAD_FIELD_ERROR') {
        await query(
          `INSERT INTO health_records
             (id, patient_id, record_type, title, description,
              record_date, icd_code, severity, status, metadata, doctor_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, patientId, recordType, title, description || null,
            recordDate, icd10Code || null, severity || null, status || 'active',
            metadata ? JSON.stringify(metadata) : null, createdBy || null,
          ]
        );
      } else {
        throw colErr;
      }
    }
    return this.findById(id);
  }

  // ─── Find by ID ──────────────────────────────────────────────────────
  static async findById(id) {
    const record = await queryOne('SELECT * FROM health_records WHERE id = ?', [id]);
    if (record?.metadata) record.metadata = JSON.parse(record.metadata);
    if (record?.attachments) record.attachments = JSON.parse(record.attachments);
    return record;
  }

  // ─── List by Patient ─────────────────────────────────────────────────
  static async listByPatient(patientId, { recordType, status, limit = 50, offset = 0 } = {}) {
    let sql = 'SELECT * FROM health_records WHERE patient_id = ?';
    const params = [patientId];

    if (recordType) { sql += ' AND record_type = ?'; params.push(recordType); }
    if (status)     { sql += ' AND status = ?'; params.push(status); }

    sql += ' ORDER BY record_date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const records = await query(sql, params);
    return records.map(r => {
      if (r.metadata) r.metadata = JSON.parse(r.metadata);
      if (r.attachments) r.attachments = JSON.parse(r.attachments);
      return r;
    });
  }

  // ─── Get Timeline (all record types grouped by date) ─────────────────
  static async getTimeline(patientId, { limit = 100 } = {}) {
    const records = await query(
      `SELECT *
       FROM health_records
       WHERE patient_id = ?
       ORDER BY record_date DESC
       LIMIT ?`,
      [patientId, limit]
    );
    return records;
  }

  // ─── Get Summary (counts by type + active conditions) ────────────────
  static async getSummary(patientId) {
    const counts = await query(
      `SELECT record_type, COUNT(*) AS count
       FROM health_records WHERE patient_id = ?
       GROUP BY record_type`,
      [patientId]
    );

    const activeConditions = await query(
      `SELECT title, severity, record_date, status
       FROM health_records
       WHERE patient_id = ? AND record_type IN ('condition','diagnosis') AND status IN ('active','chronic','managed')
       ORDER BY record_date DESC`,
      [patientId]
    );

    return { counts, activeConditions };
  }

  // ─── Update ──────────────────────────────────────────────────────────
  static async update(id, patientId, fields) {
    const allowed = ['title', 'description', 'record_date', 'severity', 'status', 'metadata',
      'provider_name', 'facility_name', 'icd10_code', 'icd_code'];
    const updates = [];
    const params = [];

    for (const [key, val] of Object.entries(fields)) {
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowed.includes(col)) {
        updates.push(`${col} = ?`);
        params.push(col === 'metadata' ? JSON.stringify(val) : val);
      }
    }
    if (!updates.length) return this.findById(id);

    params.push(id, patientId);
    await query(`UPDATE health_records SET ${updates.join(', ')} WHERE id = ? AND patient_id = ?`, params);
    return this.findById(id);
  }

  // ─── Delete ──────────────────────────────────────────────────────────
  static async delete(id, patientId) {
    const result = await query('DELETE FROM health_records WHERE id = ? AND patient_id = ?', [id, patientId]);
    return result.affectedRows > 0;
  }

  // ─── Access Control ──────────────────────────────────────────────────
  static async grantAccess({ recordId, grantedTo, grantedBy, accessLevel, expiresAt }) {
    const id = uuidv4();
    try {
      await query(
        `INSERT INTO health_record_access (id, record_id, granted_to, granted_by, access_level, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, recordId, grantedTo, grantedBy, accessLevel || 'view', expiresAt || null]
      );
    } catch (colErr) {
      // Fallback for old schema (patient_id, doctor_id, permission)
      if (colErr.code === 'ER_BAD_FIELD_ERROR') {
        await query(
          `INSERT INTO health_record_access (id, patient_id, doctor_id, permission, expires_at)
           VALUES (?, ?, ?, ?, ?)`,
          [id, grantedBy, grantedTo, accessLevel || 'view', expiresAt || null]
        );
      } else {
        throw colErr;
      }
    }
    return { id, recordId, grantedTo, accessLevel };
  }

  static async revokeAccess(recordId, grantedTo) {
    // Try new schema first, then fall back to old schema
    let result = await query(
      'DELETE FROM health_record_access WHERE record_id = ? AND granted_to = ?',
      [recordId, grantedTo]
    ).catch(() => ({ affectedRows: 0 }));
    if (!result.affectedRows) {
      result = await query(
        'DELETE FROM health_record_access WHERE patient_id = ? AND doctor_id = ?',
        [recordId, grantedTo]
      ).catch(() => ({ affectedRows: 0 }));
    }
    return result.affectedRows > 0;
  }

  static async listAccessGrants(patientId) {
    // Try new schema first (record-level access)
    try {
      return await query(
        `SELECT hra.*, hr.title AS record_title, u.first_name, u.last_name, u.email
         FROM health_record_access hra
         JOIN health_records hr ON hr.id = hra.record_id
         JOIN users u ON u.id = hra.granted_to
         WHERE hr.patient_id = ?
         ORDER BY hra.created_at DESC`,
        [patientId]
      );
    } catch {
      // Fallback: old schema (patient-level access)
      return query(
        `SELECT hra.*, u.first_name, u.last_name, u.email,
                hra.permission AS access_level, hra.granted_at AS created_at
         FROM health_record_access hra
         JOIN users u ON u.id = hra.doctor_id
         WHERE hra.patient_id = ?
         ORDER BY hra.granted_at DESC`,
        [patientId]
      );
    }
  }

  // ─── Doctor: Get patient records they have access to ──────────────────
  static async listAccessibleRecords(doctorUserId, patientId) {
    // Try new schema first (record-level access)
    try {
      return await query(
        `SELECT hr.*
         FROM health_records hr
         JOIN health_record_access hra ON hra.record_id = hr.id
         WHERE hr.patient_id = ? AND hra.granted_to = ?
           AND (hra.expires_at IS NULL OR hra.expires_at > NOW())
         ORDER BY hr.record_date DESC`,
        [patientId, doctorUserId]
      );
    } catch {
      // Fallback: old schema — doctor has access to ALL patient records if granted
      const access = await query(
        `SELECT 1 FROM health_record_access
         WHERE patient_id = ? AND doctor_id = ?
           AND (expires_at IS NULL OR expires_at > NOW())`,
        [patientId, doctorUserId]
      );
      if (!access.length) return [];
      return query(
        'SELECT * FROM health_records WHERE patient_id = ? ORDER BY record_date DESC',
        [patientId]
      );
    }
  }
}

module.exports = HealthRecordModel;
