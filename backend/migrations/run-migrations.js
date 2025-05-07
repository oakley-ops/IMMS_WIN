const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dbConfig = require('../config/database')[process.env.NODE_ENV || 'development'];

async function runMigrations() {
  const pool = new Pool(dbConfig);
  
  try {
    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Read schema.sql
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Read seed.sql
    const seedPath = path.join(__dirname, '../db/seed.sql');
    const seed = fs.readFileSync(seedPath, 'utf8');

    // Begin transaction
    await pool.query('BEGIN');

    try {
      // Check if schema has been applied
      const { rows } = await pool.query(
        'SELECT * FROM migrations WHERE name = $1',
        ['initial_schema']
      );

      if (rows.length === 0) {
        // Apply schema
        await pool.query(schema);
        
        // Record migration
        await pool.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          ['initial_schema']
        );

        // Apply seed data only in development
        if (process.env.NODE_ENV !== 'production') {
          await pool.query(seed);
        }

        console.log('✅ Database schema and seed data applied successfully');
      } else {
        console.log('ℹ️ Database schema already exists');
      }

      // Commit transaction
      await pool.query('COMMIT');
    } catch (error) {
      // Rollback transaction on error
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('❌ Error running migrations:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
