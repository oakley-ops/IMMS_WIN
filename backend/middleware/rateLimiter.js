const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { createClient } = require('redis');

// Create Redis client if Redis URL is provided
const redisClient = process.env.REDIS_URL
  ? createClient({ url: process.env.REDIS_URL })
  : null;

if (redisClient) {
  redisClient.on('error', (err) => console.error('Redis Client Error:', err));
  redisClient.connect().catch(console.error);
}

// Store provider based on environment
const store = redisClient
  ? new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
    })
  : undefined; // Falls back to memory store

// Common rate limiter configuration
const commonConfig = {
  store,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development',
  handler: (req, res) => {
    console.log('Rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
      headers: req.headers
    });
    res.status(429).json({ error: 'Too many requests, please try again later' });
  },
  keyGenerator: (req) => {
    // Use X-Forwarded-For only if it's from a trusted proxy
    const ip = req.headers['fly-client-ip'] || 
               req.headers['x-real-ip'] || 
               req.headers['x-forwarded-for']?.split(',')[0] || 
               req.ip;
    return `${ip}:${req.path}`;
  }
};

// Rate limiting for login attempts
const authLimiter = rateLimit({
  ...commonConfig,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per window
  message: { error: 'Too many login attempts, please try again later' }
});

// General rate limiting for other routes
const generalLimiter = rateLimit({
  ...commonConfig,
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per minute
  message: { error: 'Too many requests, please try again later' }
});

// File upload limiter
const uploadLimiter = rateLimit({
  ...commonConfig,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour per IP
  message: {
    error: 'Upload limit reached. Please try again later.',
    retryAfter: '1 hour'
  }
});

module.exports = {
  authLimiter,
  generalLimiter,
  uploadLimiter
}; 