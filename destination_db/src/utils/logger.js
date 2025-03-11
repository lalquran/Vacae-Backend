const winston = require('winston');
const { format } = winston;

// Custom format for timestamps
const timeFormat = format.timestamp({
  format: 'YYYY-MM-DD HH:mm:ss.SSS'
});

// Custom formatter for better readability
const customFormat = format.printf(({ timestamp, level, message, ...meta }) => {
  const metaString = Object.keys(meta).length 
    ? '\n' + JSON.stringify(meta, null, 2)
    : '';
  
  return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaString}`;
});

// Define log levels and colors
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

// Add colors to Winston
winston.addColors(colors);

// Determine log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'production' ? 'info' : 'debug';
};

// Create logger instance
const logger = winston.createLogger({
  level: level(),
  levels,
  format: format.combine(
    timeFormat,
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'destination-database-service' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: format.combine(
        format.colorize({ all: true }),
        customFormat
      )
    }),
    // Write error and warn logs to error.log
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'warn',
      format: format.combine(timeFormat, format.json()),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: format.combine(timeFormat, format.json()),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  ],
  exitOnError: false // Don't exit on handled exceptions
});

// Create request logging middleware
const requestLogger = (req, res, next) => {
  // Generate a unique ID for the request
  req.id = Math.random().toString(36).substring(2, 15);
  
  // Log request details
  logger.http(`${req.method} ${req.url}`, {
    requestId: req.id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user ? req.user.id : 'anonymous'
  });
  
  // Log response time
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'http';
    
    logger[level](`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`, {
      requestId: req.id,
      statusCode: res.statusCode,
      duration,
      userId: req.user ? req.user.id : 'anonymous'
    });
  });
  
  next();
};

// Export functions to mimic previous logger interface
module.exports = {
  error: (message, meta = {}) => logger.error(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  info: (message, meta = {}) => logger.info(message, meta),
  http: (message, meta = {}) => logger.http(message, meta),
  debug: (message, meta = {}) => logger.debug(message, meta),
  requestLogger
};