const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/auth.controller');
const { authenticate }              = require('../middleware/auth.middleware');
const { authLimiter, otpLimiter }   = require('../middleware/rateLimiter.middleware');
const passport = require('passport');

// ─── Traditional Auth ─────────────────────────────────────────────────────
// Public
router.post('/register',    authLimiter, ctrl.register);
router.post('/login',       authLimiter, ctrl.login);
router.post('/refresh',     ctrl.refresh);
router.post('/logout',      ctrl.logout);
router.post('/send-otp',    otpLimiter,  ctrl.sendOTP);
router.post('/verify-otp',  otpLimiter,  ctrl.verifyOTP);

// Protected
router.get('/me', authenticate, ctrl.getMe);

// ─── Google OAuth 2.0 ────────────────────────────────────────────────────
// Initiate Google OAuth login
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  prompt: 'login'
}));

// Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/pages/auth/login.html?error=google_auth_failed' }),
  ctrl.handleGoogleCallback
);

// Fallback POST endpoint for frontend-based Google authentication
router.post('/google', ctrl.googleCallback);

module.exports = router;
