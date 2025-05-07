#!/bin/bash

# Set timestamp for backup file name
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/app/backups"
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"

# Log start of backup
echo "Starting database backup at $(date)"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Extract database connection details from DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable is not set"
    exit 1
fi

# Perform backup
echo "Creating backup: $BACKUP_FILE"
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "Backup completed successfully at $(date)"
    echo "Backup saved to: $BACKUP_FILE"
    
    # Keep only the last 7 backups
    cd "$BACKUP_DIR"
    ls -t *.sql.gz | tail -n +8 | xargs -r rm
    echo "Cleaned up old backups"
else
    echo "Backup failed at $(date)"
    rm -f "$BACKUP_FILE"
    exit 1
fi 