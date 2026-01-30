const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { status, die_id } = req.query;
    
    let query = `
      SELECT 
        dsr.*,
        d.die_number,
        d.die_name,
        d.die_type
      FROM die_sharpening_records dsr
      JOIN dies d ON dsr.die_id = d.die_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (status) {
      query += ` AND dsr.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    if (die_id) {
      query += ` AND dsr.die_id = $${paramCount}`;
      params.push(die_id);
      paramCount++;
    }
    
    query += ` ORDER BY dsr.scheduled_date DESC`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sharpening records:', error);
    res.status(500).json({ error: 'Failed to fetch sharpening records' });
  }
});

router.post('/', auth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      die_id,
      sharpening_vendor,
      vendor_contact,
      vendor_phone,
      po_number,
      scheduled_date,
      expected_return_date,
      quoted_cost,
      condition_before,
      service_type,
      notes
    } = req.body;
    
    const result = await client.query(`
      INSERT INTO die_sharpening_records (
        die_id, sharpening_vendor, vendor_contact, vendor_phone, po_number,
        scheduled_date, expected_return_date, quoted_cost, condition_before,
        service_type, notes, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'SCHEDULED', $12)
      RETURNING *
    `, [
      die_id,
      sharpening_vendor,
      vendor_contact,
      vendor_phone,
      po_number,
      scheduled_date,
      expected_return_date,
      quoted_cost,
      condition_before,
      service_type,
      notes,
      req.user.id
    ]);
    
    await client.query(`
      UPDATE dies SET
        status = 'OUT_FOR_SHARPENING',
        current_location = $1
      WHERE die_id = $2
    `, [sharpening_vendor, die_id]);

    await client.query('COMMIT');

    // Emit socket event for real-time updates
    if (global.io) {
      global.io.emit('die_updated', {
        action: 'sharpening_scheduled',
        die_id: die_id,
        sharpening_record: result.rows[0]
      });
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating sharpening record:', error);
    res.status(500).json({ error: 'Failed to create sharpening record' });
  } finally {
    client.release();
  }
});

router.put('/:id/ship', auth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { shipped_date, tracking_number_outbound } = req.body;
    
    const result = await client.query(`
      UPDATE die_sharpening_records SET
        status = 'SHIPPED',
        shipped_date = $1,
        tracking_number_outbound = $2
      WHERE sharpening_id = $3
      RETURNING *
    `, [shipped_date || new Date(), tracking_number_outbound, id]);
    
    if (result.rows.length === 0) {
      throw new Error('Sharpening record not found');
    }

    // Update die status and location to vendor name
    await client.query(`
      UPDATE dies SET
        status = 'OUT_FOR_SHARPENING',
        current_location = $1
      WHERE die_id = $2
    `, [result.rows[0].sharpening_vendor, result.rows[0].die_id]);

    await client.query('COMMIT');

    // Emit socket event for real-time updates
    if (global.io) {
      global.io.emit('die_updated', {
        action: 'sharpening_shipped',
        die_id: result.rows[0].die_id,
        sharpening_record: result.rows[0]
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error shipping die:', error);
    res.status(500).json({ error: error.message || 'Failed to ship die' });
  } finally {
    client.release();
  }
});

router.put('/:id/receive', auth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const {
      actual_return_date,
      tracking_number_inbound,
      actual_cost,
      condition_after,
      inspection_passed,
      inspection_notes
    } = req.body;
    
    const returnDate = actual_return_date || new Date();
    
    const sharpeningResult = await client.query(`
      UPDATE die_sharpening_records SET
        status = 'RETURNED',
        actual_return_date = $1,
        tracking_number_inbound = $2,
        actual_cost = $3,
        condition_after = $4,
        inspection_passed = $5,
        inspection_notes = $6,
        turnaround_days = $1::date - shipped_date::date
      WHERE sharpening_id = $7
      RETURNING *
    `, [
      returnDate,
      tracking_number_inbound,
      actual_cost,
      condition_after,
      inspection_passed,
      inspection_notes,
      id
    ]);
    
    if (sharpeningResult.rows.length === 0) {
      throw new Error('Sharpening record not found');
    }
    
    await client.query(`
      UPDATE dies SET
        status = 'SHARP',
        current_location = 'Storage',
        sharpenings_count = sharpenings_count + 1,
        last_inspection_date = $1,
        last_inspection_notes = $2
      WHERE die_id = $3
    `, [returnDate, inspection_notes, sharpeningResult.rows[0].die_id]);

    await client.query('COMMIT');

    // Emit socket event for real-time updates
    if (global.io) {
      global.io.emit('die_updated', {
        action: 'sharpening_received',
        die_id: sharpeningResult.rows[0].die_id,
        sharpening_record: sharpeningResult.rows[0]
      });
    }

    res.json(sharpeningResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error receiving die:', error);
    res.status(500).json({ error: error.message || 'Failed to receive die' });
  } finally {
    client.release();
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        dsr.*,
        d.die_number,
        d.die_name,
        d.die_type
      FROM die_sharpening_records dsr
      JOIN dies d ON dsr.die_id = d.die_id
      WHERE dsr.sharpening_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sharpening record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching sharpening record:', error);
    res.status(500).json({ error: 'Failed to fetch sharpening record' });
  }
});

// Quick receive - finds the active sharpening record for a die and marks it as returned
// Used by the interactive SharpeningZone component
router.put('/quick-receive/die/:dieId', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { dieId } = req.params;

    // Find the most recent non-returned sharpening record for this die
    const recordResult = await client.query(`
      SELECT sharpening_id, die_id, sharpening_vendor
      FROM die_sharpening_records
      WHERE die_id = $1 AND status IN ('SCHEDULED', 'SHIPPED', 'AT_VENDOR')
      ORDER BY scheduled_date DESC
      LIMIT 1
    `, [dieId]);

    if (recordResult.rows.length === 0) {
      // No active sharpening record found - just update the die status directly
      await client.query(`
        UPDATE dies SET
          status = 'SHARP',
          current_location = 'Storage'
        WHERE die_id = $1
      `, [dieId]);

      await client.query('COMMIT');

      // Emit socket event
      if (global.io) {
        global.io.emit('die_updated', {
          action: 'sharpening_received',
          die_id: parseInt(dieId)
        });
      }

      return res.json({ message: 'Die marked as sharp (no active sharpening record found)' });
    }

    const sharpeningId = recordResult.rows[0].sharpening_id;
    const returnDate = new Date();

    // Update the sharpening record to RETURNED
    const sharpeningResult = await client.query(`
      UPDATE die_sharpening_records SET
        status = 'RETURNED',
        actual_return_date = $1,
        turnaround_days = $1::date - COALESCE(shipped_date, scheduled_date)::date
      WHERE sharpening_id = $2
      RETURNING *
    `, [returnDate, sharpeningId]);

    // Update the die status to SHARP
    await client.query(`
      UPDATE dies SET
        status = 'SHARP',
        current_location = 'Storage',
        sharpenings_count = COALESCE(sharpenings_count, 0) + 1,
        last_inspection_date = $1
      WHERE die_id = $2
    `, [returnDate, dieId]);

    await client.query('COMMIT');

    // Emit socket event for real-time updates
    if (global.io) {
      global.io.emit('die_updated', {
        action: 'sharpening_received',
        die_id: parseInt(dieId),
        sharpening_record: sharpeningResult.rows[0]
      });
    }

    res.json(sharpeningResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error quick receiving die:', error);
    res.status(500).json({ error: error.message || 'Failed to receive die' });
  } finally {
    client.release();
  }
});

module.exports = router;
