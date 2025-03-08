require('dotenv').config();
const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
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

// Initialize PostGIS extension if not exists
async function initializePostGIS() {
  try {
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis');
    logger.info('PostGIS extension initialized or already exists');
  } catch (error) {
    logger.error('Error initializing PostGIS extension:', error);
    throw error;
  }
}

// Connect to database
async function connectDatabase() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    
    // Initialize PostGIS
    await initializePostGIS();
    
    return sequelize;
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    throw error;
  }
}

module.exports = sequelize;
module.exports.connectDatabase = connectDatabase;
