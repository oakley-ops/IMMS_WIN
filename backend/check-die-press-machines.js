const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'imms_inventory',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function checkMachines() {
  try {
    console.log('\nChecking machines with "Die Press" in name...\n');
    
    const result = await pool.query(`
      SELECT machine_id, name, machine_type, location, status
      FROM machines 
      WHERE name ILIKE '%die press%'
      ORDER BY name ASC
    `);
    
    if (result.rows.length === 0) {
      console.log('No machines found with "Die Press" in name.');
    } else {
      console.log('Found machines:');
      console.log('-----------------------------------------------------------');
      result.rows.forEach(machine => {
        console.log(`ID: ${machine.machine_id}`);
        console.log(`Name: ${machine.name}`);
        console.log(`Type: ${machine.machine_type || '(NULL)'}`);
        console.log(`Location: ${machine.location || '(NULL)'}`);
        console.log(`Status: ${machine.status || '(NULL)'}`);
        console.log('-----------------------------------------------------------');
      });
    }
    
    console.log('\nAll machine types in database:');
    const types = await pool.query(`
      SELECT DISTINCT machine_type, COUNT(*) as count
      FROM machines 
      GROUP BY machine_type
      ORDER BY machine_type
    `);
    types.rows.forEach(row => {
      console.log(`  ${row.machine_type || '(NULL)'}: ${row.count} machines`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkMachines();
