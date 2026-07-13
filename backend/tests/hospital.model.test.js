const test = require('node:test');
const assert = require('node:assert');
const db = require('../config/database');

const originalPoolQuery = db.pool.query;

test.describe('HospitalModel.getDoctorsHospitals', () => {
  test.afterEach(() => {
    db.pool.query = originalPoolQuery;
  });

  test.it('should return empty object for empty or null input', async () => {
    const HospitalModel = require('../models/Hospital.model');
    const result1 = await HospitalModel.getDoctorsHospitals([]);
    assert.deepStrictEqual(result1, {});

    const result2 = await HospitalModel.getDoctorsHospitals(null);
    assert.deepStrictEqual(result2, {});
  });

  test.it('should fetch and map hospitals for multiple doctors in a single query', async () => {
    const HospitalModel = require('../models/Hospital.model');

    let capturedSql = '';
    let capturedParams = [];

    db.pool.query = async (sql, params) => {
      capturedSql = sql;
      capturedParams = params;
      return [[
        {
          doctor_id: 'doc-123',
          id: 'hosp-1',
          name: 'General Hospital',
          city: 'Kampala',
          department: 'Cardiology',
          position: 'Senior Consultant',
          employment_type: 'full_time',
          link_status: 'active'
        },
        {
          doctor_id: 'doc-123',
          id: 'hosp-2',
          name: 'City Clinic',
          city: 'Entebbe',
          department: 'ER',
          position: 'Attending',
          employment_type: 'part_time',
          link_status: 'active'
        },
        {
          doctor_id: 'doc-456',
          id: 'hosp-1',
          name: 'General Hospital',
          city: 'Kampala',
          department: 'Pediatrics',
          position: 'Resident',
          employment_type: 'full_time',
          link_status: 'active'
        }
      ]];
    };

    const doctorIds = ['doc-123', 'doc-456', 'doc-789'];
    const result = await HospitalModel.getDoctorsHospitals(doctorIds);

    assert.ok(capturedSql.includes('doctor_id IN (?, ?, ?)'));
    assert.deepStrictEqual(capturedParams, ['doc-123', 'doc-456', 'doc-789']);

    assert.ok(result['doc-123']);
    assert.strictEqual(result['doc-123'].length, 2);
    assert.strictEqual(result['doc-123'][0].name, 'General Hospital');
    assert.strictEqual(result['doc-123'][1].name, 'City Clinic');

    assert.ok(result['doc-456']);
    assert.strictEqual(result['doc-456'].length, 1);
    assert.strictEqual(result['doc-456'][0].name, 'General Hospital');

    assert.ok(result['doc-789']);
    assert.strictEqual(result['doc-789'].length, 0);
  });
});
