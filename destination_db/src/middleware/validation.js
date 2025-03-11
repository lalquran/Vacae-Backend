const Joi = require('joi');
const { ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Generic validation middleware creator
 * @param {Joi.Schema} schema - Joi schema to validate against
 * @param {string} type - Request part to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
const validate = (schema, type = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[type], {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      // Format Joi validation errors
      const details = error.details.map(detail => ({
        field: detail.context.key || detail.context.label,
        message: detail.message.replace(/['"]/g, ''),
        type: detail.type
      }));
      
      // Log validation error with context
      logger.warn(`Validation error in ${type}`, { 
        path: req.path, 
        method: req.method,
        errors: details
      });
      
      // Create a validation error with details
      const validationError = new ValidationError(
        `Validation failed in ${type}`,
        details
      );
      
      // Send the error response
      return next(validationError);
    }
    
    // Replace validated data and proceed
    req[type] = value;
    next();
  };
};

// Destination validation schemas
const destinationSchemas = {
  create: Joi.object({
    name: Joi.string().trim().required().max(100)
      .messages({
        'string.empty': 'Name is required',
        'string.max': 'Name cannot exceed 100 characters'
      }),
    description: Joi.string().allow('').max(2000)
      .messages({
        'string.max': 'Description cannot exceed 2000 characters'
      }),
    latitude: Joi.number().required().min(-90).max(90)
      .messages({
        'number.base': 'Latitude must be a number',
        'number.min': 'Latitude must be between -90 and 90',
        'number.max': 'Latitude must be between -90 and 90'
      }),
    longitude: Joi.number().required().min(-180).max(180)
      .messages({
        'number.base': 'Longitude must be a number',
        'number.min': 'Longitude must be between -180 and 180',
        'number.max': 'Longitude must be between -180 and 180'
      }),
    address: Joi.object({
      street: Joi.string().allow('').max(100),
      city: Joi.string().required().max(100)
        .messages({
          'string.empty': 'City is required',
          'string.max': 'City cannot exceed 100 characters'
        }),
      state: Joi.string().allow('').max(50),
      postalCode: Joi.string().allow('').max(20),
      country: Joi.string().required().max(50)
        .messages({
          'string.empty': 'Country is required',
          'string.max': 'Country cannot exceed 50 characters'
        })
    }),
    contactInfo: Joi.object({
      phone: Joi.string().allow('').max(20),
      email: Joi.string().email().allow('').max(100)
        .messages({
          'string.email': 'Email must be a valid email address',
          'string.max': 'Email cannot exceed 100 characters'
        }),
      website: Joi.string().uri().allow('').max(200)
        .messages({
          'string.uri': 'Website must be a valid URL',
          'string.max': 'Website cannot exceed 200 characters'
        })
    }),
    visitDuration: Joi.number().integer().min(5).max(1440) // in minutes
      .messages({
        'number.base': 'Visit duration must be a number',
        'number.integer': 'Visit duration must be a whole number',
        'number.min': 'Visit duration must be at least 5 minutes',
        'number.max': 'Visit duration cannot exceed 24 hours (1440 minutes)'
      }),
    costLevel: Joi.number().integer().min(1).max(5)
      .messages({
        'number.base': 'Cost level must be a number',
        'number.integer': 'Cost level must be a whole number',
        'number.min': 'Cost level must be between 1 and 5',
        'number.max': 'Cost level must be between 1 and 5'
      }),
    categoryIds: Joi.array().items(
      Joi.string().uuid().messages({
        'string.guid': 'Category ID must be a valid UUID'
      })
    ).min(1).messages({
      'array.min': 'At least one category is required'
    }),
    operatingHours: Joi.array().items(
      Joi.object({
        dayOfWeek: Joi.number().integer().min(0).max(6).required()
          .messages({
            'number.base': 'Day of week must be a number',
            'number.integer': 'Day of week must be a whole number',
            'number.min': 'Day of week must be between 0 (Sunday) and 6 (Saturday)',
            'number.max': 'Day of week must be between 0 (Sunday) and 6 (Saturday)'
          }),
        openTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
          .messages({
            'string.pattern.base': 'Open time must be in the format HH:MM:SS (24-hour format)'
          }),
        closeTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
          .messages({
            'string.pattern.base': 'Close time must be in the format HH:MM:SS (24-hour format)'
          }),
        is24Hours: Joi.boolean(),
        seasonStart: Joi.date(),
        seasonEnd: Joi.date(),
        notes: Joi.string().allow('').max(200)
      })
    )
  }).custom((value, helpers) => {
    // Check that either openTime/closeTime are provided OR is24Hours is true
    if (value.operatingHours) {
      for (const hour of value.operatingHours) {
        if (!hour.is24Hours && (!hour.openTime || !hour.closeTime)) {
          return helpers.error('custom.operatingHours', {
            message: 'Either provide both openTime and closeTime or set is24Hours to true'
          });
        }
      }
    }
    
    return value;
  }),
  
  update: Joi.object({
    name: Joi.string().trim().max(100),
    description: Joi.string().allow('').max(2000),
    latitude: Joi.number().min(-90).max(90),
    longitude: Joi.number().min(-180).max(180),
    address: Joi.object({
      street: Joi.string().allow('').max(100),
      city: Joi.string().max(100),
      state: Joi.string().allow('').max(50),
      postalCode: Joi.string().allow('').max(20),
      country: Joi.string().max(50)
    }),
    contactInfo: Joi.object({
      phone: Joi.string().allow('').max(20),
      email: Joi.string().email().allow('').max(100),
      website: Joi.string().uri().allow('').max(200)
    }),
    visitDuration: Joi.number().integer().min(5).max(1440),
    costLevel: Joi.number().integer().min(1).max(5),
    categoryIds: Joi.array().items(Joi.string().uuid()),
    status: Joi.string().valid('active', 'inactive', 'pending')
  }),
  
  operatingHours: Joi.object({
    operatingHours: Joi.array().items(
      Joi.object({
        dayOfWeek: Joi.number().integer().min(0).max(6).required(),
        openTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/),
        closeTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/),
        is24Hours: Joi.boolean(),
        seasonStart: Joi.date(),
        seasonEnd: Joi.date(),
        notes: Joi.string().allow('').max(200)
      })
    ).required().min(1)
  }).custom((value, helpers) => {
    // Check that either openTime/closeTime are provided OR is24Hours is true
    for (const hour of value.operatingHours) {
      if (!hour.is24Hours && (!hour.openTime || !hour.closeTime)) {
        return helpers.error('custom.operatingHours', {
          message: 'Either provide both openTime and closeTime or set is24Hours to true'
        });
      }
    }
    
    // Check that all days are unique
    const days = value.operatingHours.map(h => h.dayOfWeek);
    const uniqueDays = new Set(days);
    if (days.length !== uniqueDays.size) {
      return helpers.error('custom.duplicateDays', {
        message: 'Each day of week can only appear once'
      });
    }
    
    return value;
  })
};

