const { registerTasks: registerGenerateRecommendationTask } = require('./generateRecommendation');
const { registerTasks: registerUpdateFeaturesTask } = require('./updateFeatures');
const rabbitmq = require('../config/rabbitmq');
const logger = require('../utils/logger');

/**
 * Register all Celery tasks
 */
const registerAllTasks = () => {
  const celeryClient = rabbitmq.getCeleryClient();
  
  if (!celeryClient) {
    logger.error('Celery client not available, cannot register tasks');
    return false;
  }
  
  try {
    // Register each task type
    registerGenerateRecommendationTask(celeryClient);
    registerUpdateFeaturesTask(celeryClient);
    
    logger.info('All Celery tasks registered successfully');
    return true;
  } catch (error) {
    logger.error('Error registering Celery tasks:', error);
    return false;
  }
};

module.exports = {
  registerAllTasks
};