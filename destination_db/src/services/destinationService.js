const { Op } = require('sequelize');
const Destination = require('../models/destination');
const Category = require('../models/category');
const OperatingHours = require('../models/operatingHours');
const Review = require('../models/review');
const { buildRadiusQuery } = require('../utils/geoUtils');
const logger = require('../utils/logger');

/**
 * Get destinations with filtering, pagination, and sorting
 */
exports.getDestinations = async (options) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sort = 'name', 
      order = 'ASC', 
      category, 
      costLevel,
      status = 'active' 
    } = options;
    
    const offset = (page - 1) * limit;
    
    // Build where conditions
    const whereConditions = { status };
    
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
    
    return {
      data: destinations,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    };
  } catch (error) {
    logger.error('Error in destinationService.getDestinations:', error);
    throw error;
  }
};

/**
 * Get a single destination by ID with all related data
 */
exports.getDestinationById = async (id) => {
  try {
    const destination = await Destination.findByPk(id, {
      include: [
        {
          model: Category,
          as: 'categories',
          through: { attributes: [] }
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
      throw new Error('Destination not found');
    }
    
    return destination;
  } catch (error) {
    logger.error(`Error in destinationService.getDestinationById for ID ${id}:`, error);
    throw error;
  }
};

/**
 * Create a new destination with associated data
 */
exports.createDestination = async (destinationData) => {
  try {
    const { 
      categoryIds, 
      operatingHours, 
      ...destinationFields 
    } = destinationData;
    
    // Create destination
    const destination = await Destination.create(destinationFields);
    
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
    
    // Fetch complete destination with associations
    return await this.getDestinationById(destination.id);
  } catch (error) {
    logger.error('Error in destinationService.createDestination:', error);
    throw error;
  }
};

/**
 * Update an existing destination
 */
exports.updateDestination = async (id, updateData) => {
  try {
    const { categoryIds, ...updateFields } = updateData;
    
    // Find destination
    const destination = await Destination.findByPk(id);
    if (!destination) {
      throw new Error('Destination not found');
    }
    
    // Update destination
    await destination.update(updateFields);
    
    // Update categories if provided
    if (categoryIds && categoryIds.length > 0) {
      await destination.setCategories(categoryIds);
    }
    
    // Return updated destination with associations
    return await this.getDestinationById(id);
  } catch (error) {
    logger.error(`Error in destinationService.updateDestination for ID ${id}:`, error);
    throw error;
  }
};

/**
 * Delete a destination
 */
exports.deleteDestination = async (id) => {
  try {
    const destination = await Destination.findByPk(id);
    if (!destination) {
      throw new Error('Destination not found');
    }
    
    await destination.destroy();
    return true;
  } catch (error) {
    logger.error(`Error in destinationService.deleteDestination for ID ${id}:`, error);
    throw error;
  }
};

/**
 * Update operating hours for a destination
 */
exports.updateOperatingHours = async (destinationId, operatingHours) => {
  try {
    // Find destination
    const destination = await Destination.findByPk(destinationId);
    if (!destination) {
      throw new Error('Destination not found');
    }
    
    // Delete existing hours
    await OperatingHours.destroy({
      where: { destinationId }
    });
    
    // Create new hours
    if (operatingHours && operatingHours.length > 0) {
      const hoursRecords = operatingHours.map(hour => ({
        ...hour,
        destinationId
      }));
      
      await OperatingHours.bulkCreate(hoursRecords);
    }
    
    // Fetch updated hours
    const updatedHours = await OperatingHours.findAll({
      where: { destinationId },
      order: [['dayOfWeek', 'ASC']]
    });
    
    return updatedHours;
  } catch (error) {
    logger.error(`Error in destinationService.updateOperatingHours for ID ${destinationId}:`, error);
    throw error;
  }
};

/**
 * Search destinations by various criteria
 */
exports.searchDestinations = async (searchParams) => {
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
    } = searchParams;
    
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
      Object.assign(whereConditions, radiusQuery);
    }
    
    // Build include conditions
    const includeConditions = [
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] }
      },
      {
        model: OperatingHours,
        as: 'operatingHours'
      }
    ];
    
    // Category filter
    if (categories) {
      const categoryArray = typeof categories === 'string' 
        ? categories.split(',') 
        : categories;
        
      includeConditions[0].where = { slug: { [Op.in]: categoryArray } };
    }
    
    // Execute search query
    const { count, rows: destinations } = await Destination.findAndCountAll({
      where: whereConditions,
      include: includeConditions,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sort, order]],
      distinct: true
    });
    
    return {
      data: destinations,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    };
  } catch (error) {
    logger.error('Error in destinationService.searchDestinations:', error);
    throw error;
  }
};
