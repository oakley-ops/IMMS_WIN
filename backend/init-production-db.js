require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Parse the DATABASE_URL to get the database name
const dbUrl = new URL(process.env.DATABASE_URL);
const databaseName = dbUrl.pathname.split('/')[1];

// Create a connection config without specific database
const baseConfig = {
  connectionString: process.env.DATABASE_URL.replace(databaseName, 'postgres'),
  ssl: {
    rejectUnauthorized: false
  }
};

async function initializeDatabase() {
  // First connect to default database
  const basePool = new Pool(baseConfig);
  
  try {
    console.log('Creating database if it doesn\'t exist...');
    await basePool.query(`CREATE DATABASE ${databaseName}`);
    console.log(`Database ${databaseName} created or already exists`);
  } catch (error) {
    if (error.code === '42P04') {
      console.log('Database already exists, continuing...');
    } else {
      console.error('Error creating database:', error);
      throw error;
    }
  } finally {
    await basePool.end();
  }

  // Connect to the actual database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  try {
    console.log('Testing connection...');
    const testResult = await pool.query('SELECT NOW()');
    console.log('Connection successful:', testResult.rows[0].now);

    console.log('Reading schema file...');
    const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    
    console.log('Executing schema...');
    await pool.query(schemaSQL);
    console.log('Schema executed successfully');

    try {
      // Optional: Add sample data
      const sampleDataSQL = fs.readFileSync(path.join(__dirname, 'sample_data.sql'), 'utf8');
      console.log('Adding sample data...');
      await pool.query(sampleDataSQL);
      console.log('Sample data added successfully');
    } catch (sampleDataError) {
      console.warn('Warning: Could not add sample data:', sampleDataError.message);
    }

    // Verify tables were created
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Created tables:', tablesResult.rows.map(row => row.table_name));
    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Error initializing database:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail
    });
    throw error;
  } finally {
    await pool.end();
  }
}

initializeDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 