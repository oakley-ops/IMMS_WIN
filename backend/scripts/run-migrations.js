const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function runMigrations() {
  console.log('Starting database migrations...');
  console.log('Database configuration:', {
    hasConnectionString: !!process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV
  });

  try {
    // Test database connection first
    console.log('Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('Database connection successful');

    console.log('Creating migrations table if needed...');
    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Migrations table ready');

    // Get all migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    console.log('Reading migrations from:', migrationsDir);
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    console.log('Found migration files:', migrationFiles);

    // Get executed migrations
    console.log('Checking executed migrations...');
    const { rows: executedMigrations } = await pool.query(
      'SELECT name FROM migrations'
    );
    const executedMigrationNames = executedMigrations.map(m => m.name);
    console.log('Already executed migrations:', executedMigrationNames);

    // Run pending migrations
    for (const file of migrationFiles) {
      if (!executedMigrationNames.includes(file)) {
        console.log(`Running migration: ${file}`);
        const sql = fs.readFileSync(
          path.join(migrationsDir, file),
          'utf8'
        );
        console.log('Migration SQL:', sql);

        await pool.query('BEGIN');
        try {
          console.log('Executing migration...');
          await pool.query(sql);
          console.log('Recording migration in migrations table...');
          await pool.query(
            'INSERT INTO migrations (name) VALUES ($1)',
            [file]
          );
          await pool.query('COMMIT');
          console.log(`Migration ${file} completed successfully`);
        } catch (error) {
          console.error(`Error executing migration ${file}:`, error);
          console.log('Rolling back transaction...');
          await pool.query('ROLLBACK');
          throw error;
        }
      } else {
        console.log(`Skipping already executed migration: ${file}`);
      }
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    });
    process.exit(1);
  } finally {
    console.log('Closing database connection...');
    await pool.end();
  }
}

// Run migrations
console.log('Migration script started');
runMigrations(); 