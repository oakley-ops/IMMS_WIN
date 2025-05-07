const express = require('express');
const router = express.Router();
const pool = require('../../db');
const auth = require('../middleware/auth');

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: Get all projects
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all projects
 */
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM projects ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/projects/{id}:
 *   get:
 *     summary: Get project by ID
 *     tags: [Projects]
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
 *         description: Project details
 *       404:
 *         description: Project not found
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM projects WHERE project_id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching project:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/projects:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - start_date
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               start_date:
 *                 type: string
 *                 format: date
 *               end_date:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *                 enum: [planning, in_progress, on_hold, completed, cancelled]
 *               budget:
 *                 type: number
 *               facility_id:
 *                 type: integer
 *               project_manager:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *     responses:
 *       201:
 *         description: Project created successfully
 */
router.post('/', auth, async (req, res) => {
  try {
    const {
      name,
      description,
      start_date,
      end_date,
      status,
      budget,
      facility_id,
      project_manager,
      priority
    } = req.body;

    if (!name || !start_date) {
      return res.status(400).json({ error: 'Name and start date are required' });
    }

    const result = await pool.query(
      `INSERT INTO projects 
      (name, description, start_date, end_date, status, budget, facility_id, project_manager, priority) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING *`,
      [name, description, start_date, end_date, status || 'planning', budget, facility_id, project_manager, priority || 'medium']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/projects/{id}:
 *   put:
 *     summary: Update a project
 *     tags: [Projects]
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
 *         description: Project updated successfully
 *       404:
 *         description: Project not found
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      start_date,
      end_date,
      status,
      budget,
      facility_id,
      project_manager,
      priority
    } = req.body;

    // First check if project exists
    const checkResult = await pool.query(
      'SELECT * FROM projects WHERE project_id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await pool.query(
      `UPDATE projects 
      SET name = $1, description = $2, start_date = $3, end_date = $4, 
          status = $5, budget = $6, facility_id = $7, project_manager = $8, 
          priority = $9, updated_at = CURRENT_TIMESTAMP 
      WHERE project_id = $10 
      RETURNING *`,
      [name, description, start_date, end_date, status, budget, facility_id, 
       project_manager, priority, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/projects/{id}:
 *   delete:
 *     summary: Delete a project
 *     tags: [Projects]
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
 *         description: Project deleted successfully
 *       404:
 *         description: Project not found
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if project exists
    const checkResult = await pool.query(
      'SELECT * FROM projects WHERE project_id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    await pool.query('DELETE FROM projects WHERE project_id = $1', [id]);
    
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/projects/{id}/equipment:
 *   get:
 *     summary: Get equipment installations for a project
 *     tags: [Projects]
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
 *         description: List of equipment installations
 */
router.get('/:id/equipment', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM equipment_installations WHERE project_id = $1 ORDER BY planned_installation_date',
      [id]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching project equipment:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/projects/{id}/milestones:
 *   get:
 *     summary: Get milestones for a project
 *     tags: [Projects]
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
 *         description: List of project milestones
 */
router.get('/:id/milestones', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM project_milestones WHERE project_id = $1 ORDER BY due_date',
      [id]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching project milestones:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/projects/{id}/timeline:
 *   get:
 *     summary: Get project timeline data (tasks, equipment installations, milestones)
 *     tags: [Projects]
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
 *         description: Project timeline data
 */
router.get('/:id/timeline', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get all tasks
      const tasksResult = await client.query(
        'SELECT * FROM project_tasks WHERE project_id = $1',
        [id]
      );
      
      // Get all equipment installations
      const equipmentResult = await client.query(
        'SELECT * FROM equipment_installations WHERE project_id = $1',
        [id]
      );
      
      // Get all milestones
      const milestonesResult = await client.query(
        'SELECT * FROM project_milestones WHERE project_id = $1',
        [id]
      );
      
      // Get equipment dependencies
      const dependenciesResult = await client.query(
        `SELECT ed.* 
         FROM equipment_dependencies ed
         JOIN equipment_installations ei ON ed.equipment_id = ei.installation_id
         WHERE ei.project_id = $1`,
        [id]
      );
      
      await client.query('COMMIT');
      
      res.json({
        tasks: tasksResult.rows,
        equipment: equipmentResult.rows,
        milestones: milestonesResult.rows,
        dependencies: dependenciesResult.rows
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error fetching project timeline:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 