/**
 * HealthConnect — Auto Schema Initialization
 * Reads schema.sql and runs all CREATE TABLE IF NOT EXISTS statements on startup.
 * This ensures the database has all required tables on first Railway deploy,
 * just like Orion's ensureSchema() pattern.
 */

const fs     = require('fs');
const path   = require('path');
const { pool } = require('../config/database');
const logger = require('../utils/logger.util');

async function ensureSchema() {
  logger.info('🔄 Ensuring database schema exists…');

  const schemaFiles = [
    path.join(__dirname, 'schema.sql'),
    path.join(__dirname, 'hospital_migration.sql'),
    path.join(__dirname, 'migrations.sql'),
  ];

  for (const filePath of schemaFiles) {
    if (!fs.existsSync(filePath)) {
      logger.warn(`  ⏭ Schema file not found: ${path.basename(filePath)}`);
      continue;
    }

    const sql = fs.readFileSync(filePath, 'utf8');

    // Split on semicolons, strip leading comment lines from each chunk,
    // then keep only chunks that contain actual SQL statements.
    const statements = sql
      .split(';')
      .map(s => {
        // Strip leading blank lines and full-line comments (-- ...)
        // This is critical because many SQL files have comment headers before
        // each CREATE TABLE / ALTER TABLE statement. Without stripping these,
        // the startsWith('--') filter would discard the entire chunk.
        return s.replace(/^(\s*--[^\n]*\n|\s*\n)*/g, '').trim();
      })
      .filter(s => s.length > 0);

    let applied = 0;
    let skipped = 0;

    for (const stmt of statements) {
      // Only run CREATE TABLE, CREATE VIEW, SET, ALTER, UPDATE, INSERT statements
      const upper = stmt.toUpperCase();
      if (
        !upper.startsWith('CREATE') &&
        !upper.startsWith('SET') &&
        !upper.startsWith('ALTER') &&
        !upper.startsWith('UPDATE') &&
        !upper.startsWith('INSERT')
      ) {
        continue;
      }

      try {
        await pool.query(stmt);
        applied++;
      } catch (err) {
        // Ignore "already exists" type errors
        if (
          err.errno === 1060 || // Duplicate column
          err.errno === 1061 || // Duplicate key name
          err.errno === 1050 || // Table already exists
          err.errno === 1091    // Can't drop column that doesn't exist
        ) {
          skipped++;
        } else {
          // Log but don't crash — let other statements continue
          logger.warn(`  ⚠ ${path.basename(filePath)}: ${err.message.substring(0, 120)}`);
        }
      }
    }

    logger.info(`  ✔ ${path.basename(filePath)}: ${applied} applied, ${skipped} already existed`);
  }

  logger.info('✅ Schema initialization complete');
}

module.exports = { ensureSchema };
