const logger = require('../utils/logger');
const profileService = require('../services/profileService');
const destinationService = require('../services/destinationService');
const Recommendation = require('../models/recommendation');
const UserPreference = require('../models/userPreference');
const UserToken = require('../models/userToken');
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');

/**
 * Background task to update user feature vectors for recommendations
 */
const updateUserFeaturesTask = async (data) => {
  try {
    const { userId } = data;
    
    logger.info(`Starting feature update task for user ${userId}`);
    
    // Get user token for service-to-service communication
    const tokenRecord = await UserToken.findOne({
      where: { 
        userId,
        expiresAt: { [Op.gt]: new Date() } // Only valid tokens
      }
    });
    
    if (!tokenRecord) {
      logger.warn(`No valid token found for user ${userId}, skipping preference update`);
      return { success: false, reason: 'no_valid_token' };
    }
    
    // Get user feedback history
    const feedbackHistory = await Recommendation.findAll({
      where: {
        userId,
        status: {
          [Op.in]: ['accepted', 'rejected', 'completed']
        },
        updatedAt: {
          [Op.gte]: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
        }
      },
      order: [['updatedAt', 'DESC']]
    });
    
    if (feedbackHistory.length === 0) {
      logger.info(`No recent feedback history for user ${userId}`);
      return {
        success: true,
        message: 'No recent feedback data to process',
        updated: false
      };
    }
    
    // Get destination details for feedback items
    const destinationIds = feedbackHistory.map(item => item.destinationId);
    const destinations = await destinationService.getDestinationDetails(destinationIds);
    
    // Map destinations by ID for easy lookup
    const destinationMap = {};
    destinations.forEach(dest => {
      destinationMap[dest.id] = dest;
    });
    
    // Get current user preferences
    const userProfile = await profileService.getUserProfile(userId, tokenRecord.token);
    if (!userProfile) {
      throw new Error(`User profile not found for ${userId}`);
    }
    
    // Calculate preference adjustments based on feedback
    const preferenceAdjustments = calculatePreferenceAdjustments(
      feedbackHistory, 
      destinationMap,
      userProfile.preferences
    );
    
    // Update user preferences in profile service
    await updateUserPreferencesInProfileService(userId, preferenceAdjustments, tokenRecord.token);
    
    // Store computed preferences locally for recommendation engine
    await UserPreference.upsert({
      userId,
      ...preferenceAdjustments,
      lastUpdated: new Date(),
      source: 'derived'
    });
    
    logger.info(`Updated preferences for user ${userId} based on ${feedbackHistory.length} feedback items`);
    
    return {
      success: true,
      updated: true,
      adjustments: preferenceAdjustments
    };
  } catch (error) {
    logger.error('Error in update user features task:', error);
    throw error;
  }
};

/**
 * Calculate preference adjustments based on feedback
 */
const calculatePreferenceAdjustments = (feedbackHistory, destinationMap, currentPreferences) => {
  // Initialize tracking for category preferences
  const categoryScores = {};
  const categoryCount = {};
  
  // Default preference object (for first-time users)
  const defaultPreferences = {
    categories: [],
    costLevel: 3,
    activityLevel: 'moderate'
  };
  
  // Start with current preferences or defaults
  const preferences = currentPreferences || defaultPreferences;
  
  // Process each feedback item
  feedbackHistory.forEach(feedback => {
    const destination = destinationMap[feedback.destinationId];
    if (!destination) return; // Skip if destination not found
    
    // Determine feedback score multiplier
    let multiplier;
    if (feedback.status === 'rejected') {
      multiplier = -1; // Negative for rejected
    } else if (feedback.status === 'completed') {
      multiplier = feedback.rating ? (feedback.rating / 3) : 1; // Weight by rating if available
    } else {
      multiplier = 0.5; // Mild positive for just accepted
    }
    
    // Process category preferences
    if (destination.categories) {
      destination.categories.forEach(category => {
        // Get category ID or name
        const categoryId = typeof category === 'object' ? category.id || category.name : category;
        
        // Initialize if not exists
        if (!categoryScores[categoryId]) {
          categoryScores[categoryId] = 0;
          categoryCount[categoryId] = 0;
        }
        
        // Adjust score based on feedback
        categoryScores[categoryId] += multiplier;
        categoryCount[categoryId]++;
      });
    }
    
    // Process cost level preferences - adjust toward costs of liked places
    if (feedback.status === 'completed' && destination.costLevel) {
      preferences.costLevel = calculateWeightedAverage(
        preferences.costLevel || 3,
        destination.costLevel,
        0.3 // How quickly to adjust (lower = slower adjustment)
      );
    }
    
    // Process activity level preferences
    if (feedback.status === 'completed' && destination.visitDuration) {
      let preferredActivityLevel;
      
      // Map visit duration to activity level
      if (destination.visitDuration > 180) {
        preferredActivityLevel = 'relaxed';
      } else if (destination.visitDuration >= 60 && destination.visitDuration <= 180) {
        preferredActivityLevel = 'moderate';
      } else {
        preferredActivityLevel = 'active';
      }
      
      // Gradually shift toward this activity level
      if (preferredActivityLevel !== preferences.activityLevel) {
        // Simple adjustment - in a more sophisticated system, 
        // you'd use a probabilistic approach
        preferences.activityLevel = preferredActivityLevel;
      }
    }
  });
  
  // Calculate preferred categories based on feedback
  const updatedCategories = Object.keys(categoryScores)
    .filter(categoryId => {
      // Only include categories with positive average scores
      return categoryScores[categoryId] > 0;
    });
  
  // Ensure we maintain some categories even for negative feedback
  const finalCategories = updatedCategories.length > 0 
    ? updatedCategories 
    : (preferences.categories || []);
  
  return {
    categories: finalCategories,
    costLevel: Math.round(preferences.costLevel || 3),
    activityLevel: preferences.activityLevel || 'moderate',
    lastUpdateReason: 'feedback_analysis',
    feedbackCount: feedbackHistory.length
  };
};

