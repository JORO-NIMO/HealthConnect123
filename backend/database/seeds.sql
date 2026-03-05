-- ============================================================
-- HealthConnect — Seed Data
-- Run AFTER schema.sql
-- mysql -u root -p healthconnect_db < seeds.sql
-- ============================================================

-- ─── Admin User (password: Admin@123456) ─────────────────────────────────
INSERT IGNORE INTO users (id, email, password_hash, first_name, last_name, phone, role, is_active, is_verified)
VALUES (
  'admin-0000-0000-0000-000000000001',
  'admin@healthconnect.health',
  '$2a$12$zva05J613fj2h3tu6C29EOL38R.lYqsDvEke4jQUXNy89m/ydqWPq',
  'System', 'Admin', '+254700000001', 'admin', 1, 1
);

-- ─── Demo Doctor (password: Doctor@123456) ───────────────────────────────
INSERT IGNORE INTO users (id, email, password_hash, first_name, last_name, phone, role, is_active, is_verified)
VALUES (
  'doctor-000-0000-0000-000000000001',
  'dr.amara@healthconnect.health',
  '$2a$12$qI7NIeZk08fCtW.QNdKIZOkvs1O43nTf1VsM5sqSHwWsQ0b0V/gr.',
  'Amara', 'Osei', '+254711000001', 'doctor', 1, 1
);
INSERT IGNORE INTO doctors (id, user_id, specialization, years_experience, bio, license_number, consultation_fee, rating, total_reviews, verification_status)
VALUES (
  'dprof-000-0000-0000-000000000001',
  'doctor-000-0000-0000-000000000001',
  'General Medicine', 8,
  'Dr. Amara Osei is an experienced general practitioner with 8 years of experience in primary care, infectious diseases, and preventive medicine across East Africa.',
  'MD-KE-12345', 25.00, 4.8, 47, 'verified'
);

INSERT IGNORE INTO users (id, email, password_hash, first_name, last_name, phone, role, is_active, is_verified)
VALUES (
  'doctor-000-0000-0000-000000000002',
  'dr.fatima@healthconnect.health',
  '$2a$12$qI7NIeZk08fCtW.QNdKIZOkvs1O43nTf1VsM5sqSHwWsQ0b0V/gr.',
  'Fatima', 'Al-Hassan', '+254711000002', 'doctor', 1, 1
);
INSERT IGNORE INTO doctors (id, user_id, specialization, years_experience, bio, license_number, consultation_fee, rating, total_reviews, verification_status)
VALUES (
  'dprof-000-0000-0000-000000000002',
  'doctor-000-0000-0000-000000000002',
  'Pediatrics', 12,
  'Dr. Fatima Al-Hassan is a board-certified pediatrician with over 12 years of experience in child healthcare, nutrition, and developmental medicine.',
  'MD-KE-67890', 30.00, 4.9, 83, 'verified'
);

-- ─── Demo Patient (password: Patient@123456) ─────────────────────────────
INSERT IGNORE INTO users (id, email, password_hash, first_name, last_name, phone, role, is_active, is_verified)
VALUES (
  'patient-00-0000-0000-000000000001',
  'john.doe@example.com',
  '$2a$12$2oUgWxIEEO5gPrCIzN1.Fe4emzdB1w.fEo8GgfV0mDb/.co5gd6gi',
  'John', 'Doe', '+254722000001', 'patient', 1, 1
);
INSERT IGNORE INTO patients (id, user_id, date_of_birth, gender, blood_type)
VALUES ('pprof-000-0000-0000-000000000001', 'patient-00-0000-0000-000000000001', '1990-05-15', 'male', 'O+');

-- ─── Doctor Availability ──────────────────────────────────────────────────
INSERT IGNORE INTO doctor_availability (id, doctor_id, day_of_week, start_time, end_time)
VALUES
  (UUID(), 'dprof-000-0000-0000-000000000001', 1, '08:00:00', '17:00:00'),
  (UUID(), 'dprof-000-0000-0000-000000000001', 2, '08:00:00', '17:00:00'),
  (UUID(), 'dprof-000-0000-0000-000000000001', 3, '08:00:00', '17:00:00'),
  (UUID(), 'dprof-000-0000-0000-000000000001', 4, '08:00:00', '17:00:00'),
  (UUID(), 'dprof-000-0000-0000-000000000001', 5, '08:00:00', '12:00:00'),
  (UUID(), 'dprof-000-0000-0000-000000000002', 1, '09:00:00', '18:00:00'),
  (UUID(), 'dprof-000-0000-0000-000000000002', 3, '09:00:00', '18:00:00'),
  (UUID(), 'dprof-000-0000-0000-000000000002', 5, '09:00:00', '13:00:00');

-- ─── Symptom Master List ──────────────────────────────────────────────────
INSERT IGNORE INTO symptoms (name, category, icd10_hint) VALUES
('Fever',                    'General',         'R50'),
('Headache',                 'Neurological',    'R51'),
('Fatigue',                  'General',         'R53'),
('Cough',                    'Respiratory',     'R05'),
('Shortness of breath',      'Respiratory',     'R06.0'),
('Chest pain',               'Cardiovascular',  'R07'),
('Nausea',                   'Gastrointestinal','R11'),
('Vomiting',                 'Gastrointestinal','R11'),
('Diarrhea',                 'Gastrointestinal','R19.7'),
('Abdominal pain',           'Gastrointestinal','R10'),
('Sore throat',              'ENT',             'R07.0'),
('Runny nose',               'ENT',             'R09.89'),
('Joint pain',               'Musculoskeletal', 'M25.5'),
('Back pain',                'Musculoskeletal', 'M54'),
('Skin rash',                'Dermatological',  'R21'),
('Dizziness',                'Neurological',    'R42'),
('Swollen lymph nodes',      'General',         'R59'),
('Loss of appetite',         'General',         'R63.0'),
('Night sweats',             'General',         'R61'),
('Weight loss',              'General',         'R63.4'),
('Chills',                   'General',         'R68.83'),
('Muscle aches',             'Musculoskeletal', 'M79.1'),
('Eye redness',              'Ophthalmological','H10'),
('Frequent urination',       'Urological',      'R35'),
('Painful urination',        'Urological',      'R30.0'),
('Blurred vision',           'Ophthalmological','H54'),
('Swelling',                 'General',         'R60'),
('Bleeding',                 'General',         'R58'),
('Difficulty swallowing',    'ENT',             'R13'),
('Palpitations',             'Cardiovascular',  'R00.2');
