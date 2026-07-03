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
      name: 'imms-web-local',
      script: 'serve', // PM2 built-in static server
      env: {
        PM2_SERVE_PATH: path.join(__dirname, 'frontend', 'build-localhost'),
        PM2_SERVE_PORT: 3002,
        PM2_SERVE_SPA: 'true',
      },
      max_memory_restart: '150M',
    },
    {
      ...common,
      name: 'imms-web-network',
      script: 'serve',
      env: {
        PM2_SERVE_PATH: path.join(__dirname, 'frontend', 'build-network'),
        PM2_SERVE_PORT: 3001,
        PM2_SERVE_SPA: 'true',
      },
      max_memory_restart: '150M',
    },
  ],
};
