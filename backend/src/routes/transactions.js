const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const dbConfig = require('../../config/database')[process.env.NODE_ENV || 'development'];
const pool = new Pool(dbConfig);

// Get all transactions
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT 
        t.transaction_id as id,
        p.name as part_name,
        p.fiserv_part_number,
        p.unit_cost,
        m.name as machine_name,
        t.quantity,
        t.type,
        DATE(t.created_at) as date
      FROM transactions t
      LEFT JOIN parts p ON t.part_id = p.part_id
      LEFT JOIN machines m ON p.machine_id = m.machine_id
      WHERE t.type = 'usage'
    `;

    const params = [];
    if (startDate || endDate) {
      if (startDate) {
        params.push(`${startDate} 00:00:00`);
        query += ` AND t.created_at >= $${params.length}`;
      }
      if (endDate) {
        params.push(`${endDate} 23:59:59`);
        query += ` AND t.created_at <= $${params.length}`;
      }
    }

    query += ' ORDER BY t.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
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
        t.transaction_id as id,
        p.name as part_name,
        p.fiserv_part_number,
        m.name as machine_name,
        t.quantity,
        t.type,
        t.created_at as date
      FROM transactions t
      LEFT JOIN parts p ON t.part_id = p.part_id
      LEFT JOIN machines m ON p.machine_id = m.machine_id
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
        t.transaction_id as id,
        p.name as part_name,
        p.fiserv_part_number,
        m.name as machine_name,
        t.quantity,
        t.type,
        t.created_at as date
      FROM transactions t
      LEFT JOIN parts p ON t.part_id = p.part_id
      LEFT JOIN machines m ON p.machine_id = m.machine_id
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