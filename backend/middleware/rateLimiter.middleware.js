const rateLimit = require('express-rate-limit');
const logger    = require('../utils/logger.util');

// ─── Message helper ────────────────────────────────────────────────────────
const rateLimitMessage = (windowMinutes, maxReq) => ({
  success: false,
  message : `Too many requests. You are allowed ${maxReq} requests per ${windowMinutes} minutes. Please try again later.`,
  code    : 429,
});

// ─── Skip rate limiting for health checks ─────────────────────────────────
const skipHealthChecks = (req) => {
  return req.path.startsWith('/api/health') || req.path === '/api/metrics';
};

// ─── Global API Limiter ────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs       : parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 min
  max            : parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '200'),
  standardHeaders: true,
  legacyHeaders  : false,
  skip           : skipHealthChecks,
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
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip} | Email: ${req.body?.email || 'N/A'}`);
    res.status(429).json(options.message);
  },
});

// ─── AI Symptom Checker (per user) ────────────────────────────────────────
const aiLimiter = rateLimit({
  windowMs       : 60 * 60 * 1000, // 1 hour
  max            : parseInt(process.env.AI_RATE_LIMIT_MAX || '20'),
  keyGenerator   : (req) => req.user?.id || req.ip,
  standardHeaders: true,
  legacyHeaders  : false,
  message        : rateLimitMessage(60, 20),
  handler        : (req, res, _next, options) => {
    logger.warn(`AI rate limit exceeded for user: ${req.user?.id || req.ip}`);
    res.status(429).json(options.message);
  },
});

// ─── OTP Endpoints ─────────────────────────────────────────────────────────
const otpLimiter = rateLimit({
  windowMs       : 10 * 60 * 1000, // 10 minutes
  max            : parseInt(process.env.OTP_RATE_LIMIT_MAX || '3'),
  standardHeaders: true,
  legacyHeaders  : false,
  message        : rateLimitMessage(10, 3),
  handler        : (req, res, _next, options) => {
    logger.warn(`OTP rate limit exceeded for IP: ${req.ip} | Email: ${req.body?.email || 'N/A'}`);
    res.status(429).json(options.message);
  },
});

// ─── Payment Endpoints (per user) ──────────────────────────────────────────
const paymentLimiter = rateLimit({
  windowMs       : 60 * 60 * 1000, // 1 hour
  max            : parseInt(process.env.PAYMENT_RATE_LIMIT_MAX || '10'),
  keyGenerator   : (req) => req.user?.id || req.ip,
  standardHeaders: true,
  legacyHeaders  : false,
  message        : rateLimitMessage(60, 10),
  handler        : (req, res, _next, options) => {
    logger.warn(`Payment rate limit exceeded for user: ${req.user?.id || req.ip}`);
    res.status(429).json(options.message);
  },
});

// ─── File Upload Endpoints ─────────────────────────────────────────────────
const uploadLimiter = rateLimit({
  windowMs       : 15 * 60 * 1000, // 15 minutes
  max            : parseInt(process.env.UPLOAD_RATE_LIMIT_MAX || '30'),
  keyGenerator   : (req) => req.user?.id || req.ip,
  standardHeaders: true,
  legacyHeaders  : false,
  message        : rateLimitMessage(15, 30),
  handler        : (req, res, _next, options) => {
    logger.warn(`Upload rate limit exceeded for user: ${req.user?.id || req.ip}`);
    res.status(429).json(options.message);
  },
});

module.exports = { 
  globalLimiter, 
  authLimiter, 
  aiLimiter, 
  otpLimiter, 
  paymentLimiter,
  uploadLimiter,
};
