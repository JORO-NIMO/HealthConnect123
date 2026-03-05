const rateLimit = require('express-rate-limit');
const logger    = require('../utils/logger.util');

// ─── Message helper ────────────────────────────────────────────────────────
const rateLimitMessage = (windowMinutes, maxReq) => ({
  success: false,
  message : `Too many requests. You are allowed ${maxReq} requests per ${windowMinutes} minutes. Please try again later.`,
  code    : 429,
});

// ─── Global API Limiter ────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs       : parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 min
  max            : parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '200'),
  standardHeaders: true,
  legacyHeaders  : false,
  message        : rateLimitMessage(15, 200),
  handler        : (req, res, _next, options) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip} | ${req.method} ${req.path}`);
    res.status(429).json(options.message);
  },
});

// ─── Auth Endpoints (stricter) ─────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs       : 15 * 60 * 1000,
  max            : parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10'),
  standardHeaders: true,
  legacyHeaders  : false,
  message        : rateLimitMessage(15, 10),
  handler        : (req, res, _next, options) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(options.message);
  },
});

// ─── AI Symptom Checker (per user) ────────────────────────────────────────
const aiLimiter = rateLimit({
  windowMs       : 60 * 60 * 1000, // 1 hour
  max            : 20,
  keyGenerator   : (req) => req.user?.id || req.ip,
  standardHeaders: true,
  legacyHeaders  : false,
  message        : rateLimitMessage(60, 20),
});

// ─── OTP Endpoints ─────────────────────────────────────────────────────────
const otpLimiter = rateLimit({
  windowMs       : 10 * 60 * 1000,
  max            : 3,
  standardHeaders: true,
  legacyHeaders  : false,
  message        : rateLimitMessage(10, 3),
});

module.exports = { globalLimiter, authLimiter, aiLimiter, otpLimiter };
