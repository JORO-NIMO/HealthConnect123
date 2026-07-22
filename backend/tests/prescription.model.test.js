const test = require('node:test');
const assert = require('node:assert');
const db = require('../config/database');
const PrescriptionModel = require('../models/Prescription.model');

const originalPoolQuery = db.pool.query;

test.describe('PrescriptionModel.create', () => {
  test.afterEach(() => {
    db.pool.query = originalPoolQuery;
  });

  test.it('should insert a prescription and its medication items in exactly two database queries, then fetch details', async () => {
    const queries = [];

    db.pool.query = async (sql, params) => {
      queries.push({ sql, params });
      // Mock different returned rows for queries
      if (sql.includes('SELECT p.*')) {
        return [[{
          id: 'prescription-123',
          patient_id: 'patient-456',
          doctor_id: 'doctor-789',
          consultation_id: 'consultation-abc',
          diagnosis: 'Infection',
          notes: 'Take with food',
          valid_until: '2026-08-17',
          status: 'active',
          created_at: '2026-07-21 12:00:00',
          patient_first_name: 'John',
          patient_last_name: 'Doe',
          doctor_first_name: 'Jane',
          doctor_last_name: 'Smith',
          specialization: 'General Medicine',
          license_number: 'MD12345'
        }]];
      }
      if (sql.includes('SELECT * FROM prescription_items WHERE prescription_id = ?')) {
        return [[
          { id: 'item-1', prescription_id: 'prescription-123', medication_name: 'Amoxicillin', dosage: '500mg', frequency: '3x daily', duration: '7 days', instructions: 'Take with water' },
          { id: 'item-2', prescription_id: 'prescription-123', medication_name: 'Ibuprofen', dosage: '400mg', frequency: 'As needed', duration: '5 days', instructions: null }
        ]];
      }
      // INSERT or other queries return success structure
      return [[{ affectedRows: 1 }]];
    };

    const prescription = await PrescriptionModel.create({
      patientId: 'patient-456',
      doctorId: 'doctor-789',
      consultationId: 'consultation-abc',
      diagnosis: 'Infection',
      notes: 'Take with food',
      validUntil: '2026-08-17',
      medications: [
        { name: 'Amoxicillin', dosage: '500mg', frequency: '3x daily', duration: '7 days', instructions: 'Take with water' },
        { name: 'Ibuprofen', dosage: '400mg', frequency: 'As needed', duration: '5 days' }
      ]
    });

    // Check query calls
    // 1. INSERT prescription
    // 2. INSERT prescription_items (in a single bulk query)
    // 3. SELECT prescription details (findById query 1)
    // 4. SELECT prescription medications (findById query 2)
    assert.strictEqual(queries.length, 4, `Expected 4 queries, but got ${queries.length}: ${JSON.stringify(queries.map(q => q.sql))}`);

    // First query: INSERT INTO prescriptions
    assert.ok(queries[0].sql.includes('INSERT INTO prescriptions'));
    assert.strictEqual(queries[0].params[1], 'patient-456');
    assert.strictEqual(queries[0].params[2], 'doctor-789');

    // Second query: INSERT INTO prescription_items bulk
    assert.ok(queries[1].sql.includes('INSERT INTO prescription_items'));
    assert.ok(queries[1].sql.includes('VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)'), 'Should use bulk insert with multiple values placeholders');

    // Check parameters of the bulk insert
    const params = queries[1].params;
    const expectedPrescriptionId = queries[0].params[0]; // actual generated UUID of prescription

    // item 1:
    assert.strictEqual(params[1], expectedPrescriptionId); // prescription_id
    assert.strictEqual(params[2], 'Amoxicillin');
    assert.strictEqual(params[3], '500mg');
    assert.strictEqual(params[4], '3x daily');
    assert.strictEqual(params[5], '7 days');
    assert.strictEqual(params[6], 'Take with water');
    // item 2:
    assert.strictEqual(params[8], expectedPrescriptionId); // prescription_id
    assert.strictEqual(params[9], 'Ibuprofen');
    assert.strictEqual(params[10], '400mg');
    assert.strictEqual(params[11], 'As needed');
    assert.strictEqual(params[12], '5 days');
    assert.strictEqual(params[13], null);

    // Returned prescription object verification
    assert.ok(prescription);
    assert.strictEqual(prescription.id, 'prescription-123');
    assert.strictEqual(prescription.diagnosis, 'Infection');
    assert.strictEqual(prescription.medications.length, 2);
    assert.strictEqual(prescription.medications[0].medication_name, 'Amoxicillin');
  });

  test.it('should handle empty medications array without inserting any prescription items', async () => {
    const queries = [];

    db.pool.query = async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('SELECT p.*')) {
        return [[{
          id: 'prescription-123',
          patient_id: 'patient-456',
          doctor_id: 'doctor-789',
          consultation_id: 'consultation-abc',
          diagnosis: 'Infection',
          notes: 'Take with food',
          valid_until: '2026-08-17',
          status: 'active',
          created_at: '2026-07-21 12:00:00',
          patient_first_name: 'John',
          patient_last_name: 'Doe',
          doctor_first_name: 'Jane',
          doctor_last_name: 'Smith',
          specialization: 'General Medicine',
          license_number: 'MD12345'
        }]];
      }
      if (sql.includes('SELECT * FROM prescription_items WHERE prescription_id = ?')) {
        return [[]];
      }
      return [[{ affectedRows: 1 }]];
    };

    const prescription = await PrescriptionModel.create({
      patientId: 'patient-456',
      doctorId: 'doctor-789',
      consultationId: 'consultation-abc',
      diagnosis: 'Infection',
      notes: 'Take with food',
      validUntil: '2026-08-17',
      medications: []
    });

    // Check query calls — no prescription_items INSERT should be made
    assert.strictEqual(queries.length, 3); // 1. INSERT prescription, 2. SELECT prescription, 3. SELECT items
    assert.ok(queries[0].sql.includes('INSERT INTO prescriptions'));
    assert.ok(queries[1].sql.includes('SELECT p.*'));
    assert.ok(queries[2].sql.includes('SELECT * FROM prescription_items'));

    assert.ok(prescription);
    assert.strictEqual(prescription.medications.length, 0);
  });
});
