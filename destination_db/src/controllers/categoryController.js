const Category = require('../models/category');
const { setCache, getCache, deleteCache } = require('../config/redis');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');
const sequelize = require('../config/database');
const { NotFoundError, ConflictError, ValidationError, DatabaseError } = require('../utils/errors');

// Get all categories
exports.getAllCategories = asyncHandler(async (req, res) => {
  const cacheKey = 'categories:all';
  
  // Try to get from cache first
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    return res.status(200).json({ data: cachedData });
  }
  
  // Get all categories
  const categories = await Category.findAll({
    order: [
      ['displayOrder', 'ASC'],
      ['name', 'ASC']
    ]
  });
  
  // Cache the result
  await setCache(cacheKey, categories, 86400); // Cache for 24 hours
  
  res.status(200).json({ data: categories });
});

// Get category by ID or slug
exports.getCategoryByIdOrSlug = asyncHandler(async (req, res) => {
  const { identifier } = req.params;
  const cacheKey = `category:${identifier}`;
  
  // Try to get from cache first
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    return res.status(200).json({ data: cachedData });
  }
  
  // Find by ID or slug
  const where = {};
  if (identifier.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
    where.id = identifier;
  } else {
    where.slug = identifier;
  }
  
  // First, find the category without trying to include associations
  const category = await Category.findOne({ where });
  
  if (!category) {
    throw new NotFoundError('Category', identifier);
  }
  
  // If we found the category, now get its child categories in a separate query
  const childCategories = await Category.findAll({
    where: { parentId: category.id },
    order: [['displayOrder', 'ASC']]
  });
  
  // Manually add the child categories to the result
  const result = category.toJSON();
  result.childCategories = childCategories;
  
  // Cache the result
  await setCache(cacheKey, result, 86400); // Cache for 24 hours
  
  res.status(200).json({ data: result });
});

// Create new category
exports.createCategory = asyncHandler(async (req, res) => {
  const { name, slug, description, parentId, icon, displayOrder } = req.body;
  
  // Check if slug already exists
  const existingCategory = await Category.findOne({ where: { slug } });
  if (existingCategory) {
    throw new ConflictError(`Category with slug "${slug}" already exists`);
  }
  
  // If parentId is provided, check if parent category exists
  if (parentId) {
    const parentCategory = await Category.findByPk(parentId);
    if (!parentCategory) {
      throw new NotFoundError('Parent category', parentId);
    }
  }
  
  // Create category
  try {
    const category = await Category.create({
      name,
      slug,
      description,
      parentId,
      icon,
      displayOrder
    });
    
    // Clear category cache
    await deleteCache('categories:*');
    
    logger.info(`Category created: ${category.id} - ${category.name}`);
    
    res.status(201).json({ 
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    // This shouldn't happen due to validation middleware, but just in case
    logger.error('Error creating category:', error);
    throw new DatabaseError('Failed to create category', error);
  }
});

// Update category
exports.updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, parentId, icon, displayOrder } = req.body;
  
  // Find category
  const category = await Category.findByPk(id);
  if (!category) {
    throw new NotFoundError('Category', id);
  }
  
  // If parentId is provided and changed, check if parent category exists
  if (parentId && parentId !== category.parentId) {
    const parentCategory = await Category.findByPk(parentId);
    if (!parentCategory) {
      throw new NotFoundError('Parent category', parentId);
    }
    
    // Prevent circular references
    if (parentId === id) {
      throw new ValidationError('Category cannot be its own parent');
    }
  }
  
  // Update category
  try {
    await category.update({
      name,
      description,
      parentId,
      icon,
      displayOrder
    });
    
    // Clear category cache
    await deleteCache('categories:*');
    await deleteCache(`category:${id}`);
    await deleteCache(`category:${category.slug}`);
    
    logger.info(`Category updated: ${category.id} - ${category.name}`);
    
    res.status(200).json({ 
      message: 'Category updated successfully',
      data: category
    });
  } catch (error) {
    logger.error(`Error updating category ${id}:`, error);
    throw new DatabaseError('Failed to update category', error);
  }
});

// Delete category
exports.deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Find category
  const category = await Category.findByPk(id);
  if (!category) {
    throw new NotFoundError('Category', id);
  }
  
  // Check if category has subcategories
  const subcategories = await Category.findAll({ 
    where: { parentId: id } 
  });
  
  if (subcategories.length > 0) {
    throw new ConflictError(
      'Cannot delete category with subcategories. Delete subcategories first or reassign them.',
      { childCount: subcategories.length }
    );
  }
  
  // Check if category is used by any destinations
  const [destinations] = await sequelize.query(`
    SELECT COUNT(*) as count 
    FROM destination_categories 
    WHERE "categoryId" = '${id}'
  `);
  
  if (destinations[0].count > 0) {
    throw new ConflictError(
      'Cannot delete category that is used by destinations. Remove the category from all destinations first.',
      { destinationCount: destinations[0].count }
    );
  }
  
  // Delete category
  try {
    await category.destroy();
    
    // Clear category cache
    await deleteCache('categories:*');
    await deleteCache(`category:${id}`);
    await deleteCache(`category:${category.slug}`);
    
    logger.info(`Category deleted: ${id} - ${category.name}`);
    
    res.status(200).json({ 
      message: 'Category deleted successfully' 
    });
  } catch (error) {
    logger.error(`Error deleting category ${id}:`, error);
    throw new DatabaseError('Failed to delete category', error);
  }
});