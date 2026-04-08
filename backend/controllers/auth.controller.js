const { v4: uuidv4 } = require('uuid');
const UserModel    = require('../models/User.model');
const PatientModel = require('../models/Patient.model');
const DoctorModel  = require('../models/Doctor.model');
const HospitalModel = require('../models/Hospital.model');
const { generateTokens, verifyRefreshToken } = require('../utils/jwt.util');
const { sendSuccess, sendError }             = require('../utils/response.util');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email.service');
const { sendOTP: sendSMSOTP }                = require('../services/sms.service');
const logger = require('../utils/logger.util');

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
  };
}

function buildGoogleRoleNotAllowedError(role) {
  const err = new Error('Google sign-in is only available for patient accounts. Doctors and hospital admins must use verified registration.');
  err.statusCode = 403;
  err.code = 'google_role_not_allowed';
  err.role = role;
  return err;
}

function assertGoogleRoleAllowed(user) {
  if (user?.role && user.role !== 'patient') {
    throw buildGoogleRoleNotAllowedError(user.role);
  }
}

async function authenticateWithGoogleProfile({ googleId, email, firstName, lastName }) {
  if (!googleId || !email) {
    throw new Error('Missing googleId or email in Google profile payload.');
  }

  let user = await UserModel.findByGoogleId(googleId);

  if (user) {
    assertGoogleRoleAllowed(user);
  }

  if (!user) {
    user = await UserModel.findByEmail(email);
    if (user) {
      assertGoogleRoleAllowed(user);
      await UserModel.setGoogleId(user.id, googleId);
      user = await UserModel.findById(user.id);
    } else {
      const tempPass = uuidv4();
      user = await UserModel.create({ email, password: tempPass, firstName, lastName, role: 'patient' });
      await PatientModel.create(user.id);
      await UserModel.setGoogleId(user.id, googleId);
      user = await UserModel.findById(user.id);
    }
  }

  const tokens = generateTokens(user);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await UserModel.saveRefreshToken(user.id, tokens.refreshToken, expiresAt);

  return { user, tokens };
}

function buildFrontendAuthRedirect(req, { tokens, user, oauthError }) {
  const fallbackOrigin = `${req.protocol}://${req.get('host')}`;
  const frontendBase = (process.env.FRONTEND_URL || fallbackOrigin).replace(/\/+$/, '');
  const redirectUrl = new URL('/pages/auth/login.html', frontendBase);

  if (oauthError) {
    redirectUrl.searchParams.set('oauthError', oauthError);
    return redirectUrl.toString();
  }

  redirectUrl.searchParams.set('accessToken', tokens.accessToken);
  redirectUrl.searchParams.set('refreshToken', tokens.refreshToken);
  redirectUrl.searchParams.set('user', JSON.stringify(user));
  return redirectUrl.toString();
}

// ─── Register ─────────────────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone, role = 'patient', specialization, licenseNumber } = req.body;

    // Only allow patient, doctor, and hospital_admin self-registration
    if (!['patient', 'doctor', 'hospital_admin'].includes(role)) {
      return sendError(res, 400, 'Invalid role. Choose patient, doctor, or hospital_admin.');
    }

    const existing = await UserModel.findByEmail(email);
    if (existing) return sendError(res, 409, 'An account with this email already exists.');

    const user = await UserModel.create({ email, password, firstName, lastName, phone, role });

    // Create role-specific profile
    if (role === 'patient') await PatientModel.create(user.id);
    if (role === 'doctor')  await DoctorModel.create(user.id, { specialization, licenseNumber });
    // hospital_admin profile is created when they register their hospital via /api/v1/hospitals/register

    const tokens = generateTokens(user);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await UserModel.saveRefreshToken(user.id, tokens.refreshToken, expiresAt);

    // Send welcome email (non-blocking)
    sendVerificationEmail(user).catch(err => logger.warn('Email failed:', err.message));

    const verificationStatus = (role === 'doctor' || role === 'hospital_admin') ? 'pending' : null;

    return sendSuccess(res, 201, 'Account created successfully.', {
      user  : {
        id: user.id, email: user.email,
        firstName: user.first_name, lastName: user.last_name,
        role: user.role,
        verificationStatus,
      },
      tokens,
    });
  } catch (err) { next(err); }
};

// ─── Login ────────────────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await UserModel.findByEmail(email);
    if (!user) return sendError(res, 401, 'Invalid email or password.');

    const valid = await UserModel.validatePassword(password, user.password_hash);
    if (!valid) return sendError(res, 401, 'Invalid email or password.');

    if (!user.is_active) return sendError(res, 403, 'Your account has been deactivated. Contact support.');

    // Check verification status for doctors and hospital_admin
    let verificationStatus = null;
    if (user.role === 'doctor') {
      const doctor = await DoctorModel.findByUserId(user.id);
      verificationStatus = doctor?.verification_status || 'pending';
    } else if (user.role === 'hospital_admin') {
      const hospital = await HospitalModel.findByAdminUserId(user.id);
      verificationStatus = hospital?.verification_status || 'pending';
    }

    const tokens = generateTokens(user);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await UserModel.saveRefreshToken(user.id, tokens.refreshToken, expiresAt);

    logger.info(`User logged in: ${user.email}`);
    return sendSuccess(res, 200, 'Login successful.', {
      user  : {
        id: user.id, email: user.email,
        firstName: user.first_name, lastName: user.last_name,
        role: user.role,
        verificationStatus,
      },
      tokens,
    });
  } catch (err) { next(err); }
};

