#!/bin/bash
set -e

echo "Starting application initialization..."

# Function to log with timestamp
log() {
    echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $1"
}

# Run migrations
log "Running database migrations..."
if ! node scripts/run-migrations.js; then
    log "ERROR: Database migrations failed"
    exit 1
fi
log "Database migrations completed successfully"

# Start cron scheduler
log "Starting cron scheduler..."
supercronic /app/crontab &
CRON_PID=$!
log "Cron scheduler started with PID: $CRON_PID"

# Start application
log "Starting Node.js application..."
export HOST=0.0.0.0
exec node index.js 