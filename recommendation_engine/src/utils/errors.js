const { ValidationError, DatabaseError, TimeoutError } = require('sequelize');
const logger = require('./logger');

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, errorCode, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

class ValidationFailedError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class NotFoundError extends AppError {
  constructor(message, details = null) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message, details = null) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

class ForbiddenError extends AppError {
  constructor(message, details = null) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message, details = null) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details);
  }
}

// Utility to convert Sequelize errors to our custom errors
const convertSequelizeError = (error) => {
  logger.debug('Converting Sequelize error:', error);

  if (error instanceof ValidationError) {
    return new ValidationFailedError(
      'Validation failed',
      error.errors.map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }))
    );
  }

  if (error instanceof DatabaseError) {
    // Extract constraint name from Postgres error
    const constraintMatch = error.message.match(/constraint "([^"]+)"/);
    const constraintName = constraintMatch ? constraintMatch[1] : null;

    if (error.message.includes('violates foreign key constraint')) {
      return new ValidationFailedError(
        'Invalid reference to a related resource',
        {
          field: null,
          message: error.message
        }
      );
    }

    if (error.message.includes('violates unique constraint')) {
      return new ValidationFailedError(
        'Resource already exists',
        {
          field: constraintName,
          message: 'A unique constraint was violated'
        }
      );
    }

    return new ServiceUnavailableError(
      'Database error occurred',
      { message: 'An error occurred while accessing the database' }
    );
  }

  if (error instanceof TimeoutError) {
    return new ServiceUnavailableError(
      'Database operation timed out',
      { message: 'The database operation took too long to complete' }
    );
  }

  return error;
};

module.exports = {
  AppError,
  BadRequestError,
  ValidationFailedError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ServiceUnavailableError,
  convertSequelizeError
};