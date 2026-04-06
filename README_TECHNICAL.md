# HealthConnect Technical README

## 1. Executive Summary
HealthConnect is a full-stack telemedicine platform with role-based workflows for patients, doctors, admins, and hospital administrators. It combines REST APIs, realtime communication, AI-assisted clinical support, and PWA capabilities.

## 2. Languages, Frameworks, And Runtime

### Backend
- Node.js 18+
- Express 4
- MySQL 8 (mysql2/promise)
- Socket.IO 4
- JWT authentication
- express-validator
- express-rate-limit
- multer
- winston logging

### Frontend
- Vanilla HTML/CSS/JavaScript (modular scripts)
- Tailwind loaded from CDN (cdn.tailwindcss.com)
- PWA manifest + service worker

### AI Layer
- OpenAI SDK client abstraction
- Provider switch:
  - OpenAI
  - Hugging Face router endpoint

### Infra / Deployment
- Docker + Docker Compose
- Optional Nginx reverse proxy with TLS
- Redis service defined in Compose (cache/queue-ready infrastructure)

## 3. High-Level Architecture

### API Layer
- Entry: backend/server.js
- Route aggregator: backend/routes/index.js
- Domain routes per capability (auth, patients, doctors, appointments, emergency, hospitals, etc.)

### Application Layer
- Controllers: request orchestration and response shaping
- Services: cross-cutting or domain logic (AI, cron, SMS, email, etc.)
- Middleware: auth, RBAC, validation, rate limits, error mapping, audit logging, uploads

### Data Layer
- Models encapsulate SQL operations
- Database config uses pooled mysql2/promise connections
- Schema bootstrap + auto-migration during startup

### Realtime Layer
- Socket.IO server attached to HTTP server
- Room strategy:
  - consultation rooms
  - user:{id} personal channels
- Realtime events for consultations, notifications, vitals, and emergency workflows

## 4. Project Structure And Component Responsibilities
- backend/controllers: request handlers per domain
- backend/routes: endpoint definitions and role guards
- backend/models: SQL and data access patterns
- backend/middleware: security/validation/audit/error/rate-limit/upload concerns
- backend/services: AI, cron, messaging, and utility service orchestration
- backend/config: DB and AI provider bootstrapping
- backend/database: schema, migrations, optimization scripts
- frontend/pages: role-specific UI pages
- frontend/js: API client, auth/session handling, page logic, notifications, utilities
- frontend/sw.js: PWA caching/offline policy

## 5. Current System Scale Snapshot
- Controllers: 17
- Models: 16
- Route files: 20
- Services: 7
- Middleware modules: 7
- Frontend pages: 23
- Route declarations (get/post/put/patch/delete): ~142
- Realtime event handlers/emits references: ~190

These values indicate a medium-to-large monolithic codebase with multiple bounded domains.

## 6. Request Lifecycle
1. Client sends request to /api/v1/*.
2. Express middleware chain applies:
   - security headers and CORS
   - body parsing and compression
   - authentication / RBAC
   - validation / rate-limits
   - audit logging
3. Route hands off to controller.
4. Controller orchestrates model/service calls.
5. Model executes parameterized SQL via pool.query.
6. Response utility normalizes payload shape.
7. Errors flow to centralized error middleware.

## 7. Security Model
- JWT access token verification with active-user checks.
- RBAC middleware across role-protected routes.
- Input validation with express-validator.
- Rate limiting for auth, OTP, AI, payments, uploads.
- Helmet headers and proxy trust configuration.
- Audit logging on API paths.

## 8. AI Subsystem
- AI provider configured via AI_PROVIDER.
- OpenAI and Hugging Face are supported through a unified client style.
- Symptom analysis pipeline:
  - prompt construction with medical context
  - strict JSON response parsing/extraction
  - urgency normalization and disclaimers
  - fallback response when AI is unavailable
- Follow-up question generation and doctor recommendation are AI-assisted.

## 9. Emergency SOS Technical Flow
- Patient triggers SOS with validation and idempotency key.
- Latest vitals are snapshotted and persisted with SOS log.
- Dispatch target selection combines:
  - patient-linked hospitals
  - nearby emergency-eligible hospitals by location
- Dispatch targets persisted in emergency_sos_dispatch_targets.
- Realtime + stored notifications fan out to responders.
- On first response/claim:
  - claiming hospital targets marked claimed
  - other targets marked stand_down
  - stand-down events pushed to avoid responder collision

## 10. Service Worker, Caching, And Offline
- Precache static essentials.
- API is always network-only to avoid stale medical data.
- HTML/CSS/JS use network-first for fast updates.
- Images/static assets use cache-first for bandwidth savings.
- Background sync hook exists and can be extended for offline queues.

## 11. CDN And Asset Delivery
- Current explicit CDN dependency: Tailwind via cdn.tailwindcss.com.
- Nginx config supports long-lived static cache headers.
- External image sources are used in some landing visuals.
- Recommended production hardening:
  - move static assets behind edge CDN (Cloudflare/Fastly/Akamai)
  - self-host critical UI dependencies for deterministic builds

## 12. Scaling Characteristics And Strategy

### Current Strengths
- Stateless API process design (except socket session locality).
- MySQL connection pooling and retry-based DB init.
- Compression and static caching headers.
- Start-server-before-DB-init strategy improves platform health checks.

### Scale Risks / Constraints
- Socket.IO horizontal scale requires sticky sessions and shared adapter (Redis adapter recommended).
- Geospatial queries currently use Haversine over row sets; larger hospital tables may require spatial indexing strategy.
- Notification fan-out cost grows with responder cardinality.

### Complexity Notes (Practical)
- Nearby-hospital lookup: O(H) scan with distance computation (bounded by filters/index selectivity).
- SOS fan-out: O(R) over responder set.
- Queue merge/dedup in app layer: O(N) with map/set dedup.

## 13. Reliability, Observability, And Ops
- Health routes support readiness/liveness style checks.
- Structured app logging via winston + morgan stream integration.
- Graceful shutdown closes HTTP and Socket.IO with timeout fallback.
- Startup diagnostics log critical env readiness.
- Cron subsystem handles periodic maintenance/reminder workloads.

## 14. Deployment Topologies

### A. Single service app deployment
- backend serves API and frontend static files from one process.

### B. Containerized stack (docker-compose)
- app + mysql + redis + optional nginx
- health checks and restart policies included
- environment-driven behavior for cloud portability

## 15. Suggested Next Technical Enhancements
1. Add Socket.IO auth middleware for room joins and role-aware channels.
2. Add Redis adapter for multi-instance Socket.IO scaling.
3. Add geospatial index strategy for high-volume location search.
4. Add SLO dashboards (p95 latency, AI timeout rate, SOS ack latency).
5. Add API contract docs (OpenAPI) and automated integration tests by role.
