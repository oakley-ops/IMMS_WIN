'use strict';

// Express middleware: when a response finishes with a 5xx status, report it to
// Sentry (no-op when Sentry is disabled — captureException guards internally).
// IMMS routes swallow their errors and respond directly, so the original stack
// is gone; we capture the request context (method/path/status) instead. This
// never touches the response — it only listens for 'finish'.
const sentry = require('./sentry');

function capture5xx(req, res, next) {
  res.on('finish', () => {
    if (res.statusCode >= 500) {
      sentry.captureException(new Error(`HTTP ${res.statusCode} on ${req.method} ${req.originalUrl}`));
    }
  });
  next();
}

module.exports = capture5xx;
