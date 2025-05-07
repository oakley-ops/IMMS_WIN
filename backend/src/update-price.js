// Script to update the price in the database
const { Pool } = require('pg');

async function updatePrice() {
  const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'fiservinventory',
    password: '1234',
    port: 5432
  });

  try {
    console.log('Connecting to database...');
    
    // Update the price
    const res = await pool.query(
      'UPDATE part_suppliers SET unit_cost = 1.00 WHERE part_id = 1975 AND supplier_id = 8'
    );
    
    console.log('Updated price for part 1975:', res.rowCount, 'rows affected');
    
    // Verify the update
    const check = await pool.query(
      'SELECT unit_cost FROM part_suppliers WHERE part_id = 1975 AND supplier_id = 8'
    );
    
    if (check.rows.length > 0) {
      console.log('New price:', check.rows[0].unit_cost);
    } else {
      console.log('No part-supplier relationship found');
    }
  } catch (err) {
    console.error('Error updating price:', err);
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the function
updatePrice(); 