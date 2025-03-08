const logger = require('../utils/logger');

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error('Application error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Known error types
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: true,
      message: 'Validation error',
      details: err.errors.map(e => e.message)
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      error: true,
      message: 'Resource already exists',
      details: err.errors.map(e => e.message)
    });
  }

  // Default to 500 server error
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;

  // Send response
  res.status(statusCode).json({
    error: true,
    message,
    // Only include stack in development
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

module.exports = errorHandler;