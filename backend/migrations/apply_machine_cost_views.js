const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create a database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function applyMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration: Creating machine cost views...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'create_machine_cost_view.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Execute the SQL
    await client.query(sql);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('Migration completed successfully!');
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    // Release the client
    client.release();
  }
}

// Run the migration
applyMigration()
  .then(() => {
    console.log('Migration process completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration process failed:', error);
    process.exit(1);
  }); 