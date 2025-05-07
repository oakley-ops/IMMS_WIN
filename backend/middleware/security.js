const csrf = require('csurf');
const helmet = require('helmet');
const uuid = require('uuid');
const rateLimit = require('express-rate-limit');

// CSRF protection middleware
const csrfProtection = csrf({
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    httpOnly: true
  }
});

// Request ID middleware
const addRequestId = (req, res, next) => {
  req.id = uuid.v4();
  res.setHeader('X-Request-ID', req.id);
  next();
};

// Enhanced security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-site" },
  dnsPrefetchControl: { allow: false },
  expectCt: {
    enforce: true,
    maxAge: 30,
  },
  frameguard: { action: "deny" },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true
});

// Cookie security middleware
const secureCookies = (req, res, next) => {
  res.cookie('sessionId', req.sessionID, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: parseInt(process.env.SESSION_DURATION) || 28800000 // 8 hours default
  });
  next();
};

// Payload size limiter
const payloadSizeLimit = (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || 0);
  const maxSize = parseInt(process.env.MAX_REQUEST_SIZE) || 10 * 1024 * 1024; // 10MB default

  if (contentLength > maxSize) {
    return res.status(413).json({
      error: 'Payload too large',
      maxSize: `${maxSize / (1024 * 1024)}MB`
    });
  }
  next();
};

// Combine all security middlewares
const securityMiddleware = [
  addRequestId,
  securityHeaders,
  payloadSizeLimit,
  secureCookies
];

// Export individual middlewares for flexible usage
module.exports = {
  csrfProtection,
  addRequestId,
  securityHeaders,
  secureCookies,
  payloadSizeLimit,
  securityMiddleware
}; 