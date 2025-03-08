const express = require('express');
const searchController = require('../controllers/searchController');
const { validateSearch, validateNearbySearch } = require('../middleware/validation');
const { cacheMiddleware } = require('../middleware/cache');

const router = express.Router();

// Public search routes
router.get('/', validateSearch, cacheMiddleware(1800), searchController.searchDestinations);
router.get('/nearby', validateNearbySearch, cacheMiddleware(1800), searchController.findNearbyDestinations);
router.get('/open', cacheMiddleware(900), searchController.getOpenDestinations);

module.exports = router;