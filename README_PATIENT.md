# HealthConnect Patient Guide

## Overview
HealthConnect helps patients move from symptom check to treatment in one flow: AI-assisted triage, doctor access, records, payments, and emergency response.

## What A Patient Can Do

### 1. Account And Profile
- Register and log in (email/password, OTP, and Google OAuth where enabled).
- Update patient profile data.
- Upload profile avatar.
- View personal dashboard stats.

### 2. AI Symptom Analysis
- Browse symptom list.
- Submit symptom analysis request.
- Receive urgency classification (LOW, MEDIUM, HIGH, EMERGENCY).
- Ask follow-up symptom questions.
- View symptom history and specific reports.

### 3. Doctor Discovery
- Browse verified doctors.
- Search doctors.
- Find nearby doctors.
- Receive doctor recommendations based on symptom context.
- View doctor profiles and availability.

### 4. Appointment Management
- Book appointments with doctors.
- View personal appointment list.
- View appointment details.
- Cancel appointments.

### 5. Consultation Experience
- Join consultations.
- Exchange chat messages in-session.
- Participate in video consultation workflow.
- View consultation history/details where authorized.

### 6. Prescriptions And Medical History
- View issued prescriptions.
- View medical history summary.
- Access timeline-style record history through Health Records.

### 7. Vitals Tracking
- Record vital signs.
- View latest readings.
- View trends and averages.
- View alerts for out-of-range values.
- Delete incorrect entries.

### 8. Health Records
- Create and manage personal health records.
- View timeline and summary views.
- Grant and revoke record access for clinicians.

### 9. Medical Documents
- Upload medical documents (PDF/images/selected office formats).
- List, view, update, and delete owned documents.

### 10. Payments
- Create card payment intents.
- Initiate mobile money payment flow.
- View payment history.
- View payment info for a specific appointment.

### 11. Hospital Features
- View hospitals you are linked to.
- View your test results from linked hospitals.
- View a specific test result detail.

### 12. Reviews And Waitlist
- Submit, update, and delete doctor reviews.
- Join doctor waitlists.
- View your waitlist entries.
- Cancel your waitlist entries.
- Check waitlist count.

### 13. Notifications
- Receive in-app notifications.
- View unread count.
- Mark single notification as read.
- Mark all as read.
- Delete notifications.

### 14. Emergency SOS
- Trigger SOS with current location.
- Save emergency contacts.
- Notify emergency contacts by SMS (if configured).
- Dispatch SOS to:
  - hospitals linked to your account
  - nearest eligible hospitals in your area
- Track SOS history.
- Receive response updates when a responder acknowledges.
- Benefit from collision prevention: once one responder claims the SOS, others are told to stand down.

## Typical Patient Journey
1. Create account and complete profile.
2. Run symptom analysis.
3. Find/select doctor.
4. Book appointment.
5. Attend consultation.
6. Receive prescription or tests.
7. Pay and track records.
8. Use SOS in emergencies.

## Privacy And Security (Patient-Facing)
- JWT-based session security.
- Role-based authorization checks.
- Audit logging on API actions.
- Rate-limited sensitive endpoints.
- Secure transport recommended (HTTPS in production).

## Mobile And Offline Behavior
- Progressive Web App support via service worker.
- API calls stay network-first to avoid stale medical data.
- Static assets use caching for better low-bandwidth performance.

## Current Limits / Notes
- SOS map navigation is not yet built into the product (location is shared now; map-guided dispatch can be added next).
- Feature availability depends on your assigned role and system configuration by deployment environment.
