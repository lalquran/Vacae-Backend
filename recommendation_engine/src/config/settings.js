require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3002,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Database
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: process.env.DB_PORT || 5432,
  DB_NAME: process.env.DB_NAME || 'recommendation_db',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASS: process.env.DB_PASS || 'postgres',
  
  // Redis
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: process.env.REDIS_PORT || 6379,
  REDIS_ENABLED: process.env.REDIS_ENABLED === 'true',
  
  // RabbitMQ
  RABBITMQ_URL: process.env.RABBITMQ_URL,
  RABBITMQ_HOST: process.env.RABBITMQ_HOST,
  RABBITMQ_PORT: process.env.RABBITMQ_PORT || 5672,
  RABBITMQ_USER: process.env.RABBITMQ_USER || 'guest',
  RABBITMQ_PASS: process.env.RABBITMQ_PASS || 'guest',
  RABBITMQ_ENABLED: process.env.RABBITMQ_ENABLED === 'true',
  RABBITMQ_VHOST: process.env.RABBITMQ_VHOST || '/',
  RABBITMQ_SSL: process.env.RABBITMQ_SSL === 'true',
  
  // Service URLs
  USER_PROFILE_SERVICE_URL: process.env.USER_PROFILE_SERVICE_URL || 'http://localhost:3000',
  DESTINATION_SERVICE_URL: process.env.DESTINATION_SERVICE_URL || 'http://localhost:4000',
  
  // JWT Secret for auth
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  
  // Algorithm settings
  DEFAULT_RECOMMENDATION_COUNT: process.env.DEFAULT_RECOMMENDATION_COUNT || 10,
  PREFERENCE_WEIGHT: parseFloat(process.env.PREFERENCE_WEIGHT || 0.6),
  POPULARITY_WEIGHT: parseFloat(process.env.POPULARITY_WEIGHT || 0.4),
  DISTANCE_PENALTY_FACTOR: parseFloat(process.env.DISTANCE_PENALTY_FACTOR || 0.01),
  MAX_TRAVEL_TIME_MINUTES: parseInt(process.env.MAX_TRAVEL_TIME_MINUTES || 60)
};