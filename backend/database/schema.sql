-- ============================================================
-- HealthConnect — AI Symptom Checker & Telemedicine Platform
-- Database Schema — MySQL 8.0
-- Run: mysql -u root -p healthconnect_db < schema.sql
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';

-- ─── Users ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36)  NOT NULL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  phone         VARCHAR(20)  NULL,
  role          ENUM('patient','doctor','admin') NOT NULL DEFAULT 'patient',
  avatar_url    VARCHAR(500) NULL,
  google_id     VARCHAR(255) NULL UNIQUE,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  is_verified   TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email  (email),
  INDEX idx_role   (role),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── OTP Codes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_codes (
  user_id    VARCHAR(36)  NOT NULL PRIMARY KEY,
  code       VARCHAR(6)   NOT NULL,
  expires_at DATETIME     NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Refresh Tokens ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         VARCHAR(36)  NOT NULL PRIMARY KEY DEFAULT (UUID()),
  user_id    VARCHAR(36)  NOT NULL,
  token      TEXT         NOT NULL,
  expires_at DATETIME     NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Patients ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id                       VARCHAR(36)  NOT NULL PRIMARY KEY,
  user_id                  VARCHAR(36)  NOT NULL UNIQUE,
  date_of_birth            DATE         NULL,
  gender                   ENUM('male','female','other','prefer_not_to_say') NULL,
  blood_type               ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NULL,
  weight_kg                DECIMAL(5,2) NULL,
  height_cm                DECIMAL(5,2) NULL,
CREATE TABLE IF NOT EXISTS vital_signs (
  id                VARCHAR(36)   NOT NULL PRIMARY KEY,
  patient_id        VARCHAR(36)   NOT NULL,
  recorded_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  systolic_bp       INT           NULL,
  diastolic_bp      INT           NULL,
  heart_rate        INT           NULL,
  temperature       DECIMAL(4,1)  NULL,
  oxygen_sat        INT           NULL,
  respiratory_rate  INT           NULL,
  weight_kg         DECIMAL(5,2)  NULL,
  height_cm         DECIMAL(5,2)  NULL,
  blood_sugar       DECIMAL(6,2)  NULL,
  sugar_context     ENUM('fasting','post_meal','random') NOT NULL DEFAULT 'random',
  notes             TEXT          NULL,
  source            ENUM('manual','device','doctor') NOT NULL DEFAULT 'manual',
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  INDEX idx_patient_id (patient_id),
  INDEX idx_recorded_at (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  allergies                TEXT         NULL,
  chronic_conditions       TEXT         NULL,
  current_medications      TEXT         NULL,
  emergency_contact_name   VARCHAR(200) NULL,
  emergency_contact_phone  VARCHAR(20)  NULL,
  address                  TEXT         NULL,
  insurance_number         VARCHAR(100) NULL,
  created_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Doctors ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
  id                    VARCHAR(36)   NOT NULL PRIMARY KEY,
  user_id               VARCHAR(36)   NOT NULL UNIQUE,
  specialization        VARCHAR(200)  NULL,
  years_experience      INT           NULL DEFAULT 0,
  bio                   TEXT          NULL,
  license_number        VARCHAR(100)  NULL,
  hospital_affiliation  VARCHAR(255)  NULL,
  languages             VARCHAR(255)  NULL DEFAULT 'English',
  consultation_fee      DECIMAL(10,2) NULL DEFAULT 0.00,
  rating                DECIMAL(3,2)  NULL DEFAULT 0.00,
  total_reviews         INT           NULL DEFAULT 0,
  verification_status   ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  admin_note            TEXT          NULL,
  is_available          TINYINT(1)    NOT NULL DEFAULT 1,
  created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id             (user_id),
  INDEX idx_verification_status (verification_status),
  INDEX idx_specialization      (specialization)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Doctor Availability ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctor_availability (
  id           VARCHAR(36) NOT NULL PRIMARY KEY,
  doctor_id    VARCHAR(36) NOT NULL,
  day_of_week  TINYINT     NOT NULL COMMENT '0=Sunday, 1=Monday ... 6=Saturday',
  start_time   TIME        NOT NULL,
  end_time     TIME        NOT NULL,
  is_available TINYINT(1)  NOT NULL DEFAULT 1,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  INDEX idx_doctor_id (doctor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Reviews ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id          VARCHAR(36)  NOT NULL PRIMARY KEY DEFAULT (UUID()),
  doctor_id   VARCHAR(36)  NOT NULL,
  patient_id  VARCHAR(36)  NOT NULL,
  rating      TINYINT      NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id)  REFERENCES doctors(id)  ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  UNIQUE KEY unique_review (doctor_id, patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Symptom Master List ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS symptoms (
  id         VARCHAR(36)  NOT NULL PRIMARY KEY DEFAULT (UUID()),
  name       VARCHAR(200) NOT NULL UNIQUE,
  category   VARCHAR(100) NULL,
  synonyms   TEXT         NULL,
  icd10_hint VARCHAR(20)  NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Symptom Reports ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS symptom_reports (
  id            VARCHAR(36) NOT NULL PRIMARY KEY,
  patient_id    VARCHAR(36) NOT NULL,
  symptoms_raw  JSON        NOT NULL,
  ai_analysis   JSON        NULL,
  urgency_level ENUM('LOW','MEDIUM','HIGH','EMERGENCY') NOT NULL DEFAULT 'MEDIUM',
  session_id    VARCHAR(100) NULL,
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  INDEX idx_patient_id    (patient_id),
  INDEX idx_urgency_level (urgency_level),
  INDEX idx_created_at    (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Symptom Report Details ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS symptom_report_details (
  id               VARCHAR(36)   NOT NULL PRIMARY KEY,
  report_id        VARCHAR(36)   NOT NULL,
  condition_name   VARCHAR(255)  NOT NULL,
  icd10_code       VARCHAR(20)   NULL,
  probability      ENUM('high','medium','low') NOT NULL DEFAULT 'medium',
  confidence_score DECIMAL(5,2)  NULL DEFAULT 0,
  description      TEXT          NULL,
  FOREIGN KEY (report_id) REFERENCES symptom_reports(id) ON DELETE CASCADE,
  INDEX idx_report_id (report_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Appointments ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id                   VARCHAR(36) NOT NULL PRIMARY KEY,
  patient_id           VARCHAR(36) NOT NULL,
  doctor_id            VARCHAR(36) NOT NULL,
  symptom_report_id    VARCHAR(36) NULL,
  appointment_date     DATE        NOT NULL,
  appointment_time     TIME        NOT NULL,
  type                 ENUM('video','chat','in_person') NOT NULL DEFAULT 'video',
  status               ENUM('pending','confirmed','in_progress','completed','cancelled','no_show') NOT NULL DEFAULT 'pending',
  notes                TEXT        NULL,
  cancelled_by         VARCHAR(36) NULL,
  cancellation_reason  TEXT        NULL,
  created_at           DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id)        REFERENCES patients(id)        ON DELETE CASCADE,
  FOREIGN KEY (doctor_id)         REFERENCES doctors(id)         ON DELETE CASCADE,
  FOREIGN KEY (symptom_report_id) REFERENCES symptom_reports(id) ON DELETE SET NULL,
  INDEX idx_patient_id (patient_id),
  INDEX idx_doctor_id  (doctor_id),
  INDEX idx_status     (status),
  INDEX idx_date       (appointment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Consultations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consultations (
  id             VARCHAR(36)  NOT NULL PRIMARY KEY,
  appointment_id VARCHAR(36)  NOT NULL UNIQUE,
  room_id        VARCHAR(100) NOT NULL UNIQUE,
  status         ENUM('active','completed','cancelled') NOT NULL DEFAULT 'active',
  notes          TEXT         NULL,
  started_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at       DATETIME     NULL,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  INDEX idx_appointment_id (appointment_id),
  INDEX idx_room_id        (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Consultation Messages ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consultation_messages (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  consultation_id VARCHAR(36)  NOT NULL,
  sender_id       VARCHAR(36)  NOT NULL,
  sender_role     ENUM('patient','doctor') NOT NULL,
  message_type    ENUM('text','image','file','system') NOT NULL DEFAULT 'text',
  content         TEXT         NULL,
  file_url        VARCHAR(500) NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id)       REFERENCES users(id)         ON DELETE CASCADE,
  INDEX idx_consultation_id (consultation_id),
  INDEX idx_created_at      (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Prescriptions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescriptions (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  patient_id      VARCHAR(36)  NOT NULL,
  doctor_id       VARCHAR(36)  NOT NULL,
  consultation_id VARCHAR(36)  NULL,
  diagnosis       TEXT         NOT NULL,
  notes           TEXT         NULL,
  valid_until     DATE         NULL,
  status          ENUM('active','expired','cancelled') NOT NULL DEFAULT 'active',
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id)      REFERENCES patients(id)       ON DELETE CASCADE,
  FOREIGN KEY (doctor_id)       REFERENCES doctors(id)        ON DELETE CASCADE,
  FOREIGN KEY (consultation_id) REFERENCES consultations(id)  ON DELETE SET NULL,
  INDEX idx_patient_id (patient_id),
  INDEX idx_doctor_id  (doctor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Prescription Items ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescription_items (
  id               VARCHAR(36)  NOT NULL PRIMARY KEY,
  prescription_id  VARCHAR(36)  NOT NULL,
  medication_name  VARCHAR(255) NOT NULL,
  dosage           VARCHAR(100) NOT NULL,
  frequency        VARCHAR(100) NOT NULL,
  duration         VARCHAR(100) NULL,
  instructions     TEXT         NULL,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
  INDEX idx_prescription_id (prescription_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Payments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id                 VARCHAR(36)   NOT NULL PRIMARY KEY,
  patient_id         VARCHAR(36)   NOT NULL,
  appointment_id     VARCHAR(36)   NULL,
  amount             DECIMAL(10,2) NOT NULL,
  currency           VARCHAR(3)    NOT NULL DEFAULT 'USD',
  payment_method     VARCHAR(50)   NOT NULL,
  provider_reference VARCHAR(255)  NULL,
  status             ENUM('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
  created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id)    REFERENCES patients(id)     ON DELETE CASCADE,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  INDEX idx_patient_id (patient_id),
  INDEX idx_status     (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- ─── Emergency Contacts ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id                   VARCHAR(36)  NOT NULL PRIMARY KEY,
  patient_id           VARCHAR(36)  NOT NULL,
  name                 VARCHAR(200) NOT NULL,
  relationship         VARCHAR(100) NOT NULL,
  phone                VARCHAR(20)  NOT NULL,
  email                VARCHAR(255) NULL,
  is_primary           TINYINT(1)   NOT NULL DEFAULT 0,
  notify_on_emergency  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  INDEX idx_patient_id (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Emergency SOS Logs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emergency_sos_logs (
  id               VARCHAR(36)  NOT NULL PRIMARY KEY,
  patient_id       VARCHAR(36)  NOT NULL,
  latitude         DECIMAL(10,7) NULL,
  longitude        DECIMAL(10,7) NULL,
  address          TEXT          NULL,
  symptoms         JSON          NULL,
  vitals_snapshot  JSON          NULL,
  status           ENUM('triggered','acknowledged','resolved','cancelled') NOT NULL DEFAULT 'triggered',
  responded_by     VARCHAR(36)   NULL,
  responded_at     DATETIME      NULL,
  resolved_at      DATETIME      NULL,
  notes            TEXT          NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id)   REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (responded_by) REFERENCES users(id)    ON DELETE SET NULL,
  INDEX idx_patient_id (patient_id),
  INDEX idx_status     (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Drug Interaction Checks ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drug_interaction_checks (
  id            VARCHAR(36)  NOT NULL PRIMARY KEY,
  patient_id    VARCHAR(36)  NULL,
  medications   JSON         NOT NULL,
  interactions  JSON         NULL,
  severity      VARCHAR(50)  NULL,
  checked_by    VARCHAR(36)  NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
  FOREIGN KEY (checked_by) REFERENCES users(id)    ON DELETE SET NULL,
  INDEX idx_patient_id (patient_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- ─── Audit Logs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT       NOT NULL PRIMARY KEY AUTO_INCREMENT,
  user_id     VARCHAR(36)  NULL,
  action      VARCHAR(50)  NOT NULL,
  resource    VARCHAR(100) NOT NULL,
  method      VARCHAR(10)  NOT NULL,
  endpoint    VARCHAR(500) NOT NULL,
  ip_address  VARCHAR(45)  NULL,
  status_code INT          NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id    (user_id),
  INDEX idx_resource   (resource),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ─── Views ────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_patient_summary AS
SELECT
  p.id         AS patient_id,
  u.first_name, u.last_name, u.email, u.phone,
  p.date_of_birth, p.gender, p.blood_type,
  COUNT(DISTINCT a.id)   AS total_appointments,
  COUNT(DISTINCT sr.id)  AS total_symptom_checks,
  COUNT(DISTINCT rx.id)  AS total_prescriptions
FROM patients p
JOIN users u ON u.id = p.user_id
LEFT JOIN appointments    a  ON a.patient_id  = p.id
LEFT JOIN symptom_reports sr ON sr.patient_id = p.id
LEFT JOIN prescriptions   rx ON rx.patient_id = p.id
GROUP BY p.id;

CREATE OR REPLACE VIEW vw_doctor_summary AS
SELECT
  d.id AS doctor_id,
  u.first_name, u.last_name, u.email,
  d.specialization, d.rating, d.total_reviews,
  d.consultation_fee, d.verification_status,
  COUNT(DISTINCT a.id) AS total_appointments
FROM doctors d
JOIN users u ON u.id = d.user_id
LEFT JOIN appointments a ON a.doctor_id = d.id
GROUP BY d.id;

-- ─── Health Records (Universal Health Record) ─────────────────────────────
CREATE TABLE IF NOT EXISTS health_records (
  id          VARCHAR(36)  NOT NULL PRIMARY KEY DEFAULT (UUID()),
  patient_id  VARCHAR(36)  NOT NULL,
  doctor_id   VARCHAR(36)  NULL,
  record_type ENUM('diagnosis','condition','procedure','lab_result','allergy','medication','immunization','note') NOT NULL,
  title       VARCHAR(255) NOT NULL,
  description TEXT         NULL,
  severity    ENUM('mild','moderate','severe','critical') NULL,
  status      ENUM('active','resolved','chronic','managed') NOT NULL DEFAULT 'active',
  record_date DATE         NOT NULL,
  icd_code    VARCHAR(20)  NULL,
  metadata    JSON         NULL,
  attachments JSON         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id)  REFERENCES doctors(id)  ON DELETE SET NULL,
  INDEX idx_patient    (patient_id),
  INDEX idx_type       (record_type),
  INDEX idx_status     (status),
  INDEX idx_record_date(record_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Health Record Access Control ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS health_record_access (
  id         VARCHAR(36)  NOT NULL PRIMARY KEY DEFAULT (UUID()),
  patient_id VARCHAR(36)  NOT NULL,
  doctor_id  VARCHAR(36)  NOT NULL,
  permission ENUM('view','edit','full') NOT NULL DEFAULT 'view',
  granted_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME     NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id)  REFERENCES doctors(id)  ON DELETE CASCADE,
  UNIQUE KEY uq_access (patient_id, doctor_id),
  INDEX idx_doctor (doctor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Appointment Waitlist ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointment_waitlist (
  id             VARCHAR(36)  NOT NULL PRIMARY KEY DEFAULT (UUID()),
  patient_id     VARCHAR(36)  NOT NULL,
  doctor_id      VARCHAR(36)  NOT NULL,
  preferred_date DATE         NULL,
  preferred_time VARCHAR(10)  NULL,
  type           ENUM('video','in-person','chat') NOT NULL DEFAULT 'video',
  notes          TEXT         NULL,
  status         ENUM('waiting','notified','booked','expired','cancelled') NOT NULL DEFAULT 'waiting',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id)  REFERENCES doctors(id)  ON DELETE CASCADE,
  INDEX idx_doctor_status (doctor_id, status),
  INDEX idx_patient       (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
