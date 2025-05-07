const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load database configuration
require('dotenv').config();
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
};

async function runMigration() {
  const pool = new Pool(dbConfig);
  const client = await pool.connect();
  
  try {
    console.log('Starting maintenance_status column migration...');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Check if column already exists
    const columnCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'machines'
        AND column_name = 'maintenance_status'
      );
    `);
    
    if (columnCheck.rows[0].exists) {
      console.log('Maintenance status column already exists, skipping creation');
      await client.query('COMMIT');
      return;
    }
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, '20250325_add_maintenance_status.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Execute the SQL
    await client.query(sqlContent);
    
    // Commit the transaction
    await client.query('COMMIT');
    
    console.log('Maintenance status column migration completed successfully');
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Error executing maintenance status column migration:', error);
    throw error;
  } finally {
    // Release client
    client.release();
    await pool.end();
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { runMigration }; 