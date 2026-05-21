const express = require('express');
const router = express.Router();
const { pool } = require('../../db');

// Get all transactions
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    console.log('Transactions API called with query params:', req.query);
    let query = `
      SELECT 
        t.transaction_id,
        t.part_id,
        p.name as part_name,
        p.manufacturer_part_number,
        m.name as machine_name,
        t.type,
        t.quantity,
        t.created_at as date,
        t.user_id,
        t.notes,
        t.reference_number,
        p.unit_cost
      FROM transactions t
      LEFT JOIN parts p ON t.part_id = p.part_id
      LEFT JOIN machines m ON t.machine_id = m.machine_id
      WHERE t.type IN ('usage', 'return', 'restock')
    `;

    const params = [];
    if (startDate || endDate) {
      if (startDate) {
        // Use the date as-is since frontend already includes time
        params.push(startDate);
        query += ` AND t.created_at >= $${params.length}`;
        console.log('Added start date filter:', startDate);
      }
      if (endDate) {
        // Use the date as-is since frontend already includes time
        params.push(endDate);
        query += ` AND t.created_at <= $${params.length}`;
        console.log('Added end date filter:', endDate);
      }
    }

    query += ' ORDER BY t.created_at DESC';

    console.log('Final SQL query:', query);
    console.log('Query params:', params);
    
    const result = await pool.query(query, params);
    console.log('Query returned', result.rows.length, 'transactions');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching transactions:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      hint: err.hint,
      stack: err.stack
    });
    res.status(500).json({ 
      error: 'Failed to fetch transactions',
      details: err.message,
      code: err.code
    });
  }
});

// Create a new transaction
router.post('/', async (req, res) => {
  const { part_id, machine_id, quantity, transaction_type: type } = req.body;

  try {
    // Start a transaction
    await pool.query('BEGIN');

    // Update part quantity
    const updateQuantity = type === 'usage' ? 'quantity - $1' : 'quantity + $1';
    const updateResult = await pool.query(
      `UPDATE parts SET quantity = ${updateQuantity} WHERE part_id = $2 RETURNING quantity`,
      [quantity, part_id]
    );

    if (updateResult.rows[0].quantity < 0) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient quantity available' });
    }

    // Create transaction record
    const result = await pool.query(
      `INSERT INTO transactions (
        part_id,
        machine_id,
        quantity,
        type
      ) VALUES ($1, $2, $3, $4) RETURNING *`,
      [part_id, machine_id, quantity, type.toLowerCase()]
    );

    await pool.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error creating transaction:', err);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// Get transactions for a specific part
router.get('/part/:id', async (req, res) => {
  const partId = parseInt(req.params.id);
  try {
    const result = await pool.query(
      `SELECT 
        t.transaction_id,
        t.part_id,
        p.name as part_name,
        p.manufacturer_part_number,
        m.name as machine_name,
        t.type,
        t.quantity,
        t.created_at as date,
        t.user_id,
        t.notes,
        t.reference_number,
        p.unit_cost
      FROM transactions t
      LEFT JOIN parts p ON t.part_id = p.part_id
      LEFT JOIN machines m ON t.machine_id = m.machine_id
      WHERE t.part_id = $1
      ORDER BY t.created_at DESC`,
      [partId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching part transactions:', err);
    res.status(500).json({ error: 'Failed to fetch part transactions' });
  }
});

// Get transactions for a specific machine
router.get('/machine/:id', async (req, res) => {
  const machineId = parseInt(req.params.id);
  try {
    const result = await pool.query(
      `SELECT 
        t.transaction_id,
        t.part_id,
        p.name as part_name,
        p.manufacturer_part_number,
        m.name as machine_name,
        t.type,
        t.quantity,
        t.created_at as date,
        t.user_id,
        t.notes,
        t.reference_number,
        p.unit_cost
      FROM transactions t
      LEFT JOIN parts p ON t.part_id = p.part_id
      LEFT JOIN machines m ON t.machine_id = m.machine_id
      WHERE m.machine_id = $1
      ORDER BY t.created_at DESC`,
      [machineId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching machine transactions:', err);
    res.status(500).json({ error: 'Failed to fetch machine transactions' });
  }
});

module.exports = router;