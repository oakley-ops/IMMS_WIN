const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixLocationData() {
  console.log('Starting location data fix...');
  
  const client = await pool.connect();
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    // Step 1: Check if part_locations table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'part_locations'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Creating part_locations table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS part_locations (
          location_id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
    
    // Step 2: Check parts table schema
    const columnsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'parts';
    `);
    
    const columns = columnsCheck.rows.map(row => row.column_name);
    console.log('Current parts table columns:', columns);
    
    const hasLocationId = columns.includes('location_id');
    const hasLocation = columns.includes('location');
    
    // Step 3: Add location_id column if it doesn't exist
    if (!hasLocationId) {
      console.log('Adding location_id column to parts table...');
      await client.query(`
        ALTER TABLE parts ADD COLUMN location_id INTEGER;
      `);
      
      // Add foreign key constraint
      await client.query(`
        ALTER TABLE parts
        ADD CONSTRAINT fk_location
        FOREIGN KEY (location_id)
        REFERENCES part_locations(location_id)
        ON DELETE SET NULL;
      `);
    }
    
    // Step 4: Migrate data from location to location_id
    if (hasLocation) {
      console.log('Migrating data from location to location_id...');
      
      // Get all distinct locations
      const distinctLocations = await client.query(`
        SELECT DISTINCT location FROM parts WHERE location IS NOT NULL AND location != '';
      `);
      
      console.log(`Found ${distinctLocations.rows.length} distinct locations to migrate.`);
      
      // For each location, create a record in part_locations and update parts
      for (const row of distinctLocations.rows) {
        const locationName = row.location;
        console.log(`Processing location: ${locationName}`);
        
        // Check if location already exists
        const existingLocation = await client.query(`
          SELECT location_id FROM part_locations WHERE name = $1;
        `, [locationName]);
        
        let locationId;
        if (existingLocation.rows.length > 0) {
          locationId = existingLocation.rows[0].location_id;
          console.log(`Found existing location_id: ${locationId}`);
        } else {
          // Create new location
          const newLocation = await client.query(`
            INSERT INTO part_locations (name) VALUES ($1) RETURNING location_id;
          `, [locationName]);
          locationId = newLocation.rows[0].location_id;
          console.log(`Created new location with id: ${locationId}`);
        }
        
        // Update parts with this location
        const updateResult = await client.query(`
          UPDATE parts SET location_id = $1 WHERE location = $2;
        `, [locationId, locationName]);
        
        console.log(`Updated ${updateResult.rowCount} parts with location_id ${locationId}`);
      }
    }
    
    // Step 5: Update the SQL query in the routes file to join with part_locations
    console.log('Data migration complete. Please update your parts.js SQL queries to include:');
    console.log(`LEFT JOIN part_locations pl ON p.location_id = pl.location_id`);
    console.log(`And select pl.name as location instead of p.location`);
    
    // Commit the transaction
    await client.query('COMMIT');
    console.log('Fix completed successfully!');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error fixing location data:', err);
  } finally {
    client.release();
    pool.end();
  }
}

fixLocationData().catch(console.error); 