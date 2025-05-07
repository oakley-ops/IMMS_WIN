const { logger } = require('../middleware/logger');

// Validation rules for environment variables
const envValidations = {
  // Database Configuration
  DB_USER: { required: true, type: 'string' },
  DB_HOST: { required: true, type: 'string' },
  DB_NAME: { required: true, type: 'string' },
  DB_PASSWORD: { required: true, type: 'string' },
  DB_PORT: { required: true, type: 'number', min: 1, max: 65535 },
  DB_POOL_MAX: { required: true, type: 'number', min: 1, max: 100 },
  DB_SSL_CA: { required: false, type: 'string' },

  // Server Configuration
  PORT: { required: true, type: 'number', min: 1, max: 65535 },
  NODE_ENV: { required: true, type: 'string', values: ['development', 'production', 'test'] },
  HOST: { required: true, type: 'string' },

  // Security
  JWT_SECRET: { required: true, type: 'string', minLength: 32 },
  JWT_EXPIRES_IN: { required: true, type: 'string' },
  METRICS_TOKEN: { required: true, type: 'string', minLength: 32 },
  CSRF_SECRET: { required: true, type: 'string', minLength: 32 },
  COOKIE_SECRET: { required: true, type: 'string', minLength: 32 },

  // CORS Configuration
  CORS_ORIGIN: { required: true, type: 'string' },
  CORS_METHODS: { required: true, type: 'string' },
  CORS_ALLOWED_HEADERS: { required: true, type: 'string' },

  // Rate Limiting
  RATE_LIMIT_WINDOW: { required: true, type: 'number', min: 1 },
  RATE_LIMIT_MAX_REQUESTS: { required: true, type: 'number', min: 1 },
  RATE_LIMIT_REDIS_URL: { required: false, type: 'string' },

  // Logging
  LOG_LEVEL: { required: true, type: 'string', values: ['error', 'warn', 'info', 'debug'] },
  LOG_FORMAT: { required: true, type: 'string', values: ['combined', 'common', 'dev', 'short', 'tiny'] },
  LOG_FILE_MAX_SIZE: { required: true, type: 'string' },
  LOG_MAX_FILES: { required: true, type: 'string' },
  LOG_PATH: { required: true, type: 'string' },

  // Request Tracking
  REQUEST_TIMEOUT: { required: true, type: 'number', min: 1000 },
  SHUTDOWN_TIMEOUT: { required: true, type: 'number', min: 1000 },
  SLOW_REQUEST_THRESHOLD: { required: true, type: 'number', min: 100 },
  MAX_CONCURRENT_REQUESTS: { required: true, type: 'number', min: 1 },
  MAX_REQUEST_SIZE: { required: true, type: 'number', min: 1024 },
  CORRELATION_ID_HEADER: { required: true, type: 'string' },
  REQUEST_ID_HEADER: { required: true, type: 'string' },

  // API Versioning
  API_VERSION_DEFAULT: { required: true, type: 'string' },
  API_VERSION_LATEST: { required: true, type: 'string' },
  API_DEPRECATION_WINDOW: { required: true, type: 'string' },

  // Caching
  STATIC_CACHE_DURATION: { required: true, type: 'number', min: 0 },
  REDIS_CACHE_URL: { required: false, type: 'string' },
  CACHE_TTL: { required: true, type: 'number', min: 0 },

  // SSL/TLS Configuration
  SSL_ENABLED: { required: true, type: 'boolean' },
  SSL_KEY_PATH: { required: false, type: 'string' },
  SSL_CERT_PATH: { required: false, type: 'string' },
  SSL_CA_PATH: { required: false, type: 'string' },

  // Monitoring
  METRICS_ENABLED: { required: true, type: 'boolean' },
  METRICS_INTERVAL: { required: true, type: 'number', min: 1000 },
  HEALTH_CHECK_INTERVAL: { required: true, type: 'number', min: 1000 },
  PROMETHEUS_METRICS_PATH: { required: true, type: 'string' },

  // File Upload
  UPLOAD_MAX_SIZE: { required: true, type: 'number', min: 1024 },
  UPLOAD_PATH: { required: true, type: 'string' },
  ALLOWED_FILE_TYPES: { required: true, type: 'string' },

  // Backup Configuration
  BACKUP_ENABLED: { required: true, type: 'boolean' },
  BACKUP_INTERVAL: { required: true, type: 'number', min: 3600 },
  BACKUP_PATH: { required: true, type: 'string' },
  BACKUP_RETENTION_DAYS: { required: true, type: 'number', min: 1 },

  // Feature Flags
  FEATURE_API_V2: { required: true, type: 'boolean' },
  FEATURE_WEBSOCKETS: { required: true, type: 'boolean' },
  FEATURE_FILE_UPLOAD: { required: true, type: 'boolean' },
  FEATURE_EXPORT: { required: true, type: 'boolean' }
};

// Helper function to validate a single environment variable
const validateEnvVar = (key, value, rules) => {
  // Check if required
  if (rules.required && (value === undefined || value === '')) {
    throw new Error(`${key} is required`);
  }

  // If value is not provided and not required, skip further validation
  if (value === undefined || value === '') {
    return true;
  }

  // Type validation
  switch (rules.type) {
    case 'number':
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(`${key} must be a number`);
      }
      if (rules.min !== undefined && num < rules.min) {
        throw new Error(`${key} must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && num > rules.max) {
        throw new Error(`${key} must be at most ${rules.max}`);
      }
      break;

    case 'boolean':
      if (value !== 'true' && value !== 'false') {
        throw new Error(`${key} must be either 'true' or 'false'`);
      }
      break;

    case 'string':
      if (rules.values && !rules.values.includes(value)) {
        throw new Error(`${key} must be one of: ${rules.values.join(', ')}`);
      }
      if (rules.minLength && value.length < rules.minLength) {
        throw new Error(`${key} must be at least ${rules.minLength} characters long`);
      }
      break;
  }

  return true;
};

// Main validation function
const validateEnv = () => {
  const errors = [];

  // Validate each environment variable
  Object.entries(envValidations).forEach(([key, rules]) => {
    try {
      validateEnvVar(key, process.env[key], rules);
    } catch (error) {
      errors.push(error.message);
    }
  });

  // Log validation results
  if (errors.length > 0) {
    logger.error('Environment validation failed', { errors });
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }

  logger.info('Environment validation successful');
  return true;
};

module.exports = validateEnv; 