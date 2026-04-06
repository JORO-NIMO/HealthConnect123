# 🏥 HealthConnect — AI Symptom Checker & Telemedicine Platform

> Production-ready, mobile-first SaaS telemedicine platform built for African healthcare markets.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Deployment](#deployment)

---

## 📚 Pitch Documentation

For role-specific pitch narratives and technical architecture detail, use:

- [README_PATIENT.md](README_PATIENT.md) — Patient capabilities and journeys
- [README_DOCTOR.md](README_DOCTOR.md) — Doctor workflows and platform tools
- [README_HOSPITAL.md](README_HOSPITAL.md) — Hospital operations and emergency queue behavior
- [README_TECHNICAL.md](README_TECHNICAL.md) — Full technical architecture, scaling, AI, PWA/SW, CDN, and system complexity

---

## 🌍 Overview

HealthConnect is a full-stack AI-powered telemedicine platform designed for:

| Role | Capabilities |
|------|-------------|
| **Patient** | Symptom check, book appointments, view history |
| **Doctor** | Manage schedule, conduct consultations, write prescriptions |
| **Admin** | Approve doctors, manage users, view analytics |

---

## ✨ Features

### Core Features
- 🤖 **AI Symptom Checker** — NLP-powered symptom analysis with ICD-10 mapping
- 📅 **Appointment Booking** — Real-time calendar scheduling
- 📹 **Video Consultation** — WebRTC-based peer-to-peer video calls
- 💬 **Chat Consultation** — Real-time messaging via Socket.IO
- 📋 **Electronic Medical Records (EMR)** — Encrypted patient records
- 💊 **Prescription Management** — Digital prescription generation
- 💳 **Payment Integration** — Stripe, MTN MoMo, Airtel Money

### Security Features
- 🔐 JWT + Refresh Token Authentication
- 🛡️ Role-Based Access Control (RBAC)
- 🔒 AES-256 Data Encryption
- ⚡ Rate Limiting & DDoS Protection
- 📝 Full Audit Logging
- 🔑 Google OAuth2 Integration

### Performance Features
- 📱 Mobile-First PWA (Progressive Web App)
- 🚀 Redis API Caching
- 🗜️ GZIP Compression
- 📶 Offline Support via Service Worker
- ⚡ Low-bandwidth optimization

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML5, CSS3, JavaScript (ES6+), Tailwind CSS CDN |
| **Backend** | Node.js 18+, Express.js 4 |
| **Database** | MySQL 8.0 |
| **Cache** | Redis |
| **AI** | OpenAI GPT-4 API |
| **Real-time** | Socket.IO + WebRTC |
| **Auth** | JWT, Google OAuth2 |
| **Email** | NodeMailer + SendGrid |
| **SMS** | Africa's Talking / Twilio |
| **Payments** | Stripe + Mobile Money APIs |
| **Container** | Docker + Docker Compose |
| **CI/CD** | GitHub Actions |

---

## 📁 Project Structure

```
healthconnect/
├── frontend/                   # Vanilla HTML/CSS/JS Frontend
│   ├── index.html              # Landing page
│   ├── css/                    # Stylesheets
│   ├── js/                     # JavaScript modules
│   ├── pages/                  # App pages
│   │   ├── auth/               # Login, Register
│   │   ├── patient/            # Patient dashboard pages
│   │   ├── doctor/             # Doctor portal pages
│   │   └── admin/              # Admin dashboard pages
│   ├── manifest.json           # PWA manifest
│   └── sw.js                   # Service Worker
├── backend/                    # Node.js + Express API
│   ├── server.js               # Entry point
│   ├── config/                 # App configuration
│   ├── middleware/             # Express middleware
│   ├── models/                 # MySQL query models
│   ├── controllers/            # Request handlers
│   ├── routes/                 # API route definitions
│   ├── services/               # Business logic services
│   ├── utils/                  # Utility functions
│   └── database/               # SQL schema & seeds
├── docker/                     # Docker configuration
├── .github/workflows/          # CI/CD pipelines
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- MySQL 8.0
- Redis (optional, for caching)
- OpenAI API Key

### 1. Clone & Install

```bash
git clone https://github.com/yourorg/healthconnect.git
cd healthconnect

# Install backend dependencies
cd backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Initialize Database

```bash
# Create MySQL database
mysql -u root -p -e "CREATE DATABASE healthconnect_db;"

# Run schema migrations
mysql -u root -p healthconnect_db < backend/database/schema.sql

# Seed initial data
mysql -u root -p healthconnect_db < backend/database/seeds.sql
```

### 4. Start Development Server

```bash
cd backend
npm run dev
```

### 5. Open Application

Visit `http://localhost:5000` in your browser.

---

## 🐳 Docker Deployment

```bash
# Build and start all services
docker-compose up --build

# Run in background
docker-compose up -d
```

---

## 🔐 Environment Variables

See [.env.example](.env.example) for all required variables.

Key variables:

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 5000) |
| `DB_HOST` | MySQL host |
| `DB_NAME` | Database name |
| `JWT_SECRET` | JWT signing secret (min 64 chars) |
| `OPENAI_API_KEY` | OpenAI API key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `FRONTEND_URL` | Frontend URL for CORS |

