const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'imms_inventory', // Use the current database name
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432', 10),
};

async function runMigration() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('Connecting to database:', dbConfig.database);
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', 'rename_internal_to_crc_column.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running column rename migration...');
    
    // Execute the migration
    const result = await pool.query(migrationSQL);
    
    console.log('Migration completed successfully!');
    console.log('Result:', result[result.length - 1]?.rows[0]?.status || 'Done');
    
  } catch (error) {
    console.error('Migration failed:', error);
    console.error('Error details:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration().catch(console.error);
