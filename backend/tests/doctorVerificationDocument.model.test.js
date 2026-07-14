const test = require('node:test');
const assert = require('node:assert');
const db = require('../config/database');

const originalPoolQuery = db.pool.query;

test.describe('DoctorVerificationDocumentModel.getDoctorsVerificationDocuments', () => {
  test.afterEach(() => {
    db.pool.query = originalPoolQuery;
  });

  test.it('should return empty object for empty or null input', async () => {
    const DoctorVerificationDocumentModel = require('../models/DoctorVerificationDocument.model');
    const result1 = await DoctorVerificationDocumentModel.getDoctorsVerificationDocuments([]);
    assert.deepStrictEqual(result1, {});

    const result2 = await DoctorVerificationDocumentModel.getDoctorsVerificationDocuments(null);
    assert.deepStrictEqual(result2, {});
  });

  test.it('should fetch and map verification documents for multiple doctors in a single query', async () => {
    const DoctorVerificationDocumentModel = require('../models/DoctorVerificationDocument.model');

    let capturedSql = '';
    let capturedParams = [];

    db.pool.query = async (sql, params) => {
      capturedSql = sql;
      capturedParams = params;
      return [[
        {
          id: 'doc-id-1',
          doctor_id: 'doc-123',
          document_type: 'license',
          file_url: '/uploads/license.pdf',
          uploaded_by_first_name: 'John',
          uploaded_by_last_name: 'Doe'
        },
        {
          id: 'doc-id-2',
          doctor_id: 'doc-123',
          document_type: 'degree',
          file_url: '/uploads/degree.pdf',
          uploaded_by_first_name: 'John',
          uploaded_by_last_name: 'Doe'
        },
        {
          id: 'doc-id-3',
          doctor_id: 'doc-456',
          document_type: 'id',
          file_url: '/uploads/id.pdf',
          uploaded_by_first_name: 'Jane',
          uploaded_by_last_name: 'Smith'
        }
      ]];
    };

    const doctorIds = ['doc-123', 'doc-456', 'doc-789'];
    const result = await DoctorVerificationDocumentModel.getDoctorsVerificationDocuments(doctorIds);

    assert.ok(capturedSql.includes('doctor_id IN (?, ?, ?)'));
    assert.deepStrictEqual(capturedParams, ['doc-123', 'doc-456', 'doc-789']);

    assert.ok(result['doc-123']);
    assert.strictEqual(result['doc-123'].length, 2);
    assert.strictEqual(result['doc-123'][0].document_type, 'license');
    assert.strictEqual(result['doc-123'][1].document_type, 'degree');

    assert.ok(result['doc-456']);
    assert.strictEqual(result['doc-456'].length, 1);
    assert.strictEqual(result['doc-456'][0].document_type, 'id');

    assert.ok(result['doc-789']);
    assert.strictEqual(result['doc-789'].length, 0);
  });
});
