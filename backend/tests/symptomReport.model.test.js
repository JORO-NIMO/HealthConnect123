const test = require('node:test');
const assert = require('node:assert');
const db = require('../config/database');
const SymptomReportModel = require('../models/SymptomReport.model');

const originalPoolQuery = db.pool.query;

test.describe('SymptomReportModel.create', () => {
  test.afterEach(() => {
    db.pool.query = originalPoolQuery;
  });

  test.it('should insert a symptom report and its details in exactly two database queries', async () => {
    const queries = [];

    db.pool.query = async (sql, params) => {
      queries.push({ sql, params });
      // Mocking different returned rows for queries
      if (sql.includes('SELECT * FROM symptom_reports WHERE id = ?')) {
        return [[{
          id: 'report-123',
          patient_id: 'patient-456',
          symptoms_raw: '["fever", "cough"]',
          ai_analysis: '{"urgencyLevel": "MEDIUM", "possibleConditions": []}',
          urgency_level: 'MEDIUM',
          session_id: 'session-789',
          created_at: '2026-07-17 12:00:00'
        }]];
      }
      if (sql.includes('SELECT * FROM symptom_report_details WHERE report_id = ?')) {
        return [[
          { id: 'detail-1', report_id: 'report-123', condition_name: 'Common Cold', confidence_score: 85 },
          { id: 'detail-2', report_id: 'report-123', condition_name: 'Flu', confidence_score: 70 }
        ]];
      }
      // INSERT or other queries return success structure
      return [[{ affectedRows: 1 }]];
    };

    const report = await SymptomReportModel.create({
      patientId: 'patient-456',
      symptoms: ['fever', 'cough'],
      urgencyLevel: 'MEDIUM',
      sessionId: 'session-789',
      aiAnalysis: {
        urgencyLevel: 'MEDIUM',
        possibleConditions: [
          { name: 'Common Cold', icd10Code: 'J00', probability: 'high', confidenceScore: 85, description: 'Mild viral infection' },
          { name: 'Flu', icd10Code: 'J11', probability: 'medium', confidenceScore: 70, description: 'Influenza viral infection' }
        ]
      }
    });

    // Check query calls
    assert.strictEqual(queries.length, 4); // 1. INSERT report, 2. INSERT details, 3. SELECT report, 4. SELECT details

    // First query: INSERT INTO symptom_reports
    assert.ok(queries[0].sql.includes('INSERT INTO symptom_reports'));
    assert.strictEqual(queries[0].params[1], 'patient-456');
    assert.strictEqual(queries[0].params[2], '["fever","cough"]');

    // Second query: INSERT INTO symptom_report_details
    assert.ok(queries[1].sql.includes('INSERT INTO symptom_report_details'));
    assert.ok(queries[1].sql.includes('VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)')); // Batched placeholder verification!
    assert.strictEqual(queries[1].params[2], 'Common Cold');
    assert.strictEqual(queries[1].params[3], 'J00');
    assert.strictEqual(queries[1].params[4], 'high');
    assert.strictEqual(queries[1].params[5], 85);
    assert.strictEqual(queries[1].params[6], 'Mild viral infection');
    assert.strictEqual(queries[1].params[9], 'Flu');
    assert.strictEqual(queries[1].params[10], 'J11');
    assert.strictEqual(queries[1].params[11], 'medium');
    assert.strictEqual(queries[1].params[12], 70);
    assert.strictEqual(queries[1].params[13], 'Influenza viral infection');

    // Returned report object verification
    assert.ok(report);
    assert.strictEqual(report.id, 'report-123');
    assert.strictEqual(report.urgency_level, 'MEDIUM');
    assert.deepStrictEqual(report.symptoms_raw, ['fever', 'cough']);
    assert.strictEqual(report.details.length, 2);
    assert.strictEqual(report.details[0].condition_name, 'Common Cold');
  });

  test.it('should handle empty conditions array without inserting details', async () => {
    const queries = [];

    db.pool.query = async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('SELECT * FROM symptom_reports WHERE id = ?')) {
        return [[{
          id: 'report-123',
          patient_id: 'patient-456',
          symptoms_raw: '["fever"]',
          ai_analysis: '{"urgencyLevel": "LOW", "possibleConditions": []}',
          urgency_level: 'LOW',
          session_id: null,
          created_at: '2026-07-17 12:00:00'
        }]];
      }
      if (sql.includes('SELECT * FROM symptom_report_details WHERE report_id = ?')) {
        return [[]];
      }
      return [[{ affectedRows: 1 }]];
    };

    const report = await SymptomReportModel.create({
      patientId: 'patient-456',
      symptoms: ['fever'],
      urgencyLevel: 'LOW',
      aiAnalysis: {
        urgencyLevel: 'LOW',
        possibleConditions: []
      }
    });

    // Check query calls — no details INSERT should be made
    assert.strictEqual(queries.length, 3); // 1. INSERT report, 2. SELECT report, 3. SELECT details
    assert.ok(queries[0].sql.includes('INSERT INTO symptom_reports'));
    assert.ok(queries[1].sql.includes('SELECT * FROM symptom_reports'));
    assert.ok(queries[2].sql.includes('SELECT * FROM symptom_report_details'));

    assert.ok(report);
    assert.strictEqual(report.details.length, 0);
  });
});
