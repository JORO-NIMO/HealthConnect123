const test = require('node:test');
const assert = require('node:assert');
const db = require('../config/database');

const originalPoolQuery = db.pool.query;

test.describe('EmergencyModel.listActiveSOSForHospitals', () => {
  test.afterEach(() => {
    db.pool.query = originalPoolQuery;
  });

  test.it('should return empty array for empty or null input', async () => {
    const EmergencyModel = require('../models/Emergency.model');
    const result1 = await EmergencyModel.listActiveSOSForHospitals([]);
    assert.deepStrictEqual(result1, []);

    const result2 = await EmergencyModel.listActiveSOSForHospitals(null);
    assert.deepStrictEqual(result2, []);
  });

  test.it('should fetch active SOS logs for multiple hospitals in a single query', async () => {
    const EmergencyModel = require('../models/Emergency.model');

    let capturedSql = '';
    let capturedParams = [];

    db.pool.query = async (sql, params) => {
      capturedSql = sql;
      capturedParams = params;
      return [[
        {
          id: 'sos-123',
          patient_id: 'pat-1',
          latitude: 0.3476,
          longitude: 32.5825,
          address: 'Kampala',
          symptoms: '["fever", "cough"]',
          vitals_snapshot: '{"heart_rate": 85}',
          status: 'triggered',
          dispatch_status: 'pending',
          first_name: 'John',
          last_name: 'Doe',
          phone: '+256700000000',
          email: 'john@example.com'
        }
      ]];
    };

    const hospitalIds = ['hosp-1', 'hosp-2'];
    const result = await EmergencyModel.listActiveSOSForHospitals(hospitalIds);

    assert.ok(capturedSql.includes('t.hospital_id IN (?, ?)'));
    assert.deepStrictEqual(capturedParams, ['hosp-1', 'hosp-2', 50]);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'sos-123');
    assert.deepStrictEqual(result[0].symptoms, ['fever', 'cough']);
    assert.deepStrictEqual(result[0].vitals_snapshot, { heart_rate: 85 });
    assert.strictEqual(result[0].first_name, 'John');
  });
});
