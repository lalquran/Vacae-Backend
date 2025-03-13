const jwt = require('jsonwebtoken');
const config = require('../../config/settings');
const { UnauthorizedError } = require('../../utils/errors');

/**
 * Authentication middleware to verify JWT token
 */
const auth = (req, res, next) => {
  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No authentication token provided');
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify the token
    const decoded = jwt.verify(token, config.JWT_SECRET);
    
    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new UnauthorizedError('Invalid authentication token'));
    } else if (error.name === 'TokenExpiredError') {
      next(new UnauthorizedError('Authentication token expired'));
    } else {
      next(error);
    }
  }
};

/**
 * Role-based authorization middleware
 */
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('User not authenticated'));
    }
    
    // Convert single role to array
    if (typeof roles === 'string') {
      roles = [roles];
    }
    
    // Check if user's role is in the allowed roles
    if (roles.length && !roles.includes(req.user.role)) {
      return next(new UnauthorizedError('Insufficient permissions'));
    }
    
    next();
  };
};

module.exports = {
  auth,
  authorize
};