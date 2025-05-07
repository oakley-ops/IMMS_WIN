module.exports = {
  apps: [{
    name: "email-monitor",
    script: "./src/scripts/monitorEmails.js",
    watch: true,
    max_memory_restart: "1G",
    restart_delay: 5000,
    instances: 1,
    exec_mode: "fork",
    env: {
      NODE_ENV: "production",
      PROCESS_ALL_EMAILS: "true"
    },
    error_file: "logs/email-monitor-error.log",
    out_file: "logs/email-monitor-out.log",
    time: true,
    autorestart: true,
    max_restarts: 10,
    node_args: "--trace-warnings",
    merge_logs: true,
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    exp_backoff_restart_delay: 100
  }]
} 