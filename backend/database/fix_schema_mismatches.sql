-- ═══════════════════════════════════════════════════════════════════════════
-- HealthConnect — Fix Schema Mismatches
-- Run: mysql -u root -p healthconnect_db < fix_schema_mismatches.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. health_records: add missing columns used by model ────────────────
ALTER TABLE health_records
  ADD COLUMN IF NOT EXISTS provider_name VARCHAR(255) NULL AFTER description,
  ADD COLUMN IF NOT EXISTS facility_name VARCHAR(255) NULL AFTER provider_name,
  ADD COLUMN IF NOT EXISTS icd10_code    VARCHAR(20)  NULL AFTER icd_code,
  ADD COLUMN IF NOT EXISTS created_by    VARCHAR(36)  NULL AFTER metadata;

-- Copy existing icd_code values into icd10_code if icd_code exists
UPDATE health_records SET icd10_code = icd_code WHERE icd10_code IS NULL AND icd_code IS NOT NULL;

-- ─── 2. health_record_access: restructure to match model ─────────────────
-- The model expects record-level access (record_id, granted_to, granted_by, access_level)
-- The schema has patient-level access (patient_id, doctor_id, permission)

-- Add missing columns if they don't exist
ALTER TABLE health_record_access
  ADD COLUMN IF NOT EXISTS record_id   VARCHAR(36) NULL AFTER id,
  ADD COLUMN IF NOT EXISTS granted_to  VARCHAR(36) NULL AFTER record_id,
  ADD COLUMN IF NOT EXISTS granted_by  VARCHAR(36) NULL AFTER granted_to,
  ADD COLUMN IF NOT EXISTS access_level ENUM('view','edit','full') NOT NULL DEFAULT 'view' AFTER granted_by,
  ADD COLUMN IF NOT EXISTS created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Migrate existing data: map doctor_id → granted_to, permission → access_level
UPDATE health_record_access
SET granted_to = doctor_id, granted_by = patient_id, access_level = permission
WHERE granted_to IS NULL AND doctor_id IS NOT NULL;

-- ─── 3. hospital_test_results: expand test_type ENUM ─────────────────────
ALTER TABLE hospital_test_results
  MODIFY COLUMN test_type ENUM('lab','imaging','pathology','cardiology','blood_test','urine_test','genetic','other')
  NOT NULL DEFAULT 'lab';
