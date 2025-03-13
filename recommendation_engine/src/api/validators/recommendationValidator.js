const Joi = require('joi');

// Schema for generating recommendations
exports.generateSchema = Joi.object({
  location: Joi.object({
    latitude: Joi.number().required().min(-90).max(90),
    longitude: Joi.number().required().min(-180).max(180)
  }).required(),
  date: Joi.date().iso().default(() => new Date().toISOString().split('T')[0]),
  startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('09:00'),
  endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('17:00'),
  preferences: Joi.object({
    categories: Joi.array().items(Joi.string().uuid()),
    costLevel: Joi.number().min(1).max(5),
    activityLevel: Joi.string().valid('relaxed', 'moderate', 'active')
  }).default({}),
  transportMode: Joi.string().valid('walking', 'transit', 'driving').default('walking')
});

// Schema for refining an itinerary
exports.refineSchema = Joi.object({
  removedDestinations: Joi.array().items(Joi.string().uuid()).default([]),
  addedConstraints: Joi.object({
    startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    startLocation: Joi.object({
      latitude: Joi.number().min(-90).max(90),
      longitude: Joi.number().min(-180).max(180)
    })
  }).default({}),
  transportMode: Joi.string().valid('walking', 'transit', 'driving')
});

// Schema for saving feedback
exports.feedbackSchema = Joi.object({
  rating: Joi.number().min(1).max(5),
  comments: Joi.string().max(500),
  status: Joi.string().valid('accepted', 'rejected', 'completed')
});