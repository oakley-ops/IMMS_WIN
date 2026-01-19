const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');

// Create Task
router.post('/', auth, async (req, res) => {
  try {
    const { project_id, milestone_id, installation_id, name, description, assignee, start_date, end_date, status, priority } = req.body;
    if (!project_id || !name) {
      return res.status(400).json({ error: 'Project ID and name are required' });
    }
    const result = await db.query(
      `INSERT INTO project_tasks (project_id, milestone_id, installation_id, name, description, assignee, start_date, end_date, status, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [project_id, milestone_id, installation_id, name, description, assignee, start_date, end_date, status || 'not_started', priority || 'medium']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Tasks by Project ID
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await db.query(
      'SELECT * FROM project_tasks WHERE project_id = $1 ORDER BY start_date',
      [projectId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching project tasks:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update Task
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { milestone_id, installation_id, name, description, assignee, start_date, end_date, status, priority } = req.body;
    const result = await db.query(
      `UPDATE project_tasks SET milestone_id = $1, installation_id = $2, name = $3, description = $4, assignee = $5, start_date = $6, end_date = $7, status = $8, priority = $9, updated_at = CURRENT_TIMESTAMP
       WHERE task_id = $10 RETURNING *`,
      [milestone_id, installation_id, name, description, assignee, start_date, end_date, status, priority, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete Task
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM project_tasks WHERE task_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;







