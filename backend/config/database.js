const mysql  = require('mysql2/promise');
const logger = require('../utils/logger.util');

// ─── Connection Pool ────────────────────────────────────────────────────────
const pool = mysql.createPool({
  host              : process.env.DB_HOST     || 'localhost',
  port              : parseInt(process.env.DB_PORT || '3306'),
  user              : process.env.DB_USER     || 'root',
  password          : process.env.DB_PASSWORD || '',
  database          : process.env.DB_NAME     || 'mucosa_db',
  connectionLimit   : parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
  waitForConnections: true,
  queueLimit        : 0,
  charset           : 'utf8mb4',
  timezone          : '+00:00',
  enableKeepAlive   : true,
  keepAliveInitialDelay: 0,
});

// ─── Test & Initialize ─────────────────────────────────────────────────────
async function initializeDatabase() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    logger.info('✅ MySQL database connected successfully');
  } catch (err) {
    logger.error('❌ MySQL connection failed:', err.message);
    throw err;
  }
}

// ─── Query Helper ──────────────────────────────────────────────────────────
/**
 * Execute a parameterized SQL query.
 * @param {string} sql - SQL string with ? placeholders
 * @param {Array}  params - Values for placeholders
 * @returns {Promise<Array>} rows result
 */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Execute a query and return first row or null.
 */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/**
 * Execute multiple queries inside a transaction.
 * @param {Function} callback - async (conn) => { ... }
 */
async function transaction(callback) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, queryOne, transaction, initializeDatabase };
