// src/routes/reports.js (create a new file for report routes)
const express = require('express');
const router = express.Router();
const { Pool } = require('pg'); // Assuming you have the pool configured

const pool = new Pool({
  // ... your database configuration
});

router.get('/low-stock', async (req, res) => {
  const threshold = req.query.threshold || 10; // Default threshold is 10

  try {
    const result = await pool.query(
      'SELECT * FROM parts WHERE quantity <= $1',
      [threshold]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating report');
  }
});

module.exports = router;