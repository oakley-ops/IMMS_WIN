'use strict';

// Configured helmet middleware for the IMMS backend. Sets the standard security
// headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) and
// removes X-Powered-By.
//
// Content-Security-Policy runs in REPORT-ONLY mode: the browser reports policy
// violations (visible in devtools) but blocks NOTHING, so it cannot break the SPA
// or its jsdelivr Bootstrap / Google Fonts / websocket traffic. The directives
// below reflect the app's real sources. Flipping this to enforced (removing
// `reportOnly`) is a deliberate follow-up, done after confirming zero violations
// against the live demo.
const helmet = require('helmet');

module.exports = helmet({
  contentSecurityPolicy: {
    reportOnly: true,
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      // 'unsafe-inline' for the CRA runtime chunk; jsdelivr for Bootstrap's JS.
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net'],
      // 'unsafe-inline' for MUI/emotion injected styles; jsdelivr + Google Fonts CSS.
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'blob:'], // /uploads, data URIs, blob: PDF/doc previews
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'ws:', 'wss:'], // same-origin API + Socket.io
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      baseUri: ["'self'"],
    },
  },
  frameguard: { action: 'sameorigin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // 1-year HSTS, host-scoped only. Deliberately no includeSubDomains/preload
  // (per the spec) so it never over-reaches to the immsystem.com apex/siblings.
  hsts: { maxAge: 31536000, includeSubDomains: false },
});
