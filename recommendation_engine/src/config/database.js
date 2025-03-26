const { Sequelize } = require('sequelize');
const config = require('./settings');
const logger = require('../utils/logger');

// Create Sequelize instance with PostgreSQL
const sequelize = new Sequelize(
  config.DB_NAME,
  config.DB_USER,
  config.DB_PASS,
  {
    host: config.DB_HOST,
    port: config.DB_PORT || 5432,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // You might need this during development
      }
    },
    logging: msg => logger.debug(msg),
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Test connection function
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    return true;
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    
    // Provide more helpful messages based on error type
    if (error.original && error.original.code === 'ECONNREFUSED') {
      logger.error('Database server is not running or not accessible');
    } else if (error.original && error.original.code === '3D000') {
      logger.error('Database does not exist');
    } else if (error.original && error.original.code === '28P01') {
      logger.error('Invalid database credentials');
    }
    
    return false;
  }
};

// Export the sequelize instance and test function
module.exports = sequelize;
module.exports.testConnection = testConnection;