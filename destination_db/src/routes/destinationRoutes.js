const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const destinationController = require('../controllers/destinationController');
const { validateDestinationCreate, validateDestinationUpdate } = require('../middleware/validation');
const { cacheMiddleware } = require('../middleware/cache');

const router = express.Router();

// Public routes
router.get('/', cacheMiddleware(3600), destinationController.getAllDestinations);
router.get('/:id', cacheMiddleware(3600), destinationController.getDestinationById);

// Protected routes - require authentication
router.use(protect);

// Admin only routes - require admin role
router.post('/', adminOnly, validateDestinationCreate, destinationController.createDestination);
router.put('/:id', adminOnly, validateDestinationUpdate, destinationController.updateDestination);
router.delete('/:id', adminOnly, destinationController.deleteDestination);
router.put('/:id/operating-hours', adminOnly, destinationController.updateOperatingHours);

module.exports = router;