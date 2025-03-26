const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validation');
const recommendationValidator = require('../validators/recommendationValidator');

// All routes require authentication
router.use(auth);

// Generate recommendations
router.post(
  '/generate', 
  validate(recommendationValidator.generateSchema), 
  recommendationController.generateRecommendations
);

// Get itinerary
router.get(
  '/itinerary/:itineraryId',
  recommendationController.getItinerary
);

// Refine itinerary
router.post(
  '/itinerary/:itineraryId/refine',
  validate(recommendationValidator.refineSchema),
  recommendationController.refineItinerary
);

// Save feedback
router.post(
  '/feedback/:recommendationId',
  validate(recommendationValidator.feedbackSchema),
  recommendationController.saveFeedback
);

router.post(
  '/update-preferences',
  recommendationController.updateUserPreferences
);

module.exports = router;