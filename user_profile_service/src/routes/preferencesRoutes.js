const express = require('express');
const { protect } = require('../middleware/auth');
const preferencesController = require('../controllers/preferencesController');
const { validatePreferencesUpdate } = require('../middleware/validation');

const router = express.Router();

// Protect all preferences routes
router.use(protect);

// Preferences routes
router.get('/', preferencesController.getPreferences);
router.put('/', validatePreferencesUpdate, preferencesController.updatePreferences);
router.patch('/:category', preferencesController.updatePreferenceCategory);

module.exports = router;