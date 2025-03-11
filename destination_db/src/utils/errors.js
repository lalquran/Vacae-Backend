/**
 * Custom error classes for more specific error handling
 */

/**
 * Base application error class
 */
 class AppError extends Error {
    constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR') {
      super(message);
      this.statusCode = statusCode;
      this.errorCode = errorCode;
      this.name = this.constructor.name;
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * 400 Bad Request - Invalid input/parameters
   */
  class ValidationError extends AppError {
    constructor(message, details = null) {
      super(message, 400, 'VALIDATION_ERROR');
      this.details = details;
    }
  }
  
  /**
   * 401 Unauthorized - Authentication error
   */
  class AuthenticationError extends AppError {
    constructor(message = 'Authentication required') {
      super(message, 401, 'AUTHENTICATION_ERROR');
    }
  }
  
  /**
   * 403 Forbidden - Permission error
   */
  class ForbiddenError extends AppError {
    constructor(message = 'You do not have permission to perform this action') {
      super(message, 403, 'FORBIDDEN_ERROR');
    }
  }
  
  /**
   * 404 Not Found - Resource not found
   */
  class NotFoundError extends AppError {
    constructor(resource = 'Resource', id = '') {
      const message = id 
        ? `${resource} with ID ${id} not found` 
        : `${resource} not found`;
      super(message, 404, 'NOT_FOUND_ERROR');
      this.resource = resource;
      this.resourceId = id;
    }
  }
  
  /**
   * 409 Conflict - Resource already exists
   */
  class ConflictError extends AppError {
    constructor(message, details = null) {
      super(message, 409, 'CONFLICT_ERROR');
      this.details = details;
    }
  }
  
  /**
   * 429 Too Many Requests - Rate limit exceeded
   */
  class RateLimitError extends AppError {
    constructor(message = 'Rate limit exceeded. Please try again later.') {
      super(message, 429, 'RATE_LIMIT_ERROR');
    }
  }
  
  /**
   * 500 Internal Server Error - Database error
   */
  class DatabaseError extends AppError {
    constructor(message = 'Database operation failed', originalError = null) {
      super(message, 500, 'DATABASE_ERROR');
      this.originalError = originalError;
    }
  }
  
  /**
   * 503 Service Unavailable - External service error
   */
  class ExternalServiceError extends AppError {
    constructor(service, message = 'External service unavailable') {
      super(`${service}: ${message}`, 503, 'EXTERNAL_SERVICE_ERROR');
      this.service = service;
    }
  }
  
  /**
   * Convert Sequelize errors to AppErrors
   */
  function convertSequelizeError(error) {
    if (error.name === 'SequelizeValidationError') {
      return new ValidationError(
        'Validation error',
        error.errors.map(e => ({ field: e.path, message: e.message }))
      );
    }
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return new ConflictError(
        'Resource already exists',
        error.errors.map(e => ({ field: e.path, message: e.message }))
      );
    }
    
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return new ValidationError(
        'Invalid reference to a related resource',
        { field: error.fields, message: error.message }
      );
    }
    
    if (error.name === 'SequelizeDatabaseError') {
      return new DatabaseError(
        'Database operation failed',
        error
      );
    }
    
    // Default to database error for other Sequelize errors
    return new DatabaseError('Database error', error);
  }
  
  module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    DatabaseError,
    ExternalServiceError,
    convertSequelizeError
  };