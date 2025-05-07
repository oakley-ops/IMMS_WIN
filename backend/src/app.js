const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
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

// Routes
app.use('/api/v1/parts', partsRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/test', testRouter);
app.use('/api/v1/vendors', vendorRoutes);
app.use('/api/v1/purchase-orders', purchaseOrderRoutes);
app.use('/api/v1/suppliers', supplierRoutes);
app.use('/api/v1/email', emailRoutes);  // Mount email routes with v1 prefix

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

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