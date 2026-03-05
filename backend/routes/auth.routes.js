const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/auth.controller');
const { authenticate }              = require('../middleware/auth.middleware');
const { authLimiter, otpLimiter }   = require('../middleware/rateLimiter.middleware');

// Public
router.post('/register',    authLimiter, ctrl.register);
router.post('/login',       authLimiter, ctrl.login);
router.post('/refresh',     ctrl.refresh);
router.post('/logout',      ctrl.logout);
router.post('/google',      ctrl.googleCallback);
router.post('/send-otp',    otpLimiter,  ctrl.sendOTP);
router.post('/verify-otp',  otpLimiter,  ctrl.verifyOTP);

// Protected
router.get('/me', authenticate, ctrl.getMe);

module.exports = router;
