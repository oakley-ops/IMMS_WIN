'use strict';

// Configured helmet middleware for the IMMS backend. Sets the standard security
// headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) and
// removes X-Powered-By. Content-Security-Policy is intentionally DISABLED for now
// (matching the MCS backend) to avoid breaking the SPA and its jsdelivr Bootstrap;
// a tuned CSP is a tracked follow-up.
const helmet = require('helmet');

module.exports = helmet({
  contentSecurityPolicy: false,
  frameguard: { action: 'sameorigin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});
