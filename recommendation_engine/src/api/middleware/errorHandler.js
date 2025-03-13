const { AppError } = require('../../utils/errors');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config/settings');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Generate a request ID for tracking
  const requestId = req.id || uuidv4();

  // Log the error
  logger.error({
    message: `Error processing request: ${err.message}`,
    error: err,
    requestId,
    path: req.path,
    method: req.method
  });

  // If it's one of our custom operational errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: true,
      statusCode: err.statusCode,
      errorCode: err.errorCode,
      message: err.message,
      requestId,
      details: err.details
    });
  }

  // Handle other known error types
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: true,
      statusCode: 401,
      errorCode: 'INVALID_TOKEN',
      message: 'Invalid authentication token',
      requestId
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: true,
      statusCode: 401,
      errorCode: 'EXPIRED_TOKEN',
      message: 'Authentication token expired',
      requestId
    });
  }

  // For unexpected errors, return a generic message in production
  // In development, include the stack trace
  if (config.NODE_ENV === 'production') {
    return res.status(500).json({
      error: true,
      statusCode: 500,
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      requestId
    });
  } else {
    return res.status(500).json({
      error: true,
      statusCode: 500,
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
      requestId,
      stack: err.stack
    });
  }
};

module.exports = errorHandler;