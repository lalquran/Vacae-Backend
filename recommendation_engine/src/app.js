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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    services: {
      database: sequelize.authenticate().then(() => true).catch(() => false),
      redis: redis.getClient() && redis.getClient().isReady,
      rabbitmq: rabbitmq.getConnection() && rabbitmq.getConnection().isConnected()
    }
  });
});

// Metrics endpoint (for internal monitoring)
app.get('/metrics', (req, res) => {
  res.status(200).json(require('./utils/metrics').getAllMetrics());
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
      await rabbitmq.initRabbitMQ();
      tasks.registerAllTasks();
      logger.info('RabbitMQ initialized successfully');
    } catch (error) {
      logger.warn('RabbitMQ initialization failed. Background tasks will not be available.');
    }
  } else {
    logger.info('RabbitMQ is disabled, skipping initialization');
  }
  
  logger.info('Recommendation Engine Service initialization complete');
});

module.exports = app;