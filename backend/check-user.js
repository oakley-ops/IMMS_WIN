require('dotenv').config();
const { Pool } = require('pg');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
};

console.log('Database config:', {
  user: config.user,
  host: config.host,
  port: config.port,
  database: config.database
});

async function checkDatabase() {
  const pool = new Pool(config);
  
  try {
    // Test connection
    console.log('Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('Database connection successful!');
    
    // Check users table
    console.log('\nChecking users table...');
    const usersTable = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'users'
    `);
    
    if (usersTable.rows.length === 0) {
      console.log('Users table does not exist!');
      return;
    }
    
    console.log('Users table exists.');
    
    // Check admin user
    console.log('\nChecking for admin user...');
    const adminResult = await pool.query(`
      SELECT user_id, username, role, password_hash 
      FROM users 
      WHERE username = 'admin'
    `);
    
    if (adminResult.rows.length === 0) {
      console.log('Admin user does not exist!');
      
      // Create admin user
      console.log('\nCreating admin user...');
      // Password: admin123
      await pool.query(`
        INSERT INTO users (username, password_hash, role)
        VALUES ('admin', '$2b$10$rMUXoEYkwXD.Tz.0icQkXOBwRQIJqRhqrnL8HzKWXqR1VlhKP3vPi', 'admin')
      `);
      console.log('Admin user created successfully!');
    } else {
      const admin = adminResult.rows[0];
      console.log('Admin user exists:');
      console.log('  ID:', admin.user_id);
      console.log('  Username:', admin.username);
      console.log('  Role:', admin.role);
      console.log('  Password hash:', admin.password_hash);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('Could not connect to PostgreSQL. Is it running?');
    } else if (error.code === '3D000') {
      console.error('Database does not exist. You need to create it first.');
    }
  } finally {
    await pool.end();
  }
}

checkDatabase(); 