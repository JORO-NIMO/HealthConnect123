const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../config/database');

class SymptomReportModel {
  static async create({ patientId, symptoms, aiAnalysis, urgencyLevel, sessionId }) {
    const id = uuidv4();
    await query(
      `INSERT INTO symptom_reports
         (id, patient_id, symptoms_raw, ai_analysis, urgency_level, session_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [id, patientId, JSON.stringify(symptoms), JSON.stringify(aiAnalysis), urgencyLevel, sessionId || null]
    );

    // Store individual conditions in a single batched query to avoid N+1 sequential database roundtrips
    const VALID_PROB = ['high', 'medium', 'low'];
    if (aiAnalysis?.possibleConditions?.length) {
      const values = [];
      const placeholders = [];
      for (const condition of aiAnalysis.possibleConditions) {
        const prob = VALID_PROB.includes(String(condition.probability).toLowerCase())
          ? condition.probability.toLowerCase()
          : 'medium';
        placeholders.push('(?, ?, ?, ?, ?, ?, ?)');
        values.push(
          uuidv4(),
          id,
          condition.name,
          condition.icd10Code || null,
          prob,
          condition.confidenceScore || 0,
          condition.description || null
        );
      }
      await query(
        `INSERT INTO symptom_report_details
           (id, report_id, condition_name, icd10_code, probability, confidence_score, description)
         VALUES ${placeholders.join(', ')}`,
        values
      );
    }
    return this.findById(id);
  }

  static async findById(id) {
    const report  = await queryOne('SELECT * FROM symptom_reports WHERE id = ?', [id]);
    if (!report) return null;
    report.details = await query('SELECT * FROM symptom_report_details WHERE report_id = ? ORDER BY confidence_score DESC', [id]);
    if (report.symptoms_raw)  report.symptoms_raw  = JSON.parse(report.symptoms_raw);
    if (report.ai_analysis)   report.ai_analysis   = JSON.parse(report.ai_analysis);
    return report;
  }

  static async listByPatient(patientId, { limit = 20, offset = 0 } = {}) {
    return query(
      `SELECT sr.id, sr.urgency_level, sr.created_at,
              COUNT(srd.id) AS condition_count,
              sr.symptoms_raw
       FROM symptom_reports sr
       LEFT JOIN symptom_report_details srd ON srd.report_id = sr.id
       WHERE sr.patient_id = ?
       GROUP BY sr.id
       ORDER BY sr.created_at DESC
       LIMIT ? OFFSET ?`,
      [patientId, limit, offset]
    );
  }

  // Common symptoms used for autocomplete / ontology
  static async getSymptomList() {
    return query('SELECT id, name, category, synonyms FROM symptoms ORDER BY name');
  }
}

module.exports = SymptomReportModel;
