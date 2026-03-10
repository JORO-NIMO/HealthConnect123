-- ============================================================
-- HealthConnect — Database Optimization & Indexing
-- Run this after initial schema setup for better performance
-- ============================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- COMPOSITE INDEXES for common queries
-- ═══════════════════════════════════════════════════════════════════════════

-- Appointments: frequently filtered by patient + date + status
CREATE INDEX idx_appointments_patient_date_status 
  ON appointments(patient_id, appointment_date, status);

-- Appointments: frequently filtered by doctor + date + status
CREATE INDEX idx_appointments_doctor_date_status 
  ON appointments(doctor_id, appointment_date, status);

-- Consultations: frequently queried by appointment + status
CREATE INDEX idx_consultations_appointment_status 
  ON consultations(appointment_id, status);

-- Symptom reports: frequently filtered by patient + date
CREATE INDEX idx_symptom_reports_patient_created 
  ON symptom_reports(patient_id, created_at DESC);

-- Vital signs: frequently queried by patient + recorded date
CREATE INDEX idx_vital_signs_patient_recorded 
  ON vital_signs(patient_id, recorded_at DESC);

-- Medical documents: frequently filtered by patient + type + date
CREATE INDEX idx_medical_documents_patient_type_date 
  ON medical_documents(patient_id, document_type, uploaded_at DESC);

-- Notifications: frequently filtered by user + read status + date
CREATE INDEX idx_notifications_user_read_created 
  ON notifications(user_id, is_read, created_at DESC);

-- Hospital-Doctor relationship
CREATE INDEX idx_hospital_doctors_hospital_status 
  ON hospital_doctors(hospital_id, status);

CREATE INDEX idx_hospital_doctors_doctor_status 
  ON hospital_doctors(doctor_id, status);

-- Hospital-Patient relationship
CREATE INDEX idx_hospital_patients_hospital_status 
  ON hospital_patients(hospital_id, status);

CREATE INDEX idx_hospital_patients_patient_status 
  ON hospital_patients(patient_id, status);

-- Test results: frequently filtered by patient + hospital + status
CREATE INDEX idx_test_results_patient_status 
  ON test_results(patient_id, status, completed_at DESC);

CREATE INDEX idx_test_results_hospital_status 
  ON test_results(hospital_id, status, created_at DESC);

-- Payments: frequently filtered by patient + status + date
CREATE INDEX idx_payments_patient_status_date 
  ON payments(patient_id, payment_status, created_at DESC);

-- Emergency: frequently filtered by patient + status
CREATE INDEX idx_emergency_contacts_patient_status 
  ON emergency_contacts(patient_id, status);

-- Reviews: frequently filtered by doctor + created date
CREATE INDEX idx_reviews_doctor_created 
  ON reviews(doctor_id, created_at DESC);

-- Waitlist: frequently filtered by doctor + status
CREATE INDEX idx_waitlist_doctor_status 
  ON waitlist_entries(doctor_id, status);

-- ═══════════════════════════════════════════════════════════════════════════
-- FULL TEXT SEARCH indexes for text searching
-- ═══════════════════════════════════════════════════════════════════════════

-- Search hospitals by name, city, specializations
ALTER TABLE hospitals ADD FULLTEXT INDEX ft_hospitals_search (name, city, address);

-- Search doctors by name, specialization, bio
ALTER TABLE doctors ADD FULLTEXT INDEX ft_doctors_search (specialization, hospital_affiliation);

-- Search medical documents by title, description
ALTER TABLE medical_documents ADD FULLTEXT INDEX ft_documents_search (title, description);

-- ═══════════════════════════════════════════════════════════════════════════
-- SPATIAL INDEXES for geolocation queries
-- ═══════════════════════════════════════════════════════════════════════════

-- For nearby hospital searches (already using Haversine formula)
-- Additional spatial index if we convert to POINT type later
-- ALTER TABLE hospitals ADD SPATIAL INDEX idx_hospitals_location (location);

-- ═══════════════════════════════════════════════════════════════════════════
-- COVERING INDEXES for frequently accessed columns
-- ═══════════════════════════════════════════════════════════════════════════

-- Users: frequently need email + role + active status
CREATE INDEX idx_users_email_role_active 
  ON users(email, role, is_active);

-- Doctors: frequently need verification status + availability + specialization
CREATE INDEX idx_doctors_verification_available_spec 
  ON doctors(verification_status, is_available, specialization);

-- ═══════════════════════════════════════════════════════════════════════════
-- ANALYZE TABLES to update statistics
-- ═══════════════════════════════════════════════════════════════════════════

ANALYZE TABLE users;
ANALYZE TABLE patients;
ANALYZE TABLE doctors;
ANALYZE TABLE appointments;
ANALYZE TABLE consultations;
ANALYZE TABLE symptom_reports;
ANALYZE TABLE vital_signs;
ANALYZE TABLE medical_documents;
ANALYZE TABLE hospitals;
ANALYZE TABLE hospital_doctors;
ANALYZE TABLE hospital_patients;
ANALYZE TABLE test_results;
ANALYZE TABLE payments;
ANALYZE TABLE notifications;
ANALYZE TABLE reviews;
ANALYZE TABLE waitlist_entries;
ANALYZE TABLE emergency_contacts;

-- ═══════════════════════════════════════════════════════════════════════════
-- QUERY OPTIMIZATION HINTS
-- ═══════════════════════════════════════════════════════════════════════════

-- Use these guidelines in your application:
-- 1. Always use parameterized queries (already done with pool.execute)
-- 2. Use LIMIT for large result sets (already implemented)
-- 3. Avoid SELECT * - specify columns (consider refactoring)
-- 4. Use JOIN instead of subqueries when possible
-- 5. Cache frequently accessed data (consider Redis)
-- 6. Use transactions for multiple related queries
-- 7. Monitor slow queries with:
--    SET GLOBAL slow_query_log = 'ON';
--    SET GLOBAL long_query_time = 2;

-- ═══════════════════════════════════════════════════════════════════════════
-- MAINTENANCE QUERIES (run periodically)
-- ═══════════════════════════════════════════════════════════════════════════

-- Check index usage:
-- SELECT * FROM sys.schema_unused_indexes;

-- Check table sizes:
-- SELECT 
--   table_name,
--   ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb
-- FROM information_schema.tables
-- WHERE table_schema = 'healthconnect_db'
-- ORDER BY size_mb DESC;

-- Optimize tables:
-- OPTIMIZE TABLE appointments, consultations, symptom_reports;
