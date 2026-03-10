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

// ─── Register ─────────────────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone, role = 'patient' } = req.body;

    // Only allow patient, doctor, and hospital_admin self-registration
    if (!['patient', 'doctor', 'hospital_admin'].includes(role)) {
      return sendError(res, 400, 'Invalid role. Choose patient, doctor, or hospital_admin.');
    }

    const existing = await UserModel.findByEmail(email);
    if (existing) return sendError(res, 409, 'An account with this email already exists.');

    const user = await UserModel.create({ email, password, firstName, lastName, phone, role });

    // Create role-specific profile
    if (role === 'patient') await PatientModel.create(user.id);
    if (role === 'doctor')  await DoctorModel.create(user.id);
    // hospital_admin profile is created when they register their hospital via /api/v1/hospitals/register

    const tokens = generateTokens(user);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await UserModel.saveRefreshToken(user.id, tokens.refreshToken, expiresAt);

    // Send welcome email (non-blocking)
    sendVerificationEmail(user).catch(err => logger.warn('Email failed:', err.message));

    return sendSuccess(res, 201, 'Account created successfully.', {
      user  : { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role },
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

    const tokens = generateTokens(user);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await UserModel.saveRefreshToken(user.id, tokens.refreshToken, expiresAt);

    logger.info(`User logged in: ${user.email}`);
    return sendSuccess(res, 200, 'Login successful.', {
      user  : { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role },
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

// ─── Google OAuth callback ────────────────────────────────────────────────
exports.googleCallback = async (req, res, next) => {
  try {
    const { googleId, email, firstName, lastName, avatarUrl } = req.body;

    let user = await UserModel.findByGoogleId(googleId);
    if (!user) {
      user = await UserModel.findByEmail(email);
      if (user) {
        await UserModel.setGoogleId(user.id, googleId);
      } else {
        const tempPass = uuidv4();
        user = await UserModel.create({ email, password: tempPass, firstName, lastName, role: 'patient' });
        await PatientModel.create(user.id);
        await UserModel.setGoogleId(user.id, googleId);
      }
    }

    const tokens    = generateTokens(user);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await UserModel.saveRefreshToken(user.id, tokens.refreshToken, expiresAt);

    return sendSuccess(res, 200, 'Google authentication successful.', {
      user  : { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role },
      tokens,
    });
  } catch (err) { next(err); }
};

// ─── Get current user ────────────────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.user.id);
    if (!user) return sendError(res, 404, 'User not found.');
    return sendSuccess(res, 200, 'User retrieved.', { user });
  } catch (err) { next(err); }
};
