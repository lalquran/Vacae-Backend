const Redis = require('redis');
const config = require('./settings');
const logger = require('../utils/logger');

// Create Redis client
let redisClient = null;

// Initialize Redis client if enabled
const initRedis = async () => {
  if (!config.REDIS_ENABLED) {
    logger.info('Redis caching is disabled');
    return false;
  }

  try {
    redisClient = Redis.createClient({
      url: `redis://${config.REDIS_HOST}:${config.REDIS_PORT}`
    });

    redisClient.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    redisClient.on('connect', () => {
      logger.info('Connected to Redis successfully');
    });

    await redisClient.connect();
    return true;
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    return false;
  }
};

// Get value from cache
const getCache = async (key) => {
  if (!redisClient || !config.REDIS_ENABLED) {
    return null;
  }

  try {
    return await redisClient.get(key);
  } catch (error) {
    logger.error(`Error getting cache for key ${key}:`, error);
    return null;
  }
};

// Set value in cache with optional TTL in seconds
const setCache = async (key, value, ttl = 3600) => {
  if (!redisClient || !config.REDIS_ENABLED) {
    return false;
  }

  try {
    await redisClient.set(key, value, { EX: ttl });
    return true;
  } catch (error) {
    logger.error(`Error setting cache for key ${key}:`, error);
    return false;
  }
};

// Invalidate a cache key
const invalidateCache = async (key) => {
  if (!redisClient || !config.REDIS_ENABLED) {
    return false;
  }

  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    logger.error(`Error invalidating cache for key ${key}:`, error);
    return false;
  }
};

// Invalidate cache by pattern (using SCAN)
const invalidateCachePattern = async (pattern) => {
  if (!redisClient || !config.REDIS_ENABLED) {
    return false;
  }

  try {
    // Use SCAN to find keys matching pattern
    let cursor = 0;
    do {
      const scanResult = await redisClient.scan(cursor, {
        MATCH: pattern,
        COUNT: 100
      });
      
      cursor = scanResult.cursor;
      const keys = scanResult.keys;
      
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } while (cursor !== 0);
    
    return true;
  } catch (error) {
    logger.error(`Error invalidating cache pattern ${pattern}:`, error);
    return false;
  }
};

// Module initialization
initRedis();

module.exports = {
  getCache,
  setCache,
  invalidateCache,
  invalidateCachePattern,
  initRedis,
  getClient: () => redisClient
};