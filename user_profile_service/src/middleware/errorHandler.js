const logger = require('../utils/logger');

// Central error handler middleware
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Application error', { 
    error: err.message, 
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  // Determine status code
  const statusCode = err.statusCode || 500;
  
  // Format the error response
  const errorResponse = {
    error: true,
    message: statusCode === 500 ? 'Internal server error' : err.message
  };
  
  // Add stack trace in development
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = err.stack;
  }
  
  // Send response
  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;