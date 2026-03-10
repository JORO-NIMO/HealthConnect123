-- ============================================================
-- HealthConnect — Hospital Integration & Location Features
-- Migration Script — MySQL 8.0
-- Run: mysql -u root -p healthconnect_db < hospital_migration.sql
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ─── Update users role to support hospital_admin ──────────────────────────
ALTER TABLE users 
  MODIFY COLUMN role ENUM('patient','doctor','admin','hospital_admin') NOT NULL DEFAULT 'patient';

-- ─── Add location fields to patients ──────────────────────────────────────
ALTER TABLE patients
  ADD COLUMN latitude  DECIMAL(10,7) NULL AFTER address,
  ADD COLUMN longitude DECIMAL(10,7) NULL AFTER latitude,
  ADD COLUMN city      VARCHAR(100)  NULL AFTER longitude,
  ADD COLUMN state     VARCHAR(100)  NULL AFTER city,
  ADD COLUMN country   VARCHAR(100)  NULL DEFAULT 'Uganda' AFTER state,
  ADD INDEX idx_location (latitude, longitude);

-- ─── Add location fields to doctors ───────────────────────────────────────
ALTER TABLE doctors
  ADD COLUMN latitude       DECIMAL(10,7) NULL AFTER is_available,
  ADD COLUMN longitude      DECIMAL(10,7) NULL AFTER latitude,
  ADD COLUMN city            VARCHAR(100)  NULL AFTER longitude,
  ADD COLUMN state           VARCHAR(100)  NULL AFTER city,
  ADD COLUMN country         VARCHAR(100)  NULL DEFAULT 'Uganda' AFTER state,
  ADD COLUMN accepts_in_person TINYINT(1) NOT NULL DEFAULT 1 AFTER country,
  ADD INDEX idx_location (latitude, longitude),
  ADD INDEX idx_city     (city);