/**
 * Calculate weighted average for numeric preferences
 */
const calculateWeightedAverage = (currentValue, newValue, weight) => {
  return (currentValue * (1 - weight)) + (newValue * weight);
};

/**
 * Update user preferences in profile service using user's token
 */
const updateUserPreferencesInProfileService = async (userId, preferenceAdjustments, authToken) => {
  try {
    logger.info(`Updating preferences in profile service for user ${userId}`);
    
    // Map our internal preferences to the format expected by the profile service
    const profileServicePreferences = {
      categories: {
        // Map category scores for profile service format
        // For each category in our adjustments, set a score of 4 (higher than default)
        ...preferenceAdjustments.categories.reduce((acc, category) => {
          acc[category] = 4; // Higher than default
          return acc;
        }, {})
      },
      // Map costLevel to budgetLevel
      budgetLevel: mapCostLevelToBudgetLevel(preferenceAdjustments.costLevel),
      // Map activityLevel
      activityLevel: mapActivityLevelToProfileService(preferenceAdjustments.activityLevel),
      // Any other preferences mappings...
    };
    
    // Call profile service API with user token
    const response = await axios.put(
      `${config.USER_PROFILE_SERVICE_URL}/api/preferences`, // Adjust to match your actual endpoint
      profileServicePreferences,
      { 
        headers: { 
          Authorization: authToken
        } 
      }
    );
    
    if (response.status === 200) {
      logger.info(`Successfully updated preferences in profile service for user ${userId}`);
      return true;
    } else {
      logger.warn(`Unexpected response from profile service: ${response.status}`);
      return false;
    }
  } catch (error) {
    logger.error(`Error updating preferences in profile service: ${error.message}`);
    if (error.response) {
      logger.error(`Response: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
};

/**
 * Map cost level to budget level for profile service
 */
const mapCostLevelToBudgetLevel = (costLevel) => {
  const map = {
    1: 'budget',
    2: 'economy',
    3: 'moderate',
    4: 'luxury',
    5: 'ultra-luxury'
  };
  return map[costLevel] || 'moderate';
};

/**
 * Map activity level to profile service format
 */
const mapActivityLevelToProfileService = (activityLevel) => {
  const map = {
    'relaxed': 'low',
    'moderate': 'medium',
    'active': 'high'
  };
  return map[activityLevel] || 'medium';
};

// Register the task with Celery
const registerTasks = (celeryApp) => {
  // Only register if we have the register method (our fake client)
  if (celeryApp && typeof celeryApp.register === 'function') {
    celeryApp.register('tasks.update_user_features', updateUserFeaturesTask);
    logger.info('Registered update_user_features task with Celery');
    return true;
  }
  
  // For real celery, we'd need a worker process
  logger.info('Task registration skipped - requires external Celery worker in production');
  return false;
};

module.exports = {
  updateUserFeaturesTask,
  updateUserPreferencesInProfileService,
  registerTasks
};