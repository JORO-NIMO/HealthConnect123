const logger = require('../utils/logger.util');

/**
 * Central error handler — must be registered AFTER all routes.
 */
function errorHandler(err, req, res, _next) {
  logger.error(`${err.message}`, {
    stack : err.stack,
    method: req.method,
    url   : req.originalUrl,
    ip    : req.ip,
    userId: req.user?.id,
  });

  // MySQL duplicate-entry
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'A record with this information already exists.',
    });
  }

  // MySQL constraint violation
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist.',
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.',
    });
  }

  // Multer file too large
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'File too large. Maximum size is 5MB.',
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'An internal server error occurred.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * 404 handler for unmatched API routes.
 */
function notFound(req, res, next) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: `Endpoint not found: ${req.method} ${req.path}`,
    });
  }
  next();
}

module.exports = { errorHandler, notFound };
