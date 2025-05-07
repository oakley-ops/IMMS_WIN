const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { logger } = require('../middleware/logger');

// Required directories
const directories = [
  './logs',
  './uploads',
  './backups'
];

// Function to create directories if they don't exist
const createDirectories = () => {
  directories.forEach(dir => {
    const fullPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  });
};

// Function to generate a secure random string
const generateSecureString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Function to check and update security keys
const checkSecurityKeys = () => {
  const envPath = path.join(__dirname, '..', '.env');
  
  if (!fs.existsSync(envPath)) {
    logger.error('.env file not found');
    process.exit(1);
  }

  let envContent = fs.readFileSync(envPath, 'utf8');
  let updated = false;

  // Check and update security keys
  const securityKeys = [
    'JWT_SECRET',
    'CSRF_SECRET'
  ];

  securityKeys.forEach(key => {
    const currentValue = process.env[key];
    if (!currentValue || currentValue.includes('your-') || currentValue.includes('local_')) {
      const newValue = generateSecureString();
      envContent = envContent.replace(
        new RegExp(`${key}=.*`),
        `${key}=${newValue}`
      );
      updated = true;
      logger.info(`Generated new ${key}`);
    }
  });

  if (updated) {
    fs.writeFileSync(envPath, envContent);
    logger.info('Updated security keys in .env file');
  }
};

// Function to check database connection
const checkDatabase = async () => {
  try {
    const { pool } = require('../db');
    const result = await pool.query('SELECT NOW()');
    if (result.rows[0]) {
      logger.info('Database connection successful');
    }
  } catch (error) {
    logger.error('Database connection failed:', error.message);
    process.exit(1);
  }
};

// Main setup function
const setup = async () => {
  try {
    logger.info('Starting application setup...');

    // Create required directories
    createDirectories();

    // Check and update security keys
    checkSecurityKeys();

    // Check database connection
    await checkDatabase();

    logger.info('Setup completed successfully');
  } catch (error) {
    logger.error('Setup failed:', error.message);
    process.exit(1);
  }
};

// Run setup if this script is run directly
if (require.main === module) {
  setup();
}

module.exports = setup; 