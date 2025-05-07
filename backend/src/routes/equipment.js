const express = require('express');
const router = express.Router();
const pool = require('../../db');
const auth = require('../middleware/auth');

/**
 * @swagger
 * /api/equipment:
 *   get:
 *     summary: Get all equipment installations
 *     tags: [Equipment]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all equipment installations
 */
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM equipment_installations ORDER BY planned_installation_date'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching equipment installations:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/equipment/{id}:
 *   get:
 *     summary: Get equipment installation by ID
 *     tags: [Equipment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Equipment installation details
 *       404:
 *         description: Equipment installation not found
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM equipment_installations WHERE installation_id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment installation not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching equipment installation:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/equipment:
 *   post:
 *     summary: Create a new equipment installation
 *     tags: [Equipment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - project_id
 *               - equipment_name
 *             properties:
 *               project_id:
 *                 type: integer
 *               equipment_name:
 *                 type: string
 *               equipment_type:
 *                 type: string
 *               manufacturer:
 *                 type: string
 *               model:
 *                 type: string
 *               serial_number:
 *                 type: string
 *               planned_installation_date:
 *                 type: string
 *                 format: date
 *               actual_installation_date:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *                 enum: [pending, ordered, delivered, installed, tested, operational, delayed]
 *               location_in_facility:
 *                 type: string
 *               installation_notes:
 *                 type: string
 *               dependencies:
 *                 type: string
 *     responses:
 *       201:
 *         description: Equipment installation created successfully
 */
router.post('/', auth, async (req, res) => {
  try {
    const {
      project_id,
      equipment_name,
      equipment_type,
      manufacturer,
      model,
      serial_number,
      planned_installation_date,
      actual_installation_date,
      status,
      location_in_facility,
      installation_notes,
      dependencies
    } = req.body;

    if (!project_id || !equipment_name) {
      return res.status(400).json({ error: 'Project ID and equipment name are required' });
    }

    const result = await pool.query(
      `INSERT INTO equipment_installations 
      (project_id, equipment_name, equipment_type, manufacturer, model, 
       serial_number, planned_installation_date, actual_installation_date, 
       status, location_in_facility, installation_notes, dependencies) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
      RETURNING *`,
      [project_id, equipment_name, equipment_type, manufacturer, model, 
       serial_number, planned_installation_date, actual_installation_date, 
       status || 'pending', location_in_facility, installation_notes, dependencies]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating equipment installation:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/equipment/{id}:
 *   put:
 *     summary: Update an equipment installation
 *     tags: [Equipment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Equipment installation updated successfully
 *       404:
 *         description: Equipment installation not found
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      project_id,
      equipment_name,
      equipment_type,
      manufacturer,
      model,
      serial_number,
      planned_installation_date,
      actual_installation_date,
      status,
      location_in_facility,
      installation_notes,
      dependencies
    } = req.body;

    // First check if equipment installation exists
    const checkResult = await pool.query(
      'SELECT * FROM equipment_installations WHERE installation_id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment installation not found' });
    }

    const result = await pool.query(
      `UPDATE equipment_installations 
      SET project_id = $1, equipment_name = $2, equipment_type = $3, 
          manufacturer = $4, model = $5, serial_number = $6, 
          planned_installation_date = $7, actual_installation_date = $8, 
          status = $9, location_in_facility = $10, installation_notes = $11, 
          dependencies = $12, updated_at = CURRENT_TIMESTAMP 
      WHERE installation_id = $13 
      RETURNING *`,
      [project_id, equipment_name, equipment_type, manufacturer, model, 
       serial_number, planned_installation_date, actual_installation_date, 
       status, location_in_facility, installation_notes, dependencies, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating equipment installation:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/equipment/{id}:
 *   delete:
 *     summary: Delete an equipment installation
 *     tags: [Equipment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Equipment installation deleted successfully
 *       404:
 *         description: Equipment installation not found
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if equipment installation exists
    const checkResult = await pool.query(
      'SELECT * FROM equipment_installations WHERE installation_id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment installation not found' });
    }
    
    await pool.query('DELETE FROM equipment_installations WHERE installation_id = $1', [id]);
    
    res.json({ message: 'Equipment installation deleted successfully' });
  } catch (err) {
    console.error('Error deleting equipment installation:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/equipment/{id}/dependencies:
 *   get:
 *     summary: Get dependencies for an equipment installation
 *     tags: [Equipment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of equipment dependencies
 */
router.get('/:id/dependencies', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT ed.*, ei.equipment_name, ei.status 
       FROM equipment_dependencies ed
       JOIN equipment_installations ei ON ed.depends_on_id = ei.installation_id
       WHERE ed.equipment_id = $1`,
      [id]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching equipment dependencies:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/equipment/{id}/dependencies:
 *   post:
 *     summary: Add a dependency for an equipment installation
 *     tags: [Equipment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - depends_on_id
 *             properties:
 *               depends_on_id:
 *                 type: integer
 *               dependency_type:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Dependency added successfully
 */
router.post('/:id/dependencies', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { depends_on_id, dependency_type, notes } = req.body;

    if (!depends_on_id) {
      return res.status(400).json({ error: 'Dependency ID is required' });
    }

    // Check if equipment installation exists
    const checkEquipment = await pool.query(
      'SELECT * FROM equipment_installations WHERE installation_id = $1',
      [id]
    );
    
    if (checkEquipment.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment installation not found' });
    }

    // Check if dependency exists
    const checkDependency = await pool.query(
      'SELECT * FROM equipment_installations WHERE installation_id = $1',
      [depends_on_id]
    );
    
    if (checkDependency.rows.length === 0) {
      return res.status(404).json({ error: 'Dependency equipment not found' });
    }

    const result = await pool.query(
      `INSERT INTO equipment_dependencies 
      (equipment_id, depends_on_id, dependency_type, notes) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *`,
      [id, depends_on_id, dependency_type, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding equipment dependency:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 