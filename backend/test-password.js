const bcrypt = require('bcrypt');

// The stored hash from our database check
const storedHash = '$2a$10$gXhblMXrfkw2DFYSxs/Tx.ygw8zLoG5jqDZk3mdVFX/tNMwV6R2WC';

// Check if common passwords match the stored hash
async function testPasswords() {
  const testPasswords = [
    'admin',
    'admin123',
    'password',
    'admin1234',
    'Admin123',
    'admin123!',
    'admin@123',
  ];
  
  console.log('Testing passwords against stored hash:', storedHash);
  
  for (const password of testPasswords) {
    try {
      const isMatch = await bcrypt.compare(password, storedHash);
      console.log(`Password: "${password}" ${isMatch ? 'MATCHES!' : 'does not match'}`);
    } catch (error) {
      console.error(`Error comparing "${password}":`, error.message);
    }
  }
  
  // For reference, let's create a new hash for 'admin123'
  const newHash = await bcrypt.hash('admin123', 10);
  console.log('\nFor reference, a new hash for "admin123":', newHash);
}

testPasswords(); 