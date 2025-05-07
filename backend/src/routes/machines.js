const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const dbConfig = require('../../config/database')[process.env.NODE_ENV || 'development'];
const pool = new Pool(dbConfig);

// Get all machines
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM machines ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching machines:', err);
    res.status(500).json({ error: 'Failed to fetch machines' });
  }
});

// Get machine cost summary
router.get('/costs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM machine_parts_cost_view');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching machine costs:', err);
    res.status(500).json({ error: 'Failed to fetch machine costs' });
  }
});

// Get detailed parts usage for a specific machine
router.get('/:id/parts-usage', async (req, res) => {
  const machineId = parseInt(req.params.id);
  
  try {
    const result = await pool.query(
      'SELECT * FROM machine_parts_detail_view WHERE machine_id = $1',
      [machineId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching machine parts usage:', err);
    res.status(500).json({ error: 'Failed to fetch machine parts usage' });
  }
});

// Get parts associated with a specific machine
router.get('/:id/parts', async (req, res) => {
  const machineId = parseInt(req.params.id);
  
  try {
    // Query to get parts associated with a machine through transactions
    const result = await pool.query(`
      SELECT DISTINCT 
        p.part_id,
        p.name,
        p.fiserv_part_number,
        p.manufacturer_part_number,
        p.quantity,
        p.minimum_quantity
      FROM 
        parts p
      JOIN 
        transactions t ON p.part_id = t.part_id
      WHERE 
        t.machine_id = $1
      ORDER BY 
        p.name
    `, [machineId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching machine parts:', err);
    res.status(500).json({ error: 'Failed to fetch machine parts' });
  }
});

// Get machine parts usage over time (for charts)
router.get('/:id/usage-timeline', async (req, res) => {
  const machineId = parseInt(req.params.id);
  const { startDate, endDate } = req.query;
  
  try {
    let query = `
      SELECT 
        DATE_TRUNC('month', pu.usage_date) AS month,
        SUM(pu.quantity * p.unit_cost) AS monthly_cost,
        COUNT(DISTINCT pu.part_id) AS parts_count,
        SUM(pu.quantity) AS parts_quantity
      FROM parts_usage pu
      JOIN parts p ON pu.part_id = p.part_id
      WHERE pu.machine_id = $1
    `;
    
    const params = [machineId];
    
    if (startDate) {
      params.push(startDate);
      query += ` AND pu.usage_date >= $${params.length}`;
    }
    
    if (endDate) {
      params.push(endDate);
      query += ` AND pu.usage_date <= $${params.length}`;
    }
    
    query += `
      GROUP BY DATE_TRUNC('month', pu.usage_date)
      ORDER BY DATE_TRUNC('month', pu.usage_date)
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching machine usage timeline:', err);
    res.status(500).json({ error: 'Failed to fetch machine usage timeline' });
  }
});

// Get PM schedule data for calendar
router.get('/pm-schedule', async (req, res) => {
  try {
    console.log('Fetching PM schedule data...');
    
    // First check if maintenance_status column exists
    const columnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'machines'
        AND column_name = 'maintenance_status'
      );
    `);
    
    // Construct query based on whether maintenance_status column exists
    let query;
    if (columnCheck.rows[0].exists) {
      query = `
        SELECT 
          machine_id as id,
          name,
          model,
          location,
          last_maintenance_date,
          next_maintenance_date,
          maintenance_status,
          CASE
            WHEN maintenance_status = 'in_progress' THEN 'in_progress'
            WHEN next_maintenance_date < CURRENT_DATE THEN 'overdue'
            WHEN next_maintenance_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due'
            ELSE 'scheduled'
          END as status
        FROM machines
        WHERE next_maintenance_date IS NOT NULL
        AND (maintenance_status IS NULL OR maintenance_status != 'completed')
        ORDER BY next_maintenance_date ASC
      `;
    } else {
      query = `
        SELECT 
          machine_id as id,
          name,
          model,
          location,
          last_maintenance_date,
          next_maintenance_date,
          CASE
            WHEN next_maintenance_date < CURRENT_DATE THEN 'overdue'
            WHEN next_maintenance_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due'
            ELSE 'scheduled'
          END as status
        FROM machines
        WHERE next_maintenance_date IS NOT NULL
        ORDER BY next_maintenance_date ASC
      `;
    }
    
    const result = await pool.query(query);
    
    console.log(`Found ${result.rows.length} machines with maintenance dates`);
    
    // Count status types for debugging
    const overdueCount = result.rows.filter(m => m.status === 'overdue').length;
    const dueCount = result.rows.filter(m => m.status === 'due').length;
    const scheduledCount = result.rows.filter(m => m.status === 'scheduled').length;
    const inProgressCount = result.rows.filter(m => m.status === 'in_progress').length;
    
    console.log(`Status counts - Overdue: ${overdueCount}, Due: ${dueCount}, Scheduled: ${scheduledCount}, In Progress: ${inProgressCount}`);
    
    // Format the data for the calendar
    const events = result.rows.map(machine => {
      // Ensure id is a valid number
      const id = typeof machine.id === 'number' ? machine.id : parseInt(machine.id, 10);
      
      // Skip invalid entries
      if (isNaN(id) || !machine.next_maintenance_date) {
        console.warn('Skipping invalid machine data:', machine);
        return null;
      }
      
      const event = {
        id,
        title: `${machine.name || 'Unknown'} ${machine.model ? `(${machine.model})` : ''}`,
        start: machine.next_maintenance_date,
        end: machine.next_maintenance_date,
        allDay: true,
        resource: {
          location: machine.location || 'Unknown',
          status: machine.status || 'scheduled',
          lastMaintenance: machine.last_maintenance_date
        }
      };
      
      // Debug log for overdue events
      if (machine.status === 'overdue') {
        console.log('Created overdue event:', event);
      }
      
      return event;
    }).filter(event => event !== null); // Remove any null entries
    
    console.log(`Sending ${events.length} events to frontend`);
    console.log(`Event status counts - Overdue: ${events.filter(e => e.resource.status === 'overdue').length}, Due: ${events.filter(e => e.resource.status === 'due').length}, Scheduled: ${events.filter(e => e.resource.status === 'scheduled').length}`);
    
    res.json(events);
  } catch (err) {
    console.error('Error fetching PM schedule data:', err);
    res.status(500).json({ error: 'Failed to fetch PM schedule data' });
  }
});

// Create a new machine
router.post('/', async (req, res) => {
  const {
    name,
    model,
    serial_number,
    location,
    manufacturer,
    installation_date,
    notes
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO machines (
        name,
        model,
        serial_number,
        location,
        manufacturer,
        installation_date,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, model, serial_number, location, manufacturer, installation_date, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating machine:', err);
    res.status(500).json({ error: 'Failed to create machine' });
  }
});

// Get a specific machine
router.get('/:id', async (req, res) => {
  // Validate the ID parameter
  const machineIdParam = req.params.id;
  const machineId = parseInt(machineIdParam, 10);
  
  // Check if ID is valid
  if (isNaN(machineId)) {
    return res.status(400).json({ error: `Invalid machine ID: ${machineIdParam}` });
  }
  
  try {
    const result = await pool.query(
      `SELECT 
        machine_id as id,
        name,
        model,
        serial_number,
        location,
        manufacturer,
        installation_date,
        last_maintenance_date,
        next_maintenance_date,
        notes
      FROM machines
      WHERE machine_id = $1`,
      [machineId]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Machine not found' });
    } else {
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error('Error fetching machine:', err);
    res.status(500).json({ error: 'Failed to fetch machine' });
  }
});

// Update a machine
router.put('/:id', async (req, res) => {
  // Validate the ID parameter
  const machineIdParam = req.params.id;
  const machineId = parseInt(machineIdParam, 10);
  
  // Check if ID is valid
  if (isNaN(machineId)) {
    return res.status(400).json({ error: `Invalid machine ID: ${machineIdParam}` });
  }
  
  const {
    name,
    model,
    serial_number,
    location,
    manufacturer,
    installation_date,
    last_maintenance_date,
    next_maintenance_date,
    notes,
    status
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE machines SET
        name = COALESCE($1, name),
        model = COALESCE($2, model),
        serial_number = COALESCE($3, serial_number),
        location = COALESCE($4, location),
        manufacturer = COALESCE($5, manufacturer),
        installation_date = COALESCE($6, installation_date),
        last_maintenance_date = COALESCE($7, last_maintenance_date),
        next_maintenance_date = COALESCE($8, next_maintenance_date),
        notes = COALESCE($9, notes),
        status = COALESCE($10, status)
      WHERE machine_id = $11
      RETURNING *`,
      [
        name,
        model,
        serial_number,
        location,
        manufacturer,
        installation_date,
        last_maintenance_date,
        next_maintenance_date,
        notes,
        status,
        machineId
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Machine not found' });
    } else {
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error('Error updating machine:', err);
    res.status(500).json({ error: 'Failed to update machine' });
  }
});

// Delete a machine
router.delete('/:id', async (req, res) => {
  // Validate the ID parameter
  const machineIdParam = req.params.id;
  const machineId = parseInt(machineIdParam, 10);
  
  // Check if ID is valid
  if (isNaN(machineId)) {
    return res.status(400).json({ error: `Invalid machine ID: ${machineIdParam}` });
  }

  try {
    // Start a transaction
    await pool.query('BEGIN');

    // First, set machine_id to NULL in related transactions
    await pool.query(
      'UPDATE transactions SET machine_id = NULL WHERE machine_id = $1',
      [machineId]
    );

    // Then delete the machine
    const result = await pool.query(
      'DELETE FROM machines WHERE machine_id = $1 RETURNING *',
      [machineId]
    );

    if (result.rows.length === 0) {
      await pool.query('ROLLBACK');
      res.status(404).json({ error: 'Machine not found' });
    } else {
      await pool.query('COMMIT');
      res.json({ message: 'Machine deleted successfully' });
    }
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error deleting machine:', err);
    res.status(500).json({ error: 'Failed to delete machine' });
  }
});

// Update machine maintenance status
router.post('/:id/maintenance-status', async (req, res) => {
  const machineId = parseInt(req.params.id);
  const { status, maintenanceDate } = req.body;
  
  console.log('Received maintenance status update request:', {
    machineId,
    status,
    maintenanceDate,
    body: req.body
  });
  
  // Validate inputs
  if (!machineId || isNaN(machineId)) {
    return res.status(400).json({ error: 'Invalid machine ID' });
  }
  
  if (!status || !['completed', 'in_progress'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be "completed" or "in_progress"' });
  }

  try {
    console.log(`Updating maintenance status for machine ${machineId} to ${status}`);
    
    // Start a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // First, check if the machine exists
      const checkResult = await client.query(
        'SELECT machine_id, next_maintenance_date FROM machines WHERE machine_id = $1',
        [machineId]
      );
      
      if (checkResult.rows.length === 0) {
        throw new Error(`Machine with ID ${machineId} not found`);
      }
      
      const currentDate = new Date();
      
      if (status === 'completed') {
        // If completed, update last_maintenance_date to current date (or provided date)
        // and calculate new next_maintenance_date (typically 3 months in future)
        const lastMaintenanceDate = maintenanceDate ? new Date(maintenanceDate) : currentDate;
        const nextMaintenanceDate = new Date(lastMaintenanceDate);
        nextMaintenanceDate.setMonth(nextMaintenanceDate.getMonth() + 3); // Schedule next maintenance 3 months from now
        
        // Make sure the maintenance_status column exists
        try {
          const columnCheck = await client.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.columns
              WHERE table_name = 'machines'
              AND column_name = 'maintenance_status'
            );
          `);
          
          if (!columnCheck.rows[0].exists) {
            // Add maintenance_status column if it doesn't exist
            await client.query(`
              ALTER TABLE machines 
              ADD COLUMN IF NOT EXISTS maintenance_status VARCHAR(20) DEFAULT 'none'
            `);
            console.log('Added maintenance_status column to machines table');
          }
        } catch (columnErr) {
          console.warn('Error checking/adding maintenance_status column:', columnErr.message);
        }
        
        await client.query(
          `UPDATE machines 
           SET last_maintenance_date = $1, 
               next_maintenance_date = $2,
               maintenance_status = $3
           WHERE machine_id = $4`,
          [lastMaintenanceDate, nextMaintenanceDate, 'completed', machineId]
        );
        
        console.log(`Maintenance completed for machine ${machineId}. Next maintenance scheduled for ${nextMaintenanceDate.toISOString()}`);
        
        // Fetch the updated machine data to return to the client
        const updatedMachineData = await client.query(
          `SELECT 
            machine_id as id,
            name,
            model,
            location,
            last_maintenance_date,
            next_maintenance_date,
            maintenance_status,
            CASE
              WHEN maintenance_status = 'in_progress' THEN 'in_progress'
              WHEN maintenance_status = 'completed' THEN 'completed'
              WHEN next_maintenance_date < CURRENT_DATE THEN 'overdue'
              WHEN next_maintenance_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due'
              ELSE 'scheduled'
            END as status
          FROM machines
          WHERE machine_id = $1`,
          [machineId]
        );
        
        // Try to log it, but don't fail if table doesn't exist
        try {
          // Check if maintenance_logs table exists
          const tableCheck = await client.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = 'maintenance_logs'
            );
          `);
          
          if (tableCheck.rows[0].exists) {
            await client.query(
              `INSERT INTO maintenance_logs 
               (machine_id, status, log_date, completion_date, notes)
               VALUES ($1, $2, $3, $4, $5)`,
              [machineId, 'completed', currentDate, lastMaintenanceDate, 'Maintenance completed']
            );
          } else {
            console.log('Maintenance_logs table does not exist, skipping log entry');
          }
        } catch (logErr) {
          console.warn('Could not log maintenance completion to maintenance_logs table:', logErr.message);
          // Continue processing even if logging fails
        }
      } else if (status === 'in_progress') {
        // For in_progress, update the machine to reflect the status
        console.log(`Maintenance marked as in progress for machine ${machineId}`);
        
        // Add a status field to the machines table if it doesn't exist
        try {
          // Check if status column exists in machines table
          const columnCheck = await client.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.columns
              WHERE table_name = 'machines'
              AND column_name = 'maintenance_status'
            );
          `);
          
          if (!columnCheck.rows[0].exists) {
            // Add maintenance_status column if it doesn't exist
            await client.query(`
              ALTER TABLE machines 
              ADD COLUMN IF NOT EXISTS maintenance_status VARCHAR(20) DEFAULT 'none'
            `);
            console.log('Added maintenance_status column to machines table');
          }
          
          // Update the machine's maintenance status
          await client.query(
            `UPDATE machines 
             SET maintenance_status = $1
             WHERE machine_id = $2`,
            ['in_progress', machineId]
          );
        } catch (columnErr) {
          console.warn('Error adding or updating maintenance_status column:', columnErr.message);
        }
      }
      
      await client.query('COMMIT');
      
      // In both cases, let's fetch the latest machine data
      const updatedMachineData = await pool.query(
        `SELECT 
          machine_id as id,
          name,
          model,
          location,
          last_maintenance_date,
          next_maintenance_date,
          maintenance_status,
          CASE
            WHEN maintenance_status = 'in_progress' THEN 'in_progress'
            WHEN maintenance_status = 'completed' THEN 'completed'
            WHEN next_maintenance_date < CURRENT_DATE THEN 'overdue'
            WHEN next_maintenance_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due'
            ELSE 'scheduled'
          END as status
        FROM machines
        WHERE machine_id = $1`,
        [machineId]
      );
      
      res.json({ 
        success: true, 
        message: `Maintenance status updated to ${status}`,
        machineId,
        updatedMachine: updatedMachineData.rows[0]
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`Error updating maintenance status for machine ${machineId}:`, err);
    res.status(500).json({ 
      error: `Failed to update maintenance status: ${err.message}` 
    });
  }
});

module.exports = router;