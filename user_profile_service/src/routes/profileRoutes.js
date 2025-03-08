const express = require('express');
const { protect } = require('../middleware/auth');
const profileController = require('../controllers/profileController');

const router = express.Router();

// Protect all profile routes
router.use(protect);

// Profile routes
router.get('/', profileController.getProfile);
router.put('/', profileController.updateProfile);

module.exports = router;