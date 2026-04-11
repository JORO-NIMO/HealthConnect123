# HealthConnect Release Notes
Date: 2026-04-11
Commit: b4da8cb
Type: Feature release with UI refresh and support chatbot integration

## Summary
This release introduces a role-aware support chatbot across the platform, improves API resilience and deployment diagnostics, and ships broad frontend visual updates across patient, doctor, admin, hospital, legal, and auth pages.

## Highlights
- Added a new support chatbot API with role-aware behavior for anonymous users, patients, and doctors.
- Added a floating support widget on app pages and landing page.
- Disabled chatbot rendering on consultation room pages to avoid distractions during live care sessions.
- Added support-chat rate limiting on backend endpoints.
- Improved backend startup and database diagnostics for smoother deployment troubleshooting.
- Refreshed UI theme and color system with broad consistency updates across major frontend pages.
- Added patient icon enhancement script to improve navigation and visual clarity.

## Backend Changes
- New support chatbot service:
  - Platform-knowledge grounding from project docs
  - Role-aware prompting and fallback flows
  - Structured response contract for frontend
- New support chatbot controller and route:
  - Public or authenticated use via optional auth
  - Endpoint mounted under v1 API routes
- Added support chat limiter:
  - Environment variable support for tuning request volume
- Improved database and server startup behavior:
  - Expanded database env key compatibility
  - Better startup diagnostics and clearer error messaging
  - Port bind fallback logic for occupied ports

## Frontend Changes
- Added support chat widget script and loader:
  - Floating support icon
  - Role-specific greetings and suggested actions
  - Landing page support enabled
- Consultation room opt-out:
  - Chatbot hidden during doctor consultation sessions
- Added patient icon enhancement module for patient pages.
- Updated theme colors and visual consistency across:
  - Auth pages
  - Patient pages
  - Doctor pages
  - Admin and hospital dashboards
  - Legal pages
  - Landing page and manifest theme colors

## Operations Notes
- If AI tokens are not configured, chatbot uses role-aware fallback responses.
- To enable full AI responses, ensure one of these is configured:
  - HF_TOKEN
  - OPENAI_API_KEY
- New optional rate limit env variable:
  - SUPPORT_CHAT_RATE_LIMIT_MAX

## Deployment Impact
- No database migration required for this release.
- Recommended post-deploy checks:
  - Open landing page and verify chatbot icon appears
  - Confirm chatbot response for anonymous, patient, and doctor contexts
  - Confirm chatbot does not appear in consultation room
  - Verify support endpoint responds under API v1 routes
  - Validate startup logs for DB and port diagnostics

## Files Added
- backend/controllers/support.controller.js
- backend/routes/support.routes.js
- backend/services/supportChat.service.js
- frontend/js/patient-icons.js
- frontend/js/support-chatbot.js