// Category validation schemas
const categorySchemas = {
  create: Joi.object({
    name: Joi.string().trim().required().max(50)
      .messages({
        'string.empty': 'Name is required',
        'string.max': 'Name cannot exceed 50 characters'
      }),
    slug: Joi.string().required().pattern(/^[a-z0-9-]+$/).max(50)
      .messages({
        'string.empty': 'Slug is required',
        'string.pattern.base': 'Slug can only contain lowercase letters, numbers, and hyphens',
        'string.max': 'Slug cannot exceed 50 characters'
      }),
    description: Joi.string().allow('').max(500)
      .messages({
        'string.max': 'Description cannot exceed 500 characters'
      }),
    parentId: Joi.string().uuid().allow(null)
      .messages({
        'string.guid': 'Parent ID must be a valid UUID'
      }),
    icon: Joi.string().allow('').max(50),
    displayOrder: Joi.number().integer().min(0)
      .messages({
        'number.base': 'Display order must be a number',
        'number.integer': 'Display order must be a whole number',
        'number.min': 'Display order must be at least 0'
      })
  }),
  
  update: Joi.object({
    name: Joi.string().trim().max(50),
    description: Joi.string().allow('').max(500),
    parentId: Joi.string().uuid().allow(null),
    icon: Joi.string().allow('').max(50),
    displayOrder: Joi.number().integer().min(0)
  })
};

