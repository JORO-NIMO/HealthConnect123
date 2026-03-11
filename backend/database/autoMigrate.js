/**
 * HealthConnect — Auto-migrate
 * Runs idempotent ALTER TABLE statements on startup so the DB schema
 * matches what the models expect.  Each statement is wrapped in a
 * try/catch so a single failure (e.g. column already exists) never
 * prevents the rest from running.
 */

const { query } = require('../config/database');
const logger    = require('../utils/logger.util');

// ─── Helper: run a single DDL and swallow "duplicate column" errors ────────
async function safeExec(sql, label) {
  try {
    await query(sql);
    logger.info(`  ✔ ${label}`);
  } catch (err) {
    // ER_DUP_FIELDNAME (1060) = column already exists  → safe to ignore
    // ER_CANT_DROP_FIELD_OR_KEY (1091) = column/key doesn't exist → safe
    if (err.errno === 1060 || err.errno === 1091) {
      logger.info(`  ⏭ ${label} (already applied)`);
    } else {
      logger.warn(`  ⚠ ${label} — ${err.message}`);
    }
  }
}

// ─── Main migration runner ─────────────────────────────────────────────────
async function runMigrations() {
  logger.info('🔄 Running auto-migrations…');

  // ── 1. health_records: add columns the model uses ─────────────────────
  await safeExec(
    `ALTER TABLE health_records ADD COLUMN provider_name VARCHAR(255) NULL AFTER description`,
    'health_records.provider_name'
  );
  await safeExec(
    `ALTER TABLE health_records ADD COLUMN facility_name VARCHAR(255) NULL AFTER provider_name`,
    'health_records.facility_name'
  );
  await safeExec(
    `ALTER TABLE health_records ADD COLUMN icd10_code VARCHAR(20) NULL`,
    'health_records.icd10_code'
  );
  await safeExec(
    `ALTER TABLE health_records ADD COLUMN created_by VARCHAR(36) NULL`,
    'health_records.created_by'
  );

  // Copy icd_code → icd10_code for existing rows (idempotent)
  await safeExec(
    `UPDATE health_records SET icd10_code = icd_code WHERE icd10_code IS NULL AND icd_code IS NOT NULL`,
    'health_records: copy icd_code → icd10_code'
  );

  // ── 2. health_record_access: add record-level access columns ──────────
  await safeExec(
    `ALTER TABLE health_record_access ADD COLUMN record_id VARCHAR(36) NULL AFTER id`,
    'health_record_access.record_id'
  );
  await safeExec(
    `ALTER TABLE health_record_access ADD COLUMN granted_to VARCHAR(36) NULL AFTER record_id`,
    'health_record_access.granted_to'
  );
  await safeExec(
    `ALTER TABLE health_record_access ADD COLUMN granted_by VARCHAR(36) NULL AFTER granted_to`,
    'health_record_access.granted_by'
  );
  await safeExec(
    `ALTER TABLE health_record_access ADD COLUMN access_level ENUM('view','edit','full') NOT NULL DEFAULT 'view'`,
    'health_record_access.access_level'
  );
  await safeExec(
    `ALTER TABLE health_record_access ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    'health_record_access.created_at'
  );

  // Migrate old patient_id/doctor_id → granted_by/granted_to
  await safeExec(
    `UPDATE health_record_access SET granted_to = doctor_id, granted_by = patient_id WHERE granted_to IS NULL AND doctor_id IS NOT NULL`,
    'health_record_access: migrate old → new columns'
  );

  // ── 3. hospital_test_results: expand test_type ENUM ───────────────────
  await safeExec(
    `ALTER TABLE hospital_test_results MODIFY COLUMN test_type ENUM('lab','imaging','pathology','cardiology','blood_test','urine_test','genetic','other') NOT NULL DEFAULT 'lab'`,
    'hospital_test_results: expand test_type ENUM'
  );

  logger.info('✅ Auto-migrations complete');
}

module.exports = { runMigrations };
