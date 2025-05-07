const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  // Read the schema file
  const schema = fs.readFileSync(path.join(__dirname, 'production-schema.sql'), 'utf8');
  
  // Create a connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Run the schema
    await pool.query(schema);
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Error running migration:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration().catch(console.error);
