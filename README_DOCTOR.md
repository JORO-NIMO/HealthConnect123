# HealthConnect Doctor Guide

## Overview
HealthConnect gives doctors a workflow to manage profile and availability, handle appointments, run consultations, write prescriptions, and coordinate with hospitals and emergency events.

## What A Doctor Can Do

### 1. Profile And Professional Setup
- View doctor profile.
- Update doctor profile details (specialty, experience, fees, languages, location fields, etc.).
- Upload verification documents.
- List and delete verification documents.

### 2. Availability Management
- View availability schedule.
- Set availability slots.

### 3. Patient Discovery And Visibility
- Be discoverable in public doctor listings.
- Show profile and availability to patients.

### 4. Appointment Operations
- View doctor appointment list.
- View appointment details.
- Confirm appointments.
- Cancel appointments (where authorized).
- Start consultation session from appointment.

### 5. Consultation Workflow
- Open consultation details.
- Exchange consultation messages with patients.
- End consultation session.
- Write prescriptions during consultation.

### 6. Clinical Data Access
- View patient symptom reports (authorized endpoints).
- View patient vitals via patient-specific route.
- View patient health records (doctor/admin route).
- Add records for a patient where permitted.
- View patient documents through doctor-authorized document endpoints.

### 7. Drug Safety Support
- Check medication interactions (AI-assisted endpoint).

### 8. Hospital Collaboration
- View hospitals where you are affiliated.
- Participate in hospital-linked patient workflows and test result cycles.

### 9. Emergency Response
- View active emergency incidents where authorized.
- Access hospital-targeted SOS queue.
- Respond to SOS incidents.
- If your hospital claims an SOS, other responders are notified to stand down.

### 10. Notifications
- Receive real-time and persisted notifications.
- Track unread counts.
- Mark read / mark all read.

## Recommended Doctor Workflow
1. Complete profile and verification docs.
2. Set availability calendar.
3. Confirm appointments promptly.
4. Start consultation and document findings.
5. Issue prescriptions and follow-up notes.
6. Monitor emergency queue for your hospital coverage.

## Security And Governance
- Role-based authorization enforced at route level.
- Authenticated access required for doctor operations.
- Sensitive interactions are audit logged.
- Rate limits are applied to abuse-prone flows.

## Operational Notes
- Emergency queue visibility is role and hospital-assignment aware.
- Hospital admin and admin users may see broader SOS scope than individual doctors.
