'use strict';

// Error tracking via @sentry/node. Fully no-op unless SENTRY_DSN is set.
// initSentry() MUST be called before `express` is required in the entry file
// so the SDK can instrument express/http/pg. Errors only (no perf tracing).
// The Sentry client is injectable (default = the real module) so the on/off
// gating is testable in both jest and vitest without module mocking — vitest
// cannot intercept @sentry/node's dual CJS/ESM conditional exports.
const defaultSentry = require('@sentry/node');

function initSentry(sentry = defaultSentry) {
  if (!process.env.SENTRY_DSN) return false;
  try {
    sentry.init({
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

module.exports = { Sentry: defaultSentry, initSentry };
