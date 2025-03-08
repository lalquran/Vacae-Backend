const Joi = require('joi');

// Validate user registration
exports.validateUserRegistration = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    firstName: Joi.string().required(),
    lastName: Joi.string().required()
  });
  
  const { error } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  
  next();
};

// Validate user login
exports.validateLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  });
  
  const { error } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  
  next();
};

// Validate profile update
exports.validateProfileUpdate = (req, res, next) => {
  const schema = Joi.object({
    travelerType: Joi.array().items(
      Joi.string().valid('foodie', 'adventurer', 'culture', 'relaxation', 'nightlife', 'shopping', 'history', 'nature')
    ),
    pacePreference: Joi.string().valid('relaxed', 'moderate', 'busy'),
    budgetLevel: Joi.string().valid('budget', 'moderate', 'luxury'),
    activityLevel: Joi.string().valid('low', 'medium', 'high'),
    dietaryRestrictions: Joi.array().items(Joi.string()),
    mobilityConsiderations: Joi.string(),
    preferredAccommodationType: Joi.array().items(
      Joi.string().valid('hotel', 'hostel', 'resort', 'apartment', 'campsite')
    ),
    travelCompanions: Joi.string().valid('solo', 'couple', 'family', 'friends', 'business')
  });
  
  const { error } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  
  next();
};

// Validate preferences update
exports.validatePreferencesUpdate = (req, res, next) => {
  const categorySchema = Joi.object({
    museums: Joi.number().min(1).max(5),
    outdoorActivities: Joi.number().min(1).max(5),
    historicalSites: Joi.number().min(1).max(5),
    food: Joi.number().min(1).max(5),
    shopping: Joi.number().min(1).max(5),
    nightlife: Joi.number().min(1).max(5),
    relaxation: Joi.number().min(1).max(5),
    tours: Joi.number().min(1).max(5),
    localExperiences: Joi.number().min(1).max(5)
  });
  
  const mealTimesSchema = Joi.object({
    breakfast: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
    lunch: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
    dinner: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
  });
  
  const scheduleSchema = Joi.object({
    morningStart: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
    eveningEnd: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
    mealTimes: mealTimesSchema,
    restPeriods: Joi.boolean()
  });
  
  const schema = Joi.object({
    categories: categorySchema,
    schedule: scheduleSchema,
    excludedActivities: Joi.array().items(Joi.string()),
    preferredTransportation: Joi.array().items(
      Joi.string().valid('walking', 'public', 'taxi', 'rental', 'tour')
    )
  });
  
  const { error } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  
  next();
};

  