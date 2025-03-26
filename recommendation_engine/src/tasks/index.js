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
    logger.warn('Celery client not available, tasks will be registered when client becomes available');
    
    // You could set up a retry mechanism here
    setTimeout(() => {
      const retryClient = rabbitmq.getCeleryClient();
      if (retryClient) {
        logger.info('Celery client now available, registering tasks');
        doRegisterTasks(retryClient);
      } else {
        logger.error('Celery client still not available, cannot register tasks');
      }
    }, 20000); // Retry after 5 seconds
    
    return false;
  }
  
  return doRegisterTasks(celeryClient);
};

/**
 * Actually register the tasks with the provided client
 */
 const doRegisterTasks = (celeryClient) => {
  try {
    // Register each task type
    registerGenerateRecommendationTask(celeryClient);
    registerUpdateFeaturesTask(celeryClient);
    
    logger.info('All Celery tasks registered successfully');
    return true;
  } catch (error) {
    logger.error('Error registering Celery tasks:', error);
    
    // Continue without task registration in development
    if (config.NODE_ENV === 'development') {
      logger.warn('Continuing without task registration in development mode');
      return true;
    }
    
    return false;
  }
};

module.exports = {
  registerAllTasks
};