const test = require('node:test');
const assert = require('node:assert');
const db = require('../config/database');
const PrescriptionModel = require('../models/Prescription.model');

const originalPoolQuery = db.pool.query;

test.describe('PrescriptionModel.create', () => {
  test.afterEach(() => {
    db.pool.query = originalPoolQuery;
  });

  test.it('should insert a prescription and its medication items in exactly two database queries', async () => {
    const queries = [];

    db.pool.query = async (sql, params) => {
      queries.push({ sql, params });

      // Mock returned rows for findById
      if (sql.includes('SELECT p.*,')) {
        return [[{
          id: 'rx-123',
          patient_id: 'patient-456',
          doctor_id: 'doctor-789',
          consultation_id: 'consultation-abc',
          diagnosis: 'Acute Bronchitis',
          notes: 'Take with food',
          valid_until: '2026-08-17',
          status: 'active',
          created_at: '2026-07-20 12:00:00',
          patient_first_name: 'John',
          patient_last_name: 'Doe',
          doctor_first_name: 'Jane',
          doctor_last_name: 'Smith',
          specialization: 'Pulmonology',
          license_number: 'LIC98765'
        }]];
      }
      if (sql.includes('SELECT * FROM prescription_items WHERE prescription_id = ?')) {
        return [[
          { id: 'item-1', prescription_id: 'rx-123', medication_name: 'Amoxicillin', dosage: '500mg', frequency: 'Three times daily', duration: '7 days', instructions: 'Finish the entire course' },
          { id: 'item-2', prescription_id: 'rx-123', medication_name: 'Ibuprofen', dosage: '400mg', frequency: 'As needed for pain', duration: '5 days', instructions: 'Take with food' }
        ]];
      }

      // INSERT returns success
      return [[{ affectedRows: 1 }]];
    };

    const rx = await PrescriptionModel.create({
      patientId: 'patient-456',
      doctorId: 'doctor-789',
      consultationId: 'consultation-abc',
      diagnosis: 'Acute Bronchitis',
      notes: 'Take with food',
      validUntil: '2026-08-17',
      medications: [
        { name: 'Amoxicillin', dosage: '500mg', frequency: 'Three times daily', duration: '7 days', instructions: 'Finish the entire course' },
        { name: 'Ibuprofen', dosage: '400mg', frequency: 'As needed for pain', duration: '5 days', instructions: 'Take with food' }
      ]
    });

    // Check query calls: 1. INSERT prescriptions, 2. INSERT prescription_items, 3. SELECT prescription (findById), 4. SELECT items (findById)
    assert.strictEqual(queries.length, 4);

    // First query: INSERT INTO prescriptions
    assert.ok(queries[0].sql.includes('INSERT INTO prescriptions'));
    assert.strictEqual(queries[0].params[1], 'patient-456');
    assert.strictEqual(queries[0].params[2], 'doctor-789');
    assert.strictEqual(queries[0].params[3], 'consultation-abc');
    assert.strictEqual(queries[0].params[4], 'Acute Bronchitis');

    // Second query: INSERT INTO prescription_items
    assert.ok(queries[1].sql.includes('INSERT INTO prescription_items'));
    assert.ok(queries[1].sql.includes('VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)')); // Batched placeholder verification
    assert.strictEqual(queries[1].params[2], 'Amoxicillin');
    assert.strictEqual(queries[1].params[3], '500mg');
    assert.strictEqual(queries[1].params[4], 'Three times daily');
    assert.strictEqual(queries[1].params[5], '7 days');
    assert.strictEqual(queries[1].params[6], 'Finish the entire course');
    assert.strictEqual(queries[1].params[9], 'Ibuprofen');
    assert.strictEqual(queries[1].params[10], '400mg');
    assert.strictEqual(queries[1].params[11], 'As needed for pain');
    assert.strictEqual(queries[1].params[12], '5 days');
    assert.strictEqual(queries[1].params[13], 'Take with food');

    // Returned prescription object verification
    assert.ok(rx);
    assert.strictEqual(rx.id, 'rx-123');
    assert.strictEqual(rx.diagnosis, 'Acute Bronchitis');
    assert.strictEqual(rx.medications.length, 2);
    assert.strictEqual(rx.medications[0].medication_name, 'Amoxicillin');
    assert.strictEqual(rx.medications[1].medication_name, 'Ibuprofen');
  });

  test.it('should handle empty medications array without inserting any prescription items', async () => {
    const queries = [];

    db.pool.query = async (sql, params) => {
      queries.push({ sql, params });

      if (sql.includes('SELECT p.*,')) {
        return [[{
          id: 'rx-123',
          patient_id: 'patient-456',
          doctor_id: 'doctor-789',
          consultation_id: null,
          diagnosis: 'No meds needed',
          notes: 'Rest and fluids',
          valid_until: null,
          status: 'active',
          created_at: '2026-07-20 12:00:00'
        }]];
      }
      if (sql.includes('SELECT * FROM prescription_items WHERE prescription_id = ?')) {
        return [[]];
      }
      return [[{ affectedRows: 1 }]];
    };

    const rx = await PrescriptionModel.create({
      patientId: 'patient-456',
      doctorId: 'doctor-789',
      diagnosis: 'No meds needed',
      notes: 'Rest and fluids',
      medications: []
    });

    // Check query calls: 1. INSERT prescription, 2. SELECT prescription, 3. SELECT items (no insert should occur)
    assert.strictEqual(queries.length, 3);
    assert.ok(queries[0].sql.includes('INSERT INTO prescriptions'));
    assert.ok(queries[1].sql.includes('SELECT p.*,'));
    assert.ok(queries[2].sql.includes('SELECT * FROM prescription_items'));

    assert.ok(rx);
    assert.strictEqual(rx.medications.length, 0);
  });
});
