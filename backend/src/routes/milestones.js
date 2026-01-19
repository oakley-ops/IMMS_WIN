const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');

// Create Milestone
router.post('/', auth, async (req, res) => {
  try {
    const { project_id, name, description, due_date, completion_date, status, order_index } = req.body;
    if (!project_id || !name || !due_date) {
      return res.status(400).json({ error: 'Project ID, name, and due date are required' });
    }
    const result = await db.query(
      `INSERT INTO project_milestones (project_id, name, description, due_date, completion_date, status, order_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [project_id, name, description, due_date, completion_date, status || 'pending', order_index || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating milestone:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create Multiple Milestones
router.post('/bulk', auth, async (req, res) => {
  try {
    const { project_id, milestones } = req.body;
    if (!project_id || !milestones || !Array.isArray(milestones)) {
      return res.status(400).json({ error: 'Project ID and milestones array are required' });
    }
    
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const createdMilestones = [];
      
      for (let i = 0; i < milestones.length; i++) {
        const { name, description, due_date, status } = milestones[i];
        const result = await client.query(
          `INSERT INTO project_milestones (project_id, name, description, due_date, status, order_index)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [project_id, name, description, due_date, status || 'pending', i]
        );
        createdMilestones.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
      res.status(201).json(createdMilestones);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error creating bulk milestones:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Milestones by Project ID
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await db.query(
      'SELECT * FROM project_milestones WHERE project_id = $1 ORDER BY due_date',
      [projectId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching project milestones:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update Milestone
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, due_date, completion_date, status } = req.body;
    const result = await db.query(
      `UPDATE project_milestones SET name = $1, description = $2, due_date = $3, completion_date = $4, status = $5, updated_at = CURRENT_TIMESTAMP
       WHERE milestone_id = $6 RETURNING *`,
      [name, description, due_date, completion_date, status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating milestone:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete Milestone
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM project_milestones WHERE milestone_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }
    res.json({ message: 'Milestone deleted successfully' });
  } catch (err) {
    console.error('Error deleting milestone:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;







