const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/auth.controller');
const { sendError } = require('../utils/response.util');
const {
	passport,
	isGoogleOAuthConfigured,
	getGoogleOAuthConfigErrors,
} = require('../config/passport');
const { authenticate }              = require('../middleware/auth.middleware');
const { authLimiter, otpLimiter }   = require('../middleware/rateLimiter.middleware');

function requireGoogleOAuthConfig(res) {
	if (isGoogleOAuthConfigured()) return true;
	sendError(
		res,
		500,
		'Google OAuth is not configured on the server.',
		getGoogleOAuthConfigErrors()
	);
	return false;
}

// Public
router.post('/register',    authLimiter, ctrl.register);
router.post('/login',       authLimiter, ctrl.login);
router.post('/refresh',     ctrl.refresh);
router.post('/logout',      ctrl.logout);

router.get('/google', (req, res, next) => {
	if (!requireGoogleOAuthConfig(res)) return;
	passport.authenticate('google', {
		scope: ['profile', 'email'],
		session: false,
	})(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
	if (!requireGoogleOAuthConfig(res)) return;
	passport.authenticate('google', { session: false }, (err, user) => {
		if (err || !user) return ctrl.googleOAuthFailedRedirect(req, res);
		req.user = user;
		return ctrl.googleOAuthRedirect(req, res, next);
	})(req, res, next);
});

router.post('/google',      ctrl.googleCallback);
router.post('/send-otp',    otpLimiter,  ctrl.sendOTP);
router.post('/verify-otp',  otpLimiter,  ctrl.verifyOTP);

// Protected
router.get('/me', authenticate, ctrl.getMe);

module.exports = router;
