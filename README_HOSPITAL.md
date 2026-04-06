# HealthConnect Hospital Guide

## Overview
HealthConnect enables hospital administrators to register facilities, manage hospital teams and linked patients, publish test results, and participate in emergency dispatch workflows.

## What A Hospital (hospital_admin) Can Do

### 1. Hospital Registration And Profile
- Register hospital profile.
- View managed hospital details.
- Update hospital profile (contact, location, services, emergency availability, bed count, etc.).
- View hospital operational stats.

### 2. Doctor Network Management
- Add doctors to hospital.
- List affiliated doctors.
- Remove doctors from hospital.

### 3. Patient Network Management
- Link patients to hospital.
- List linked patients.
- Remove linked patients.

### 4. Test Result Lifecycle
- Create test results for linked patients.
- Upload/attach test artifacts.
- Update test result status and details.
- List hospital test results.
- Trigger patient notifications when results are ready.

### 5. Emergency Operations
- Receive SOS incidents routed to your hospital when:
  - patient is linked to your hospital, or
  - patient location is near your hospital and you are eligible.
- Access hospital-targeted SOS queue.
- Respond to SOS incidents from queue.
- Automatically reduce scene collision:
  - when one responder claims/responds, other responders are told stand_down.

### 6. Public Discovery Surface
- Hospital appears in public hospital listing/search.
- Public users can view hospital profile and associated doctors.

## Recommended Hospital Operations Playbook
1. Keep emergency availability and location data accurate.
2. Maintain active on-call doctor assignments.
3. Keep patient links current.
4. Monitor SOS queue continuously.
5. Respond quickly and document notes/status updates.
6. Publish lab/test results with clear summaries.

## Emergency Dispatch Model (Current)
- Dispatch target set combines:
  - patient-linked hospitals
  - nearest eligible hospitals by geolocation
- Dispatch state tracking per hospital includes:
  - pending
  - claimed
  - stand_down

## Security And Access Control
- Hospital routes are protected by authentication and role checks.
- Only hospital_admin/admin can perform hospital management actions.
- Emergency response access is restricted to authorized responder roles.

## Integration Notes
- Realtime notifications are delivered through Socket.IO channels.
- Persisted notifications are also stored for inbox/history access.
