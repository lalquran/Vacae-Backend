const sequelize = require('../config/database');
const Destination = require('../models/destination');
const Category = require('../models/category');
const OperatingHours = require('../models/operatingHours');
const { setCache, getCache } = require('../config/redis');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');
const { ValidationError } = require('../utils/errors');

// Search destinations
exports.searchDestinations = asyncHandler(async (req, res) => {
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
});

// Find nearby destinations
exports.findNearbyDestinations = asyncHandler(async (req, res) => {
  const { lat, lng, radius = 5, categories, limit = 20 } = req.query;
  
  if (!lat || !lng) {
    throw new ValidationError('Latitude and longitude are required');
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
  const [results] = await sequelize.query(query);
  
  res.status(200).json({ data: results });
});

// Get destinations by opening hours
exports.getOpenDestinations = asyncHandler(async (req, res) => {
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
  const [results] = await sequelize.query(query);
  
  res.status(200).json({ data: results });
});