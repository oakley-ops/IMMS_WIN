const db = require('../../db');

class MachineController {
  constructor() {
    // Bind methods to ensure 'this' context
    this.getAllMachines = this.getAllMachines.bind(this);
    this.getMachine = this.getMachine.bind(this);
    this.createMachine = this.createMachine.bind(this);
    this.deleteMachine = this.deleteMachine.bind(this);
    this.updateMachine = this.updateMachine.bind(this);
  }

  async getMachine(req, res) {
    console.log('getMachine called with params:', req.params);
    const machineId = parseInt(req.params.id);
    
    if (!machineId) {
      console.log('Invalid machine ID:', req.params.id);
      return res.status(400).json({ error: 'Invalid machine ID' });
    }

    try {
      console.log('Executing query for machine ID:', machineId);
      const result = await db.query(
        'SELECT * FROM machines WHERE machine_id = $1',
        [machineId]
      );
      
      console.log('Query result:', result.rows);
      
      if (result.rows.length === 0) {
        console.log('Machine not found:', machineId);
        return res.status(404).json({ error: 'Machine not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error in getMachine:', error);
      res.status(500).json({ 
        error: 'Error fetching machine',
        details: error.message 
      });
    }
  }

  async updateMachine(req, res) {
    const machineId = parseInt(req.params.id);
    const { 
      name, 
      model, 
      serial_number, 
      location, 
      status, 
      manufacturer,
      installation_date,
      last_maintenance_date,
      next_maintenance_date,
      notes
    } = req.body;
    
    if (!machineId) {
      return res.status(400).json({ error: 'Invalid machine ID' });
    }

    try {
      // First check if machine exists
      const checkResult = await db.query(
        'SELECT * FROM machines WHERE machine_id = $1',
        [machineId]
      );
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Machine not found' });
      }

      // Update the machine
      const result = await db.query(
        `UPDATE machines 
         SET name = COALESCE($1, name),
             model = COALESCE($2, model),
             serial_number = COALESCE($3, serial_number),
             location = COALESCE($4, location),
             status = COALESCE($5, status),
             manufacturer = COALESCE($6, manufacturer),
             installation_date = COALESCE($7::timestamp, installation_date),
             last_maintenance_date = COALESCE($8::timestamp, last_maintenance_date),
             next_maintenance_date = COALESCE($9::timestamp, next_maintenance_date),
             notes = COALESCE($10, notes),
             updated_at = CURRENT_TIMESTAMP
         WHERE machine_id = $11
         RETURNING *`,
        [
          name, 
          model, 
          serial_number, 
          location, 
          status, 
          manufacturer,
          installation_date,
          last_maintenance_date,
          next_maintenance_date,
          notes,
          machineId
        ]
      );

      console.log('Update result:', result.rows[0]);
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating machine:', error);
      res.status(500).json({ 
        error: 'Error updating machine',
        details: error.message 
      });
    }
  }

  async getAllMachines(req, res) {
    try {
      const result = await db.query('SELECT * FROM machines ORDER BY machine_id');
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching machines:', error);
      res.status(500).json({ 
        error: 'Error fetching machines',
        details: error.message 
      });
    }
  }

  async createMachine(req, res) {
    console.log('Creating machine with data:', req.body);
    
    const { 
      name, 
      model, 
      serial_number, 
      location, 
      status, 
      manufacturer,
      installation_date,
      last_maintenance_date,
      next_maintenance_date,
      notes
    } = req.body;

    if (!name) {
      console.log('Machine name is missing');
      return res.status(400).json({ error: 'Machine name is required' });
    }

    try {
      console.log('Executing insert query with values:', {
        name, 
        model, 
        serial_number, 
        location, 
        status, 
        manufacturer,
        installation_date,
        last_maintenance_date,
        next_maintenance_date,
        notes
      });

      const result = await db.query(
        `INSERT INTO machines (
          name, 
          model, 
          serial_number, 
          location, 
          status, 
          manufacturer,
          installation_date,
          last_maintenance_date,
          next_maintenance_date,
          notes
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          name, 
          model, 
          serial_number, 
          location, 
          status, 
          manufacturer,
          installation_date ? new Date(installation_date) : null,
          last_maintenance_date ? new Date(last_maintenance_date) : null,
          next_maintenance_date ? new Date(next_maintenance_date) : null,
          notes
        ]
      );

      console.log('Machine created successfully:', result.rows[0]);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating machine:', {
        error: error.message,
        stack: error.stack,
        details: error.detail,
        hint: error.hint,
        code: error.code
      });
      res.status(500).json({ 
        error: 'Error creating machine',
        details: error.message,
        code: error.code
      });
    }
  }

  async deleteMachine(req, res) {
    const { id } = req.params;
    console.log('Attempting to delete machine:', id);

    try {
      // First check if machine has any parts
      const partsCheck = await db.query(
        'SELECT COUNT(*) FROM parts WHERE machine_id = $1',
        [id]
      );

      if (partsCheck.rows[0].count > 0) {
        console.log('Machine has parts attached:', partsCheck.rows[0].count);
        return res.status(400).json({
          error: 'Cannot delete machine',
          details: 'This machine has parts assigned to it. Please unassign or delete the parts first.'
        });
      }

      // If no parts are assigned, proceed with deletion
      const result = await db.query(
        'DELETE FROM machines WHERE machine_id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        console.log('Machine not found:', id);
        return res.status(404).json({
          error: 'Machine not found',
          details: 'The specified machine does not exist.'
        });
      }

      console.log('Machine deleted successfully:', result.rows[0]);
      res.json({ 
        message: 'Machine deleted successfully',
        machine: result.rows[0]
      });
    } catch (error) {
      console.error('Error deleting machine:', {
        error: error.message,
        stack: error.stack,
        details: error.detail,
        hint: error.hint,
        code: error.code
      });
      res.status(500).json({ 
        error: 'Error deleting machine',
        details: error.message,
        code: error.code
      });
    }
  }
}

module.exports = MachineController;