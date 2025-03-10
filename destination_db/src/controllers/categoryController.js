const Category = require('../models/category');
const { setCache, getCache, deleteCache } = require('../config/redis');
const logger = require('../utils/logger');

// Get all categories
exports.getAllCategories = async (req, res, next) => {
  try {
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
  } catch (error) {
    logger.error('Error fetching categories:', error);
    next(error);
  }
};

// Get category by ID or slug
exports.getCategoryByIdOrSlug = async (req, res, next) => {
  try {
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
      return res.status(404).json({ message: 'Category not found' });
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
  } catch (error) {
    logger.error(`Error fetching category ${req.params.identifier}:`, error);
    next(error);
  }
};

// Create new category
exports.createCategory = async (req, res, next) => {
  try {
    const { name, slug, description, parentId, icon, displayOrder } = req.body;
    
    // Check if slug already exists
    const existingCategory = await Category.findOne({ where: { slug } });
    if (existingCategory) {
      return res.status(400).json({ message: 'Category with this slug already exists' });
    }
    
    // Create category
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
    
    res.status(201).json({ 
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    logger.error('Error creating category:', error);
    next(error);
  }
};

// Update category
exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, parentId, icon, displayOrder } = req.body;
    
    // Find category
    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Update category
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
    
    res.status(200).json({ 
      message: 'Category updated successfully',
      data: category
    });
  } catch (error) {
    logger.error(`Error updating category ${req.params.id}:`, error);
    next(error);
  }
};

// Delete category
exports.deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Find category
    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Check if category has subcategories
    const subcategories = await Category.findAll({ 
      where: { parentId: id } 
    });
    
    if (subcategories.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete category with subcategories. Delete subcategories first or reassign them.' 
      });
    }
    
    // Delete category
    await category.destroy();
    
    // Clear category cache
    await deleteCache('categories:*');
    await deleteCache(`category:${id}`);
    await deleteCache(`category:${category.slug}`);
    
    res.status(200).json({ 
      message: 'Category deleted successfully' 
    });
  } catch (error) {
    logger.error(`Error deleting category ${req.params.id}:`, error);
    next(error);
  }
};