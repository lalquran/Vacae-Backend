const { AppError, convertSequelizeError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = err;
  
  // Generate request ID for tracking
  const requestId = req.id || Math.random().toString(36).substring(2, 15);
  
  // Log the original path and method
  const logContext = {
    requestId,
    path: req.path,
    method: req.method,
    ip: req.ip,
    user: req.user ? req.user.id : 'anonymous'
  };
  
  // Convert Sequelize errors to our custom error types
  if (err.name && err.name.startsWith('Sequelize')) {
    error = convertSequelizeError(err);
  }
  
  // Handle JSON parsing errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = {
      statusCode: 400,
      errorCode: 'INVALID_JSON',
      message: 'Invalid JSON in request body',
      name: 'SyntaxError'
    };
  }
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      statusCode: 401,
      errorCode: 'INVALID_TOKEN',
      message: 'Invalid authentication token',
      name: 'AuthenticationError'
    };
  }
  
  if (err.name === 'TokenExpiredError') {
    error = {
      statusCode: 401,
      errorCode: 'EXPIRED_TOKEN',
      message: 'Authentication token expired',
      name: 'AuthenticationError'
    };
  }
  
  // Set default values if not an AppError
  const statusCode = error.statusCode || 500;
  const errorCode = error.errorCode || 'INTERNAL_ERROR';
  const errorName = error.name || 'Error';
  const message = statusCode === 500 && process.env.NODE_ENV === 'production'
    ? 'Internal Server Error'
    : error.message || 'Something went wrong';
  
  // Add stack trace for non-production
  const devDetails = process.env.NODE_ENV !== 'production' ? {
    stack: error.stack,
    originalError: error.originalError
  } : {};
  
  // Create response object
  const errorResponse = {
    error: true,
    statusCode,
    errorCode,
    message,
    requestId,
    ...(error.details && { details: error.details }),
    ...devDetails
  };
  
  // Log error with context
  if (statusCode >= 500) {
    logger.error(`${errorName}: ${message}`, {
      ...logContext,
      stack: error.stack,
      originalError: error.originalError
    });
  } else {
    logger.warn(`${errorName}: ${message}`, logContext);
  }
  
  // Send response
  res.status(statusCode).json(errorResponse);
};

/**
 * Not found handler - for routes that don't exist
 */
const notFoundHandler = (req, res, next) => {
  const error = {
    statusCode: 404,
    errorCode: 'ROUTE_NOT_FOUND',
    message: `Route not found: ${req.method} ${req.originalUrl}`
  };
  
  res.status(404).json(error);
};

/**
 * Async handler to catch errors in async routes
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};