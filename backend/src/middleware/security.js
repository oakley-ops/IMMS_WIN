const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const hpp = require('hpp');
const xss = require('xss-clean');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('../config/db');

const productionMiddleware = (app) => {
  // Create logs directory if it doesn't exist
  const logsDir = path.join(__dirname, '../../logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
  }

  // Create access log stream
  const accessLogStream = fs.createWriteStream(
    path.join(logsDir, 'access.log'),
    { flags: 'a' }
  );

  // Basic security headers with updated CSP for production
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:", "http:"],
        imgSrc: ["'self'", 'data:', 'https:', 'http:'],
        connectSrc: ["'self'", process.env.API_URL],
        fontSrc: ["'self'", "https:", "http:", "data:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  
  // Rate limiting - adjusted for 3 devices and 10 users
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3000, // Increased for multiple users per device
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: true // Enable trust proxy
  });
  app.use('/api/', limiter);
  
  // Prevent parameter pollution
  app.use(hpp());
  
  // Prevent XSS attacks
  app.use(xss());
  
  // Logging
  app.use(morgan('combined', { stream: accessLogStream }));
  
  // Session handling with PostgreSQL store
  app.use(session({
    store: new pgSession({
      pool,
      tableName: 'user_sessions',
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // true in production
      httpOnly: true,
      maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict'
    },
    name: 'sessionId', // Custom name instead of default 'connect.sid'
  }));

  // Track active users per device
  app.use((req, res, next) => {
    if (req.session && req.session.userId) {
      const deviceId = req.headers['x-device-id'] || 'default';
      global.activeUsers = global.activeUsers || {};
      global.activeUsers[deviceId] = global.activeUsers[deviceId] || new Set();
      global.activeUsers[deviceId].add(req.session.userId);
      
      // Check if device exceeds max users
      if (global.activeUsers[deviceId].size > parseInt(process.env.MAX_USERS_PER_DEVICE)) {
        return res.status(429).json({
          status: 'error',
          message: 'Maximum number of users reached for this device'
        });
      }
    }
    next();
  });

  // Error handling middleware with better production logging
  app.use((err, req, res, next) => {
    const errorDetails = {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userId: req.session?.userId,
      deviceId: req.headers['x-device-id']
    };

    // Log error details in production
    if (process.env.NODE_ENV === 'production') {
      console.error(JSON.stringify(errorDetails));
    } else {
      console.error(err.stack);
    }

    res.status(err.status || 500).json({
      status: 'error',
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message
    });
  });
};

module.exports = productionMiddleware;
