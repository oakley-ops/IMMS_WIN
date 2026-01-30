const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();

// CORS Configuration - restrict to allowed origins
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://10.1.10.50:3001',
      'http://10.1.10.171:3001'
    ];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.) in development
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Handle production
if (process.env.NODE_ENV === 'production') {
  // Static folder
  app.use(express.static(path.join(__dirname, '../../frontend/build')));

  // Handle SPA
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../../frontend/build', 'index.html'));
  });
}

// Comment out this section as it's creating a duplicate server
// const PORT = process.env.PORT || 4000;
// 
// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });

module.exports = app;