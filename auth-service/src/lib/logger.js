// src/lib/logger.js
const pino = require('pino');

const env = process.env.NODE_ENV || 'development';
const level = process.env.LOG_LEVEL
  || (env === 'production' ? 'info' : env === 'test' ? 'silent' : 'debug');

const transport = env === 'development'
  ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
  : undefined;

const logger = pino({
  level,
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.password_hash', '*.token'],
  ...(transport ? { transport } : {}),
});

module.exports = logger;