---

## 📡 API Documentation

Base URL: `http://localhost:5000/api/v1`

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Register new user |
| `POST` | `/auth/login` | Login |
| `POST` | `/auth/refresh` | Refresh JWT token |
| `POST` | `/auth/logout` | Logout |
| `GET` | `/auth/google` | Google OAuth |
| `POST` | `/auth/send-otp` | Send phone OTP |
| `POST` | `/auth/verify-otp` | Verify phone OTP |

### Patients
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/patients/profile` | Get patient profile |
| `PUT` | `/patients/profile` | Update profile |
| `GET` | `/patients/medical-history` | Get medical history |
| `GET` | `/patients/appointments` | List appointments |

### Symptoms
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/symptoms/analyze` | AI symptom analysis |
| `GET` | `/symptoms/list` | Get symptom list |
| `GET` | `/symptoms/report/:id` | Get analysis report |
| `GET` | `/symptoms/history` | Patient's symptom history |

### Doctors
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/doctors` | List verified doctors |
| `GET` | `/doctors/:id` | Get doctor profile |
| `GET` | `/doctors/:id/availability` | Get availability |
| `PUT` | `/doctors/profile` | Update doctor profile |

### Appointments
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/appointments` | Book appointment |
| `GET` | `/appointments/:id` | Get appointment |
| `PUT` | `/appointments/:id/cancel` | Cancel appointment |
| `PUT` | `/appointments/:id/confirm` | Confirm appointment (doctor) |

### Consultations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/consultations/:id/start` | Start consultation |
| `POST` | `/consultations/:id/end` | End consultation |
| `POST` | `/consultations/:id/message` | Send message |
| `GET` | `/consultations/:id/messages` | Get messages |

---

## 💾 Database Schema

Key tables: `users`, `patients`, `doctors`, `symptom_reports`, `appointments`, `consultations`, `prescriptions`, `payments`, `audit_logs`

Full schema: [backend/database/schema.sql](backend/database/schema.sql)

---

## 🔒 Security

- All endpoints use HTTPS in production
- JWT tokens expire in 1 hour; refresh tokens in 7 days
- Passwords hashed with bcrypt (12 rounds)
- Sensitive data encrypted with AES-256
- Rate limiting: 100 req/15min globally, 5 req/15min for auth
- RBAC enforced on all protected routes

---

## 🌐 Deployment

### Render / Railway
```bash
# Set environment variables in dashboard
# Connect GitHub repo for auto-deploy
```

### AWS
```bash
# Use docker-compose.yml with EC2
# Configure RDS for MySQL
# Use ElastiCache for Redis
```

---

## 📞 Support

For support, email support@healthconnect.health or open a GitHub issue.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) file for details.

---

*Built with ❤️ for African healthcare*
