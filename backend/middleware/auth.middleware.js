const jwt    = require('jsonwebtoken');
const { query } = require('../config/database');
const { sendError } = require('../utils/response.util');

/**
 * Verify JWT access token from Authorization header.
 * Attaches decoded user payload to req.user.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'Authentication required. Please log in.');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify user still exists and is active
    const user = await query(
      'SELECT id, email, role, is_active FROM users WHERE id = ? AND is_active = 1',
      [decoded.userId]
    );

    if (!user.length) {
      return sendError(res, 401, 'User account not found or deactivated.');
    }

    req.user = {
      id   : decoded.userId,
      email: user[0].email,
      role : user[0].role,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Session expired. Please log in again.');
    }
    if (err.name === 'JsonWebTokenError') {
      return sendError(res, 401, 'Invalid authentication token.');
    }
    next(err);
  }
}

/**
 * Optional authentication — attaches user if token is present but does not
 * block the request if no token is provided.
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  return authenticate(req, res, next);
}

module.exports = { authenticate, optionalAuth };
