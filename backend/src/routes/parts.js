const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticateToken } = require('../../middleware/auth');
const roleAuthorization = require('../middleware/roleMiddleware');
const { executeWithRetry, pool } = require('../../db');
const EventEmitter = require('events');
const PartController = require('../controllers/PartController');
const PartImageService = require('../services/PartImageService');

// Define role permissions
const ROLES = {
  ALL: ['admin', 'tech', 'purchasing'],
  MODIFY_PARTS: ['admin'],
  INVENTORY_MANAGEMENT: ['admin', 'tech'],
  RESTOCK_PARTS: ['admin', 'purchasing'], // For actual restocking actions
  VIEW_LOW_STOCK: ['admin', 'tech', 'purchasing'] // For viewing low stock information
};

const inventoryEvents = new EventEmitter();
const clients = new Set();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
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

// Configure multer for part image uploads
const partImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/temp/'); // Temporary storage
  },
  filename: function (req, file, cb) {
    cb(null, `temp-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const partImageUpload = multer({
  storage: partImageStorage,
  fileFilter: function (req, file, cb) {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/heic',
      'image/heif',
      'image/webp',
      'image/bmp',
      'image/tiff'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, HEIC, WebP, BMP, TIFF) are allowed'), false);
    }
  },
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB for high-res screenshots
  }
});

// SSE endpoint for real-time updates - accessible to all authenticated users
router.get('/events', authenticateToken, roleAuthorization(ROLES.ALL), (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const client = res;
  clients.add(client);

  req.on('close', () => {
    clients.delete(client);
  });
});

// Helper function to notify clients of inventory changes
const notifyInventoryChange = () => {
  const data = JSON.stringify({ type: 'inventory_change', timestamp: new Date().toISOString() });
  clients.forEach(client => {
    client.write(`data: ${data}\n\n`);
  });
};

// Get all parts with pagination and filtering - accessible to all authenticated users
router.get('/', authenticateToken, roleAuthorization(ROLES.ALL), async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('Parts GET request received with params:', req.query);
    
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 10000; // Default to high limit to show all parts
    const offset = page * limit;
    const search = req.query.search || '';
    const partNumber = req.query.partNumber || '';
    const location = req.query.location || '';
    const minQuantity = req.query.minQuantity ? parseInt(req.query.minQuantity) : null;
    const maxQuantity = req.query.maxQuantity ? parseInt(req.query.maxQuantity) : null;

    // Build the WHERE clause based on filters
    const whereConditions = ['p.status = $1'];
    const queryParams = ['active'];
    let paramCount = 2;

    if (search) {
      whereConditions.push(`(
        p.name ILIKE $${paramCount} OR
        p.description ILIKE $${paramCount} OR
        p.manufacturer_part_number ILIKE $${paramCount} OR
        p.crc_part_number ILIKE $${paramCount} OR
        p.supplier ILIKE $${paramCount} OR
        pl.name ILIKE $${paramCount}
      )`);
      queryParams.push(`%${search}%`);
      paramCount++;
    }

    if (partNumber) {
      whereConditions.push(`(
        p.manufacturer_part_number ILIKE $${paramCount} OR
        p.crc_part_number ILIKE $${paramCount}
      )`);
      queryParams.push(`%${partNumber}%`);
      paramCount++;
    }

    if (location) {
      whereConditions.push(`pl.name ILIKE $${paramCount}`);
      queryParams.push(`%${location}%`);
      paramCount++;
    }

    if (minQuantity !== null) {
      whereConditions.push(`p.quantity >= $${paramCount}`);
      queryParams.push(minQuantity);
      paramCount++;
    }

    if (maxQuantity !== null) {
      whereConditions.push(`p.quantity <= $${paramCount}`);
      queryParams.push(maxQuantity);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Get total count with filters
    const countQuery = `
      SELECT COUNT(*) as total
      FROM parts p
      LEFT JOIN part_locations pl ON p.location_id = pl.location_id
      ${whereClause}
    `;

    // Get total count
    const countResult = await executeWithRetry(
      countQuery,
      queryParams
    );

    const total = parseInt(countResult.rows[0].total);

    // Add pagination parameters
    queryParams.push(limit, offset);

    // Fetch paginated results
    const query = `
      SELECT 
        p.part_id, 
        p.name, 
        p.description, 
        p.manufacturer_part_number, 
        p.crc_part_number, 
        p.quantity::integer, 
        p.minimum_quantity::integer, 
        pl.name as location, 
        CAST(p.unit_cost AS NUMERIC) as unit_cost, 
        CAST(p.unit_cost AS NUMERIC) as cost, 
        p.supplier as manufacturer, 
        p.image_url,
        p.created_at as last_ordered_date, 
        p.updated_at,
        COALESCE(p.status, 'active') as status,
        p.notes
      FROM parts p
      LEFT JOIN part_locations pl ON p.location_id = pl.location_id
      ${whereClause}
      ORDER BY p.part_id DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    // Get paginated results
    const result = await executeWithRetry(
      query,
      queryParams
    );

    const endTime = Date.now();
    console.log(`Parts query completed in ${endTime - startTime}ms: found ${result.rows.length} parts out of ${total} total`);

    // Ensure all parts have valid part_id
    const validatedParts = result.rows.map(part => ({
      ...part,
      part_id: part.part_id || part.id || Math.floor(Math.random() * 1000000), // Fallback ID if missing
    }));

    res.json({
      items: validatedParts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      queryTime: endTime - startTime
    });
  } catch (error) {
    console.error('Error fetching parts:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch parts',
      message: error.message 
    });
  }
});

