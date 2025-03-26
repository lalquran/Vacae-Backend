const logger = require('../../../../destination_db/src/utils/logger');
const { ValidationFailedError } = require('../../utils/errors');

/**
 * Request validation middleware using Joi schemas
 */
const validate = (schema) => {
  return (req, res, next) => {
    if (!schema) return next();

    const options = {
      abortEarly: false, // Return all errors, not just the first one
      allowUnknown: true, // Ignore unknown properties
      stripUnknown: false // Don't remove unknown properties
    };

    const { error, value } = schema.validate(req.body, options);
    
    if (error) {
      // Format validation errors
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return next(new ValidationFailedError('Validation failed', validationErrors));
    }

    // Update req with the validated values
    req.body = value;
    next();
  };
};

module.exports = validate;