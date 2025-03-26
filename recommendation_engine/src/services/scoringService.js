const axios = require('axios');
const config = require('../config/settings');
const logger = require('../utils/logger');
const destinationService = require('./destinationService');
const profileService = require('./profileService');
const UserPreference = require('../models/userPreference');

/**
 * Calculate scores for destinations based on user preferences
 * This is the core recommendation algorithm for MVP
 */
const scoreDestinations = async (userId, destinationIds, context = {}, authToken=null) => {
  try {
    const learnedPreferences = await UserPreference.findOne({
      where: { userId }
    });

    let userProfile;
    
    if (learnedPreferences && learnedPreferences.categories.length > 0) {
      logger.info(`Using learned preferences for user ${userId}`);
      userProfile = {
        userId,
        preferences: {
          categories: learnedPreferences.categories,
          costLevel: learnedPreferences.costLevel,
          activityLevel: learnedPreferences.activityLevel
        }
      };
    } 
    else {
      // Fall back to profile service
      logger.info(`No learned preferences, using profile for user ${userId}`);
      userProfile = await profileService.getUserProfile(userId, authToken);
    }
    
    if (!userProfile) {
      throw new Error('User profile not found');
    }
    
    // Get destination data
    const destinations = await destinationService.getDestinationDetails(destinationIds);
    
    // Score each destination
    const scoredDestinations = destinations.map(destination => {
      // Calculate preference score (how well the destination matches user preferences)
      const preferenceScore = calculatePreferenceScore(destination, userProfile);
      
      // Calculate popularity score
      const popularityScore = destination.popularity / 5; // Normalize to 0-1
      
      // Apply contextual adjustments
      const contextAdjustment = calculateContextAdjustment(destination, context);
      
      // Calculate final weighted score
      const finalScore = (
        preferenceScore * config.PREFERENCE_WEIGHT +
        popularityScore * config.POPULARITY_WEIGHT
      ) * contextAdjustment;
      
      // Return scored destination with reasoning
      return {
        destinationId: destination.id,
        score: finalScore,
        reasoning: {
          preferenceScore,
          popularityScore,
          contextAdjustment,
          preferenceFactors: getPreferenceFactors(destination, userProfile)
        }
      };
    });
    
    // Sort by score
    return scoredDestinations.sort((a, b) => b.score - a.score);
  } catch (error) {
    logger.error('Error scoring destinations:', error);
    throw error;
  }
};

/**
 * Calculate how well a destination matches user preferences
 */
 const calculatePreferenceScore = (destination, userProfile) => {
  let score = 0.5; // Start with neutral score
  
  // Category match
  const userCategories = userProfile.preferences.categories || [];
  
  // Get destination categories - handle different formats
  let destinationCategories = [];
  if (destination.categories) {
    destinationCategories = destination.categories.map(cat => 
      typeof cat === 'object' ? cat.id || cat.name : cat
    );
  }
  
  // Find overlap between user categories and destination categories
  const categoryOverlap = destinationCategories.filter(category => 
    userCategories.includes(category)
  ).length;
  
  if (destinationCategories.length > 0) {
    score += 0.3 * (categoryOverlap / destinationCategories.length);
  }
  
  // Check if this is an excluded activity
  if (userProfile.preferences.excludedActivities && 
      userProfile.preferences.excludedActivities.some(act => 
        destinationCategories.includes(act)
      )) {
    score -= 0.4; // Strong penalty for excluded activities
  }
  
  // Cost level match (penalize if too far from preferred cost level)
  const costDifference = Math.abs((destination.costLevel || 3) - (userProfile.preferences.costLevel || 3));
  score -= 0.1 * costDifference;
  
  // Activity level match
  if (destination.visitDuration && userProfile.preferences.activityLevel) {
    // Higher visit duration might appeal to users who prefer more immersive experiences
    if (userProfile.preferences.activityLevel === 'relaxed' && destination.visitDuration > 120) {
      score += 0.1;
    } else if (userProfile.preferences.activityLevel === 'moderate' && 
              destination.visitDuration >= 60 && destination.visitDuration <= 180) {
      score += 0.1;
    } else if (userProfile.preferences.activityLevel === 'active' && destination.visitDuration < 120) {
      score += 0.1;
    }
  }
  
  // Ensure score is in 0-1 range
  return Math.max(0, Math.min(1, score));
};

/**
 * Apply contextual adjustments (weather, time, etc.)
 */
const calculateContextAdjustment = (destination, context) => {
  let adjustment = 1.0;
  
  // Time of day adjustment
  if (context.timeOfDay && destination.attributes && destination.attributes.bestTimeOfDay) {
    if (destination.attributes.bestTimeOfDay === context.timeOfDay) {
      adjustment *= 1.2;
    }
  }
  
  // Weather adjustment
  if (context.weather && destination.attributes && destination.attributes.indoor) {
    if (context.weather === 'rain' && destination.attributes.indoor === true) {
      adjustment *= 1.3; // Boost indoor activities in rainy weather
    } else if (context.weather === 'sunny' && destination.attributes.indoor === false) {
      adjustment *= 1.2; // Boost outdoor activities in sunny weather
    }
  }
  
  // Time constraints
  if (context.availableTime && destination.visitDuration) {
    if (destination.visitDuration > context.availableTime) {
      // Penalize destinations that take too long
      adjustment *= 0.7;
    }
  }
  
  return adjustment;
};

/**
 * Get detailed factors that influenced the preference score for explanation
 */
const getPreferenceFactors = (destination, userProfile) => {
  const factors = [];
  
  // Category matches
  const userCategories = userProfile.preferences.categories || [];
  const destinationCategories = destination.categories || [];
  
  const matchingCategories = destinationCategories.filter(category => 
    userCategories.includes(category.id)
  );
  
  if (matchingCategories.length > 0) {
    factors.push({
      type: 'category_match',
      description: `Matches ${matchingCategories.length} of your preferred categories`,
      impact: 'positive'
    });
  }
  
  // Cost level
  const costDifference = Math.abs((destination.costLevel || 3) - (userProfile.preferences.costLevel || 3));
  if (costDifference === 0) {
    factors.push({
      type: 'cost_match',
      description: 'Perfectly matches your budget preference',
      impact: 'positive'
    });
  } else if (costDifference >= 2) {
    factors.push({
      type: 'cost_mismatch',
      description: 'Significantly different from your budget preference',
      impact: 'negative'
    });
  }
  
  // Add more factors as needed
  
  return factors;
};

module.exports = {
  scoreDestinations
};