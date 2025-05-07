const uuid = require('uuid');
const { logger } = require('./logger');
const { performance } = require('perf_hooks');

// Store active requests
const activeRequests = new Map();

// Request tracking middleware
const requestTracker = (req, res, next) => {
  // Generate correlation ID
  const correlationId = uuid.v4();
  const parentRequestId = req.headers['x-correlation-id'];
  
  // Set request tracking info
  req.tracking = {
    requestId: uuid.v4(),
    correlationId: parentRequestId || correlationId,
    parentRequestId,
    startTime: performance.now(),
    path: req.path,
    method: req.method
  };

  // Set tracking headers
  res.set('x-request-id', req.tracking.requestId);
  res.set('x-correlation-id', req.tracking.correlationId);

  // Track request start
  activeRequests.set(req.tracking.requestId, {
    ...req.tracking,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Log request start
  logger.info('Request started', {
    ...req.tracking,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Track response
  res.on('finish', () => {
    const endTime = performance.now();
    const duration = endTime - req.tracking.startTime;

    // Get request details
    const request = activeRequests.get(req.tracking.requestId);
    activeRequests.delete(req.tracking.requestId);

    // Log request completion
    logger.info('Request completed', {
      ...request,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(2)}ms`,
      contentLength: res.get('content-length'),
      contentType: res.get('content-type')
    });
  });

  // Track response errors
  res.on('error', (error) => {
    const endTime = performance.now();
    const duration = endTime - req.tracking.startTime;

    // Get request details
    const request = activeRequests.get(req.tracking.requestId);
    activeRequests.delete(req.tracking.requestId);

    // Log request error
    logger.error('Request failed', {
      ...request,
      error: error.message,
      stack: error.stack,
      duration: `${duration.toFixed(2)}ms`
    });
  });

  next();
};

// Middleware to track slow requests
const slowRequestTracker = (threshold = 1000) => (req, res, next) => {
  const start = performance.now();

  res.on('finish', () => {
    const duration = performance.now() - start;
    if (duration > threshold) {
      logger.warn('Slow request detected', {
        ...req.tracking,
        duration: `${duration.toFixed(2)}ms`,
        threshold: `${threshold}ms`,
        path: req.path,
        method: req.method,
        query: req.query,
        body: req.method !== 'GET' ? req.body : undefined
      });
    }
  });

  next();
};

// Get active requests info
const getActiveRequests = () => {
  return {
    count: activeRequests.size,
    requests: Array.from(activeRequests.values()).map(req => ({
      requestId: req.requestId,
      correlationId: req.correlationId,
      path: req.path,
      method: req.method,
      duration: `${(performance.now() - req.startTime).toFixed(2)}ms`
    }))
  };
};

// Middleware to track concurrent requests
const concurrentRequestTracker = (limit = 100) => (req, res, next) => {
  const currentCount = activeRequests.size;

  if (currentCount >= limit) {
    logger.warn('High concurrent requests detected', {
      currentCount,
      limit,
      activeRequests: getActiveRequests()
    });
  }

  next();
};

// Middleware to track request body size
const requestSizeTracker = (limit = 10 * 1024 * 1024) => (req, res, next) => {
  const contentLength = parseInt(req.get('content-length') || '0');

  if (contentLength > limit) {
    logger.warn('Large request body detected', {
      ...req.tracking,
      size: contentLength,
      limit,
      path: req.path,
      method: req.method
    });
  }

  next();
};

module.exports = {
  requestTracker,
  slowRequestTracker,
  concurrentRequestTracker,
  requestSizeTracker,
  getActiveRequests
}; 