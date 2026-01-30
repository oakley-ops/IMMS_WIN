const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { status, machine_id, search } = req.query;
    
    let query = `
      SELECT 
        d.*,
        m.name as machine_name,
        m.location as machine_location,
        (SELECT COUNT(*) FROM die_change_history WHERE die_id = d.die_id) as total_changes,
        (SELECT MAX(change_date) FROM die_change_history WHERE die_id = d.die_id AND action = 'INSTALL') as last_installed_date
      FROM dies d
      LEFT JOIN machines m ON d.machine_id = m.machine_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (status) {
      query += ` AND d.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    if (machine_id) {
      query += ` AND d.machine_id = $${paramCount}`;
      params.push(machine_id);
      paramCount++;
    }
    
    if (search) {
      query += ` AND (d.die_number ILIKE $${paramCount} OR d.die_name ILIKE $${paramCount} OR d.manufacturer ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }
    
    query += ` ORDER BY d.die_number DESC`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching dies:', error);
    res.status(500).json({ error: 'Failed to fetch dies' });
  }
});

router.get('/stats', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'SHARP') as sharp,
        COUNT(*) FILTER (WHERE status = 'IN_MACHINE') as in_machine,
        COUNT(*) FILTER (WHERE status = 'OUT_FOR_SHARPENING') as out_for_sharpening,
        COUNT(*) FILTER (WHERE status = 'USED') as used,
        COUNT(*) FILTER (WHERE status = 'DULL') as dull
      FROM dies
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching die stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        d.*,
        m.name as machine_name,
        m.location as machine_location
      FROM dies d
      LEFT JOIN machines m ON d.machine_id = m.machine_id
      WHERE d.die_id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Die not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching die:', error);
    res.status(500).json({ error: 'Failed to fetch die' });
  }
});

router.post('/', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { die_number, die_name, die_type, notes, compatible_machine_ids } = req.body;

    if (!die_number || !die_type) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Die number and type are required' });
    }

    // Check if die_number already exists
    const existingDie = await client.query('SELECT die_id FROM dies WHERE die_number = $1', [die_number]);
    if (existingDie.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Die number "${die_number}" already exists` });
    }

    // Auto-generate die_name if not provided
    const finalDieName = die_name || `${die_type} #${die_number}`;

    const result = await client.query(`
      INSERT INTO dies (die_number, die_name, die_type, notes, status, created_by, compatible_machine_ids)
      VALUES ($1, $2, $3, $4, 'SHARP', $5, $6)
      RETURNING *
    `, [die_number, finalDieName, die_type, notes, req.user.id, compatible_machine_ids || null]);

    await client.query('COMMIT');

    // Emit socket event for real-time updates
    if (global.io) {
      global.io.emit('die_updated', {
        action: 'create',
        die: result.rows[0]
      });
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating die:', error);
    res.status(500).json({ error: 'Failed to create die' });
  } finally {
    client.release();
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { die_number, die_type, notes, status, compatible_machine_ids } = req.body;

    const result = await pool.query(`
      UPDATE dies SET
        die_number = COALESCE($1, die_number),
        die_type = COALESCE($2, die_type),
        notes = COALESCE($3, notes),
        status = COALESCE($4, status),
        compatible_machine_ids = $5
      WHERE die_id = $6
      RETURNING *
    `, [die_number, die_type, notes, status, compatible_machine_ids || null, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Die not found' });
    }

    // Emit socket event for real-time updates
    if (global.io) {
      global.io.emit('die_updated', {
        action: 'update',
        die: result.rows[0]
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating die:', error);
    res.status(500).json({ error: 'Failed to update die' });
  }
});

router.post('/:id/install', auth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const {
      machine_id,
      technician_id,
      technician_name,
      change_reason_code,
      change_reason_notes,
      expected_runtime_hours,
      expected_cycles
    } = req.body;
    
    const dieCheck = await client.query(
      'SELECT status, die_type, die_number, compatible_machine_ids FROM dies WHERE die_id = $1',
      [id]
    );

    if (dieCheck.rows.length === 0) {
      throw new Error('Die not found');
    }

    const allowedStatuses = ['SHARP', 'USED'];
    if (!allowedStatuses.includes(dieCheck.rows[0].status)) {
      throw new Error('Die is not available for installation. Only dies with "Sharp" or "Used" status can be installed.');
    }

    const machineCheck = await client.query(
      `SELECT m.current_die_id, m.name as machine_name, m.machine_id, d.die_number as current_die_number, d.die_name as current_die_name
       FROM machines m
       LEFT JOIN dies d ON m.current_die_id = d.die_id
       WHERE m.machine_id = $1`,
      [machine_id]
    );

    if (machineCheck.rows.length === 0) {
      throw new Error('Machine not found');
    }

    const machine = machineCheck.rows[0];
    const dieNumber = dieCheck.rows[0].die_number;
    const compatibleMachineIds = dieCheck.rows[0].compatible_machine_ids;

    // Check die-to-machine compatibility (if restrictions are set)
    if (compatibleMachineIds && compatibleMachineIds.length > 0) {
      if (!compatibleMachineIds.includes(machine_id)) {
        // Get names of compatible machines for better error message
        const compatibleMachinesResult = await client.query(
          'SELECT name FROM machines WHERE machine_id = ANY($1)',
          [compatibleMachineIds]
        );
        const compatibleNames = compatibleMachinesResult.rows.map(r => r.name).join(', ');
        throw new Error(`Die ${dieNumber} cannot be installed in ${machine.machine_name}. This die is only compatible with: ${compatibleNames}`);
      }
    }

    if (machine.current_die_id) {
      throw new Error(`Machine "${machine.machine_name}" already has die "${machine.current_die_number}" (${machine.current_die_name}) installed. Remove it first.`);
    }
    
    await client.query(`
      UPDATE dies SET
        status = 'IN_MACHINE',
        machine_id = $1,
        current_location = (SELECT name FROM machines WHERE machine_id = $1)
      WHERE die_id = $2
    `, [machine_id, id]);
    
    await client.query(`
      UPDATE machines SET
        current_die_id = $1,
        die_installed_date = CURRENT_TIMESTAMP,
        die_installed_by = $2
      WHERE machine_id = $3
    `, [id, technician_id, machine_id]);
    
    await client.query(`
      INSERT INTO die_change_history (
        machine_id, die_id, action, change_reason_code, change_reason_notes,
        technician_id, technician_name, expected_runtime_hours, expected_cycles
      ) VALUES ($1, $2, 'INSTALL', $3, $4, $5, $6, $7, $8)
    `, [
      machine_id,
      id,
      change_reason_code || 'INSTALL',
      change_reason_notes,
      technician_id,
      technician_name,
      expected_runtime_hours,
      expected_cycles
    ]);
    
    await client.query('COMMIT');

    const result = await client.query(
      'SELECT * FROM dies WHERE die_id = $1',
      [id]
    );

    // Emit socket event for real-time updates
    if (global.io) {
      global.io.emit('die_updated', {
        action: 'install',
        die: result.rows[0],
        machine_id: machine_id
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error installing die:', error);
    res.status(500).json({ error: error.message || 'Failed to install die' });
  } finally {
    client.release();
  }
});

router.post('/:id/remove', auth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const {
      technician_id,
      technician_name,
      change_reason_code,
      change_reason_notes,
      actual_runtime_hours,
      actual_cycles,
      cycles_at_removal,
      die_condition,
      next_status
    } = req.body;
    
    const dieResult = await client.query(
      'SELECT * FROM dies WHERE die_id = $1',
      [id]
    );
    
    if (dieResult.rows.length === 0) {
      throw new Error('Die not found');
    }
    
    const die = dieResult.rows[0];
    
    if (die.status !== 'IN_MACHINE') {
      throw new Error('Die is not installed in a machine');
    }

    // When a die is removed from a machine, it's considered used
    // Allow next_status override only for special cases (e.g., sending to sharpening)
    const newStatus = next_status || 'USED';
    
    await client.query(`
      UPDATE dies SET
        status = $1,
        machine_id = NULL,
        current_location = NULL,
        total_cycles = COALESCE(total_cycles, 0) + COALESCE($2, 0)
      WHERE die_id = $3
    `, [newStatus, actual_cycles, id]);
    
    await client.query(`
      UPDATE machines SET
        current_die_id = NULL,
        die_installed_date = NULL,
        die_installed_by = NULL
      WHERE machine_id = $1
    `, [die.machine_id]);
    
    await client.query(`
      INSERT INTO die_change_history (
        machine_id, die_id, action, change_reason_code, change_reason_notes,
        technician_id, technician_name, actual_runtime_hours, actual_cycles,
        cycles_at_removal, die_condition
      ) VALUES ($1, $2, 'REMOVE', $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      die.machine_id,
      id,
      change_reason_code || 'REMOVE',
      change_reason_notes,
      technician_id,
      technician_name,
      actual_runtime_hours,
      actual_cycles,
      cycles_at_removal,
      die_condition
    ]);
    
    await client.query('COMMIT');

    const result = await client.query(
      'SELECT * FROM dies WHERE die_id = $1',
      [id]
    );

    // Emit socket event for real-time updates
    if (global.io) {
      global.io.emit('die_updated', {
        action: 'remove',
        die: result.rows[0],
        machine_id: die.machine_id
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error removing die:', error);
    res.status(500).json({ error: error.message || 'Failed to remove die' });
  } finally {
    client.release();
  }
});

router.delete('/:id', auth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    const dieCheck = await client.query(
      'SELECT die_id, die_number, status FROM dies WHERE die_id = $1',
      [id]
    );
    
    if (dieCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Die not found' });
    }
    
    const die = dieCheck.rows[0];
    
    if (die.status === 'IN_MACHINE') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Cannot delete a die that is in a machine. Please remove it from the machine first.'
      });
    }
    
    await client.query('DELETE FROM die_documents WHERE die_id = $1', [id]);
    await client.query('DELETE FROM die_sharpening_records WHERE die_id = $1', [id]);
    await client.query('DELETE FROM die_change_history WHERE die_id = $1', [id]);
    await client.query('DELETE FROM dies WHERE die_id = $1', [id]);

    await client.query('COMMIT');

    // Emit socket event for real-time updates
    if (global.io) {
      global.io.emit('die_updated', {
        action: 'delete',
        die_id: id,
        die_number: die.die_number
      });
    }

    res.json({
      success: true,
      message: `Die ${die.die_number} has been permanently deleted`
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting die:', error);
    res.status(500).json({ error: error.message || 'Failed to delete die' });
  } finally {
    client.release();
  }
});

router.get('/:id/history', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        dch.*,
        m.name as machine_name,
        t.name as technician_full_name
      FROM die_change_history dch
      LEFT JOIN machines m ON dch.machine_id = m.machine_id
      LEFT JOIN technicians t ON dch.technician_id = t.technician_id
      WHERE dch.die_id = $1
      ORDER BY dch.change_date DESC
    `, [id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching die history:', error);
    res.status(500).json({ error: 'Failed to fetch die history' });
  }
});

// Lookup die by barcode
router.get('/barcode/:barcode', auth, async (req, res) => {
  try {
    const { barcode } = req.params;
    
    const result = await pool.query(`
      SELECT 
        d.*,
        m.name as machine_name,
        m.location as machine_location,
        (SELECT COUNT(*) FROM die_change_history WHERE die_id = d.die_id) as total_changes,
        (SELECT MAX(change_date) FROM die_change_history WHERE die_id = d.die_id AND action = 'INSTALL') as last_installed_date
      FROM dies d
      LEFT JOIN machines m ON d.machine_id = m.machine_id
      WHERE d.barcode = $1
    `, [barcode]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Die not found with this barcode' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching die by barcode:', error);
    res.status(500).json({ error: 'Failed to fetch die by barcode' });
  }
});

// Lookup die by die_number (alternative to barcode)
router.get('/number/:dieNumber', auth, async (req, res) => {
  try {
    const { dieNumber } = req.params;
    
    const result = await pool.query(`
      SELECT 
        d.*,
        m.name as machine_name,
        m.location as machine_location,
        (SELECT COUNT(*) FROM die_change_history WHERE die_id = d.die_id) as total_changes,
        (SELECT MAX(change_date) FROM die_change_history WHERE die_id = d.die_id AND action = 'INSTALL') as last_installed_date
      FROM dies d
      LEFT JOIN machines m ON d.machine_id = m.machine_id
      WHERE d.die_number = $1
    `, [dieNumber]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Die not found with this die number' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching die by number:', error);
    res.status(500).json({ error: 'Failed to fetch die by number' });
  }
});

module.exports = router;
