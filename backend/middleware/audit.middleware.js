const { query } = require('../config/database');
const logger    = require('../utils/logger.util');

/**
 * Logs every authenticated API request to the audit_logs table.
 * Skips health-check and static asset requests.
 */
async function auditMiddleware(req, res, next) {
  // Only log authenticated API calls
  if (!req.path.startsWith('/api/') || req.path === '/api/health') {
    return next();
  }

  const originalSend = res.json.bind(res);
  res.json = function (body) {
    // Fire-and-forget audit log after response is sent
    setImmediate(async () => {
      try {
        if (req.user?.id) {
          await query(
            `INSERT INTO audit_logs 
             (user_id, action, resource, method, endpoint, ip_address, status_code, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              req.user.id,
              deriveAction(req.method, req.path),
              deriveResource(req.path),
              req.method,
              req.originalUrl,
              req.ip,
              res.statusCode,
            ]
          );
        }
      } catch (err) {
        logger.warn('Audit log failed:', err.message);
      }
    });
    return originalSend(body);
  };

  next();
}

function deriveAction(method, path) {
  const map = { GET: 'READ', POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' };
  return map[method] || 'ACTION';
}

function deriveResource(path) {
  const parts = path.replace('/api/v1/', '').split('/');
  return parts[0] || 'unknown';
}

module.exports = { auditMiddleware };
