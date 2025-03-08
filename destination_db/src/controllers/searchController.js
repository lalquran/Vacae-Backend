const { Op, Sequelize } = require('sequelize');
const Destination = require('../models/destination');
const Category = require('../models/category');
const OperatingHours = require('../models/operatingHours');
const { setCache, getCache } = require('../config/redis');
const { buildRadiusQuery } = require('../utils/geoUtils');
const logger = require('../utils/logger');

// Search destinations
exports.searchDestinations = async (req, res, next) => {
  try {
    const { 
      query, 
      categories, 
      costLevelMin, 
      costLevelMax, 
      lat, 
      lng, 
      radius, 
      page = 1, 
      limit = 20, 
      sort = 'name', 
      order = 'ASC' 
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Build where conditions
    const whereConditions = { status: 'active' };
    
    // Text search
    if (query) {
      whereConditions[Op.or] = [
        { name: { [Op.iLike]: `%${query}%` } },
        { description: { [Op.iLike]: `%${query}%` } }
      ];
    }
    
    // Cost level range
    if (costLevelMin || costLevelMax) {
      whereConditions.costLevel = {};
      if (costLevelMin) whereConditions.costLevel[Op.gte] = costLevelMin;
      if (costLevelMax) whereConditions.costLevel[Op.lte] = costLevelMax;
    }
    
    // Location radius search
    if (lat && lng && radius) {
      const radiusQuery = buildRadiusQuery(lat, lng, radius);
      whereConditions[radiusQuery] = true;
    }
    
    // Build include conditions
    const includeConditions = [
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] } // Don't include junction table
      },
      {
        model: OperatingHours,
        as: 'operatingHours'
      }
    ];
    
    // Category filter
    if (categories) {
      const categoryArray = categories.split(',');
      includeConditions[0].where = { slug: { [Op.in]: categoryArray } };
    }
    
    // Generate cache key
    const cacheKey = `search:${query || 'all'}:${categories || 'all'}:${costLevelMin || '0'}:${costLevelMax || '5'}:${lat || '0'}:${lng || '0'}:${radius || '0'}:${page}:${limit}:${sort}:${order}`;
    
    // Try to get from cache first
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }
    
    // Execute search query
    const { count, rows: destinations } = await Destination.findAndCountAll({
      where: whereConditions,
      include: includeConditions,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sort, order]],
      distinct: true // Important for correct count with associations
    });
    
    const responseData = {
      data: destinations,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    };
    
    // Cache the result
    await setCache(cacheKey, responseData, 1800); // Cache for 30 minutes
    
    res.status(200).json(responseData);
  } catch (error) {
    logger.error('Error searching destinations:', error);
    next(error);
  }
};

// Find nearby destinations
exports.findNearbyDestinations = async (req, res, next) => {
  try {
    const { lat, lng, radius = 5, categories, limit = 20 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }
    
    // Generate cache key
    const cacheKey = `nearby:${lat}:${lng}:${radius}:${categories || 'all'}:${limit}`;
    
    // Try to get from cache first
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return res.status(200).json({ data: cachedData });
    }
    
    // Build radius query
    const radiusQuery = buildRadiusQuery(lat, lng, radius);
    
    // Build where conditions
    const whereConditions = { 
      status: 'active',
      [radiusQuery]: true
    };
    
    // Build include conditions
    const includeConditions = [
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] } // Don't include junction table
      },
      {
        model: OperatingHours,
        as: 'operatingHours'
      }
    ];
    
    // Category filter
    if (categories) {
      const categoryArray = categories.split(',');
      includeConditions[0].where = { slug: { [Op.in]: categoryArray } };
    }
    
    // Order by distance
    const orderBy = Sequelize.literal(`ST_Distance(
      location, 
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
    )`);
    
    // Execute query
    const destinations = await Destination.findAll({
      where: whereConditions,
      include: includeConditions,
      order: [orderBy],
      limit: parseInt(limit)
    });
    
    // Cache the result
    await setCache(cacheKey, destinations, 1800); // Cache for 30 minutes
    
    res.status(200).json({ data: destinations });
  } catch (error) {
    logger.error('Error finding nearby destinations:', error);
    next(error);
  }
};

// Get destinations by opening hours
exports.getOpenDestinations = async (req, res, next) => {
  try {
    const { day, time, categories, lat, lng, radius, limit = 20 } = req.query;
    
    // Determine day of week and time
    const dayOfWeek = day ? parseInt(day) : new Date().getDay(); // 0 = Sunday, 6 = Saturday
    const currentTime = time || new Date().toTimeString().substring(0, 8); // HH:MM:SS
    
    // Generate cache key
    const cacheKey = `open:${dayOfWeek}:${currentTime}:${categories || 'all'}:${lat || '0'}:${lng || '0'}:${radius || '0'}:${limit}`;
    
    // Try to get from cache first
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return res.status(200).json({ data: cachedData });
    }
    
    // Build where conditions for operating hours
    const operatingHoursConditions = {
      dayOfWeek,
      [Op.or]: [
        { is24Hours: true },
        {
          [Op.and]: [
            { openTime: { [Op.lte]: currentTime } },
            { closeTime: { [Op.gt]: currentTime } }
          ]
        }
      ]
    };
    
    // Build destination where conditions
    const whereConditions = { status: 'active' };
    
    // Location radius search
    if (lat && lng && radius) {
      const radiusQuery = buildRadiusQuery(lat, lng, radius);
      whereConditions[radiusQuery] = true;
    }
    
    // Build include conditions
    const includeConditions = [
      {
        model: OperatingHours,
        as: 'operatingHours',
        where: operatingHoursConditions
      },
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] } // Don't include junction table
      }
    ];
    
    // Category filter
    if (categories) {
      const categoryArray = categories.split(',');
      includeConditions[1].where = { slug: { [Op.in]: categoryArray } };
    }
    
    // Execute query
    const destinations = await Destination.findAll({
      where: whereConditions,
      include: includeConditions,
      limit: parseInt(limit)
    });
    
    // Cache the result
    await setCache(cacheKey, destinations, 900); // Cache for 15 minutes
    
    res.status(200).json({ data: destinations });
  } catch (error) {
    logger.error('Error finding open destinations:', error);
    next(error);
  }
};