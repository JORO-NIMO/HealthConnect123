const express = require('express');
const router  = express.Router();
const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response.util');

// ═══════════════════════════════════════════════════════════════════════════
// BASIC HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════

router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      service: 'HealthConnect API',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };

    res.json(health);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      message: error.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DETAILED HEALTH CHECK (with DB, services)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/health/detailed', async (req, res) => {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    checks: {},
  };

  // Database check
  try {
    await query('SELECT 1');
    checks.checks.database = { status: 'ok', responseTime: null };
  } catch (err) {
    checks.checks.database = { status: 'error', error: err.message };
    checks.status = 'degraded';
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  checks.checks.memory = {
    status: 'ok',
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
  };

  // Check if critical env vars are set
  const requiredEnvVars = ['DB_HOST', 'DB_NAME', 'JWT_SECRET'];
  const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
  checks.checks.environment = {
    status: missingEnvVars.length ? 'warning' : 'ok',
    missingVars: missingEnvVars,
  };

  const statusCode = checks.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(checks);
});

// ═══════════════════════════════════════════════════════════════════════════
// READINESS CHECK (for Railway/K8s)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/health/ready', async (req, res) => {
  try {
    // Check DB connection
    await query('SELECT 1');
    res.status(200).json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// LIVENESS CHECK (for Railway/K8s)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM METRICS (admin only)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/metrics', async (req, res) => {
  try {
    // Basic metrics
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    };

    // Database stats
    try {
      const [userCount] = await query('SELECT COUNT(*) as count FROM users');
      const [appointmentCount] = await query('SELECT COUNT(*) as count FROM appointments');
      const [consultationCount] = await query('SELECT COUNT(*) as count FROM consultations');
      
      metrics.database = {
        users: userCount.count,
        appointments: appointmentCount.count,
        consultations: consultationCount.count,
      };
    } catch (err) {
      metrics.database = { error: err.message };
    }

    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