// ─── Refresh Token ────────────────────────────────────────────────────────
exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return sendError(res, 400, 'Refresh token is required.');

    const stored = await UserModel.findRefreshToken(refreshToken);
    if (!stored) return sendError(res, 401, 'Invalid or expired refresh token.');

    const payload = verifyRefreshToken(refreshToken);
    const user    = await UserModel.findById(payload.userId);
    if (!user) return sendError(res, 401, 'User not found.');

    // Rotate refresh token
    await UserModel.revokeRefreshToken(refreshToken);
    const tokens    = generateTokens(user);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await UserModel.saveRefreshToken(user.id, tokens.refreshToken, expiresAt);

    return sendSuccess(res, 200, 'Tokens refreshed.', { tokens });
  } catch (err) { next(err); }
};

// ─── Logout ───────────────────────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await UserModel.revokeRefreshToken(refreshToken);
    return sendSuccess(res, 200, 'Logged out successfully.');
  } catch (err) { next(err); }
};

// ─── Send Phone OTP ───────────────────────────────────────────────────────
exports.sendOTP = async (req, res, next) => {
  try {
    const { phone } = req.body;
    const user = await UserModel.findByEmail(req.body.email || '');
    if (!user) return sendError(res, 404, 'User not found.');

    const otp       = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + parseInt(process.env.OTP_EXPIRES_IN || '300000'));

    await UserModel.saveOTP(user.id, otp, expiresAt);
    await sendSMSOTP(phone || user.phone, otp);

    return sendSuccess(res, 200, 'OTP sent to your phone number.');
  } catch (err) { next(err); }
};

// ─── Verify Phone OTP ─────────────────────────────────────────────────────
exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const user = await UserModel.findByEmail(email);
    if (!user) return sendError(res, 404, 'User not found.');

    const valid = await UserModel.verifyOTP(user.id, otp);
    if (!valid) return sendError(res, 400, 'Invalid or expired OTP.');

    await UserModel.verifyEmail(user.id);
    const tokens    = generateTokens(user);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await UserModel.saveRefreshToken(user.id, tokens.refreshToken, expiresAt);

    return sendSuccess(res, 200, 'Phone verified successfully.', { tokens });
  } catch (err) { next(err); }
};

// ─── Google OAuth callback (frontend-initiated) ───────────────────────
exports.googleCallback = async (req, res, next) => {
  try {
    const { googleId, email, firstName, lastName, avatarUrl } = req.body;
    const { user, tokens } = await authenticateWithGoogleProfile({
      googleId,
      email,
      firstName,
      lastName,
      avatarUrl,
    });

    return sendSuccess(res, 200, 'Google authentication successful.', {
      user  : toPublicUser(user),
      tokens,
    });
  } catch (err) {
    if (err.code === 'google_role_not_allowed') {
      return sendError(res, 403, err.message, { code: err.code, role: err.role });
    }
    next(err);
  }
};

// ─── Google OAuth browser callback (passport flow) ──────────────────────
exports.googleOAuthRedirect = async (req, res, next) => {
  try {
    const googleProfile = req.user;
    const { user, tokens } = await authenticateWithGoogleProfile(googleProfile);
    const redirectUrl = buildFrontendAuthRedirect(req, {
      tokens,
      user: toPublicUser(user),
    });

    return res.redirect(302, redirectUrl);
  } catch (err) {
    if (err.code === 'google_role_not_allowed') {
      const redirectUrl = buildFrontendAuthRedirect(req, { oauthError: err.code });
      return res.redirect(302, redirectUrl);
    }
    return next(err);
  }
};

exports.googleOAuthFailedRedirect = (req, res) => {
  const redirectUrl = buildFrontendAuthRedirect(req, { oauthError: 'google_oauth_failed' });
  return res.redirect(302, redirectUrl);
};

// ─── Google OAuth callback (Passport-initiated) ────────────────────────
exports.handleGoogleCallback = async (req, res, next) => {
  try {
    // User is already authenticated by Passport.js
    if (!req.user) {
      return res.redirect('/pages/auth/login.html?error=auth_failed');
    }

    const user = await UserModel.findById(req.user.id);
    if (!user) {
      return res.redirect('/pages/auth/login.html?error=user_not_found');
    }

    // Generate JWT tokens
    const tokens = generateTokens(user);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await UserModel.saveRefreshToken(user.id, tokens.refreshToken, expiresAt);

    // Determine frontend redirect URL based on environment
    // Priority: FRONTEND_URL env var > request host > localhost:5000
    let frontendUrl = process.env.FRONTEND_URL;
    
    if (!frontendUrl) {
      const host = req.get('host') || 'localhost:5000';
      const protocol = (process.env.NODE_ENV === 'production' ? 'https' : 'http');
      frontendUrl = `${protocol}://${host}`;
    }

    const dashboardPath = {
      doctor: '/pages/doctor/dashboard.html',
      hospital_admin: '/pages/hospital/dashboard.html',
      admin: '/pages/admin/dashboard.html',
      patient: '/pages/patient/dashboard.html'
    }[user.role] || '/pages/patient/dashboard.html';

    // Redirect to frontend with tokens in URL
    const redirectUrl = `${frontendUrl}${dashboardPath}?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}&user=${encodeURIComponent(JSON.stringify({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role
    }))}`;

    logger.info(`✅ Google OAuth successful for user: ${user.email}`);
    logger.info(`📍 Redirecting to: ${redirectUrl}`);
    return res.redirect(redirectUrl);
  } catch (err) {
    logger.error('Google callback error:', err);
    next(err);
  }
};

// ─── Get current user ────────────────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.user.id);
    if (!user) return sendError(res, 404, 'User not found.');
    return sendSuccess(res, 200, 'User retrieved.', { user });
  } catch (err) { next(err); }
};
