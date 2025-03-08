const { getCache, setCache } = require('../config/redis');
const logger = require('../utils/logger');

// Caching middleware
exports.cacheMiddleware = (duration = 3600) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Create a cache key from the full URL
    const cacheKey = `cache:${req.originalUrl}`;

    try {
      // Try to get from cache
      const cachedData = await getCache(cacheKey);
      
      if (cachedData) {
        logger.debug(`Cache hit for: ${req.originalUrl}`);
        return res.status(200).json(cachedData);
      }

      logger.debug(`Cache miss for: ${req.originalUrl}`);
      
      // If not in cache, replace the response.json method
      const originalJson = res.json;
      
      res.json = function(data) {
        // Restore original json method
        res.json = originalJson;
        
        // Cache the response data
        setCache(cacheKey, data, duration).catch(err => {
          // Log cache error but don't block response
          logger.error('Cache set error:', err);
        });
        
        // Send the response
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      // If cache fails, just continue without caching
      next();
    }
  };
};

// Clear cache for a specific pattern
exports.clearCache = async (pattern) => {
  try {
    const { clearCacheByPattern } = require('../config/redis');
    await clearCacheByPattern(pattern);
    return true;
  } catch (error) {
    logger.error('Error clearing cache:', error);
    return false;
  }
};