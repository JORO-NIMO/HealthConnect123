const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../config/database');

class VitalSignModel {
  // ─── Create ───────────────────────────────────────────────────────────
  static async create({
    patientId, systolicBp, diastolicBp, heartRate, temperature,
    oxygenSat, respiratoryRate, weightKg, heightCm,
    bloodSugar, sugarContext, notes, source, recordedAt,
  }) {
    const id = uuidv4();
    await query(
      `INSERT INTO vital_signs
         (id, patient_id, recorded_at, systolic_bp, diastolic_bp, heart_rate,
          temperature, oxygen_sat, respiratory_rate, weight_kg, height_cm,
          blood_sugar, sugar_context, notes, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, patientId, recordedAt || new Date(),
        systolicBp || null, diastolicBp || null, heartRate || null,
        temperature || null, oxygenSat || null, respiratoryRate || null,
        weightKg || null, heightCm || null,
        bloodSugar || null, sugarContext || 'random',
        notes || null, source || 'manual',
      ]
    );
    return this.findById(id);
  }

  // ─── Find by ID ──────────────────────────────────────────────────────
  static async findById(id) {
    return queryOne('SELECT * FROM vital_signs WHERE id = ?', [id]);
  }

  // ─── List by Patient (paginated) ─────────────────────────────────────
  static async listByPatient(patientId, { limit = 50, offset = 0, from, to } = {}) {
    let sql = 'SELECT * FROM vital_signs WHERE patient_id = ?';
    const params = [patientId];

    if (from) { sql += ' AND recorded_at >= ?'; params.push(from); }
    if (to)   { sql += ' AND recorded_at <= ?'; params.push(to); }

    sql += ' ORDER BY recorded_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return query(sql, params);
  }

  // ─── Get Latest Reading ──────────────────────────────────────────────
  static async getLatest(patientId) {
    return queryOne(
      'SELECT * FROM vital_signs WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT 1',
      [patientId]
    );
  }

  // ─── Trend Data (for charting) ───────────────────────────────────────
  static async getTrends(patientId, { metric, days = 30 } = {}) {
    const validMetrics = [
      'systolic_bp', 'diastolic_bp', 'heart_rate', 'temperature',
      'oxygen_sat', 'respiratory_rate', 'weight_kg', 'blood_sugar',
    ];

    if (metric && !validMetrics.includes(metric)) {
      throw new Error('Invalid metric');
    }

    const selectCols = metric
      ? `recorded_at, ${metric}`
      : `recorded_at, systolic_bp, diastolic_bp, heart_rate, temperature,
         oxygen_sat, respiratory_rate, weight_kg, blood_sugar, sugar_context`;

    return query(
      `SELECT ${selectCols}
       FROM vital_signs
       WHERE patient_id = ?
         AND recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND ${metric || 'systolic_bp'} IS NOT NULL
       ORDER BY recorded_at ASC`,
      [patientId, days]
    );
  }

  // ─── Averages for a Period ───────────────────────────────────────────
  static async getAverages(patientId, days = 30) {
    return queryOne(
      `SELECT
         ROUND(AVG(systolic_bp))       AS avg_systolic,
         ROUND(AVG(diastolic_bp))      AS avg_diastolic,
         ROUND(AVG(heart_rate))        AS avg_heart_rate,
         ROUND(AVG(temperature), 1)    AS avg_temperature,
         ROUND(AVG(oxygen_sat))        AS avg_oxygen_sat,
         ROUND(AVG(blood_sugar), 1)    AS avg_blood_sugar,
         ROUND(AVG(weight_kg), 1)      AS avg_weight,
         MIN(systolic_bp) AS min_systolic, MAX(systolic_bp) AS max_systolic,
         MIN(heart_rate)  AS min_heart_rate, MAX(heart_rate) AS max_heart_rate,
         MIN(blood_sugar) AS min_blood_sugar, MAX(blood_sugar) AS max_blood_sugar,
         COUNT(*)                       AS total_readings
       FROM vital_signs
       WHERE patient_id = ?
         AND recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [patientId, days]
    );
  }

  // ─── Alerts — out-of-range vitals ────────────────────────────────────
  static async getAlerts(patientId) {
    return query(
      `SELECT * FROM vital_signs
       WHERE patient_id = ?
         AND recorded_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         AND (
           systolic_bp > 140 OR systolic_bp < 90
           OR diastolic_bp > 90 OR diastolic_bp < 60
           OR heart_rate > 100 OR heart_rate < 50
           OR temperature > 38.0 OR temperature < 35.5
           OR oxygen_sat < 94
           OR blood_sugar > 200 OR blood_sugar < 70
         )
       ORDER BY recorded_at DESC
       LIMIT 10`,
      [patientId]
    );
  }

  // ─── Delete ──────────────────────────────────────────────────────────
  static async delete(id, patientId) {
    const result = await query(
      'DELETE FROM vital_signs WHERE id = ? AND patient_id = ?',
      [id, patientId]
    );
    return result.affectedRows > 0;
  }

  // ─── Count ───────────────────────────────────────────────────────────
  static async countByPatient(patientId) {
    const row = await queryOne(
      'SELECT COUNT(*) AS total FROM vital_signs WHERE patient_id = ?',
      [patientId]
    );
    return row?.total || 0;
  }
}

module.exports = VitalSignModel;
