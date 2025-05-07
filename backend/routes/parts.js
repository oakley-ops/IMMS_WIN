const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../db');

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

// Add these helper functions at the top of the file
const isTBDValue = (value) => {
  return value && value.trim().toUpperCase() === 'TBD';
};

const generateUniqueTBD = () => {
  const timestamp = new Date().getTime();
  const random = Math.floor(Math.random() * 10000);
  return `TBD-${timestamp}-${random}`;
};

// Get all parts
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM parts ORDER BY part_id ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching parts:', error);
    res.status(500).json({ error: 'Failed to fetch parts' });
  }
});

// Get a specific part
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching part:', id);
    
    const result = await pool.query('SELECT * FROM parts WHERE part_id = $1', [id]);
    
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

// Import parts from CSV
router.post('/import', authenticateToken, upload.single('file'), async (req, res) => {
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

// Add a new part
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, quantity, location } = req.body;
    
    if (!name || !quantity || !location) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await pool.query(
      'INSERT INTO parts (name, description, quantity, location) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description, quantity, location]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding part:', error);
    res.status(500).json({ error: 'Failed to add part' });
  }
});

// Update a part
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      quantity,
      manufacturer_part_number,
      fiserv_part_number,
      machine_id,
      unit_cost,
      location,
      minimum_quantity,
      status,
      notes,
      image,
      supplier,
      supplier_id,
      location_id,
      vendor_id,
      barcode
    } = req.body;
    
    console.log('Updating part with ID:', id);
    console.log('Request body:', req.body);
    console.log('Fiserv part number:', fiserv_part_number);
    
    if (!name || !quantity) {
      return res.status(400).json({ error: 'Name and quantity are required fields' });
    }

    // Handle TBD value specially
    let finalFiservPartNumber = fiserv_part_number;
    if (isTBDValue(fiserv_part_number)) {
      // First check if this part already has a TBD-style number
      const currentPart = await pool.query(
        'SELECT fiserv_part_number FROM parts WHERE part_id = $1',
        [id]
      );

      if (currentPart.rows.length > 0 && currentPart.rows[0].fiserv_part_number?.startsWith('TBD-')) {
        // Keep the existing TBD identifier
        finalFiservPartNumber = currentPart.rows[0].fiserv_part_number;
      } else {
        // Generate a new unique TBD identifier
        finalFiservPartNumber = generateUniqueTBD();
      }
    } else {
      // If not TBD, check if the new fiserv_part_number already exists for a different part
      if (fiserv_part_number) {
        const existingPart = await pool.query(
          'SELECT part_id FROM parts WHERE fiserv_part_number = $1 AND part_id != $2',
          [fiserv_part_number, id]
        );

        if (existingPart.rows.length > 0) {
          return res.status(400).json({ 
            error: 'A part with this Fiserv part number already exists',
            detail: `Key (fiserv_part_number)=(${fiserv_part_number}) already exists.`
          });
        }
      }
    }
    
    // Build the query dynamically based on what fields are provided
    const updates = [];
    const values = [];
    let paramCount = 1;

    // Helper function to add update fields
    const addUpdateField = (field, value) => {
      if (value !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    };

    // Add all possible fields
    addUpdateField('name', name);
    addUpdateField('description', description);
    addUpdateField('quantity', quantity);
    addUpdateField('manufacturer_part_number', manufacturer_part_number);
    addUpdateField('fiserv_part_number', finalFiservPartNumber); // Use the processed Fiserv part number
    addUpdateField('machine_id', machine_id);
    addUpdateField('unit_cost', unit_cost);
    addUpdateField('location', location);
    addUpdateField('minimum_quantity', minimum_quantity);
    addUpdateField('status', status);
    addUpdateField('notes', notes);
    addUpdateField('image_url', image);
    addUpdateField('supplier', supplier);
    addUpdateField('supplier_id', supplier_id);
    addUpdateField('location_id', location_id);
    addUpdateField('vendor_id', vendor_id);
    addUpdateField('barcode', barcode);

    // Add the WHERE clause parameter
    values.push(id);

    const query = `
      UPDATE parts 
      SET ${updates.join(', ')}
      WHERE part_id = $${paramCount}
      RETURNING *
    `;

    console.log('Executing query:', query);
    console.log('With values:', values);

    const result = await pool.query(query, values);
    
    console.log('Update result:', result.rows[0]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating part:', error);
    res.status(500).json({ 
      error: 'Failed to update part',
      detail: error.detail || error.message
    });
  }
});

// Delete a part
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM parts WHERE part_id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }
    
    res.json({ message: 'Part deleted successfully' });
  } catch (error) {
    console.error('Error deleting part:', error);
    res.status(500).json({ error: 'Failed to delete part' });
  }
});

module.exports = router; 