const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const categoryController = require('../controllers/categoryController');
const { validateCategoryCreate, validateCategoryUpdate } = require('../middleware/validation');
const { cacheMiddleware } = require('../middleware/cache');

const router = express.Router();

// Public routes
router.get('/', cacheMiddleware(86400), categoryController.getAllCategories);
router.get('/:identifier', cacheMiddleware(86400), categoryController.getCategoryByIdOrSlug);

// Protected admin routes
router.use(protect, adminOnly);

router.post('/', validateCategoryCreate, categoryController.createCategory);
router.put('/:id', validateCategoryUpdate, categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;