// Get low stock parts - accessible by admin, tech, and purchasing
router.get('/low-stock', authenticateToken, roleAuthorization(ROLES.VIEW_LOW_STOCK), async (req, res) => {
  try {
    console.log('Fetching low stock parts...');
    
    const result = await executeWithRetry(
      `SELECT 
        p.part_id,
        p.name,
        p.description,
        p.manufacturer_part_number,
        p.crc_part_number,
        p.quantity,
        p.minimum_quantity,
        p.unit_cost as cost,
        p.notes,
        ps.supplier_id,
        COALESCE(s.name, 'TBD') as supplier_name
      FROM parts p
      LEFT JOIN part_suppliers ps ON p.part_id = ps.part_id AND ps.is_preferred = true
      LEFT JOIN suppliers s ON ps.supplier_id = s.supplier_id
      WHERE p.status = 'active' AND p.quantity <= p.minimum_quantity
      ORDER BY p.quantity ASC`
    );

    console.log(`Found ${result.rows.length} low stock parts`);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching low stock parts:', error);
    res.status(500).json({ error: 'Failed to fetch low stock parts' });
  }
});

// Get order status for parts - accessible by admin, tech, and purchasing
router.get('/order-status', authenticateToken, roleAuthorization(ROLES.VIEW_LOW_STOCK), async (req, res) => {
  try {
    const { partIds } = req.query;
    
    if (!partIds) {
      return res.status(400).json({ error: 'Part IDs are required' });
    }
    
    // Split the comma-separated list of part IDs and ensure they're numbers
    const partIdsArray = partIds.split(',').map(id => parseInt(id, 10));
    
    console.log('Fetching order status for parts:', partIdsArray);
    
    // Simple query to reduce chances of errors
    const query = `
      SELECT 
        poi.part_id::text as part_id,
        po.po_id,
        po.status as order_status
      FROM 
        purchase_order_items poi
      JOIN 
        purchase_orders po ON poi.po_id = po.po_id
      WHERE 
        poi.part_id = ANY($1)
      ORDER BY po.created_at DESC
    `;
    
    const result = await pool.query(query, [partIdsArray]);
    
    console.log('Order status query results:', result.rows);
    
    // Process the results to get the latest order for each part
    const partStatusMap = new Map();
    
    // Process results to get latest status for each part
    result.rows.forEach(row => {
      if (!partStatusMap.has(row.part_id)) {
        partStatusMap.set(row.part_id, {
          part_id: row.part_id,
          order_status: row.order_status,
          po_id: row.po_id
        });
      }
    });
    
    // Convert map to array of results
    const response = Array.from(partStatusMap.values());
    console.log('Final processed order statuses:', response);
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching part order statuses:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch part order statuses',
      message: error.message,
      stack: error.stack
    });
  }
});

