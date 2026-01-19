const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'fiservinventory',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function updateMachineTypes() {
  try {
    console.log('Updating Die Press machine types...\n');
    
    const result = await pool.query(`
      UPDATE machines 
      SET machine_type = 'Die Press'
      WHERE name ILIKE '%die press%'
      RETURNING machine_id, name, machine_type, location
    `);
    
    console.log(`Updated ${result.rows.length} machines:\n`);
    result.rows.forEach(machine => {
      console.log(`✓ ${machine.name} (${machine.location})`);
      console.log(`  Type set to: ${machine.machine_type}\n`);
    });
    
    console.log('Update complete!');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

updateMachineTypes();
