const bcrypt = require('bcrypt');
const { executeWithRetry } = require('../db');

async function createTestUser() {
  try {
    // Hash the password
    const password = 'admin123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Check if user already exists
    const existingUser = await executeWithRetry(
      'SELECT * FROM users WHERE username = $1',
      ['admin']
    );

    if (existingUser.rows.length > 0) {
      console.log('Test user already exists');
      return;
    }

    // Create the user
    const result = await executeWithRetry(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING *',
      ['admin', hashedPassword, 'admin']
    );

    console.log('Test user created successfully:', result.rows[0]);
  } catch (error) {
    console.error('Error creating test user:', error);
  }
}

createTestUser(); 