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
    
    // Since there's no batch endpoint, fetch destinations one by one
    const destinations = [];
    for (const id of destinationIds) {
      try {
        const response = await axios.get(`${config.DESTINATION_SERVICE_URL}/api/destinations/${id}`);
        if (response.data && response.data.data) {
          destinations.push(response.data.data);
        }
      } catch (error) {
        logger.warn(`Failed to fetch destination ${id}: ${error.message}`);
        // Continue with other destinations
      }
    }
    
    // Cache the result if redis is enabled
    if (config.REDIS_ENABLED && destinations.length > 0) {
      const cacheKey = `destinations:${destinationIds.sort().join(',')}`;
      await setCache(cacheKey, JSON.stringify(destinations), 3600); // Cache for 1 hour
    }
    
    return destinations;
  } catch (error) {
    logger.error('Error fetching destination details:', error);
    throw error;
  }
};

/**
 * Search for destinations by criteria
 * Since there's no specific search endpoint, we'll get all destinations and filter
 */
const searchDestinations = async (criteria) => {
  try {
    // Fetch all destinations
    const response = await axios.get(`${config.DESTINATION_SERVICE_URL}/api/destinations`);
    
    if (response.data && response.data.data) {
      const allDestinations = response.data.data;
      
      // Apply filtering based on criteria
      let filteredDestinations = [...allDestinations];
      
      // Filter by query if provided
      if (criteria.query) {
        const query = criteria.query.toLowerCase();
        filteredDestinations = filteredDestinations.filter(dest => 
          dest.name.toLowerCase().includes(query) || 
          (dest.description && dest.description.toLowerCase().includes(query))
        );
      }
      
      // Filter by categories if provided
      if (criteria.categories) {
        const categoryIds = criteria.categories.split(',');
        filteredDestinations = filteredDestinations.filter(dest => 
          dest.categories && dest.categories.some(cat => 
            categoryIds.includes(typeof cat === 'object' ? cat.id : cat)
          )
        );
      }
      
      // Filter by cost level if provided
      if (criteria.costLevelMin || criteria.costLevelMax) {
        filteredDestinations = filteredDestinations.filter(dest => {
          const cost = dest.costLevel || 3;
          const minOk = !criteria.costLevelMin || cost >= parseInt(criteria.costLevelMin);
          const maxOk = !criteria.costLevelMax || cost <= parseInt(criteria.costLevelMax);
          return minOk && maxOk;
        });
      }
      
      // Apply sorting
      const sort = criteria.sort || 'name';
      const order = criteria.order || 'ASC';
      
      filteredDestinations.sort((a, b) => {
        const aVal = a[sort] || '';
        const bVal = b[sort] || '';
        
        if (order.toUpperCase() === 'ASC') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });
      
      // Apply pagination
      const page = parseInt(criteria.page) || 1;
      const limit = parseInt(criteria.limit) || 20;
      const start = (page - 1) * limit;
      const end = start + limit;
      
      const paginatedResults = filteredDestinations.slice(start, end);
      
      return {
        data: paginatedResults,
        pagination: {
          total: filteredDestinations.length,
          page,
          limit,
          pages: Math.ceil(filteredDestinations.length / limit)
        }
      };
    }
    
    throw new Error('Invalid response from destination service');
  } catch (error) {
    logger.error('Error searching destinations:', error);
    throw error;
  }
};

/**
 * Find nearby destinations based on location
 * Since there's no nearby endpoint, we'll get all destinations and calculate distances
 */
const findNearbyDestinations = async (lat, lng, radius, categories) => {
  try {
    // Fetch all destinations
    const response = await axios.get(`${config.DESTINATION_SERVICE_URL}/api/destinations`);
    
    if (response.data && response.data.data) {
      const allDestinations = response.data.data;
      
      // Filter and calculate distances
      const nearbyDestinations = allDestinations
        .map(dest => {
          // Extract coordinates from destination
          let destLat, destLng;
          
          if (dest.location && dest.location.type === 'Point' && dest.location.coordinates) {
            // GeoJSON Point format
            [destLng, destLat] = dest.location.coordinates;
          } else if (dest.latitude !== undefined && dest.longitude !== undefined) {
            // Flat format
            destLat = dest.latitude;
            destLng = dest.longitude;
          } else {
            // Skip destinations without valid coordinates
            return null;
          }
          
          // Calculate distance
          const distance = calculateDistance(lat, lng, destLat, destLng);
          
          return {
            ...dest,
            distance_km: distance
          };
        })
        .filter(dest => 
          // Remove null entries and filter by radius
          dest !== null && 
          dest.distance_km <= radius &&
          // Filter by categories if provided
          (!categories || !dest.categories || 
            dest.categories.some(cat => 
              categories.includes(typeof cat === 'object' ? cat.id : cat)
            )
          )
        )
        .sort((a, b) => a.distance_km - b.distance_km);
      
      return nearbyDestinations;
    }
    
    throw new Error('Invalid response from destination service');
  } catch (error) {
    logger.error('Error finding nearby destinations:', error);
    throw error;
  }
};

/**
 * Helper to calculate distance between two points using Haversine formula
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c;
  return distance;
};

const deg2rad = (deg) => {
  return deg * (Math.PI/180);
};

module.exports = {
  getDestinationDetails,
  searchDestinations,
  findNearbyDestinations
};