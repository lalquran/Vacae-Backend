const axios = require('axios');
const config = require('../config/settings');
const logger = require('../utils/logger');
const { getCache, setCache } = require('../config/redis');

/**
 * Get user profile from the profile service
 */
 const getUserProfile = async (userId, authToken = null) => {
  try {
    // Check cache first if enabled
    // if (config.REDIS_ENABLED) {
    //   const cacheKey = `user_profile:${userId}`;
    //   const cachedProfile = await getCache(cacheKey);
    //   if (cachedProfile) {
    //     return JSON.parse(cachedProfile);
    //   }
    // }
    
    // Prepare headers with auth token if provided
    const headers = {};
    if (authToken) {
      headers.Authorization = authToken;
    }
    
    // Fetch profile from profile service
    const profileResponse = await axios.get(`${config.USER_PROFILE_SERVICE_URL}/api/profiles`, {
      headers
    });
    
    // Fetch preferences from profile service
    const preferencesResponse = await axios.get(`${config.USER_PROFILE_SERVICE_URL}/api/preferences`, {
      headers
    });
    
    if (profileResponse.data && profileResponse.data.data && 
        preferencesResponse.data && preferencesResponse.data.data) {
      
      // Combine profile and preferences data
      const profileData = {
        ...profileResponse.data.data,
        preferences: {
          // Map the preferences to match what the recommendation engine expects
          categories: Object.keys(preferencesResponse.data.data.categories || {})
            .filter(cat => preferencesResponse.data.data.categories[cat] > 2)  // Only include categories rated above 2
            .map(cat => cat),  // Map to category IDs or names
          costLevel: mapBudgetLevelToCostLevel(profileResponse.data.data.budgetLevel),
          activityLevel: mapActivityLevel(profileResponse.data.data.activityLevel),
          excludedActivities: preferencesResponse.data.data.excludedActivities || [],
          preferredTransportation: preferencesResponse.data.data.preferredTransportation || [],
          schedule: preferencesResponse.data.data.schedule || {}
        },
        userId: userId
      };
      
      // Cache the result if redis is enabled
      if (config.REDIS_ENABLED) {
        const cacheKey = `user_profile:${userId}`;
        await setCache(cacheKey, JSON.stringify(profileData), 3600); // Cache for 1 hour
      }
      
      return profileData;
    }
    
    throw new Error('Invalid response from profile service');
  } catch (error) {
    logger.error(`Error fetching user profile for ${userId}:`, error);
    
    // Return fallback profile for testing or development
    if (config.NODE_ENV === 'development') {
      logger.warn('Using fallback profile for development');
      return {
        userId,
        preferences: {
          categories: ["museums", "outdoorActivities", "historicalSites"],
          costLevel: 3,
          activityLevel: 'moderate'
        }
      };
    }
    
    throw error;
  }
};

// Helper function to map budget level to cost level
const mapBudgetLevelToCostLevel = (budgetLevel) => {
  const budgetMap = {
    'budget': 1,
    'economy': 2,
    'moderate': 3,
    'luxury': 4,
    'ultra-luxury': 5
  };
  
  return budgetMap[budgetLevel] || 3; // Default to moderate
};

// Helper function to map activity level
const mapActivityLevel = (activityLevel) => {
  const activityMap = {
    'low': 'relaxed',
    'medium': 'moderate',
    'high': 'active'
  };
  
  return activityMap[activityLevel] || 'moderate'; // Default to moderate
};

/**
 * Get user preferences
 */
const getUserPreferences = async (userId) => {
  try {
    // Check cache first if enabled
    if (config.REDIS_ENABLED) {
      const cacheKey = `user_preferences:${userId}`;
      const cachedPreferences = await getCache(cacheKey);
      if (cachedPreferences) {
        return JSON.parse(cachedPreferences);
      }
    }
    
    // Fetch from profile service
    const response = await axios.get(`${config.USER_PROFILE_SERVICE_URL}/api/users/${userId}/preferences`);
    
    if (response.data && response.data.data) {
      // Cache the result if redis is enabled
      if (config.REDIS_ENABLED) {
        const cacheKey = `user_preferences:${userId}`;
        await setCache(cacheKey, JSON.stringify(response.data.data), 3600); // Cache for 1 hour
      }
      
      return response.data.data;
    }
    
    throw new Error('Invalid response from profile service');
  } catch (error) {
    logger.error('Error fetching user preferences:', error);
    throw error;
  }
};

/**
 * Get user feedback history
 */
const getUserFeedback = async (userId) => {
  try {
    const response = await axios.get(`${config.USER_PROFILE_SERVICE_URL}/api/users/${userId}/feedback`);
    
    if (response.data && response.data.data) {
      return response.data.data;
    }
    
    throw new Error('Invalid response from profile service');
  } catch (error) {
    logger.error('Error fetching user feedback:', error);
    throw error;
  }
};

module.exports = {
  getUserProfile,
  getUserPreferences,
  getUserFeedback
};