const mysql  = require('mysql2/promise');
const logger = require('../utils/logger.util');

// ─── Connection Pool ────────────────────────────────────────────────────────
// Railway MySQL plugin injects MYSQL_URL automatically once you add the plugin.
// mysql2 requires the URL to be passed as a plain string, NOT as { uri: url }.
const MYSQL_URI = process.env.MYSQL_URL || process.env.DATABASE_URL;

const pool = MYSQL_URI
  ? mysql.createPool(MYSQL_URI)
  : mysql.createPool({
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
      keepAliveInitialDelay: 10000,
    });

// ─── Test & Initialize ─────────────────────────────────────────────────────
async function initializeDatabase(retries = 5, delay = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await pool.getConnection();
      await conn.ping();
      conn.release();
      logger.info('✅ MySQL database connected successfully');
      return;
    } catch (err) {
      logger.error(`❌ MySQL connection attempt ${attempt}/${retries} failed:`, err.message);
      if (attempt === retries) {
        logger.error('All database connection attempts failed. Exiting.');
        throw err;
      }
      logger.info(`Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 1.5; // Exponential backoff
    }
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
