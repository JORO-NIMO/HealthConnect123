const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../config/database');

class PaymentModel {
  static async create({ patientId, appointmentId, amount, currency = 'USD', method, providerRef }) {
    const id = uuidv4();
    await query(
      `INSERT INTO payments
         (id, patient_id, appointment_id, amount, currency, payment_method, provider_reference, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [id, patientId, appointmentId || null, amount, currency, method, providerRef || null]
    );
    return this.findById(id);
  }

  static async findById(id) {
    return queryOne('SELECT * FROM payments WHERE id = ?', [id]);
  }

  static async findByProviderRef(ref) {
    return queryOne('SELECT * FROM payments WHERE provider_reference = ?', [ref]);
  }

  static async updateStatus(id, status, providerRef = null) {
    await query(
      'UPDATE payments SET status = ?, provider_reference = COALESCE(?, provider_reference), updated_at = NOW() WHERE id = ?',
      [status, providerRef, id]
    );
  }

  static async listByPatient(patientId, { limit = 20, offset = 0 } = {}) {
    return query(
      `SELECT p.*, a.appointment_date, a.appointment_time
       FROM payments p
       LEFT JOIN appointments a ON a.id = p.appointment_id
       WHERE p.patient_id = ?
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [patientId, limit, offset]
    );
  }

  // ─── Admin analytics ──────────────────────────────────────────────────────
  static async getRevenueStats({ fromDate, toDate } = {}) {
    let sql = `
      SELECT
        DATE(created_at) AS date,
        SUM(amount)      AS revenue,
        COUNT(*)         AS transaction_count,
        payment_method
      FROM payments
      WHERE status = 'completed'
    `;
    const params = [];
    if (fromDate) { sql += ' AND created_at >= ?'; params.push(fromDate); }
    if (toDate)   { sql += ' AND created_at <= ?'; params.push(toDate); }
    sql += ' GROUP BY DATE(created_at), payment_method ORDER BY date DESC';
    return query(sql, params);
  }
}

module.exports = PaymentModel;
