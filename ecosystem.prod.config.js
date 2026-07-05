/**
 * PM2 ecosystem — PRODUCTION (all five services).
 *
 * Runs only from the production clone (C:\imms\prod). Deploys go through
 * scripts/deploy.ps1 — do not `pm2 start` new code by hand.
 *
 *   node <pm2-bin> startOrReload ecosystem.prod.config.js
 *   node <pm2-bin> save
 *
 * pm2-bin: C:\Users\Fiser\AppData\Roaming\npm\node_modules\pm2\bin\pm2
 */
const path = require('path');

const common = {
  watch: false,
  restart_delay: 3000,
  max_restarts: 10,
  log_date_format: 'YYYY-MM-DD HH:mm:ss',
};

module.exports = {
  apps: [
    {
      ...common,
      name: 'imms-api',
      cwd: path.join(__dirname, 'backend'),
      script: 'index.js',
      // NODE_ENV deliberately NOT set: backend/db.js forces SSL when
      // NODE_ENV === 'production' and the local PostgreSQL has no SSL.
      // NODE_ENV stays governed by backend/.env.
      env: { PORT: 4000, HOST: '0.0.0.0' },
      max_memory_restart: '500M',
    },
    {
      ...common,
      name: 'mcs-api',
      cwd: path.join(__dirname, 'maintenance_call_system', 'backend'),
      script: 'index.js',
      env: { NODE_ENV: 'production', PORT: 4001 },
      max_memory_restart: '200M',
    },
    {
      ...common,
      name: 'mcs-web',
      cwd: path.join(__dirname, 'maintenance_call_system', 'frontend'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3003',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '300M',
    },
    {
      ...common,
      // Custom static server (scripts/static-serve.js) instead of PM2's built-in
      // `serve`, which 403s nested paths on Windows (backslash vs forward-slash
      // root check). SPA fallback + correct MIME + traversal guard.
      name: 'imms-web-local',
      script: path.join(__dirname, 'scripts', 'static-serve.js'),
      env: {
        SERVE_PATH: path.join(__dirname, 'frontend', 'build-localhost'),
        SERVE_PORT: 3002,
      },
      max_memory_restart: '150M',
    },
    {
      ...common,
      name: 'imms-web-network',
      script: path.join(__dirname, 'scripts', 'static-serve.js'),
      env: {
        SERVE_PATH: path.join(__dirname, 'frontend', 'build-network'),
        SERVE_PORT: 3001,
      },
      max_memory_restart: '150M',
    },
    {
      ...common,
      // Standalone uptime monitor — separate process so it survives any single
      // service crashing. No NODE_ENV override (mirrors imms-api; it requires
      // emailService whose pg Pool must not get the production-SSL treatment).
      // No-op (no email) until OPS_ALERT_RECIPIENTS is set in backend/.env.
      name: 'uptime-monitor',
      cwd: path.join(__dirname, 'backend'),
      script: 'src/scripts/uptimeMonitor.js',
      max_memory_restart: '100M',
    },
  ],
};
