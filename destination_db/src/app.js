require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectDatabase } = require('./config/database');
const setupAssociations = require('./models/associations');
const destinationRoutes = require('./routes/destinationRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const searchRoutes = require('./routes/searchRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const { v4: uuidv4 } = require('uuid');

// Initialize app
const app = express();
const PORT = process.env.PORT || 4000;

// Connect to database and set up models
async function initializeDatabase() {
  try {
    // Connect to PostgreSQL
    await connectDatabase();
    
    // Set up model associations
    setupAssociations();
    
    // Sync models (in development only)
    if (process.env.NODE_ENV === 'development') {
      await require('./config/database').sync({ alter: true });
      logger.info('Database models synchronized');
    }
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

// Only initialize database if not in test mode
if (process.env.NODE_ENV !== 'test') {
  initializeDatabase();
}

// Request ID middleware
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Security middleware
app.use(helmet());
app.use(cors());

// JSON parsing with error handling
app.use(express.json({ 
  limit: '1mb',
  verify: (req, res, buf, encoding) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ 
        error: true,
        message: 'Invalid JSON',
        statusCode: 400,
        errorCode: 'INVALID_JSON'
      });
      throw new Error('Invalid JSON');
    }
  }
}));

// Request logging
app.use(logger.requestLogger);

// Routes
app.use('/api/destinations', destinationRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/search', searchRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Handle unknown routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`Destination Database Service running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;