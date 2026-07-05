'use strict';

// Error tracking via @sentry/node. Fully no-op unless SENTRY_DSN is set.
// initSentry() MUST be called before `express` is required in the entry file
// so the SDK can instrument express/http/pg. Errors only (no perf tracing).
const Sentry = require('@sentry/node');

function initSentry() {
  if (!process.env.SENTRY_DSN) return false;
  try {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.SENTRY_RELEASE || undefined,
      tracesSampleRate: 0,
    });
    return true;
  } catch (err) {
    console.error('[sentry] init failed; error tracking disabled:', err.message);
    return false;
  }
}

module.exports = { Sentry, initSentry };
