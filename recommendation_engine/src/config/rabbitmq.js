const amqp = require('amqplib');
const config = require('./settings');
const logger = require('../utils/logger');

// Store connection, channel and client
let connection = null;
let channel = null;
let celeryClient = null;

// Initialize RabbitMQ connection
const initRabbitMQ = async () => {
  if (!config.RABBITMQ_ENABLED) {
    logger.info('RabbitMQ is disabled in configuration');
    return false;
  }
  
  try {
    // Create connection URL
    const protocol = config.RABBITMQ_SSL ? 'amqps' : 'amqp';
    const vhostPath = config.RABBITMQ_VHOST ? `/${encodeURIComponent(config.RABBITMQ_VHOST)}` : '';
    const rabbitUrl = `${protocol}://${config.RABBITMQ_USER}:${config.RABBITMQ_PASS}@${config.RABBITMQ_HOST}${vhostPath}`;
    
    logger.info(`Connecting to RabbitMQ at ${rabbitUrl}...`);
    
    // Connect to RabbitMQ
    connection = await amqp.connect(rabbitUrl);
    
    // Create a channel
    channel = await connection.createChannel();
    
    // Set up error handlers
    connection.on('error', (error) => {
      logger.error('RabbitMQ connection error:', error);
      // We'll try to reconnect if not in development
      if (config.NODE_ENV !== 'development') {
        setTimeout(initRabbitMQ, 5000);
      }
    });
    
    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
      // We'll try to reconnect if not in development
      if (config.NODE_ENV !== 'development') {
        setTimeout(initRabbitMQ, 5000);
      }
    });
    
    logger.info('Connected to RabbitMQ successfully');
    
    // Initialize Celery client if Redis is enabled
    if (config.REDIS_ENABLED) {
      try {
        const celery = require('celery-node');
        
        // Create Redis URL for Celery backend
        const redisUrl = `redis://${config.REDIS_HOST}:${config.REDIS_PORT}`;
        
        logger.info(`Initializing Celery client with Redis backend at ${redisUrl}`);
        
        // Create the client
        celeryClient = celery.createClient({
          CELERY_BROKER: rabbitUrl,
          CELERY_BACKEND: redisUrl
        });
        
        // Test the client by creating a simple task
        const testTask = celeryClient.createTask('test');
        if (testTask) {
          logger.info('Celery client verified with test task creation');
        }
        
        logger.info('Celery client initialized successfully');
      } catch (celeryError) {
        logger.error('Failed to initialize Celery client:', celeryError);
        celeryClient = null;
      }
    } else {
      logger.info('Redis is disabled, skipping Celery initialization');
      
      // Create a fake Celery client for development that logs instead of executing
      celeryClient = createFakeCeleryClient();
      logger.info('Created fake Celery client for development');
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize RabbitMQ:', error);
    connection = null;
    channel = null;
    celeryClient = null;
    return false;
  }
};

// Create a fake Celery client that logs operations instead of executing them
const createFakeCeleryClient = () => {
    const registeredTasks = {};
    
    return {
      createTask: (name) => {
        logger.debug(`[FAKE CELERY] Creating task: ${name}`);
        return {
          applyAsync: (args, kwargs, options) => {
            logger.debug(`[FAKE CELERY] Executing task ${name} with:`, { args, kwargs });
            
            // If the task is registered, execute it
            if (registeredTasks[name]) {
              try {
                // Execute the task function with the provided arguments
                const result = registeredTasks[name](...args, kwargs);
                logger.debug(`[FAKE CELERY] Task ${name} completed successfully`);
                return { taskId: `fake-${Date.now()}`, result };
              } catch (error) {
                logger.error(`[FAKE CELERY] Error executing task ${name}:`, error);
                throw error;
              }
            } else {
              logger.warn(`[FAKE CELERY] Task ${name} called but not registered`);
              return { taskId: `fake-${Date.now()}` };
            }
          }
        };
      },
      register: (name, fn) => {
        logger.debug(`[FAKE CELERY] Registered task: ${name}`);
        registeredTasks[name] = fn;
        return true;
      }
    };
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

module.exports = {
  initRabbitMQ,
  sendTask,
  getTaskResult,
  publishMessage,
  subscribeToQueue,
  getConnection: () => connection,
  getChannel: () => channel,
  getCeleryClient: () => celeryClient
};