// Get a specific part - accessible to all authenticated users
router.get('/:id', authenticateToken, roleAuthorization(ROLES.ALL), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching part:', id);
    
    const result = await executeWithRetry(
      `SELECT 
        p.part_id,
        p.name,
        p.description,
        p.manufacturer_part_number,
        p.crc_part_number,
        p.quantity,
        p.minimum_quantity,
        p.supplier,
        p.unit_cost,
        p.created_at,
        pl.name as location,
        p.notes,
        p.status
       FROM parts p
       LEFT JOIN part_locations pl ON p.location_id = pl.location_id
       WHERE p.part_id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      console.log('Part not found:', id);
      return res.status(404).json({ error: 'Part not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching part:', error);
    res.status(500).json({ error: 'Failed to fetch part' });
  }
});

// Import parts from CSV - admin only
router.post('/import', authenticateToken, roleAuthorization(ROLES.MODIFY_PARTS), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    // Process CSV file here
    res.json({ message: 'File uploaded successfully' });
  } catch (error) {
    console.error('Error importing parts:', error);
    res.status(500).json({ error: 'Failed to import parts' });
  }
});

// Add a new part - admin only
router.post('/', authenticateToken, roleAuthorization(ROLES.MODIFY_PARTS), async (req, res) => {
  try {
    const {
      name,
      description,
      manufacturer_part_number,
      crc_part_number,
      quantity,
      minimum_quantity,
      manufacturer,
      unit_cost,
      location,
      notes
    } = req.body;
    
    if (!name || quantity === undefined || quantity === null || minimum_quantity === undefined || minimum_quantity === null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Start transaction
    await executeWithRetry('BEGIN');
    
    // Get or create location
    let locationId = null;
    if (location) {
      const locationResult = await executeWithRetry(
        'SELECT location_id FROM part_locations WHERE name = $1',
        [location]
      );
      
      if (locationResult.rows.length > 0) {
        locationId = locationResult.rows[0].location_id;
      } else {
        const newLocationResult = await executeWithRetry(
          'INSERT INTO part_locations (name) VALUES ($1) RETURNING location_id',
          [location]
        );
        locationId = newLocationResult.rows[0].location_id;
      }
    }
    
    const result = await executeWithRetry(
      `INSERT INTO parts (
        name,
        description,
        manufacturer_part_number,
        crc_part_number,
        quantity,
        minimum_quantity,
        supplier,
        unit_cost,
        location_id,
        notes,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        name,
        description,
        manufacturer_part_number,
        crc_part_number,
        quantity,
        minimum_quantity,
        manufacturer,
        unit_cost,
        locationId,
        notes,
        'active'
      ]
    );
    
    await executeWithRetry('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await executeWithRetry('ROLLBACK');
    console.error('Error adding part:', error);
    res.status(500).json({ error: 'Failed to add part' });
  }
});

// Update a part
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Updating part ID:', id);
    console.log('Received update data:', req.body);
    
    const {
      name,
      description,
      manufacturer_part_number,
      crc_part_number,
      quantity,
      minimum_quantity,
      supplier,
      unit_cost,
      location,
      notes,
      status,
      vendor_id,
      supplier_id
    } = req.body;
    
    console.log('Extracted unit_cost:', unit_cost, 'Type:', typeof unit_cost);
    console.log('Extracted name:', name, 'Type:', typeof name);
    console.log('Extracted quantity:', quantity, 'Type:', typeof quantity);
    console.log('Extracted minimum_quantity:', minimum_quantity, 'Type:', typeof minimum_quantity);
    console.log('Extracted crc_part_number:', crc_part_number, 'Type:', typeof crc_part_number);
    
    // Validate required fields - allowing quantity to be 0
    if (!name || name.trim() === '') {
      console.log('VALIDATION FAILED: Missing name');
      return res.status(400).json({ error: 'Missing required field: name' });
    }
    
    if (quantity === undefined || quantity === null) {
      console.log('VALIDATION FAILED: Missing quantity');
      return res.status(400).json({ error: 'Missing required field: quantity' });
    }
    
    if (minimum_quantity === undefined || minimum_quantity === null) {
      console.log('VALIDATION FAILED: Missing minimum_quantity');
      return res.status(400).json({ error: 'Missing required field: minimum_quantity' });
    }

    if (!crc_part_number || crc_part_number.trim() === '') {
      console.log('VALIDATION FAILED: Missing CRC part number');
      return res.status(400).json({ error: 'Missing required field: crc_part_number' });
    }

    // Start transaction
    await executeWithRetry('BEGIN');
    
    // Get or create location
    let locationId = null;
    if (location) {
      const locationResult = await executeWithRetry(
        'SELECT location_id FROM part_locations WHERE name = $1',
        [location]
      );
      
      if (locationResult.rows.length > 0) {
        locationId = locationResult.rows[0].location_id;
      } else {
        const newLocationResult = await executeWithRetry(
          'INSERT INTO part_locations (name) VALUES ($1) RETURNING location_id',
          [location]
        );
        locationId = newLocationResult.rows[0].location_id;
      }
    }

    // Ensure numeric values are properly parsed
    const parsedQuantity = Number(quantity);
    const parsedMinQuantity = Number(minimum_quantity);
    const parsedUnitCost = Number(unit_cost || 0);
    
    // Use supplier_id from request if provided, otherwise fallback to vendor_id
    const effectiveVendorId = supplier_id || vendor_id;

    // Log the values being used in the update
    const updateValues = [
      name,
      description,
      manufacturer_part_number,
      crc_part_number,
      parsedQuantity,
      parsedMinQuantity,
      supplier,
      parsedUnitCost,
      locationId,
      notes,
      status || 'active',
      effectiveVendorId,
      id
    ];
    console.log('Update query values:', updateValues);
    
    const result = await executeWithRetry(
      `UPDATE parts SET
        name = $1,
        description = $2,
        manufacturer_part_number = $3,
        crc_part_number = $4,
        quantity = $5,
        minimum_quantity = $6,
        supplier = $7,
        unit_cost = $8,
        location_id = $9,
        notes = $10,
        status = $11,
        supplier_id = $12,
        updated_at = CURRENT_TIMESTAMP
      WHERE part_id = $13
      RETURNING *`,
      updateValues
    );
    
    if (result.rows.length === 0) {
      await executeWithRetry('ROLLBACK');
      return res.status(404).json({ error: 'Part not found' });
    }
    
    await executeWithRetry('COMMIT');
    console.log('Updated part result:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    await executeWithRetry('ROLLBACK');
    console.error('Error updating part:', error);
    res.status(500).json({ error: 'Failed to update part' });
  }
});

