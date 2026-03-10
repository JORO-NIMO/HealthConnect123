# ── Stage 1: Dependencies ─────────────────────────────────────────────
FROM node:18-alpine AS deps
WORKDIR /app

# Install build tools for native modules
RUN apk add --no-cache python3 make g++

COPY backend/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ── Stage 2: Build / Source ───────────────────────────────────────────
FROM node:18-alpine AS builder
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci && npm cache clean --force

COPY backend/ ./backend/
COPY frontend/ ./frontend/

# ── Stage 3: Production ───────────────────────────────────────────────
FROM node:18-alpine AS production
WORKDIR /app

# Security: non-root user
RUN addgroup -g 1001 -S healthconnect && \
    adduser  -u 1001 -S healthconnect -G healthconnect

# Copy production node_modules from deps stage
COPY --from=deps  /app/node_modules ./node_modules

# Copy app source from builder stage
COPY --from=builder /app/backend  ./backend
COPY --from=builder /app/frontend ./frontend

# Create necessary directories
RUN mkdir -p uploads logs && \
    chown -R healthconnect:healthconnect /app

USER healthconnect

# Expose application port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health/live || exit 1

# Start server
CMD ["node", "backend/server.js"]
