const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../config/database');

class PrescriptionModel {
  static async create({ patientId, doctorId, consultationId, diagnosis, medications, notes, validUntil }) {
    const id = uuidv4();
    await query(
      `INSERT INTO prescriptions
         (id, patient_id, doctor_id, consultation_id, diagnosis, notes, valid_until, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW())`,
      [id, patientId, doctorId, consultationId || null, diagnosis, notes || null, validUntil || null]
    );

    // Insert medication line items in a single, batched database query to avoid sequential N+1 roundtrips
    const items = medications || [];
    if (items.length > 0) {
      const placeholders = items.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
      const params = [];
      for (const med of items) {
        params.push(
          uuidv4(),
          id,
          med.name,
          med.dosage,
          med.frequency,
          med.duration,
          med.instructions || null
        );
      }
      await query(
        `INSERT INTO prescription_items (id, prescription_id, medication_name, dosage, frequency, duration, instructions)
         VALUES ${placeholders}`,
        params
      );
    }
    return this.findById(id);
  }

  static async findById(id) {
    const rx = await queryOne(
      `SELECT p.*,
              up.first_name AS patient_first_name, up.last_name AS patient_last_name,
              ud.first_name AS doctor_first_name,  ud.last_name AS doctor_last_name,
              d.specialization, d.license_number
       FROM prescriptions p
       JOIN patients pat ON pat.id = p.patient_id
       JOIN users    up  ON up.id  = pat.user_id
       JOIN doctors  d   ON d.id   = p.doctor_id
       JOIN users    ud  ON ud.id  = d.user_id
       WHERE p.id = ?`,
      [id]
    );
    if (!rx) return null;
    rx.medications = await query('SELECT * FROM prescription_items WHERE prescription_id = ?', [id]);
    return rx;
  }

  static async listByPatient(patientId, { limit = 20, offset = 0 } = {}) {
    return query(
      `SELECT p.id, p.diagnosis, p.status, p.created_at, p.valid_until,
              ud.first_name AS doctor_first_name, ud.last_name AS doctor_last_name,
              d.specialization,
              COUNT(pi.id) AS medication_count
       FROM prescriptions p
       JOIN doctors  d   ON d.id  = p.doctor_id
       JOIN users    ud  ON ud.id = d.user_id
       LEFT JOIN prescription_items pi ON pi.prescription_id = p.id
       WHERE p.patient_id = ?
       GROUP BY p.id
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [patientId, limit, offset]
    );
  }

  static async listByDoctor(doctorId, { limit = 20, offset = 0 } = {}) {
    return query(
      `SELECT p.id, p.diagnosis, p.status, p.created_at,
              up.first_name AS patient_first_name, up.last_name AS patient_last_name
       FROM prescriptions p
       JOIN patients pat ON pat.id = p.patient_id
       JOIN users    up  ON up.id  = pat.user_id
       WHERE p.doctor_id = ?
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [doctorId, limit, offset]
    );
  }
}

module.exports = PrescriptionModel;
