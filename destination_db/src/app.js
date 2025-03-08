require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDatabase } = require('./config/database');
const setupAssociations = require('./models/associations');
const destinationRoutes = require('./routes/destinationRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const searchRoutes = require('./routes/searchRoutes');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

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

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(logger.requestLogger);

// Routes
app.use('/api/destinations', destinationRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/search', searchRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Error handling
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        logger.info(`Destination Database Service running on port ${PORT}`);
    });
}

module.exports = app;