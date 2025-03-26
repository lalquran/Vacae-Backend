const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const sequelize = require('./config/database');
const redis = require('./config/redis');
const rabbitmq = require('./config/rabbitmq');
const recommendationRoutes = require('./api/routes/recommendationRoutes');
const errorHandler = require('./api/middleware/errorHandler');
const tasks = require('./tasks');
const config = require('./config/settings');
const logger = require('./utils/logger');
const { Op } = require('sequelize');
const UserToken = require('./models/userToken');

// Initialize Express app
const app = express();

// Request ID middleware
app.use((req, res, next) => {
  req.id = require('uuid').v4();
  next();
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Response time tracking middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.debug(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    require('./utils/metrics').recordResponseTime(duration);
  });
  next();
});

// Routes
app.use('/api/recommendations', recommendationRoutes);

// Health check endpoint with proper Promise handling
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    let dbStatus;
    try {
      await sequelize.authenticate();
      dbStatus = true;
    } catch (error) {
      dbStatus = false;
    }
    
    // Return health status
    res.status(200).json({ 
      status: 'ok',
      services: {
        database: dbStatus,
        redis: redis.getClient() ? redis.getClient().isReady || false : false,
        rabbitmq: rabbitmq.getConnection() ? true : false
      }
    });
  } catch (error) {
    logger.error('Error in health check:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error checking service health'
    });
  }
});

// Error handling
app.use(errorHandler);

// Start server
const PORT = config.PORT;
app.listen(PORT, async () => {
  logger.info(`Recommendation Engine Service running on port ${PORT}`);
  
  // Test database connection
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    
    // Sync database models
    await sequelize.sync();
    logger.info('Database models synchronized successfully');
  } catch (error) {
    logger.error('Error connecting to database:', error);
  }
  
  // Initialize Redis if enabled
  if (config.REDIS_ENABLED) {
    try {
      await redis.initRedis();
    } catch (error) {
      logger.warn('Redis initialization failed, continuing without caching.', error);
    }
  }
  
  // Initialize RabbitMQ only if explicitly enabled
  const enableRabbitMQ = process.env.RABBITMQ_ENABLED === 'true';
  if (enableRabbitMQ) {
    try {
      const rabbitInitialized = await rabbitmq.initRabbitMQ();
      if (rabbitInitialized) {
        logger.info('RabbitMQ initialized successfully');
        
        // Get the celery client
        const celeryClient = rabbitmq.getCeleryClient();
        if (celeryClient) {
          logger.info('Registering tasks with Celery');
          tasks.registerAllTasks();
        } else {
          logger.warn('Celery client unavailable, skipping task registration');
        }
      }
    } catch (error) {
      logger.warn('RabbitMQ initialization failed, continuing without background tasks');
    }
  } else {
    logger.info('RabbitMQ is disabled, skipping initialization');
  }

  startSchedulers();
  logger.info('Recommendation Engine Service initialization complete');
});

const startSchedulers = () => {
  // Cleanup expired tokens every hour
  setInterval(async () => {
    try {
      const deleted = await UserToken.destroy({
        where: {
          expiresAt: { [Op.lt]: new Date() }
        }
      });
      
      if (deleted > 0) {
        logger.info(`Cleaned up ${deleted} expired user tokens`);
      }
    } catch (error) {
      logger.error('Error cleaning up expired tokens:', error);
    }
  }, 60 * 60 * 1000); // 1 hour
  
  logger.info('Token cleanup scheduler started');
};

module.exports = app;