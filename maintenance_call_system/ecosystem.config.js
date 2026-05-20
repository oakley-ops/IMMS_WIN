/**
 * PM2 Ecosystem Config — Maintenance Call System
 *
 * Usage:
 *   pm2 start ecosystem.config.js        # start all processes
 *   pm2 save                              # persist process list across reboots
 *   pm2 startup                           # print the command to enable boot-start
 *   pm2 reload all                        # zero-downtime reload
 *   pm2 logs mcs-backend                  # tail backend logs
 *
 * Per-site config: copy this file and set SITE_NAME, DB connection, and ports.
 */

module.exports = {
  apps: [
    {
      name: 'mcs-backend',
      cwd: './backend',
      script: 'index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 4001,
        // Override these in a .env file in the backend directory
        // SITE_NAME: 'Plant 1',
      },
      watch: false,
      max_memory_restart: '200M',
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 3000,
      max_restarts: 10,
    },
    {
      name: 'mcs-frontend',
      cwd: './frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
        // NEXT_PUBLIC_SITE_NAME: 'Plant 1',
        // NEXT_PUBLIC_API_URL: 'http://mcs-server/api/v1',
        // NEXT_PUBLIC_SOCKET_URL: 'http://mcs-server',
      },
      watch: false,
      max_memory_restart: '300M',
      error_file: '../logs/frontend-error.log',
      out_file: '../logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
