const logger = require('../utils/logger');
const profileService = require('../services/profileService');
const Recommendation = require('../models/recommendation');
const { Op } = require('sequelize');
const { getCache, setCache } = require('../config/redis');
const config = require('../config/settings');

/**
 * Background task to update user feature vectors for recommendations
 * This task should run periodically to ensure user preferences are up to date
 */
const updateUserFeaturesTask = async (data) => {
  try {
    const { userId } = data;
    
    logger.info(`Starting feature update task for user ${userId}`);
    
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
    
    // Get user profile and current preferences
    const userProfile = await profileService.getUserProfile(userId);
    if (!userProfile) {
      throw new Error(`User profile not found for ${userId}`);
    }
    
    // Extract destination IDs from feedback
    const destinationIds = feedbackHistory.map(item => item.destinationId);
    
    // Get destination details - assuming the service can fetch multiple at once
    const destinations = await destinationService.getDestinationDetails(destinationIds);
    
    // Calculate updated preference weights based on user feedback
    const updatedPreferences = calculateUpdatedPreferences(
      userProfile.preferences,
      feedbackHistory,
      destinations
    );
    
    // Cache the updated preferences
    if (config.REDIS_ENABLED) {
      const cacheKey = `user_computed_preferences:${userId}`;
      await setCache(cacheKey, JSON.stringify(updatedPreferences), 86400); // Cache for 24 hours
    }
    
    logger.info(`Updated feature vectors for user ${userId}`);
    
    return {
      success: true,
      updated: true
    };
  } catch (error) {
    logger.error('Error in update user features task:', error);
    throw error;
  }
};

/**
 * Calculate updated user preferences based on feedback history
 * This is a simplified version for MVP
 */
const calculateUpdatedPreferences = (currentPreferences, feedbackHistory, destinations) => {
  // Start with current preferences
  const updatedPreferences = { ...currentPreferences };
  
  // Create a map of destination details for easier lookup
  const destinationMap = destinations.reduce((map, dest) => {
    map[dest.id] = dest;
    return map;
  }, {});
  
  // Track categories the user has shown positive feedback for
  const categoryScores = {};
  
  // Process feedback to adjust preferences
  feedbackHistory.forEach(feedback => {
    const destination = destinationMap[feedback.destinationId];
    if (!destination) return;
    
    // Calculate feedback score: 1 for accepted/completed, -1 for rejected
    const feedbackScore = 
      feedback.status === 'accepted' || feedback.status === 'completed' ? 1 : -1;
    
    // Update category preferences
    if (destination.categories) {
      destination.categories.forEach(category => {
        // Initialize if not exists
        if (!categoryScores[category.id]) {
          categoryScores[category.id] = {
            id: category.id,
            name: category.name,
            totalScore: 0,
            count: 0
          };
        }
        
        // Add this feedback to the category's score
        categoryScores[category.id].totalScore += feedbackScore;
        categoryScores[category.id].count++;
      });
    }
    
    // Adjust cost level preference
    if (destination.costLevel && feedbackScore === 1) {
      // Gradual adjustment toward destinations user liked
      const currentCostLevel = updatedPreferences.costLevel || 3;
      updatedPreferences.costLevel = Math.round(
        (currentCostLevel * 2 + destination.costLevel) / 3
      );
    }
    
    // Adjust activity level preference based on visitDuration
    if (destination.visitDuration && feedbackScore === 1) {
      let preferredActivityLevel;
      
      // Determine preferred activity level based on visit duration
      if (destination.visitDuration > 180) {
        preferredActivityLevel = 'relaxed';
      } else if (destination.visitDuration >= 60 && destination.visitDuration <= 180) {
        preferredActivityLevel = 'moderate';
      } else {
        preferredActivityLevel = 'active';
      }
      
      // Update preferred activity level if different
      if (preferredActivityLevel !== updatedPreferences.activityLevel) {
        updatedPreferences.activityLevel = preferredActivityLevel;
      }
    }
  });
  
  // Update preferred categories based on scores
  const preferredCategories = Object.values(categoryScores)
    // Filter to categories with positive average score
    .filter(category => (category.totalScore / category.count) > 0)
    // Get IDs
    .map(category => category.id);
  
  // Update preferred categories array
  updatedPreferences.categories = preferredCategories;
  
  return updatedPreferences;
};

// Register the task with Celery
const registerTasks = (celeryApp) => {
  celeryApp.register('tasks.update_user_features', updateUserFeaturesTask);
  logger.info('Registered update_user_features task with Celery');
};

module.exports = {
  updateUserFeaturesTask,
  registerTasks
};