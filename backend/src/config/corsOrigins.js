// Single source of truth for allowed browser origins (HTTP CORS + Socket.IO).
// Override in production via the CORS_ORIGINS env var (comma-separated).
// These are intentionally limited to the internal LAN/host origins the app
// is served from — not a wildcard.
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://10.1.10.50:3000',
  'http://10.1.10.50:3001',
  'http://10.1.10.50:3002',
  'http://10.1.10.171:3000',
  'http://10.1.10.171:3001',
  'http://10.1.10.171:3002',
  'http://192.168.50.1:3000',
  'http://192.168.50.1:3001',
  'http://192.168.50.1:3002',
];

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : DEFAULT_ALLOWED_ORIGINS;

module.exports = { allowedOrigins, DEFAULT_ALLOWED_ORIGINS };
