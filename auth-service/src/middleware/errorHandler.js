// src/middleware/errorHandler.js
const logger = require('../lib/logger');
const { DomainError } = require('../lib/errors');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof DomainError) {
    (req.log || logger).warn({ err: { code: err.code, message: err.message } }, 'DomainError');
    const body = { error: err.code, message: err.message };
    if (err.details !== undefined) body.details = err.details;
    return res.status(err.status).json(body);
  }

  (req.log || logger).error({ err }, 'Unhandled error');
  const isDev = process.env.NODE_ENV !== 'production';
  const body = { error: 'server_error', message: 'Internal server error' };
  if (isDev) body.details = err.message;
  return res.status(500).json(body);
};

module.exports = errorHandler;
