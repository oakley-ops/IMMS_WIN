// auth-service/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'auth-service',
      cwd: './',
      script: 'index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 4002,
      },
      watch: false,
      max_memory_restart: '200M',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