// Delete a part
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await executeWithRetry(
      'UPDATE parts SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE part_id = $2 RETURNING *',
      ['inactive', id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }
    
    res.json({ message: 'Part deleted successfully' });
  } catch (error) {
    console.error('Error deleting part:', error);
    res.status(500).json({ error: 'Failed to delete part' });
  }
});


// Create a new part
router.post('/', async (req, res) => {
  const {
    name,
    description,
    manufacturer_part_number,
        crc_part_number,
    quantity,
    minimum_quantity,
    manufacturer,
    unit_cost,
    location,
    notes
  } = req.body;

  try {
    console.log('Creating new part...');
    // Start a transaction
    await executeWithRetry('BEGIN');

    // First, get or create the location
    let locationId = null;
    if (location) {
      console.log('Checking if location exists:', location);
      const locationResult = await executeWithRetry(
        'SELECT location_id FROM part_locations WHERE name = $1',
        [location]
      );
      
      if (locationResult.rows.length > 0) {
        locationId = locationResult.rows[0].location_id;
        console.log('Location exists:', locationId);
      } else {
        console.log('Creating new location:', location);
        const newLocationResult = await executeWithRetry(
          'INSERT INTO part_locations (name) VALUES ($1) RETURNING location_id',
          [location]
        );
        locationId = newLocationResult.rows[0].location_id;
        console.log('Created new location:', locationId);
      }
    }

    // Ensure numeric values are properly parsed
    const parsedQuantity = Number(quantity);
    const parsedMinQuantity = Number(minimum_quantity);
    const parsedUnitCost = Number(unit_cost || 0);

    // Handle TBD crc_part_number
    let finalCrcPartNumber = crc_part_number;
    if (crc_part_number && crc_part_number.trim().toUpperCase() === 'TBD') {
      // Generate a unique identifier for TBD values
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      finalCrcPartNumber = `CRC-${timestamp}-${random}`;
      console.log('Generated unique CRC identifier:', finalCrcPartNumber);
    }

    // Then create the part
    console.log('Creating new part...');
    const result = await executeWithRetry(
      `INSERT INTO parts (
        name,
        description,
        manufacturer_part_number,
        crc_part_number,
        quantity,
        minimum_quantity,
        supplier,
        unit_cost,
        location_id,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        name,
        description || null,
        manufacturer_part_number || null,
        finalCrcPartNumber,
        parsedQuantity,
        parsedMinQuantity,
        manufacturer || null,
        parsedUnitCost,
        locationId,
        notes || null
      ]
    );

    await executeWithRetry('COMMIT');
    console.log('Created new part:', result.rows[0].part_id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await executeWithRetry('ROLLBACK');
    console.error('Error creating part:', err);
    throw err;
  }
});

// Bulk import parts
router.post('/bulk', async (req, res) => {
  let client = null;
  try {
    console.log('Starting bulk import...');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Request body must be an array of parts' });
    }

    const parts = req.body;
    const results = [];
    let errors = [];

    // Get a client from the pool for the entire transaction
    client = await pool.connect();
    
    // Start transaction
    await client.query('BEGIN');

    for (const part of parts) {
      try {
        console.log('Processing part:', JSON.stringify(part, null, 2));
        
        // Validate required fields
        if (!part.name || !part.crc_part_number) {
          throw new Error('Name and CRC part number are required');
        }

        // Handle TBD crc_part_number
        let finalCrcPartNumber = part.crc_part_number;
        if (part.crc_part_number && part.crc_part_number.trim().toUpperCase() === 'TBD') {
          // Generate a unique identifier for TBD values
          const timestamp = Date.now();
          const random = Math.floor(Math.random() * 10000);
          finalCrcPartNumber = `CRC-${timestamp}-${random}`;
          console.log('Generated unique CRC identifier:', finalCrcPartNumber);
        }

        // Check if the part already exists (using the original part number for lookup)
        const existingPartResult = await client.query(
          'SELECT part_id FROM parts WHERE crc_part_number = $1',
          [part.crc_part_number]
        );

        if (existingPartResult.rows.length > 0) {
          console.log('Updating existing part:', part.crc_part_number);
          
          // Get the existing part ID
          const partId = existingPartResult.rows[0].part_id;

          // Get or create location_id if location is provided
          let locationId = null;
          if (part.location) {
            const locationResult = await client.query(
              'SELECT location_id FROM part_locations WHERE name = $1',
              [part.location]
            );

            if (locationResult.rows.length > 0) {
              locationId = locationResult.rows[0].location_id;
            } else {
              // Create new location
              const newLocationResult = await client.query(
                'INSERT INTO part_locations (name) VALUES ($1) RETURNING location_id',
                [part.location]
              );
              locationId = newLocationResult.rows[0].location_id;
            }
          }

          // Ensure numeric values are properly parsed
          const parsedQuantity = Number(part.quantity || 0);
          const parsedMinQuantity = Number(part.minimum_quantity || 0);
          const parsedUnitCost = Number(part.unit_cost || 0);

          // Update the part
          await client.query(
            `UPDATE parts SET 
              name = $1, 
              description = $2, 
              manufacturer_part_number = $3, 
              supplier = $4, 
              unit_cost = $5, 
              quantity = $6, 
              minimum_quantity = $7,
              location_id = $8,
              updated_at = NOW()
            WHERE part_id = $9`,
            [
              part.name,
              part.description || '',
              part.manufacturer_part_number || '',
              part.supplier || '',
              parsedUnitCost,
              parsedQuantity,
              parsedMinQuantity,
              locationId,
              partId
            ]
          );

          results.push({
            part_id: partId,
            name: part.name,
            crc_part_number: part.crc_part_number,
            status: 'updated'
          });
        } else {
          console.log('Inserting new part:', finalCrcPartNumber);
          
          // Get or create location_id if location is provided
          let locationId = null;
          if (part.location) {
            const locationResult = await client.query(
              'SELECT location_id FROM part_locations WHERE name = $1',
              [part.location]
            );

            if (locationResult.rows.length > 0) {
              locationId = locationResult.rows[0].location_id;
            } else {
              // Create new location
              const newLocationResult = await client.query(
                'INSERT INTO part_locations (name) VALUES ($1) RETURNING location_id',
                [part.location]
              );
              locationId = newLocationResult.rows[0].location_id;
            }
          }

          // Ensure numeric values are properly parsed
          const parsedQuantity = Number(part.quantity || 0);
          const parsedMinQuantity = Number(part.minimum_quantity || 0);
          const parsedUnitCost = Number(part.unit_cost || 0);

          // Insert the new part
          const result = await client.query(
            `INSERT INTO parts (
              name, 
              description, 
              manufacturer_part_number, 
              crc_part_number, 
              supplier, 
              unit_cost, 
              quantity, 
              minimum_quantity,
              location_id,
              status,
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) RETURNING part_id`,
            [
              part.name,
              part.description || '',
              part.manufacturer_part_number || '',
              finalCrcPartNumber,
              part.supplier || '',
              parsedUnitCost,
              parsedQuantity,
              parsedMinQuantity,
              locationId,
              'active'
            ]
          );

          results.push({
            part_id: result.rows[0].part_id,
            name: part.name,
            crc_part_number: finalCrcPartNumber,
            status: 'created'
          });
        }
      } catch (partError) {
        const errorMessage = `Error processing part ${part.crc_part_number || 'unknown'}: ${partError.message}`;
        console.error('Error details:', {
          message: partError.message,
          stack: partError.stack,
          part
        });
        errors.push(errorMessage);
        
        // We can't continue the transaction if there's an error
        // with one part since the transaction is already aborted
        await client.query('ROLLBACK');
        throw new Error(`Failed to import parts:\n${errorMessage}`);
      }
    }

    await client.query('COMMIT');
    console.log('Successfully imported parts:', results.length);
    res.json({
      message: `Successfully imported ${results.length} parts`,
      parts: results
    });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Error during rollback:', rollbackErr);
      }
    }
    console.error('Error importing parts:', {
      message: err.message,
      stack: err.stack,
      error: err
    });
    res.status(500).json({ error: err.message || 'Failed to import parts' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Record parts usage
router.post('/usage', async (req, res) => {
  const { part_id, machine_id, quantity, work_order_number } = req.body;

  console.log('Recording parts usage - request body:', req.body);
  console.log('Record values:', { part_id, machine_id, quantity, work_order_number });

  if (!part_id || !quantity || quantity <= 0) {
    console.error('Invalid request - missing required fields:', { part_id, machine_id, quantity });
    return res.status(400).json({
      error: 'Invalid request. Required fields: part_id, quantity (> 0)'
    });
  }

  try {
    await executeWithRetry('BEGIN');
    console.log('Transaction started');

    // Check if part exists and has enough quantity
    const partResult = await executeWithRetry(
      'SELECT quantity FROM parts WHERE part_id = $1',
      [part_id]
    );
    console.log('Part quantity check result:', partResult.rows);

    if (partResult.rows.length === 0) {
      await executeWithRetry('ROLLBACK');
      console.error('Part not found:', part_id);
      return res.status(404).json({
        error: 'Part not found'
      });
    }

    const currentQuantity = partResult.rows[0].quantity;
    console.log('Current quantity:', currentQuantity, 'Requested quantity:', quantity);
    
    if (currentQuantity < quantity) {
      await executeWithRetry('ROLLBACK');
      console.error('Not enough quantity available:', { available: currentQuantity, requested: quantity });
      return res.status(400).json({
        error: 'Not enough quantity available',
        available: currentQuantity,
        requested: quantity
      });
    }

    // Update part quantity
    await executeWithRetry(
      'UPDATE parts SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE part_id = $2',
      [quantity, part_id]
    );
    console.log('Part quantity updated');

    // Use transactions table instead of parts_usage
    const transactionInsertQuery = `
      INSERT INTO transactions (
        part_id,
        machine_id,
        quantity,
        type,
        notes,
        reference_number
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const reason = req.body.reason || 'Part used'; // Use reason from request if available, otherwise default
    const transactionParams = [
      part_id,
      machine_id, // Include machine_id from request
      quantity,
      'usage',  // Type of transaction
      reason,   // Notes field
      work_order_number // Reference number
    ];

    console.log('Executing transaction INSERT with params:', transactionParams);
    console.log('SQL Query:', transactionInsertQuery);
    
    try {
      const insertResult = await executeWithRetry(transactionInsertQuery, transactionParams);
      console.log('Transaction record successful, result:', insertResult.rows[0]);
    } catch (insertError) {
      console.error('Error during transaction INSERT operation:', {
        message: insertError.message,
        code: insertError.code,
        detail: insertError.detail,
        hint: insertError.hint,
        position: insertError.position
      });
      throw insertError;
    }

    await executeWithRetry('COMMIT');
    console.log('Transaction committed');

    // Notify all connected clients about the inventory change
    notifyInventoryChange();

    return res.status(200).json({
      success: true,
      message: 'Part usage recorded successfully'
    });
  } catch (error) {
    await executeWithRetry('ROLLBACK');
    console.error('Error recording part usage:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    });
    
    return res.status(500).json({
      error: 'Failed to record part usage',
      details: error.message,
      code: error.code
    });
  }
});

// Restock parts
router.post('/restock', authenticateToken, roleAuthorization(ROLES.RESTOCK_PARTS), async (req, res) => {
  const { part_id, quantity } = req.body;

  console.log('Restocking parts:', { part_id, quantity });

  if (!part_id || !quantity || quantity <= 0) {
    console.error('Invalid request:', { part_id, quantity });
    throw new Error('Invalid request. Required fields: part_id, quantity (> 0)');
  }

  try {
    await executeWithRetry('BEGIN');

    // Check if part exists
    const partResult = await executeWithRetry(
      'SELECT part_id FROM parts WHERE part_id = $1',
      [part_id]
    );

    if (partResult.rows.length === 0) {
      throw new Error(`Part not found with ID: ${part_id}`);
    }

    // Update part quantity
    await executeWithRetry(
      'UPDATE parts SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE part_id = $2',
      [quantity, part_id]
    );

    // Record restock in transactions table
    const restockResult = await executeWithRetry(
      `INSERT INTO transactions (
        part_id,
        quantity,
        type,
        notes
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [part_id, quantity, 'restock', 'Restock']
    );

    await executeWithRetry('COMMIT');
    console.log('Parts restocked successfully:', restockResult.rows[0]);
    
    // Notify clients of inventory change
    notifyInventoryChange();
    
    res.json({ message: 'Parts restocked successfully' });
  } catch (err) {
    await executeWithRetry('ROLLBACK');
    console.error('Error restocking parts:', err);
    throw err;
  }
});

// Return parts to inventory
router.post('/return', authenticateToken, roleAuthorization(ROLES.INVENTORY_MANAGEMENT), async (req, res) => {
  const { part_id, quantity, reason, original_transaction_id, work_order_number } = req.body;

  console.log('Returning parts to inventory:', { part_id, quantity, reason, original_transaction_id, work_order_number });

  if (!part_id || !quantity || quantity <= 0) {
    console.error('Invalid request:', { part_id, quantity });
    return res.status(400).json({
      error: 'Invalid request. Required fields: part_id, quantity (> 0)'
    });
  }

  try {
    await executeWithRetry('BEGIN');

    // Check if part exists
    const partResult = await executeWithRetry(
      'SELECT part_id, name FROM parts WHERE part_id = $1',
      [part_id]
    );

    if (partResult.rows.length === 0) {
      await executeWithRetry('ROLLBACK');
      console.error('Part not found:', part_id);
      return res.status(404).json({
        error: 'Part not found'
      });
    }

    const part = partResult.rows[0];

    // Update part quantity - add the returned quantity
    await executeWithRetry(
      'UPDATE parts SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE part_id = $2',
      [quantity, part_id]
    );

    // Create return transaction record
    const returnNotes = reason || 'Part returned to inventory (unused)';
    const transactionResult = await executeWithRetry(
      `INSERT INTO transactions (
        part_id,
        quantity,
        type,
        notes,
        reference_number
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [part_id, quantity, 'return', returnNotes, work_order_number || original_transaction_id]
    );

    await executeWithRetry('COMMIT');
    console.log('Parts returned to inventory successfully:', transactionResult.rows[0]);
    
    // Notify clients of inventory change
    notifyInventoryChange();
    
    res.status(200).json({ 
      success: true,
      message: `Successfully returned ${quantity} units of ${part.name} to inventory`,
      transaction: transactionResult.rows[0]
    });
  } catch (err) {
    await executeWithRetry('ROLLBACK');
    console.error('Error returning parts to inventory:', err);
    res.status(500).json({
      error: 'Failed to return parts to inventory',
      details: err.message
    });
  }
});

// Get recent parts usage (last 24 hours)
router.get('/usage/recent', async (req, res) => {
  try {
    const result = await executeWithRetry(`
      SELECT 
        pu.part_id,
        p.name as part_name,
        pu.machine_id,
        m.name as machine_name,
        pu.quantity,
        pu.usage_date
      FROM parts_usage pu
      LEFT JOIN parts p ON pu.part_id = p.part_id
      LEFT JOIN machines m ON pu.machine_id = m.machine_id
      WHERE pu.usage_date >= NOW() - INTERVAL '24 HOURS'
      ORDER BY pu.usage_date DESC
    `);

    console.log('Recent parts usage:', result.rows.length);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recent parts usage:', err);
    throw err;
  }
});

// Get parts usage history
router.get('/usage/history', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    console.log('Fetching parts usage history with params:', { startDate, endDate });

    let query = `
      SELECT 
        t.transaction_id,
        t.part_id,
        p.name as part_name,
        p.manufacturer_part_number,
        p.crc_part_number,
        t.quantity,
        t.created_at as usage_date,
        t.notes as reason,
        t.type as transaction_type,
        COALESCE(p.unit_cost, 0) as unit_cost,
        m.name as machine_name
      FROM transactions t
      LEFT JOIN parts p ON t.part_id = p.part_id
      LEFT JOIN machines m ON t.machine_id = m.machine_id
      WHERE t.type IN ('usage', 'return', 'restock')
    `;

    const queryParams = [];
    let paramCount = 1;

    if (startDate) {
      query += ` AND t.created_at >= $${paramCount++}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      query += ` AND t.created_at <= $${paramCount++}`;
      queryParams.push(endDate);
    }

    query += ' ORDER BY t.created_at DESC';

    console.log('Executing query:', { query, params: queryParams });
    const result = await executeWithRetry(query, queryParams);
    console.log('Query result:', { rowCount: result.rowCount });

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching parts usage history:', err);
    throw err;
  }
});

// Diagnostic endpoint to check inventory status
router.get('/inventory-status', authenticateToken, async (req, res) => {
  try {
    console.log('Running inventory status diagnostic...');
    
    // Get low stock parts query
    const lowStockQuery = `
      SELECT 
        p.part_id,
        p.name,
        p.quantity,
        p.minimum_quantity,
        p.vendor_id,
        COALESCE(v.name, 'Unknown Vendor') as vendor_name
      FROM parts p
      LEFT JOIN vendors v ON p.vendor_id = v.vendor_id
      WHERE p.status = 'active' 
      AND p.quantity > 0 
      AND p.quantity <= p.minimum_quantity
      ORDER BY p.quantity ASC;
    `;
    
    // Get out of stock parts query
    const outOfStockQuery = `
      SELECT 
        p.part_id,
        p.name,
        p.quantity,
        p.minimum_quantity,
        p.vendor_id,
        COALESCE(v.name, 'Unknown Vendor') as vendor_name
      FROM parts p
      LEFT JOIN vendors v ON p.vendor_id = v.vendor_id
      WHERE p.status = 'active' 
      AND p.quantity = 0
      ORDER BY p.name ASC;
    `;
    
    // Execute both queries
    const [lowStockResult, outOfStockResult] = await Promise.all([
      executeWithRetry(lowStockQuery),
      executeWithRetry(outOfStockQuery)
    ]);
    
    // Log detailed results
    console.log(`Found ${lowStockResult.rows.length} low stock parts`);
    if (lowStockResult.rows.length > 0) {
      console.log('Sample low stock parts:', lowStockResult.rows.slice(0, 3));
    }
    
    console.log(`Found ${outOfStockResult.rows.length} out of stock parts`);
    if (outOfStockResult.rows.length > 0) {
      console.log('Sample out of stock parts:', outOfStockResult.rows.slice(0, 3));
    }
    
    // Return diagnostic results
    res.json({
      diagnosticRun: new Date().toISOString(),
      lowStockCount: lowStockResult.rows.length,
      outOfStockCount: outOfStockResult.rows.length,
      lowStockParts: lowStockResult.rows,
      outOfStockParts: outOfStockResult.rows,
      message: lowStockResult.rows.length === 0 && outOfStockResult.rows.length === 0 
        ? 'No low stock or out of stock parts found. Consider updating minimum_quantity values or reducing quantities to test this feature.' 
        : 'Retrieved inventory status data successfully.'
    });
  } catch (err) {
    console.error('Error in inventory status diagnostic:', err);
    res.status(500).json({ 
      error: 'Failed to run inventory diagnostic',
      message: err.message
    });
  }
});

// Get all suppliers for a part
router.get('/:id/suppliers', authenticateToken, async (req, res) => {
  const partController = new PartController();
  await partController.getSuppliersForPart(req, res);
});

// Add a supplier to a part
router.post('/:id/suppliers', authenticateToken, async (req, res) => {
  const partController = new PartController();
  await partController.addSupplierToPart(req, res);
});

// Update a part-supplier relationship
router.put('/:partId/suppliers/:supplierId', authenticateToken, async (req, res) => {
  const partController = new PartController();
  await partController.updatePartSupplier(req, res);
});

// Remove a supplier from a part
router.delete('/:partId/suppliers/:supplierId', authenticateToken, async (req, res) => {
  const partController = new PartController();
  await partController.removeSupplierFromPart(req, res);
});

// Set a supplier as preferred for a part
router.post('/:partId/suppliers/:supplierId/preferred', authenticateToken, async (req, res) => {
  const partController = new PartController();
  await partController.setPreferredSupplier(req, res);
});

// Add a diagnostic endpoint to check parts_usage table structure
router.get('/usage/table-info', async (req, res) => {
  try {
    console.log('Checking parts_usage table structure...');
    
    // Check if table exists
    const tableCheck = await executeWithRetry(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'parts_usage'
      ) as table_exists
    `);
    
    const tableExists = tableCheck.rows[0].table_exists;
    console.log('parts_usage table exists:', tableExists);
    
    if (!tableExists) {
      return res.status(200).json({
        tableExists: false,
        message: 'parts_usage table does not exist'
      });
    }
    
    // Get column information
    const columnsInfo = await executeWithRetry(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'parts_usage'
      ORDER BY ordinal_position
    `);
    
    console.log('parts_usage columns:', columnsInfo.rows);
    
    // Return diagnostic results
    return res.status(200).json({
      tableExists: true,
      columns: columnsInfo.rows,
      message: 'Retrieved parts_usage table information'
    });
  } catch (error) {
    console.error('Error checking table structure:', error);
    return res.status(500).json({
      error: 'Failed to check table structure',
      details: error.message
    });
  }
});

// Upload part image endpoint
router.post('/:id/image', 
  authenticateToken, 
  roleAuthorization(ROLES.MODIFY_PARTS),
  partImageUpload.single('image'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const username = req.user?.username || 'system';
      
      if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
      }

      const partImageService = new PartImageService(pool);
      const result = await partImageService.uploadPartImage(id, req.file, username);
      
      res.json(result);
    } catch (error) {
      console.error('Error uploading part image:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Delete part image endpoint
router.delete('/:id/image',
  authenticateToken,
  roleAuthorization(ROLES.MODIFY_PARTS),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const partImageService = new PartImageService(pool);
      await partImageService.deletePartImage(id);
      
      res.json({ message: 'Image deleted successfully' });
    } catch (error) {
      console.error('Error deleting part image:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;