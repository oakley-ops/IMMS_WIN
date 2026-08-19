const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();

// Security headers (helmet) — applied before all routes so every response carries
// them. See src/middleware/securityHeaders.js (CSP intentionally disabled for now).
app.use(require('./middleware/securityHeaders'));

// Report any 5xx response to Sentry (no-op unless SENTRY_DSN is set). Registered
// before all routes so it covers every route in app.js and index.js.
const capture5xx = require('./observability/capture5xx');
app.use(capture5xx);

// CORS Configuration - single source of truth for allowed origins
const { allowedOrigins } = require('./config/corsOrigins');

// Distinct error type so the error handler can return a clear 403 instead of a generic 500
class CorsError extends Error {
  constructor(origin) {
    super(`Origin ${origin || '(none)'} is not allowed by CORS`);
    this.name = 'CorsError';
    this.status = 403;
  }
}

const corsOptions = {
  origin: function (origin, callback) {
    // Public demo deployments accept any origin (no real/sensitive data)
    if (process.env.DEMO_MODE === 'true') {
      return callback(null, true);
    }
    // Allow requests with no origin (mobile apps, Postman, etc.) in development
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new CorsError(origin));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));  // Increase payload limit for PDF handling
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

// Import routes
const partsRouter = require('./routes/parts');
const usersRouter = require('./routes/users');
const testRouter = require('./routes/test');
const vendorRoutes = require('./routes/vendorRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const emailRoutes = require('./routes/emailRoutes');
const pmRouter = require('./routes/pm');
const techniciansRouter = require('./routes/technicians');
const analyticsRouter = require('./routes/analytics');
const milestonesRouter = require('./routes/milestones');
const tasksRouter = require('./routes/tasks');
const workOrdersRouter = require('./routes/workOrders');
const searchRouter = require('./routes/search');

// Routes
app.use('/api/v1/parts', partsRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/test', testRouter);
app.use('/api/v1/vendors', vendorRoutes);
app.use('/api/v1/purchase-orders', purchaseOrderRoutes);
app.use('/api/v1/suppliers', supplierRoutes);
app.use('/api/v1/email', emailRoutes);  // Mount email routes with v1 prefix
app.use('/api/v1/pm', pmRouter);  // Mount PM routes with v1 prefix
app.use('/api/v1/technicians', techniciansRouter);  // Mount technicians routes with v1 prefix
app.use('/api/v1/analytics', analyticsRouter);  // Mount analytics routes
app.use('/api/v1/milestones', milestonesRouter);  // Mount milestones routes
app.use('/api/v1/tasks', tasksRouter);  // Mount tasks routes
app.use('/api/v1/work-orders', workOrdersRouter);  // Mount work orders routes
app.use('/api/v1/search', searchRouter);  // Mount hybrid search route

// Error handling middleware
app.use((err, req, res, next) => {
  // CORS rejections get a clear, specific 403 instead of a generic 500
  if (err instanceof CorsError) {
    return res.status(403).json({ error: err.message });
  }
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Serve uploaded files statically. These are embedded via <img> from the app's
// own frontends on other origins/ports (localhost:3001/3002/3003 vs this API's
// :4000/:4001 — see Network Configuration in CLAUDE.md), so relax the global
// same-origin Cross-Origin-Resource-Policy (set by securityHeaders.js) just for
// this route. Without it, browsers block the <img> load client-side
// (net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin) even though the request itself
// succeeds — CORP is enforced for no-cors tag loads, unlike the JSON API calls
// which go through CORS-mode fetch/XHR instead.
app.use('/uploads', require('helmet').crossOriginResourcePolicy({ policy: 'cross-origin' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// NOTE: Static file serving and SPA fallback are handled in index.js
// AFTER all API routes are registered. Do not add a wildcard catch-all
// here — it would intercept API requests before they are mounted.

// Comment out this section as it's creating a duplicate server
// const PORT = process.env.PORT || 4000;
// 
// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });

module.exports = app;