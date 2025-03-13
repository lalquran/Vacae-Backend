const { ValidationFailedError } = require('../../utils/errors');

/**
 * Request validation middleware using Joi schemas
 */
const validate = (schema) => {
  return (req, res, next) => {
    if (!schema) return next();

    // Determine which part of the request to validate
    const dataToValidate = {};
    if (schema.body) dataToValidate.body = req.body;
    if (schema.query) dataToValidate.query = req.query;
    if (schema.params) dataToValidate.params = req.params;

    const options = {
      abortEarly: false, // Return all errors, not just the first one
      allowUnknown: true, // Ignore unknown properties
      stripUnknown: false // Don't remove unknown properties
    };

    const { error, value } = schema.validate(dataToValidate, options);
    
    if (error) {
      // Format validation errors
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return next(new ValidationFailedError('Validation failed', validationErrors));
    }

    // Update req with the validated values
    if (value.body) req.body = value.body;
    if (value.query) req.query = value.query;
    if (value.params) req.params = value.params;

    next();
  };
};

module.exports = validate;