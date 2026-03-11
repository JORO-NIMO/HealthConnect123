const mysql  = require('mysql2/promise');
const logger = require('../utils/logger.util');

// ─── Connection Pool ────────────────────────────────────────────────────────
// Railway MySQL plugin auto-injects: MYSQL_URL, MYSQLHOST, MYSQLPORT,
// MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE.
// This config mirrors the working Orion project pattern.

let dbConfig = {
  waitForConnections   : true,
  connectionLimit      : parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
  queueLimit           : 0,
  charset              : 'utf8mb4',
  timezone             : '+00:00',
  enableKeepAlive      : true,
  keepAliveInitialDelay: 10000,
};

// 1) If a full DATABASE_URL / MYSQL_URL is provided, parse it into pieces
const rawDbUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
if (rawDbUrl) {
  try {
    const parsed = new URL(rawDbUrl);
    dbConfig.host     = parsed.hostname;
    dbConfig.port     = Number(parsed.port || 3306);
    dbConfig.user     = decodeURIComponent(parsed.username);
    dbConfig.password = decodeURIComponent(parsed.password);
    dbConfig.database = parsed.pathname ? parsed.pathname.replace(/^\//, '') : '';
    logger.info('📦 DB config: parsed from MYSQL_URL / DATABASE_URL');
  } catch (err) {
    logger.warn('⚠️  Failed to parse DATABASE_URL, falling back to individual env vars:', err.message);
  }
}

// 2) Fill any missing pieces from Railway's individual vars or local defaults
dbConfig.host     = dbConfig.host     || process.env.MYSQLHOST     || process.env.DB_HOST     || 'localhost';
dbConfig.port     = dbConfig.port     || Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306);
dbConfig.user     = dbConfig.user     || process.env.MYSQLUSER     || process.env.DB_USER     || 'root';
dbConfig.password = dbConfig.password || process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '';
dbConfig.database = dbConfig.database || process.env.MYSQLDATABASE || process.env.DB_NAME     || 'mucosa_db';

// 3) Log config (mask password)
logger.info(`🔌 DB target: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database} (password: ${dbConfig.password ? '***' : 'NOT SET'})`);

const pool = mysql.createPool(dbConfig);

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
