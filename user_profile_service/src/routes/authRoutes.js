const express = require('express');
const authController = require('../controllers/authController');
const { validateUserRegistration, validateLogin } = require('../middleware/validation');

const router = express.Router();

// Auth routes
router.post('/register', validateUserRegistration, authController.register);
router.post('/login', validateLogin, authController.login);

module.exports = router;