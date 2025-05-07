// Simple script to run our migration
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configure the connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'fiservinventory',
  password: process.env.DB_PASSWORD || '1234',
  port: process.env.DB_PORT || 5432,
});

async function runMigration() {
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'migrations', '20240320_create_po_email_tracking.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Connect to the database
    const client = await pool.connect();
    
    console.log('Running migration: 20240320_create_po_email_tracking.sql');
    
    try {
      // Execute the SQL
      await client.query(sql);
      console.log('Migration completed successfully!');
    } finally {
      // Release the client back to the pool
      client.release();
    }
  } catch (error) {
    console.error('Error running migration:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the migration
runMigration();
