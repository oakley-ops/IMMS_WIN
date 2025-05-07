const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const config = require('./config/database');

const env = process.env.NODE_ENV || 'development';
const pool = new Pool(config[env]);

async function initializeDatabase() {
  try {
    // Read all SQL files from migrations directory
    const migrationFiles = await fs.readdir(path.join(__dirname, 'migrations'));
    const sqlFiles = migrationFiles.filter(file => file.endsWith('.sql'));

    // Sort files to ensure proper order (create tables before adding foreign keys)
    sqlFiles.sort();

    // Execute each migration file
    for (const file of sqlFiles) {
      console.log(`Executing migration: ${file}`);
      const filePath = path.join(__dirname, 'migrations', file);
      const sql = await fs.readFile(filePath, 'utf-8');
      
      await pool.query(sql);
      console.log(`Successfully executed ${file}`);
    }

    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    await pool.end();
  }
}

initializeDatabase();