-- ─── Hospitals ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hospitals (
  id                    VARCHAR(36)   NOT NULL PRIMARY KEY,
  admin_user_id         VARCHAR(36)   NULL COMMENT 'The user account managing this hospital',
  name                  VARCHAR(255)  NOT NULL,
  registration_number   VARCHAR(100)  NULL UNIQUE,
  type                  ENUM('general','specialist','clinic','pharmacy','lab','teaching') NOT NULL DEFAULT 'general',
  description           TEXT          NULL,
  phone                 VARCHAR(20)   NULL,
  email                 VARCHAR(255)  NULL,
  website               VARCHAR(500)  NULL,
  logo_url              VARCHAR(500)  NULL,

  -- Location
  address               TEXT          NULL,
  city                  VARCHAR(100)  NULL,
  state                 VARCHAR(100)  NULL,
  country               VARCHAR(100)  NULL DEFAULT 'Uganda',
  latitude              DECIMAL(10,7) NULL,
  longitude             DECIMAL(10,7) NULL,

  -- Capabilities
  specializations       JSON          NULL COMMENT '["Cardiology","Dermatology","General Practice"]',
  services              JSON          NULL COMMENT '["Lab Tests","X-Ray","Pharmacy","Surgery"]',
  operating_hours       JSON          NULL COMMENT '{"mon":"08:00-17:00","tue":"08:00-17:00",...}',
  emergency_available   TINYINT(1)    NOT NULL DEFAULT 0,
  bed_count             INT           NULL DEFAULT 0,

  -- Status
  verification_status   ENUM('pending','verified','rejected','suspended') NOT NULL DEFAULT 'pending',
  admin_note            TEXT          NULL,
  is_active             TINYINT(1)   NOT NULL DEFAULT 1,
  rating                DECIMAL(3,2) NULL DEFAULT 0.00,
  total_reviews         INT          NULL DEFAULT 0,

  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_admin_user  (admin_user_id),
  INDEX idx_type        (type),
  INDEX idx_city        (city),
  INDEX idx_location    (latitude, longitude),
  INDEX idx_status      (verification_status),
  INDEX idx_active      (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Hospital–Doctor Link ─────────────────────────────────────────────────
-- A doctor can be affiliated with multiple hospitals
CREATE TABLE IF NOT EXISTS hospital_doctors (
  id            VARCHAR(36)  NOT NULL PRIMARY KEY DEFAULT (UUID()),
  hospital_id   VARCHAR(36)  NOT NULL,
  doctor_id     VARCHAR(36)  NOT NULL,
  department    VARCHAR(200) NULL,
  position      VARCHAR(200) NULL COMMENT 'e.g. Consultant, Resident, HOD',
  employment_type ENUM('full_time','part_time','visiting','contract') NOT NULL DEFAULT 'full_time',
  status        ENUM('active','inactive','pending') NOT NULL DEFAULT 'pending',
  joined_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at       DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id)   REFERENCES doctors(id)   ON DELETE CASCADE,
  UNIQUE KEY uq_hospital_doctor (hospital_id, doctor_id),
  INDEX idx_hospital (hospital_id),
  INDEX idx_doctor   (doctor_id),
  INDEX idx_status   (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Hospital–Patient Link ────────────────────────────────────────────────
-- A patient can be registered at multiple hospitals
CREATE TABLE IF NOT EXISTS hospital_patients (
  id             VARCHAR(36)  NOT NULL PRIMARY KEY DEFAULT (UUID()),
  hospital_id    VARCHAR(36)  NOT NULL,
  patient_id     VARCHAR(36)  NOT NULL,
  hospital_number VARCHAR(100) NULL COMMENT 'Hospital-assigned patient ID / file number',
  status         ENUM('active','inactive','discharged') NOT NULL DEFAULT 'active',
  registered_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_visit     DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id)  REFERENCES patients(id)  ON DELETE CASCADE,
  UNIQUE KEY uq_hospital_patient (hospital_id, patient_id),
  INDEX idx_hospital (hospital_id),
  INDEX idx_patient  (patient_id),
  INDEX idx_status   (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Hospital Test Results / Reports ──────────────────────────────────────
-- Hospitals can send lab results, imaging reports, etc. to patients
CREATE TABLE IF NOT EXISTS hospital_test_results (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY DEFAULT (UUID()),
  hospital_id     VARCHAR(36)  NOT NULL,
  patient_id      VARCHAR(36)  NOT NULL,
  doctor_id       VARCHAR(36)  NULL COMMENT 'Requesting doctor (if any)',
  test_type       ENUM('lab','imaging','pathology','cardiology','other') NOT NULL DEFAULT 'lab',
  test_name       VARCHAR(255) NOT NULL,
  description     TEXT         NULL,
  results         JSON         NULL COMMENT 'Structured results data',
  result_summary  TEXT         NULL,
  file_url        VARCHAR(500) NULL COMMENT 'PDF / image attachment',
  status          ENUM('ordered','in_progress','completed','cancelled') NOT NULL DEFAULT 'ordered',
  ordered_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at    DATETIME     NULL,
  notes           TEXT         NULL,
  is_critical     TINYINT(1)   NOT NULL DEFAULT 0,
  viewed_by_patient TINYINT(1) NOT NULL DEFAULT 0,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id)  REFERENCES patients(id)  ON DELETE CASCADE,
  FOREIGN KEY (doctor_id)   REFERENCES doctors(id)   ON DELETE SET NULL,
  INDEX idx_hospital   (hospital_id),
  INDEX idx_patient    (patient_id),
  INDEX idx_doctor     (doctor_id),
  INDEX idx_status     (status),
  INDEX idx_test_type  (test_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Hospital Appointments ────────────────────────────────────────────────
-- Appointments can now optionally be linked to a hospital
ALTER TABLE appointments
  ADD COLUMN hospital_id VARCHAR(36) NULL AFTER doctor_id,
  ADD FOREIGN KEY fk_appointment_hospital (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL,
  ADD INDEX idx_hospital_id (hospital_id);

-- ─── Hospital Reviews ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hospital_reviews (
  id          VARCHAR(36)  NOT NULL PRIMARY KEY DEFAULT (UUID()),
  hospital_id VARCHAR(36)  NOT NULL,
  patient_id  VARCHAR(36)  NOT NULL,
  rating      TINYINT      NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id)  REFERENCES patients(id)  ON DELETE CASCADE,
  UNIQUE KEY unique_hospital_review (hospital_id, patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Update Views ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_hospital_summary AS
SELECT
  h.id AS hospital_id,
  h.name, h.type, h.city, h.state, h.country,
  h.verification_status, h.rating, h.total_reviews,
  h.emergency_available, h.bed_count,
  COUNT(DISTINCT hd.id) AS total_doctors,
  COUNT(DISTINCT hp.id) AS total_patients,
  COUNT(DISTINCT htr.id) AS total_test_results
FROM hospitals h
LEFT JOIN hospital_doctors      hd  ON hd.hospital_id  = h.id AND hd.status = 'active'
LEFT JOIN hospital_patients     hp  ON hp.hospital_id  = h.id AND hp.status = 'active'
LEFT JOIN hospital_test_results htr ON htr.hospital_id = h.id
GROUP BY h.id;

SET FOREIGN_KEY_CHECKS = 1;
