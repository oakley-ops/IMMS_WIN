const { logger } = require('./logger');

// Custom error class for application errors
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  
  // Log error details
  logger.error('Error occurred', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method
  });

  // Handle specific error types
  if (err.code === '23505') { // Unique violation in PostgreSQL
    return res.status(400).json({
      status: 'error',
      message: 'A record with this information already exists'
    });
  }

  if (err.code === '23503') { // Foreign key violation
    return res.status(400).json({
      status: 'error',
      message: 'This operation would violate data relationships'
    });
  }

  // Default error response
  res.status(err.statusCode).json({
    status: err.status || 'error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong'
      : err.message
  });
};

module.exports = {
  AppError,
  errorHandler
}; 