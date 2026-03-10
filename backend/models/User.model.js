const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../config/database');

class UserModel {
  // ─── Create ──────────────────────────────────────────────────────────────
  static async create({ email, password, firstName, lastName, phone, role = 'patient' }) {
    const id           = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);

    // Validate role
    const validRoles = ['patient', 'doctor', 'admin', 'hospital_admin'];
    if (!validRoles.includes(role)) role = 'patient';

    await query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, email.toLowerCase(), passwordHash, firstName, lastName, phone || null, role]
    );
    return this.findById(id);
  }

  // ─── Find ─────────────────────────────────────────────────────────────────
  static async findById(id) {
    return queryOne(
      `SELECT id, email, first_name, last_name, phone, role, avatar_url,
              is_active, is_verified, google_id, created_at, updated_at
       FROM users WHERE id = ?`,
      [id]
    );
  }

  static async findByEmail(email) {
    return queryOne(
      'SELECT * FROM users WHERE email = ? AND is_active = 1',
      [email.toLowerCase()]
    );
  }

  static async findByGoogleId(googleId) {
    return queryOne('SELECT * FROM users WHERE google_id = ?', [googleId]);
  }

  // ─── Update ───────────────────────────────────────────────────────────────
  static async update(id, fields) {
    const allowed = ['first_name', 'last_name', 'phone', 'avatar_url'];
    const keys    = Object.keys(fields).filter(k => allowed.includes(k));
    if (!keys.length) return this.findById(id);

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values    = [...keys.map(k => fields[k]), id];

    await query(`UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = ?`, values);
    return this.findById(id);
  }

  static async setGoogleId(id, googleId) {
    await query('UPDATE users SET google_id = ?, is_verified = 1, updated_at = NOW() WHERE id = ?', [googleId, id]);
  }

  static async verifyEmail(id) {
    await query('UPDATE users SET is_verified = 1, updated_at = NOW() WHERE id = ?', [id]);
  }

  static async deactivate(id) {
    await query('UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?', [id]);
  }

  static async updatePassword(id, newPassword) {
    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, id]);
  }

  // ─── Auth helpers ────────────────────────────────────────────────────────
  static async validatePassword(plaintext, hash) {
    return bcrypt.compare(plaintext, hash);
  }

  // ─── OTP ─────────────────────────────────────────────────────────────────
  static async saveOTP(userId, otp, expiresAt) {
    await query(
      `INSERT INTO otp_codes (user_id, code, expires_at) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE code = ?, expires_at = ?`,
      [userId, otp, expiresAt, otp, expiresAt]
    );
  }

  static async verifyOTP(userId, otp) {
    const record = await queryOne(
      'SELECT * FROM otp_codes WHERE user_id = ? AND code = ? AND expires_at > NOW()',
      [userId, otp]
    );
    if (record) {
      await query('DELETE FROM otp_codes WHERE user_id = ?', [userId]);
    }
    return !!record;
  }

  // ─── Refresh tokens ───────────────────────────────────────────────────────
  static async saveRefreshToken(userId, token, expiresAt) {
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
      [userId, token, expiresAt]
    );
  }

  static async findRefreshToken(token) {
    return queryOne(
      'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
      [token]
    );
  }

  static async revokeRefreshToken(token) {
    await query('DELETE FROM refresh_tokens WHERE token = ?', [token]);
  }

  static async revokeAllUserTokens(userId) {
    await query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  }
}

module.exports = UserModel;
