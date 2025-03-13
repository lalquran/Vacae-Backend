const amqp = require('amqplib');
const CeleryClient = require('celery-node').Client;
const config = require('./settings');
const logger = require('../utils/logger');

// RabbitMQ connection
let connection = null;
let channel = null;
let celeryClient = null;

// Initialize RabbitMQ connection
// In config/rabbitmq.js
const initRabbitMQ = async () => {
    if (!config.RABBITMQ_ENABLED) {
        logger.info('RabbitMQ is disabled in configuration');
        return false;
    }
    try {

      // Create connection URL
      const rabbitUrl = `amqp://${config.RABBITMQ_USER}:${config.RABBITMQ_PASS}@${config.RABBITMQ_HOST}:${config.RABBITMQ_PORT}`;
      
      // Connect to RabbitMQ (with timeout to avoid hanging)
      connection = await Promise.race([
        amqp.connect(rabbitUrl),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('RabbitMQ connection timeout')), 5000)
        )
      ]);
      
      // Rest of the code...
    } catch (error) {
      logger.error('Failed to initialize RabbitMQ:', error);
      // Don't retry connection immediately in development mode
      if (config.NODE_ENV !== 'development') {
        setTimeout(initRabbitMQ, 5000);
      }
      throw error; // Re-throw for proper handling
    }
  };

// Send a task to Celery
const sendTask = async (taskName, args = [], kwargs = {}, options = {}) => {
  if (!celeryClient) {
    logger.error('Celery client not initialized');
    return null;
  }
  
  try {
    const task = celeryClient.createTask(taskName);
    const result = task.applyAsync(args, kwargs, options);
    return result;
  } catch (error) {
    logger.error(`Error sending task ${taskName}:`, error);
    return null;
  }
};

// Get a task result
const getTaskResult = async (taskId) => {
  if (!celeryClient) {
    logger.error('Celery client not initialized');
    return null;
  }
  
  try {
    const asyncResult = celeryClient.createAsyncResult(taskId);
    return await asyncResult.get();
  } catch (error) {
    logger.error(`Error getting result for task ${taskId}:`, error);
    return null;
  }
};

// Publish a message to a specific queue
const publishMessage = async (queue, message) => {
  if (!channel) {
    logger.error('RabbitMQ channel not initialized');
    return false;
  }
  
  try {
    // Ensure the queue exists
    await channel.assertQueue(queue, { durable: true });
    
    // Send the message
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      persistent: true
    });
    
    return true;
  } catch (error) {
    logger.error(`Error publishing message to queue ${queue}:`, error);
    return false;
  }
};

// Subscribe to a queue
const subscribeToQueue = async (queue, callback) => {
  if (!channel) {
    logger.error('RabbitMQ channel not initialized');
    return false;
  }
  
  try {
    // Ensure the queue exists
    await channel.assertQueue(queue, { durable: true });
    
    // Start consuming
    channel.consume(queue, (msg) => {
      if (msg !== null) {
        try {
          const content = JSON.parse(msg.content.toString());
          callback(content);
          channel.ack(msg);
        } catch (error) {
          logger.error(`Error processing message from queue ${queue}:`, error);
          channel.nack(msg);
        }
      }
    });
    
    logger.info(`Subscribed to queue ${queue}`);
    return true;
  } catch (error) {
    logger.error(`Error subscribing to queue ${queue}:`, error);
    return false;
  }
};

// Initialize on module load
initRabbitMQ();

module.exports = {
    initRabbitMQ,
    sendTask: async () => null, // Stub implementation
    getTaskResult: async () => null, // Stub implementation
    publishMessage: async () => false, // Stub implementation
    subscribeToQueue: async () => false, // Stub implementation
    getConnection: () => null,
    getChannel: () => null,
    getCeleryClient: () => null
  };