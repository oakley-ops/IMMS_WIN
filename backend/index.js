require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { parse } = require('csv-parse');
const fs = require('fs');
const path = require('path');
const asyncHandler = require('express-async-handler');
const morgan = require('morgan');
const partsRouter = require('./src/routes/parts');
const machinesRouter = require('./src/routes/machines');
const dashboardRouter = require('./src/routes/dashboard');
const authRouter = require('./src/routes/auth');
const testRouter = require('./src/routes/test');
const vendorRoutes = require('./src/routes/vendorRoutes');
const purchaseOrderRoutes = require('./src/routes/purchaseOrderRoutes');
const emailRoutes = require('./src/routes/emailRoutes');
const projectsRouter = require('./src/routes/projects');
const equipmentRouter = require('./src/routes/equipment');
const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./src/database/db');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000
});

// Enable trust proxy before any middleware
app.set('trust proxy', true);

const port = process.env.PORT || 4000;

// Request logging
app.use(morgan('dev'));

// Apply CORS middleware before other route handlers
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Body parser middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (!file.originalname.match(/\.(csv)$/)) {
      return cb(new Error('Only CSV files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Pass io instance to controllers
const PartsUsageController = require('./src/controllers/PartsUsageController');
const partsUsageController = new PartsUsageController(io);

// Custom direct route for parts usage without machine_id
app.post('/api/v1/parts/usage', async (req, res) => {
  const { part_id, quantity, reason, work_order_number } = req.body;
  
  console.log('Recording part usage:', { part_id, quantity, reason, work_order_number });
  
  // Validate required fields
  if (!part_id || !quantity) {
    return res.status(400).json({ error: 'Missing required fields: part_id and quantity are required' });
  }
  
  try {
    // First, check if we have enough quantity
    const partResult = await db.query(
      'SELECT quantity, name, minimum_quantity FROM parts WHERE part_id = $1',
      [part_id]
    );

    if (partResult.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }

    const part = partResult.rows[0];
    const currentQuantity = part.quantity;
    
    if (currentQuantity < quantity) {
      return res.status(400).json({ 
        error: 'Insufficient quantity',
        available: currentQuantity,
        requested: quantity
      });
    }

    // Start a transaction
    await db.query('BEGIN');

    // Update the parts quantity
    const newQuantity = currentQuantity - quantity;
    await db.query(
      'UPDATE parts SET quantity = $1 WHERE part_id = $2',
      [newQuantity, part_id]
    );

    // Record the transaction without machine_id
    const notes = reason || 'Part used';
    const transactionResult = await db.query(
      `INSERT INTO transactions (
        part_id,
        quantity,
        type,
        notes,
        reference_number
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [part_id, quantity, 'usage', notes, work_order_number]
    );

    await db.query('COMMIT');

    // Send response
    res.status(200).json({
      success: true,
      message: 'Part usage recorded successfully',
      transaction: transactionResult.rows[0]
    });
    
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error recording part usage:', error);
    res.status(500).json({ 
      error: 'Failed to record part usage',
      details: error.message
    });
  }
});

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/parts', partsRouter);
app.use('/api/v1/machines', machinesRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/test', testRouter);
app.use('/api/v1/vendors', vendorRoutes);
app.use('/api/v1/purchase-orders', purchaseOrderRoutes);
app.use('/api/v1/email', emailRoutes);
app.use('/api/v1/projects', projectsRouter);
app.use('/api/v1/equipment', equipmentRouter);

// Comment out the original parts usage controller since we're using our custom route
// app.post('/api/v1/parts/usage', (req, res) => partsUsageController.recordUsage(req, res));

// Direct test route for email
app.post('/api/test-email', (req, res) => {
  console.log('Received email test request:', req.body);
  try {
    const emailService = require('./src/services/emailService');
    // Send a simple test email
    if (req.body.recipient) {
      emailService.sendEmail(
        'Test Email from Fiserv Inventory System', 
        '<h3>Test Email</h3><p>This is a test email from the Fiserv Inventory System.</p>', 
        req.body.recipient
      )
        .then(info => {
          console.log('Test email sent successfully:', info);
          res.status(200).json({ success: true, message: 'Test email sent successfully', info });
        })
        .catch(error => {
          console.error('Failed to send test email:', error);
          res.status(500).json({ error: 'Failed to send test email', details: error.message });
        });
    } else {
      res.status(400).json({ error: 'Missing recipient' });
    }
  } catch (error) {
    console.error('Error in test email route:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Add temporary public route for purchase orders (bypass auth middleware)
app.get('/api/v1/public/purchase-orders', async (req, res) => {
  try {
    console.log('Using temporary public route for purchase orders');
    const result = await db.query(`
      SELECT po.*, 
              COALESCE(po.approval_status, po.status) as status,
              s.name as supplier_name, 
              s.address as supplier_address, 
              s.email as supplier_email, 
              s.phone as supplier_phone
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.supplier_id
      ORDER BY po.created_at DESC
    `);
    console.log(`Found ${result.rows.length} purchase orders`);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).send('Error fetching purchase orders');
  }
});

// Add temporary route for direct purchase orders access without /api/v1 prefix
app.get('/purchase-orders', async (req, res) => {
  try {
    console.log('Using temporary direct route for purchase orders');
    const result = await db.query(`
      SELECT po.*, 
              COALESCE(po.approval_status, po.status) as status,
              s.name as supplier_name, 
              s.address as supplier_address, 
              s.email as supplier_email, 
              s.phone as supplier_phone
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.supplier_id
      ORDER BY po.created_at DESC
    `);
    console.log(`Found ${result.rows.length} purchase orders from direct route`);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching purchase orders from direct route:', error);
    res.status(500).send('Error fetching purchase orders');
  }
});

// Add temporary route for direct purchase order by ID without /api/v1 prefix
app.get('/purchase-orders/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    console.log('Using temporary direct route for purchase order by ID:', id);
    const poResult = await db.query(`
      SELECT po.*, s.name as supplier_name, s.contact_name, s.email, s.phone, s.address
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.supplier_id
      WHERE po.po_id = $1
    `, [id]);

    if (poResult.rows.length === 0) {
      return res.status(404).send('Purchase order not found');
    }

    // Get the purchase order items
    const itemsResult = await db.query(`
      SELECT poi.*, p.name as part_name, p.manufacturer_part_number, p.fiserv_part_number
      FROM purchase_order_items poi
      LEFT JOIN parts p ON poi.part_id = p.part_id
      WHERE poi.po_id = $1
    `, [id]);

    // Combine the results
    const purchaseOrder = {
      ...poResult.rows[0],
      items: itemsResult.rows
    };
    
    res.json(purchaseOrder);
  } catch (error) {
    console.error('Error fetching purchase order from direct route:', error);
    res.status(500).send('Error fetching purchase order');
  }
});

// Add temporary direct route for suppliers without /api/v1 prefix
app.get('/suppliers', async (req, res) => {
  try {
    console.log('Using temporary direct route for suppliers');
    const result = await db.query(`
      SELECT * FROM suppliers ORDER BY name ASC
    `);
    console.log(`Found ${result.rows.length} suppliers from direct route`);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching suppliers from direct route:', error);
    res.status(500).send('Error fetching suppliers');
  }
});

// Add temporary direct route for a specific supplier without /api/v1 prefix
app.get('/suppliers/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    console.log('Using temporary direct route for supplier by ID:', id);
    const result = await db.query(`
      SELECT * FROM suppliers WHERE supplier_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).send('Supplier not found');
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching supplier from direct route:', error);
    res.status(500).send('Error fetching supplier');
  }
});

// Add temporary direct route for parts/low-stock without /api/v1 prefix
app.get('/parts/low-stock', async (req, res) => {
  try {
    console.log('Using temporary direct route for parts low-stock');
    const result = await db.query(`
      SELECT 
        p.part_id,
        p.name,
        p.description,
        p.manufacturer_part_number,
        p.fiserv_part_number,
        p.quantity,
        p.minimum_quantity,
        p.supplier,
        p.unit_cost,
        pl.name as location
      FROM parts p
      LEFT JOIN part_locations pl ON p.location_id = pl.location_id
      WHERE p.quantity <= p.minimum_quantity
      ORDER BY p.name ASC
    `);
    console.log(`Found ${result.rows.length} low stock parts from direct route`);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching low stock parts from direct route:', error);
    res.status(500).send('Error fetching low stock parts');
  }
});

// Add public email route for purchase orders
app.post('/api/v1/public/email/purchase-order', async (req, res) => {
  try {
    console.log('Using temporary public route for PO email');
    const { recipient, poNumber, poId, pdfBase64 } = req.body;
    
    if (!recipient || !poNumber || !poId || !pdfBase64) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const emailService = require('./src/services/emailService');
    
    // Create the email content
    const subject = `Purchase Order ${poNumber}`;
    const htmlContent = `
      <h2>Purchase Order ${poNumber}</h2>
      <p>Please find attached the purchase order.</p>
      <p>Thank you for your business.</p>
    `;
    
    // Convert base64 PDF to buffer for attachment
    const pdfBuffer = Buffer.from(pdfBase64.split(',')[1] || pdfBase64, 'base64');
    
    // Send email with PDF attachment
    const info = await emailService.sendEmailWithAttachment(
      subject,
      htmlContent,
      recipient,
      [{
        filename: `PO_${poNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    );
    
    console.log('Email sent successfully:', info);
    res.status(200).json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending PO email:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
});

// Use regular routes with middleware
app.use('/api/v1/purchase-orders', purchaseOrderRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

// Handle static files and React app routing
if (process.env.NODE_ENV === 'production') {
  // Production: Serve static files from the React app
  app.use(express.static(path.join(__dirname, '../frontend/build')));

  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
} else {
  // Development: API-only, frontend served separately
  app.get('*', (req, res) => {
    res.status(404).json({ message: 'API endpoint not found' });
  });
}

// Setup socket.io event listeners
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', (reason) => {
    console.log('Client disconnected:', socket.id, 'Reason:', reason);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Make socket.io available globally
global.io = io;

// Start server
server.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Test URL: http://localhost:${port}/api/v1/test/email`);
  console.log(`Socket.io URL: http://localhost:${port}/socket.io`);
  console.log('Environment:', process.env.NODE_ENV);
});