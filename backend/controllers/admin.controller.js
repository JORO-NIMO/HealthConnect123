const { query, queryOne } = require('../config/database');
const UserModel    = require('../models/User.model');
const DoctorModel  = require('../models/Doctor.model');
const PaymentModel = require('../models/Payment.model');
const { sendSuccess, sendError } = require('../utils/response.util');
const logger = require('../utils/logger.util');

// ─── Dashboard Overview ────────────────────────────────────────────────────
exports.getDashboard = async (req, res, next) => {
  try {
    const [stats] = await query(`
      SELECT
        (SELECT COUNT(*) FROM users  WHERE role = 'patient') AS total_patients,
        (SELECT COUNT(*) FROM users  WHERE role = 'doctor')  AS total_doctors,
        (SELECT COUNT(*) FROM users  WHERE role = 'doctor'
                                    AND id IN (SELECT user_id FROM doctors WHERE verification_status = 'pending')) AS pending_doctors,
        (SELECT COUNT(*) FROM appointments) AS total_appointments,
        (SELECT COUNT(*) FROM appointments WHERE DATE(created_at) = CURDATE()) AS today_appointments,
        (SELECT COUNT(*) FROM symptom_reports) AS total_symptom_checks,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed') AS total_revenue
    `);
    return sendSuccess(res, 200, 'Dashboard stats retrieved.', { stats });
  } catch (err) { next(err); }
};

// ─── List Users ────────────────────────────────────────────────────────────
exports.listUsers = async (req, res, next) => {
  try {
    const { role, search, limit = 20, offset = 0 } = req.query;
    let sql = `
      SELECT id, email, first_name, last_name, phone, role, is_active, is_verified, created_at
      FROM users WHERE 1=1
    `;
    const params = [];
    if (role)   { sql += ' AND role = ?';   params.push(role); }
    if (search) { sql += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const users = await query(sql, params);
    return sendSuccess(res, 200, 'Users retrieved.', { users });
  } catch (err) { next(err); }
};

// ─── Deactivate User ───────────────────────────────────────────────────────
exports.deactivateUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return sendError(res, 400, 'You cannot deactivate your own account.');
    await UserModel.deactivate(req.params.id);
    logger.info(`Admin ${req.user.id} deactivated user ${req.params.id}`);
    return sendSuccess(res, 200, 'User deactivated.');
  } catch (err) { next(err); }
};

// ─── Pending Doctors ───────────────────────────────────────────────────────
exports.getPendingDoctors = async (req, res, next) => {
  try {
    const doctors = await query(`
      SELECT d.*, u.first_name, u.last_name, u.email, u.phone
      FROM doctors d
      JOIN users u ON u.id = d.user_id
      WHERE d.verification_status = 'pending'
      ORDER BY d.created_at ASC
    `);
    return sendSuccess(res, 200, 'Pending doctors retrieved.', { doctors });
  } catch (err) { next(err); }
};

// ─── Approve / Reject Doctor ───────────────────────────────────────────────
exports.verifyDoctor = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    if (!['verified', 'rejected'].includes(status)) {
      return sendError(res, 400, 'Status must be "verified" or "rejected".');
    }
    await DoctorModel.setVerificationStatus(req.params.id, status, note);
    logger.info(`Admin ${req.user.id} ${status} doctor ${req.params.id}`);
    return sendSuccess(res, 200, `Doctor ${status} successfully.`);
  } catch (err) { next(err); }
};

// ─── Revenue Analytics ─────────────────────────────────────────────────────
exports.getRevenue = async (req, res, next) => {
  try {
    const stats = await PaymentModel.getRevenueStats(req.query);
    return sendSuccess(res, 200, 'Revenue analytics retrieved.', { stats });
  } catch (err) { next(err); }
};

// ─── Audit Logs ────────────────────────────────────────────────────────────
exports.getAuditLogs = async (req, res, next) => {
  try {
    const { userId, resource, limit = 50, offset = 0 } = req.query;
    let sql = `
      SELECT al.*, u.email, u.first_name, u.last_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE 1=1
    `;
    const params = [];
    if (userId)   { sql += ' AND al.user_id = ?';  params.push(userId); }
    if (resource) { sql += ' AND al.resource = ?'; params.push(resource); }
    sql += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const logs = await query(sql, params);
    return sendSuccess(res, 200, 'Audit logs retrieved.', { logs });
  } catch (err) { next(err); }
};
