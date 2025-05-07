const winston = require('winston');
const { createLogger, format, transports } = winston;
const { combine, timestamp, json, colorize, printf } = format;

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Custom format for development
const developmentFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  
  if (Object.keys(metadata).length > 0) {
    msg += `\n${JSON.stringify(metadata, null, 2)}`;
  }
  
  return msg;
});

// Create the logger
const logger = createLogger({
  level: level(),
  levels,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    json()
  ),
  transports: [
    // Write all logs to console
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        process.env.NODE_ENV === 'development' ? developmentFormat : json()
      ),
    }),
    // Write all errors to error.log
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(timestamp(), json()),
    }),
    // Write all logs to combined.log
    new transports.File({
      filename: 'logs/combined.log',
      format: combine(timestamp(), json()),
    }),
  ],
});

// Create a stream object for Morgan
const stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Middleware to add request logging
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log when the request ends
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const message = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
    };

    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error('Server Error', message);
    } else if (res.statusCode >= 400) {
      logger.warn('Client Error', message);
    } else {
      logger.info('Request completed', message);
    }
  });

  next();
};

// Error logging middleware
const errorLogger = (err, req, res, next) => {
  logger.error('Unhandled Error', {
    error: {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      type: err.type || 'UnknownError',
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      requestId: req.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    },
  });
  next(err);
};

module.exports = {
  logger,
  stream,
  requestLogger,
  errorLogger,
}; 