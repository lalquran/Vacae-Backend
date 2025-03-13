const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Destination = require('../models/destination');
const Category = require('../models/category');
const OperatingHours = require('../models/operatingHours');
const Review = require('../models/review');
const { setCache, getCache, deleteCache } = require('../config/redis');
const { latLngToPoint } = require('../utils/geoUtils');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');
const { NotFoundError, ValidationError, DatabaseError } = require('../utils/errors');

// Get all destinations with pagination
exports.getAllDestinations = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    sort = 'name', 
    order = 'ASC', 
    category, 
    costLevel 
  } = req.query;
  
  const offset = (page - 1) * limit;
  const cacheKey = `destinations:${page}:${limit}:${sort}:${order}:${category || 'all'}:${costLevel || 'all'}`;
  
  // Try to get from cache first
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    return res.status(200).json(cachedData);
  }
  
  // Build where conditions
  const whereConditions = { status: 'active' };
  
  if (costLevel) {
    whereConditions.costLevel = costLevel;
  }
  
  // Build query options
  const queryOptions = {
    where: whereConditions,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [[sort, order]],
    include: [
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] } // Don't include junction table
      },
      {
        model: OperatingHours,
        as: 'operatingHours'
      }
    ]
  };
  
  // If category filter is specified, use it
  if (category) {
    queryOptions.include[0].where = { slug: category };
  }
  
  // Execute query
  const { count, rows: destinations } = await Destination.findAndCountAll(queryOptions);
  
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
  await setCache(cacheKey, responseData, 3600); // Cache for 1 hour
  
  res.status(200).json(responseData);
});

// Get destination by ID
exports.getDestinationById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cacheKey = `destination:${id}`;
  
  // Try to get from cache first
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    return res.status(200).json({ data: cachedData });
  }
  
  const destination = await Destination.findByPk(id, {
    include: [
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] } // Don't include junction table
      },
      {
        model: OperatingHours,
        as: 'operatingHours'
      },
      {
        model: Review,
        as: 'reviews',
        where: { status: 'approved' },
        required: false,
        limit: 5,
        order: [['createdAt', 'DESC']]
      }
    ]
  });
  
  if (!destination) {
    throw new NotFoundError('Destination', id);
  }
  
  // Cache the result
  await setCache(cacheKey, destination, 3600); // Cache for 1 hour
  
  res.status(200).json({ data: destination });
});

// Create new destination
exports.createDestination = asyncHandler(async (req, res) => {
  const { 
    name, 
    description, 
    latitude, 
    longitude, 
    address, 
    contactInfo, 
    visitDuration, 
    costLevel, 
    categoryIds,
    operatingHours 
  } = req.body;
  
  // Create location point
  const location = latLngToPoint(latitude, longitude);
  if (!location) {
    throw new ValidationError('Invalid location coordinates');
  }
  
  // Create destination
  const destination = await Destination.create({
    name,
    description,
    location,
    address,
    contactInfo,
    visitDuration,
    costLevel
  });
  
  // Associate with categories if provided
  if (categoryIds && categoryIds.length > 0) {
    await destination.setCategories(categoryIds);
  }
  
  // Add operating hours if provided
  if (operatingHours && operatingHours.length > 0) {
    const hoursRecords = operatingHours.map(hour => ({
      ...hour,
      destinationId: destination.id
    }));
    
    await OperatingHours.bulkCreate(hoursRecords);
  }
  
  // Clear relevant cache
  await deleteCache('destinations:*');
  
  // Fetch complete destination with associations
  const createdDestination = await Destination.findByPk(destination.id, {
    include: [
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] }
      },
      {
        model: OperatingHours,
        as: 'operatingHours'
      }
    ]
  });
  
  res.status(201).json({ 
    message: 'Destination created successfully',
    data: createdDestination
  });
});

// Update destination
exports.updateDestination = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    name, 
    description, 
    latitude, 
    longitude, 
    address, 
    contactInfo, 
    visitDuration, 
    costLevel, 
    categoryIds,
    status 
  } = req.body;
  
  // Find destination
  const destination = await Destination.findByPk(id);
  if (!destination) {
    throw new NotFoundError('Destination', id);
  }
  
  // Update basic fields
  const updatedFields = {};
  
  if (name) updatedFields.name = name;
  if (description) updatedFields.description = description;
  if (address) updatedFields.address = address;
  if (contactInfo) updatedFields.contactInfo = contactInfo;
  if (visitDuration) updatedFields.visitDuration = visitDuration;
  if (costLevel) updatedFields.costLevel = costLevel;
  if (status) updatedFields.status = status;
  
  // Update location if provided
  if (latitude && longitude) {
    const location = latLngToPoint(latitude, longitude);
    if (location) {
      updatedFields.location = location;
    } else {
      throw new ValidationError('Invalid location coordinates');
    }
  }
  
  // Update destination
  await destination.update(updatedFields);
  
  // Update categories if provided
  if (categoryIds && categoryIds.length > 0) {
    await destination.setCategories(categoryIds);
  }
  
  // Clear relevant cache
  await deleteCache(`destination:${id}`);
  await deleteCache('destinations:*');
  
  // Fetch updated destination with associations
  const updatedDestination = await Destination.findByPk(id, {
    include: [
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] }
      },
      {
        model: OperatingHours,
        as: 'operatingHours'
      }
    ]
  });
  
  res.status(200).json({ 
    message: 'Destination updated successfully',
    data: updatedDestination
  });
});

// Delete destination
exports.deleteDestination = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Find destination
  const destination = await Destination.findByPk(id);
  if (!destination) {
    throw new NotFoundError('Destination', id);
  }
  
  // Delete destination
  await destination.destroy();
  
  // Clear relevant cache
  await deleteCache(`destination:${id}`);
  await deleteCache('destinations:*');
  
  res.status(200).json({ 
    message: 'Destination deleted successfully' 
  });
});

// Update operating hours
exports.updateOperatingHours = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { operatingHours } = req.body;
  
  // Find destination
  const destination = await Destination.findByPk(id);
  if (!destination) {
    throw new NotFoundError('Destination', id);
  }
  
  // Delete existing hours
  await OperatingHours.destroy({
    where: { destinationId: id }
  });
  
  // Create new hours
  if (operatingHours && operatingHours.length > 0) {
    const hoursRecords = operatingHours.map(hour => ({
      ...hour,
      destinationId: id
    }));
    
    await OperatingHours.bulkCreate(hoursRecords);
  }
  
  // Clear relevant cache
  await deleteCache(`destination:${id}`);
  
  // Fetch updated hours
  const updatedHours = await OperatingHours.findAll({
    where: { destinationId: id },
    order: [['dayOfWeek', 'ASC']]
  });
  
  res.status(200).json({ 
    message: 'Operating hours updated successfully',
    data: updatedHours
  });
});