const Joi = require('joi');

// Validate destination creation
exports.validateDestinationCreate = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow(''),
    latitude: Joi.number().required().min(-90).max(90),
    longitude: Joi.number().required().min(-180).max(180),
    address: Joi.object({
      street: Joi.string().allow(''),
      city: Joi.string().required(),
      state: Joi.string().allow(''),
      postalCode: Joi.string().allow(''),
      country: Joi.string().required()
    }),
    contactInfo: Joi.object({
      phone: Joi.string().allow(''),
      email: Joi.string().email().allow(''),
      website: Joi.string().uri().allow('')
    }),
    visitDuration: Joi.number().integer().min(5).max(1440), // in minutes
    costLevel: Joi.number().integer().min(1).max(5),
    categoryIds: Joi.array().items(Joi.string().uuid()),
    operatingHours: Joi.array().items(Joi.object({
      dayOfWeek: Joi.number().integer().min(0).max(6).required(),
      openTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/),
      closeTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/),
      is24Hours: Joi.boolean(),
      seasonStart: Joi.date(),
      seasonEnd: Joi.date(),
      notes: Joi.string().allow('')
    }))
  });

  validateRequest(req.body, res, next, schema);
};

// Validate destination update
exports.validateDestinationUpdate = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string(),
    description: Joi.string().allow(''),
    latitude: Joi.number().min(-90).max(90),
    longitude: Joi.number().min(-180).max(180),
    address: Joi.object({
      street: Joi.string().allow(''),
      city: Joi.string(),
      state: Joi.string().allow(''),
      postalCode: Joi.string().allow(''),
      country: Joi.string()
    }),
    contactInfo: Joi.object({
      phone: Joi.string().allow(''),
      email: Joi.string().email().allow(''),
      website: Joi.string().uri().allow('')
    }),
    visitDuration: Joi.number().integer().min(5).max(1440), // in minutes
    costLevel: Joi.number().integer().min(1).max(5),
    categoryIds: Joi.array().items(Joi.string().uuid()),
    status: Joi.string().valid('active', 'inactive', 'pending')
  });

  validateRequest(req.body, res, next, schema);
};

// Validate category creation
exports.validateCategoryCreate = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().required(),
    slug: Joi.string().required().pattern(/^[a-z0-9-]+$/),
    description: Joi.string().allow(''),
    parentId: Joi.string().uuid().allow(null),
    icon: Joi.string().allow(''),
    displayOrder: Joi.number().integer()
  });

  validateRequest(req.body, res, next, schema);
};

// Validate category update
exports.validateCategoryUpdate = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string(),
    description: Joi.string().allow(''),
    parentId: Joi.string().uuid().allow(null),
    icon: Joi.string().allow(''),
    displayOrder: Joi.number().integer()
  });

  validateRequest(req.body, res, next, schema);
};

// Validate operating hours update
exports.validateOperatingHoursUpdate = (req, res, next) => {
  const schema = Joi.object({
    operatingHours: Joi.array().items(Joi.object({
      dayOfWeek: Joi.number().integer().min(0).max(6).required(),
      openTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/),
      closeTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/),
      is24Hours: Joi.boolean(),
      seasonStart: Joi.date(),
      seasonEnd: Joi.date(),
      notes: Joi.string().allow('')
    })).required()
  });

  validateRequest(req.body, res, next, schema);
};

// Validate search parameters
exports.validateSearch = (req, res, next) => {
  const schema = Joi.object({
    query: Joi.string(),
    categories: Joi.string(),
    costLevelMin: Joi.number().integer().min(1).max(5),
    costLevelMax: Joi.number().integer().min(1).max(5),
    lat: Joi.number().min(-90).max(90),
    lng: Joi.number().min(-180).max(180),
    radius: Joi.number().positive(),
    page: Joi.number().integer().positive(),
    limit: Joi.number().integer().positive().max(100),
    sort: Joi.string(),
    order: Joi.string().valid('ASC', 'DESC')
  });

  validateRequest(req.query, res, next, schema);
};

// Validate nearby search parameters
exports.validateNearbySearch = (req, res, next) => {
  const schema = Joi.object({
    lat: Joi.number().required().min(-90).max(90),
    lng: Joi.number().required().min(-180).max(180),
    radius: Joi.number().positive().default(5),
    categories: Joi.string(),
    limit: Joi.number().integer().positive().max(100).default(20)
  });

  validateRequest(req.query, res, next, schema);
};

// Helper function for validation
function validateRequest(data, res, next, schema) {
  const { error } = schema.validate(data);
  
  if (error) {
    return res.status(400).json({ 
      message: 'Validation error', 
      details: error.details[0].message 
    });
  }
  
  next();
}