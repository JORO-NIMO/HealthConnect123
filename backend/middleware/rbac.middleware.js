const { sendError } = require('../utils/response.util');

/**
 * Role-Based Access Control middleware factory.
 *
 * Usage:
 *   router.get('/admin-only', authenticate, authorize('admin'), handler)
 *   router.get('/doctors',    authenticate, authorize('doctor', 'admin'), handler)
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required.');
    }
    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, 403, `Access denied. Required role: ${allowedRoles.join(' or ')}.`);
    }
    next();
  };
}

/**
 * Ensure a patient can only access their own resources.
 * Compares req.user.id against req.params.patientId or req.body.patientId.
 * Admins bypass this check.
 */
function ownResourceOnly(req, res, next) {
  if (!req.user) {
    return sendError(res, 401, 'Authentication required.');
  }
  if (req.user.role === 'admin') return next();

  const resourceId = req.params.patientId || req.params.userId || req.body.patientId;
  if (resourceId && String(resourceId) !== String(req.user.id)) {
    return sendError(res, 403, 'You do not have permission to access this resource.');
  }
  next();
}

module.exports = { authorize, ownResourceOnly };
