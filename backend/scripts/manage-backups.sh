#!/bin/bash

# Function to list all backups
list_backups() {
    echo "Listing available backups:"
    flyctl ssh console -C "ls -lh /app/backups/*.gz"
}

# Function to verify latest backup
verify_backup() {
    echo "Verifying latest backup..."
    LATEST_BACKUP=$(flyctl ssh console -C "ls -t /app/backups/*.gz | head -1")
    
    if [ -z "$LATEST_BACKUP" ]; then
        echo "No backups found!"
        exit 1
    }
    
    echo "Latest backup: $LATEST_BACKUP"
    
    # Check file size
    SIZE=$(flyctl ssh console -C "stat -f %z $LATEST_BACKUP")
    if [ "$SIZE" -lt 1000 ]; then
        echo "Warning: Backup file seems too small ($SIZE bytes)"
    else
        echo "Backup size: $SIZE bytes"
    fi
    
    # Test backup integrity
    flyctl ssh console -C "gunzip -t $LATEST_BACKUP"
    if [ $? -eq 0 ]; then
        echo "✅ Backup integrity verified"
    else
        echo "❌ Backup might be corrupted"
    fi
}

# Function to trigger manual backup
manual_backup() {
    echo "Triggering manual backup..."
    flyctl ssh console -C "/app/scripts/backup-db.sh"
}

# Function to clean old backups
clean_old_backups() {
    echo "Cleaning backups older than 7 days..."
    flyctl ssh console -C "find /app/backups -name '*.gz' -mtime +7 -delete"
}

# Show usage if no arguments provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 [list|verify|backup|clean]"
    exit 1
fi

# Parse command
case "$1" in
    "list")
        list_backups
        ;;
    "verify")
        verify_backup
        ;;
    "backup")
        manual_backup
        ;;
    "clean")
        clean_old_backups
        ;;
    *)
        echo "Invalid command. Use: list, verify, backup, or clean"
        exit 1
        ;;
esac 