/**
 * Standardized API response helpers.
 */

function sendSuccess(res, statusCode = 200, message = 'Success', data = {}) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}

function sendError(res, statusCode = 500, message = 'An error occurred', errors = null) {
  const body = { success: false, message, timestamp: new Date().toISOString() };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

function sendPaginated(res, message, items, total, page, limit) {
  return res.status(200).json({
    success: true,
    message,
    data: {
      items,
      pagination: {
        total,
        page    : parseInt(page),
        limit   : parseInt(limit),
        pages   : Math.ceil(total / limit),
        hasNext : page * limit < total,
        hasPrev : page > 1,
      },
    },
    timestamp: new Date().toISOString(),
  });
}

module.exports = { sendSuccess, sendError, sendPaginated };
