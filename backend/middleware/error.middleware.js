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

  // MySQL connection errors (includes SSL handshake failures on Railway)
  if (
    err.code === 'ECONNREFUSED' ||
    err.code === 'PROTOCOL_CONNECTION_LOST' ||
    err.code === 'ER_CON_COUNT_ERROR' ||
    err.code === 'ECONNRESET' ||
    err.code === 'ER_ACCESS_DENIED_ERROR' ||
    err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    err.code === 'CERT_HAS_EXPIRED' ||
    err.message?.includes('SSL') ||
    err.message?.includes('ETIMEDOUT')
  ) {
    logger.error(`Database connection error [${err.code}]:`, err.message);
    return res.status(503).json({
      success: false,
      message: 'Database temporarily unavailable. Please try again shortly.',
    });
  }

  // MySQL bad field/table errors
  if (err.code === 'ER_BAD_FIELD_ERROR' || err.code === 'ER_NO_SUCH_TABLE') {
    logger.error('Database schema error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An internal database error occurred. The system is initializing — please retry in a moment.',
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
      message: 'File too large. Maximum size is 25MB.',
    });
  }

  // Multer unexpected field
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected file field. Please check the upload form.',
    });
  }

  // Syntax error in JSON body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body.',
    });
  }

  // Request entity too large (body parser)
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Request body too large. Maximum size is 10MB.',
    });
  }

  // Validation errors (express-validator)
  if (err.name === 'ValidationError' || err.array) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: err.array ? err.array() : [{ msg: err.message }],
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
