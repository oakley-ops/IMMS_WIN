const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Log levels (in order): fatal, error, warn, info, debug, trace
// - prod: info+ as structured JSON (parseable by log aggregators)
// - dev:  debug+, pretty-printed for readability
// - test: silent — keeps test output clean. Override with LOG_LEVEL=debug if needed.
const level = process.env.LOG_LEVEL || (isProduction ? 'info' : isTest ? 'silent' : 'debug');

const logger = pino({
  level,
  base: { service: 'mcs-backend' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'password_hash',
      '*.password',
      '*.password_hash',
      'token',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' },
        },
      }),
});

module.exports = logger;
