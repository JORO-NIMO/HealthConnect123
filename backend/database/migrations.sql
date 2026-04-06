-- ═══════════════════════════════════════════════════════════════════════════
-- HealthConnect — Feature Enhancement Migrations
-- New tables for: Vital Signs, Medical Documents, Notifications,
--                 Emergency Contacts, Doctor Reviews
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Vital Signs Tracking ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vital_signs (
  id            CHAR(36) PRIMARY KEY,
  patient_id    CHAR(36) NOT NULL,
  recorded_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Core vitals
  systolic_bp   INT          DEFAULT NULL COMMENT 'mmHg',
  diastolic_bp  INT          DEFAULT NULL COMMENT 'mmHg',
  heart_rate    INT          DEFAULT NULL COMMENT 'bpm',
  temperature   DECIMAL(4,1) DEFAULT NULL COMMENT '°C',
  oxygen_sat    INT          DEFAULT NULL COMMENT 'SpO2 %',
  respiratory_rate INT       DEFAULT NULL COMMENT 'breaths/min',

  -- Body measurements
  weight_kg     DECIMAL(5,1) DEFAULT NULL,
  height_cm     DECIMAL(5,1) DEFAULT NULL,

  -- Diabetes-specific
  blood_sugar   DECIMAL(5,1) DEFAULT NULL COMMENT 'mg/dL',
  sugar_context ENUM('fasting','before_meal','after_meal','bedtime','random') DEFAULT 'random',

  -- Context
  notes         TEXT         DEFAULT NULL,
  source        ENUM('manual','device','wearable') DEFAULT 'manual',

  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  INDEX idx_vitals_patient (patient_id),
  INDEX idx_vitals_recorded (recorded_at),
  INDEX idx_vitals_patient_date (patient_id, recorded_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── 2. Medical Document Vault ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_documents (
  id            CHAR(36) PRIMARY KEY,
  patient_id    CHAR(36) NOT NULL,
  uploaded_by   CHAR(36) NOT NULL COMMENT 'user_id of uploader (patient or doctor)',

  title         VARCHAR(200) NOT NULL,
  description   TEXT          DEFAULT NULL,
  doc_type      ENUM('lab_result','imaging','prescription','discharge_summary',
                     'insurance','vaccination','referral','other') NOT NULL DEFAULT 'other',
  file_url      VARCHAR(500) NOT NULL,
  file_name     VARCHAR(255) NOT NULL,
  file_size     INT           NOT NULL COMMENT 'bytes',
  mime_type     VARCHAR(100)  NOT NULL,

  -- Metadata
  doc_date      DATE          DEFAULT NULL COMMENT 'Date of the document (e.g., lab date)',
  facility      VARCHAR(200)  DEFAULT NULL COMMENT 'Hospital or lab name',
  doctor_name   VARCHAR(200)  DEFAULT NULL,
  tags          JSON          DEFAULT NULL,

  is_sensitive  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  INDEX idx_docs_patient (patient_id),
  INDEX idx_docs_type (doc_type),
  INDEX idx_docs_date (doc_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── 2b. Doctor Verification Documents ───────────────────────────────────
CREATE TABLE IF NOT EXISTS doctor_verification_documents (
  id            CHAR(36) PRIMARY KEY,
  doctor_id     CHAR(36) NOT NULL,
  uploaded_by   CHAR(36) NOT NULL,
  document_type ENUM('license','hospital_id','id_card','certificate','other') NOT NULL DEFAULT 'other',
  file_url      VARCHAR(500) NOT NULL,
  file_name     VARCHAR(255) NOT NULL,
  file_size     INT NOT NULL,
  mime_type     VARCHAR(120) NOT NULL,
  notes         TEXT DEFAULT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_doc_ver_doctor (doctor_id),
  INDEX idx_doc_ver_type (document_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── 3. In-App Notifications ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          CHAR(36) PRIMARY KEY,
  user_id     CHAR(36) NOT NULL,
  title       VARCHAR(200)  NOT NULL,
  message     TEXT          NOT NULL,
  type        ENUM('appointment','consultation','prescription','vitals',
                   'emergency','system','review','document','reminder','payment') NOT NULL DEFAULT 'system',
  action_url  VARCHAR(500)  DEFAULT NULL COMMENT 'Deep link to relevant page',
  metadata    JSON          DEFAULT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  read_at     DATETIME      DEFAULT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user (user_id),
  INDEX idx_notif_unread (user_id, is_read),
  INDEX idx_notif_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── 4. Emergency Contacts (enhanced) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id          CHAR(36) PRIMARY KEY,
  patient_id  CHAR(36) NOT NULL,
  name        VARCHAR(100) NOT NULL,
  relationship VARCHAR(50) NOT NULL,
  phone       VARCHAR(20)  NOT NULL,
  email       VARCHAR(100) DEFAULT NULL,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  notify_on_emergency BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  INDEX idx_emergency_patient (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── 5. Emergency SOS Logs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emergency_sos_logs (
  id          CHAR(36) PRIMARY KEY,
  patient_id  CHAR(36) NOT NULL,
  latitude    DECIMAL(10,7) DEFAULT NULL,
  longitude   DECIMAL(10,7) DEFAULT NULL,
  address     TEXT          DEFAULT NULL,
  symptoms    JSON          DEFAULT NULL,
  vitals_snapshot JSON      DEFAULT NULL COMMENT 'Latest vital signs at time of SOS',
  idempotency_key VARCHAR(128) DEFAULT NULL,
  status      ENUM('triggered','acknowledged','responded','resolved','false_alarm')
                NOT NULL DEFAULT 'triggered',
  notes       TEXT          DEFAULT NULL,
  responded_by CHAR(36)    DEFAULT NULL COMMENT 'doctor/admin user_id',
  responded_at DATETIME    DEFAULT NULL,
  resolved_at  DATETIME    DEFAULT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (responded_by) REFERENCES users(id),
  UNIQUE KEY uq_sos_patient_idem (patient_id, idempotency_key),
  INDEX idx_sos_patient (patient_id),
  INDEX idx_sos_status (status),
  INDEX idx_sos_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── 5b. Emergency SOS Dispatch Targets ────────────────────────────────
CREATE TABLE IF NOT EXISTS emergency_sos_dispatch_targets (
  sos_id        CHAR(36) NOT NULL,
  hospital_id   CHAR(36) NOT NULL,
  status        ENUM('pending','claimed','stand_down') NOT NULL DEFAULT 'pending',
  claimed_by    CHAR(36) NULL,
  claimed_at    DATETIME NULL,
  dispatched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (sos_id, hospital_id),
  FOREIGN KEY (sos_id) REFERENCES emergency_sos_logs(id) ON DELETE CASCADE,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE,
  FOREIGN KEY (claimed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_dispatch_hospital_status (hospital_id, status),
  INDEX idx_dispatch_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── 6. Drug Interaction Logs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drug_interaction_checks (
  id          CHAR(36) PRIMARY KEY,
  patient_id  CHAR(36)     DEFAULT NULL,
  medications JSON         NOT NULL COMMENT 'Array of medication names checked',
  interactions JSON        NOT NULL COMMENT 'AI-generated interaction results',
  severity    ENUM('none','mild','moderate','severe','contraindicated') NOT NULL DEFAULT 'none',
  checked_by  CHAR(36)     DEFAULT NULL COMMENT 'user_id',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
  INDEX idx_drug_patient (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── 7. Health Goals (Chronic Disease Management) ─────────────────────────
CREATE TABLE IF NOT EXISTS health_goals (
  id          CHAR(36) PRIMARY KEY,
  patient_id  CHAR(36) NOT NULL,
  goal_type   ENUM('blood_pressure','blood_sugar','weight','heart_rate',
                   'exercise','medication_adherence','other') NOT NULL,
  title       VARCHAR(200) NOT NULL,
  target_value VARCHAR(100) DEFAULT NULL COMMENT 'e.g. "<130/80", "<100 mg/dL"',
  current_value VARCHAR(100) DEFAULT NULL,
  unit        VARCHAR(30)  DEFAULT NULL,
  start_date  DATE NOT NULL,
  target_date DATE         DEFAULT NULL,
  status      ENUM('active','achieved','missed','paused') NOT NULL DEFAULT 'active',
  notes       TEXT         DEFAULT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  INDEX idx_goals_patient (patient_id),
  INDEX idx_goals_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── 8. Medication Reminders ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medication_reminders (
  id              CHAR(36) PRIMARY KEY,
  patient_id      CHAR(36) NOT NULL,
  prescription_id CHAR(36)      DEFAULT NULL,
  medication_name VARCHAR(200) NOT NULL,
  dosage          VARCHAR(100) NOT NULL,
  frequency       VARCHAR(100) NOT NULL COMMENT 'e.g. twice_daily, every_8_hours',
  reminder_times  JSON         NOT NULL COMMENT '["08:00","20:00"]',
  start_date      DATE NOT NULL,
  end_date        DATE         DEFAULT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT         DEFAULT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL,
  INDEX idx_reminders_patient (patient_id),
  INDEX idx_reminders_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS medication_adherence (
  id          CHAR(36) PRIMARY KEY,
  reminder_id CHAR(36) NOT NULL,
  scheduled_at DATETIME NOT NULL,
  taken_at     DATETIME DEFAULT NULL,
  status       ENUM('pending','taken','missed','skipped') NOT NULL DEFAULT 'pending',
  notes        TEXT     DEFAULT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (reminder_id) REFERENCES medication_reminders(id) ON DELETE CASCADE,
  INDEX idx_adherence_reminder (reminder_id),
  INDEX idx_adherence_scheduled (scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
