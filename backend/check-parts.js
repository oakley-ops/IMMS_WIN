require('dotenv').config();
const { Pool } = require('pg');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
};

async function checkPartsLocations() {
  const pool = new Pool(config);
  
  try {
    // Check the parts table structure
    console.log('Checking parts table structure...');
    const tableInfo = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'parts' 
      ORDER BY ordinal_position
    `);
    
    console.log('Parts table columns:');
    tableInfo.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    
    // Check if location_id exists
    const hasLocationId = tableInfo.rows.some(col => col.column_name === 'location_id');
    const hasLocation = tableInfo.rows.some(col => col.column_name === 'location');
    
    console.log(`\nTable has location_id column: ${hasLocationId}`);
    console.log(`Table has location column: ${hasLocation}`);
    
    // Check if part_locations table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'part_locations'
      )
    `);
    
    const partLocationsTableExists = tableExists.rows[0].exists;
    console.log(`\npart_locations table exists: ${partLocationsTableExists}`);
    
    // Check sample parts data
    console.log('\nSample parts with location data:');
    let query;
    
    if (hasLocationId && partLocationsTableExists) {
      query = `
        SELECT p.part_id, p.name, p.location_id, pl.name as location_name
        FROM parts p
        LEFT JOIN part_locations pl ON p.location_id = pl.location_id
        LIMIT 5
      `;
    } else if (hasLocation) {
      query = `
        SELECT part_id, name, location
        FROM parts
        LIMIT 5
      `;
    } else {
      query = `
        SELECT part_id, name
        FROM parts
        LIMIT 5
      `;
    }
    
    const parts = await pool.query(query);
    console.log(parts.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkPartsLocations(); 