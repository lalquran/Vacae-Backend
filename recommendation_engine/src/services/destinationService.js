const axios = require('axios');
const config = require('../config/settings');
const logger = require('../utils/logger');
const { getCache, setCache } = require('../config/redis');

/**
 * Get destination details from the destination service
 */
const getDestinationDetails = async (destinationIds) => {
  try {
    // Check cache first if enabled
    if (config.REDIS_ENABLED) {
      const cacheKey = `destinations:${destinationIds.sort().join(',')}`;
      const cachedData = await getCache(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
    }
    
    // Fetch from destination service
    const response = await axios.get(`${config.DESTINATION_SERVICE_URL}/api/destinations/batch`, {
      params: { ids: destinationIds.join(',') }
    });
    
    if (response.data && response.data.data) {
      // Cache the result if redis is enabled
      if (config.REDIS_ENABLED) {
        const cacheKey = `destinations:${destinationIds.sort().join(',')}`;
        await setCache(cacheKey, JSON.stringify(response.data.data), 3600); // Cache for 1 hour
      }
      
      return response.data.data;
    }
    
    throw new Error('Invalid response from destination service');
  } catch (error) {
    logger.error('Error fetching destination details:', error);
    throw error;
  }
};

/**
 * Search for destinations by criteria
 */
const searchDestinations = async (criteria) => {
  try {
    const response = await axios.get(`${config.DESTINATION_SERVICE_URL}/api/destinations/search`, {
      params: criteria
    });
    
    if (response.data && response.data.data) {
      return response.data.data;
    }
    
    throw new Error('Invalid response from destination service');
  } catch (error) {
    logger.error('Error searching destinations:', error);
    throw error;
  }
};

/**
 * Find nearby destinations based on location
 */
const findNearbyDestinations = async (lat, lng, radius, categories) => {
  try {
    const response = await axios.get(`${config.DESTINATION_SERVICE_URL}/api/destinations/nearby`, {
      params: { lat, lng, radius, categories }
    });
    
    if (response.data && response.data.data) {
      return response.data.data;
    }
    
    throw new Error('Invalid response from destination service');
  } catch (error) {
    logger.error('Error finding nearby destinations:', error);
    throw error;
  }
};

module.exports = {
  getDestinationDetails,
  searchDestinations,
  findNearbyDestinations
};