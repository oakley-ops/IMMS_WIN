require('dotenv').config();
const { Pool } = require('pg');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
};

async function checkLocationColumn() {
  const pool = new Pool(config);
  
  try {
    // Check the direct location column values
    console.log('Checking location column values...');
    const locationQuery = await pool.query(`
      SELECT part_id, name, manufacturer_part_number, fiserv_part_number, location
      FROM parts
      WHERE location IS NOT NULL AND location != ''
      LIMIT 10
    `);
    
    console.log('Parts with location values:');
    console.log(locationQuery.rows);
    
    if (locationQuery.rows.length === 0) {
      console.log('No parts found with non-empty location values');
      
      // Let's check if any parts have location in their raw data
      console.log('\nChecking for any location data:');
      const anyLocationQuery = await pool.query(`
        SELECT part_id, name, location, fiserv_part_number
        FROM parts
        LIMIT 10
      `);
      
      console.log(anyLocationQuery.rows);
    }
    
    // Count how many parts have location values
    const countQuery = await pool.query(`
      SELECT 
        COUNT(*) as total_parts,
        COUNT(CASE WHEN location IS NOT NULL AND location != '' THEN 1 END) as with_location,
        COUNT(CASE WHEN location_id IS NOT NULL THEN 1 END) as with_location_id
      FROM parts
    `);
    
    console.log('\nLocation statistics:');
    console.log(countQuery.rows[0]);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkLocationColumn(); 