const axios = require('axios');
const config = require('../config/settings');
const logger = require('../utils/logger');
const { getCache, setCache } = require('../config/redis');

/**
 * Get user profile from the profile service
 */
const getUserProfile = async (userId) => {
  try {
    // Check cache first if enabled
    if (config.REDIS_ENABLED) {
      const cacheKey = `user_profile:${userId}`;
      const cachedProfile = await getCache(cacheKey);
      if (cachedProfile) {
        return JSON.parse(cachedProfile);
      }
    }
    
    // Fetch from profile service
    const response = await axios.get(`${config.USER_PROFILE_SERVICE_URL}/api/users/${userId}`);
    
    if (response.data && response.data.data) {
      // Cache the result if redis is enabled
      if (config.REDIS_ENABLED) {
        const cacheKey = `user_profile:${userId}`;
        await setCache(cacheKey, JSON.stringify(response.data.data), 3600); // Cache for 1 hour
      }
      
      return response.data.data;
    }
    
    throw new Error('Invalid response from profile service');
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    throw error;
  }
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