const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Destination = require('../models/destination');
const Category = require('../models/category');
const OperatingHours = require('../models/operatingHours');
const { setCache, getCache } = require('../config/redis');
const logger = require('../utils/logger');

// Search destinations
exports.searchDestinations = async (req, res, next) => {
  try {
    const { 
      query, 
      categories, 
      costLevelMin, 
      costLevelMax, 
      page = 1, 
      limit = 20, 
      sort = 'name', 
      order = 'ASC' 
    } = req.query;
    
    // Build a basic query - simplified to ensure it works
    const sequelize = require('../config/database');
    const Destination = require('../models/destination');
    const { Op } = require('sequelize');
    
    // Simple where conditions - just active destinations to start
    const whereConditions = { status: 'active' };
    
    // Add text search if provided
    if (query) {
      whereConditions[Op.or] = [
        { name: { [Op.iLike]: `%${query}%` } },
        { description: { [Op.iLike]: `%${query}%` } }
      ];
    }
    
    // Add cost level filters if provided
    if (costLevelMin || costLevelMax) {
      whereConditions.costLevel = {};
      if (costLevelMin) whereConditions.costLevel[Op.gte] = parseInt(costLevelMin);
      if (costLevelMax) whereConditions.costLevel[Op.lte] = parseInt(costLevelMax);
    }
    
    // Simple query without complex joins or filtering
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows } = await Destination.findAndCountAll({
      where: whereConditions,
      offset,
      limit: parseInt(limit),
      order: [[sort, order]],
    });

    // Return response with pagination
    const responseData = {
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / parseInt(limit))
      }
    };
    
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Search error:', error);
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
    
    // Convert parameters to proper types
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusNum = parseFloat(radius);
    const limitNum = parseInt(limit);
    
    // Build basic query for active destinations
    let query = `
      SELECT 
        d.id, 
        d.name, 
        d.description,
        d.status,
        d."visitDuration",
        d."costLevel",
        ST_Distance(
          d.location::geography, 
          ST_SetSRID(ST_MakePoint(${lngNum}, ${latNum}), 4326)::geography
        ) / 1000 as distance_km
      FROM 
        destinations d
      WHERE 
        d.status = 'active' AND
        ST_DWithin(
          d.location::geography, 
          ST_SetSRID(ST_MakePoint(${lngNum}, ${latNum}), 4326)::geography, 
          ${radiusNum * 1000}
        )
    `;
    
    // Add category filter if provided
    if (categories) {
      query += `
        AND d.id IN (
          SELECT dc."destinationId" 
          FROM destination_categories dc
          JOIN categories c ON dc."categoryId" = c.id
          WHERE c.slug IN (${categories.split(',').map(c => `'${c.trim()}'`).join(',')})
        )
      `;
    }
    
    // Add order and limit
    query += `
      ORDER BY distance_km ASC
      LIMIT ${limitNum}
    `;
    
    // Execute query
    const sequelize = require('../config/database');
    const [results] = await sequelize.query(query);
    
    res.status(200).json({ data: results });
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
    const dayOfWeek = day ? parseInt(day) : new Date().getDay();
    const currentTime = time || new Date().toTimeString().substring(0, 8);
    
    // Build basic query to find open destinations
    let query = `
      SELECT DISTINCT d.id, d.name, d.description, d.status, d."visitDuration", d."costLevel"
      FROM destinations d
      JOIN operating_hours oh ON d.id = oh."destinationId"
      WHERE d.status = 'active'
      AND oh."dayOfWeek" = ${dayOfWeek}
      AND (
        oh."is24Hours" = true OR
        (oh."openTime" <= '${currentTime}' AND oh."closeTime" > '${currentTime}')
      )
    `;
    
    // Add category filter if provided
    if (categories) {
      query += `
        AND d.id IN (
          SELECT dc."destinationId" 
          FROM destination_categories dc
          JOIN categories c ON dc."categoryId" = c.id
          WHERE c.slug IN (${categories.split(',').map(c => `'${c.trim()}'`).join(',')})
        )
      `;
    }
    
    // Add location filter if provided
    if (lat && lng && radius) {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      const radiusNum = parseFloat(radius);
      
      query += `
        AND ST_DWithin(
          d.location::geography, 
          ST_SetSRID(ST_MakePoint(${lngNum}, ${latNum}), 4326)::geography, 
          ${radiusNum * 1000}
        )
      `;
    }
    
    // Add limit
    query += `
      LIMIT ${parseInt(limit)}
    `;
    
    // Execute query
    const sequelize = require('../config/database');
    const [results] = await sequelize.query(query);
    
    res.status(200).json({ data: results });
  } catch (error) {
    logger.error('Error finding open destinations:', error);
    next(error);
  }
};