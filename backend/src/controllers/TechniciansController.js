const { pool } = require('../../db');

class TechniciansController {
  // Get all active technicians
  async getTechnicians(req, res) {
    try {
      const result = await pool.query(
        'SELECT technician_id, name, active, created_at, updated_at FROM technicians WHERE active = true ORDER BY name'
      );
      
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching technicians:', error);
      res.status(500).json({ error: 'Failed to fetch technicians' });
    }
  }

  // Get all technicians (including inactive)
  async getAllTechnicians(req, res) {
    try {
      const result = await pool.query(
        'SELECT technician_id, name, active, created_at, updated_at FROM technicians ORDER BY name'
      );
      
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching all technicians:', error);
      res.status(500).json({ error: 'Failed to fetch technicians' });
    }
  }

  // Get a specific technician by ID
  async getTechnician(req, res) {
    try {
      const { id } = req.params;
      
      const result = await pool.query(
        'SELECT technician_id, name, active, created_at, updated_at FROM technicians WHERE technician_id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Technician not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching technician:', error);
      res.status(500).json({ error: 'Failed to fetch technician' });
    }
  }

  // Create a new technician
  async createTechnician(req, res) {
    try {
      const { name } = req.body;
      
      if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Technician name is required' });
      }
      
      const trimmedName = name.trim();
      
      // Check if technician already exists
      const existingTechnician = await pool.query(
        'SELECT technician_id FROM technicians WHERE name = $1 AND active = true',
        [trimmedName]
      );
      
      if (existingTechnician.rows.length > 0) {
        return res.status(400).json({ error: 'A technician with this name already exists' });
      }
      
      const result = await pool.query(
        'INSERT INTO technicians (name) VALUES ($1) RETURNING technician_id, name, active, created_at, updated_at',
        [trimmedName]
      );
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating technician:', error);
      res.status(500).json({ error: 'Failed to create technician' });
    }
  }

  // Update a technician
  async updateTechnician(req, res) {
    try {
      const { id } = req.params;
      const { name, active } = req.body;
      
      if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Technician name is required' });
      }
      
      const trimmedName = name.trim();
      
      // Check if another technician with the same name exists
      const existingTechnician = await pool.query(
        'SELECT technician_id FROM technicians WHERE name = $1 AND active = true AND technician_id != $2',
        [trimmedName, id]
      );
      
      if (existingTechnician.rows.length > 0) {
        return res.status(400).json({ error: 'A technician with this name already exists' });
      }
      
      const result = await pool.query(
        'UPDATE technicians SET name = $1, active = $2, updated_at = CURRENT_TIMESTAMP WHERE technician_id = $3 RETURNING technician_id, name, active, created_at, updated_at',
        [trimmedName, active !== undefined ? active : true, id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Technician not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating technician:', error);
      res.status(500).json({ error: 'Failed to update technician' });
    }
  }

  // Delete (deactivate) a technician
  async deleteTechnician(req, res) {
    try {
      const { id } = req.params;
      
      // First check if the technician exists
      const existingTechnician = await pool.query(
        'SELECT technician_id, name, active FROM technicians WHERE technician_id = $1',
        [id]
      );
      
      if (existingTechnician.rows.length === 0) {
        return res.status(404).json({ error: 'Technician not found' });
      }
      
      // Update the technician to inactive
      const result = await pool.query(
        'UPDATE technicians SET active = false, updated_at = CURRENT_TIMESTAMP WHERE technician_id = $1 RETURNING technician_id, name, active, created_at, updated_at',
        [id]
      );
      
      res.json({ message: 'Technician deactivated successfully', technician: result.rows[0] });
    } catch (error) {
      console.error('Error deleting technician:', error);
      res.status(500).json({ error: 'Failed to delete technician', details: error.message });
    }
  }

  // Reactivate a technician
  async reactivateTechnician(req, res) {
    try {
      const { id } = req.params;
      
      const result = await pool.query(
        'UPDATE technicians SET active = true, updated_at = CURRENT_TIMESTAMP WHERE technician_id = $1 RETURNING technician_id, name, active, created_at, updated_at',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Technician not found' });
      }
      
      res.json({ message: 'Technician reactivated successfully', technician: result.rows[0] });
    } catch (error) {
      console.error('Error reactivating technician:', error);
      res.status(500).json({ error: 'Failed to reactivate technician' });
    }
  }
}

module.exports = new TechniciansController(); 