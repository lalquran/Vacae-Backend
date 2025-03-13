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
    port: config.DB_PORT,
    dialect: 'postgres',
    logging: config.NODE_ENV === 'development' ? msg => logger.debug(msg) : false,
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
    return false;
  }
};

// Export the sequelize instance and test function
module.exports = sequelize;
module.exports.testConnection = testConnection;