// Search validation schemas
const searchSchemas = {
  search: Joi.object({
    query: Joi.string().max(100),
    categories: Joi.string().max(200),
    costLevelMin: Joi.number().integer().min(1).max(5),
    costLevelMax: Joi.number().integer().min(1).max(5),
    lat: Joi.number().min(-90).max(90),
    lng: Joi.number().min(-180).max(180),
    radius: Joi.number().positive().max(100), // max 100km radius
    page: Joi.number().integer().positive(),
    limit: Joi.number().integer().positive().max(100),
    sort: Joi.string().valid('name', 'costLevel', 'visitDuration', 'popularity', 'createdAt'),
    order: Joi.string().valid('ASC', 'DESC')
  }).custom((value, helpers) => {
    if (value.costLevelMin && value.costLevelMax && value.costLevelMin > value.costLevelMax) {
      return helpers.error('custom.costLevel', {
        message: 'Minimum cost level cannot be greater than maximum cost level'
      });
    }
    
    if ((value.lat && !value.lng) || (!value.lat && value.lng)) {
      return helpers.error('custom.coordinates', {
        message: 'Both latitude and longitude must be provided together'
      });
    }
    
    return value;
  }),
  
  nearby: Joi.object({
    lat: Joi.number().required().min(-90).max(90)
      .messages({
        'any.required': 'Latitude is required',
        'number.base': 'Latitude must be a number',
        'number.min': 'Latitude must be between -90 and 90',
        'number.max': 'Latitude must be between -90 and 90'
      }),
    lng: Joi.number().required().min(-180).max(180)
      .messages({
        'any.required': 'Longitude is required',
        'number.base': 'Longitude must be a number',
        'number.min': 'Longitude must be between -180 and 180',
        'number.max': 'Longitude must be between -180 and 180'
      }),
    radius: Joi.number().positive().max(100).default(5)
      .messages({
        'number.base': 'Radius must be a number',
        'number.positive': 'Radius must be positive',
        'number.max': 'Radius cannot exceed 100 kilometers'
      }),
    categories: Joi.string().max(200),
    limit: Joi.number().integer().positive().max(100).default(20)
      .messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be a whole number',
        'number.positive': 'Limit must be positive',
        'number.max': 'Limit cannot exceed 100'
      })
  }),
  
  open: Joi.object({
    day: Joi.number().integer().min(0).max(6),
    time: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/),
    categories: Joi.string().max(200),
    lat: Joi.number().min(-90).max(90),
    lng: Joi.number().min(-180).max(180),
    radius: Joi.number().positive().max(100),
    limit: Joi.number().integer().positive().max(100).default(20)
  }).custom((value, helpers) => {
    if ((value.lat && !value.lng) || (!value.lat && value.lng)) {
      return helpers.error('custom.coordinates', {
        message: 'Both latitude and longitude must be provided together'
      });
    }
    
    if (value.lat && value.lng && !value.radius) {
      // Default radius to 5km if coordinates are provided
      value.radius = 5;
    }
    
    return value;
  })
};

// Export validation middlewares
module.exports = {
  validateDestinationCreate: validate(destinationSchemas.create),
  validateDestinationUpdate: validate(destinationSchemas.update),
  validateOperatingHours: validate(destinationSchemas.operatingHours),
  validateCategoryCreate: validate(categorySchemas.create),
  validateCategoryUpdate: validate(categorySchemas.update),
  validateSearch: validate(searchSchemas.search, 'query'),
  validateNearbySearch: validate(searchSchemas.nearby, 'query'),
  validateOpenSearch: validate(searchSchemas.open, 'query')
};