require('dotenv').config();
const logger = require('../utils/logger');

// Create dummy implementations for environments without Redis
const dummyCache = {
  cache: new Map(),
  async set(key, value, expiry) {
    this.cache.set(key, {
      value: JSON.stringify(value),
      expiry: expiry ? Date.now() + (expiry * 1000) : null
    });
    return true;
  },
  async get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Check if expired
    if (item.expiry && Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return JSON.parse(item.value);
  },
  async del(key) {
    this.cache.delete(key);
    return true;
  },
  async keys() {
    return Array.from(this.cache.keys());
  }
};

let redis;
let useMemoryCache = false;

// Set up Redis or fallback to memory cache
try {
  if (process.env.REDIS_ENABLED === 'false') {
    throw new Error('Redis disabled in configuration');
  }
  
  const Redis = require('ioredis');
  
  const redisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) {
        // After 3 retries, give up and use memory cache
        logger.warn('Redis connection failed after 3 retries, falling back to memory cache');
        return null;
      }
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  };

  redis = new Redis(redisOptions);

  redis.on('connect', () => {
    logger.info('Redis connection established successfully');
  });

  redis.on('error', (error) => {
    if (!useMemoryCache) {
      logger.error('Redis connection error:', error);
      logger.info('Falling back to in-memory cache');
      useMemoryCache = true;
    }
  });
} catch (error) {
  logger.info('Redis module not available or disabled, using in-memory cache instead');
  useMemoryCache = true;
}

// Helper function to set cache with expiry
async function setCache(key, value, expiry = 3600) {
  try {
    if (useMemoryCache) {
      return await dummyCache.set(key, value, expiry);
    }
    
    await redis.set(key, JSON.stringify(value), 'EX', expiry);
    return true;
  } catch (error) {
    logger.error('Cache set error:', error);
    return false;
  }
}

// Helper function to get cached data
async function getCache(key) {
  try {
    if (useMemoryCache) {
      return await dummyCache.get(key);
    }
    
    const cachedData = await redis.get(key);
    return cachedData ? JSON.parse(cachedData) : null;
  } catch (error) {
    logger.error('Cache get error:', error);
    return null;
  }
}

// Helper function to delete cache
async function deleteCache(key) {
  try {
    if (useMemoryCache) {
      return await dummyCache.del(key);
    }
    
    await redis.del(key);
    return true;
  } catch (error) {
    logger.error('Cache delete error:', error);
    return false;
  }
}

// Helper function to clear cache by pattern
async function clearCacheByPattern(pattern) {
  try {
    if (useMemoryCache) {
      const keys = Array.from(dummyCache.cache.keys())
        .filter(key => key.includes(pattern));
      
      keys.forEach(key => dummyCache.cache.delete(key));
      return true;
    }
    
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
    }
    return true;
  } catch (error) {
    logger.error('Cache clear by pattern error:', error);
    return false;
  }
}

module.exports = {
  redis: useMemoryCache ? null : redis,
  setCache,
  getCache,
  deleteCache,
  clearCacheByPattern
};