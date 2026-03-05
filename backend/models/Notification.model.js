const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../config/database');

class NotificationModel {
  // ─── Create ───────────────────────────────────────────────────────────
  static async create({ userId, title, message, type, actionUrl, metadata }) {
    const id = uuidv4();
    await query(
      `INSERT INTO notifications (id, user_id, title, message, type, action_url, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, title, message, type || 'system', actionUrl || null, metadata ? JSON.stringify(metadata) : null]
    );
    return this.findById(id);
  }

  // ─── Bulk Create (same notification to many users) ───────────────────
  static async createBulk(userIds, { title, message, type, actionUrl, metadata }) {
    const values = userIds.map(uid => [uuidv4(), uid, title, message, type || 'system', actionUrl || null, metadata ? JSON.stringify(metadata) : null]);
    if (!values.length) return;
    const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    await query(
      `INSERT INTO notifications (id, user_id, title, message, type, action_url, metadata) VALUES ${placeholders}`,
      values.flat()
    );
  }

  // ─── Find by ID ──────────────────────────────────────────────────────
  static async findById(id) {
    const n = await queryOne('SELECT * FROM notifications WHERE id = ?', [id]);
    if (n?.metadata) n.metadata = JSON.parse(n.metadata);
    return n;
  }

  // ─── List for User ───────────────────────────────────────────────────
  static async listByUser(userId, { limit = 30, offset = 0, unreadOnly = false } = {}) {
    let sql = 'SELECT * FROM notifications WHERE user_id = ?';
    const params = [userId];

    if (unreadOnly) { sql += ' AND is_read = FALSE'; }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const items = await query(sql, params);
    return items.map(n => {
      if (n.metadata) n.metadata = JSON.parse(n.metadata);
      return n;
    });
  }

  // ─── Unread Count ────────────────────────────────────────────────────
  static async unreadCount(userId) {
    const row = await queryOne(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );
    return row?.count || 0;
  }

  // ─── Mark as Read ────────────────────────────────────────────────────
  static async markRead(id, userId) {
    await query(
      'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = ? AND user_id = ?',
      [id, userId]
    );
  }

  // ─── Mark All Read ──────────────────────────────────────────────────
  static async markAllRead(userId) {
    await query(
      'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );
  }

  // ─── Delete ──────────────────────────────────────────────────────────
  static async delete(id, userId) {
    const result = await query('DELETE FROM notifications WHERE id = ? AND user_id = ?', [id, userId]);
    return result.affectedRows > 0;
  }

  // ─── Delete old (cleanup) ────────────────────────────────────────────
  static async deleteOlderThan(days = 90) {
    const result = await query(
      'DELETE FROM notifications WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [days]
    );
    return result.affectedRows;
  }
}

module.exports = NotificationModel;
