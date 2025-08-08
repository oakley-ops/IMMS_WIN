# PostgreSQL Database Backup Script
# Run this script daily via Windows Task Scheduler

param(
    [string]$BackupDir = "C:\DatabaseBackups",
    [string]$DatabaseName = "fiservinventory",
    [string]$Username = "postgres",
    [int]$RetentionDays = 30,
    [string]$LogFile = "C:\DatabaseBackups\backup.log"
)

# Create backup directory if it doesn't exist
if (!(Test-Path -Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force
}

# Function to write to log file
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -FilePath $LogFile -Append
    Write-Host "$timestamp - $Message"
}

try {
    Write-Log "Starting database backup for $DatabaseName"
    
    # Generate backup filename with timestamp
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = "$BackupDir\${DatabaseName}_backup_$timestamp.sql"
    $compressedFile = "$BackupDir\${DatabaseName}_backup_$timestamp.sql.gz"
    
    # Set PostgreSQL password (you should set PGPASSWORD environment variable)
    # $env:PGPASSWORD = "your_password_here"
    
    # Perform the backup
    Write-Log "Creating backup: $backupFile"
    
    $pgDumpArgs = @(
        "--host=localhost",
        "--port=5432",
        "--username=$Username",
        "--format=custom",
        "--verbose",
        "--file=$backupFile.custom",
        "--dbname=$DatabaseName"
    )
    
    # Run pg_dump
    & "pg_dump" @pgDumpArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Backup completed successfully"
        
        # Also create a plain SQL backup for easy viewing
        $pgDumpSqlArgs = @(
            "--host=localhost",
            "--port=5432", 
            "--username=$Username",
            "--format=plain",
            "--file=$backupFile",
            "--dbname=$DatabaseName"
        )
        
        & "pg_dump" @pgDumpSqlArgs
        
        # Compress the SQL file
        if (Get-Command "gzip" -ErrorAction SilentlyContinue) {
            gzip $backupFile
            Write-Log "Backup compressed to $compressedFile"
        }
        
        # Clean up old backups
        Write-Log "Cleaning up backups older than $RetentionDays days"
        $cutoffDate = (Get-Date).AddDays(-$RetentionDays)
        Get-ChildItem -Path $BackupDir -Filter "${DatabaseName}_backup_*.sql*" | 
            Where-Object { $_.CreationTime -lt $cutoffDate } | 
            Remove-Item -Force
        
        Get-ChildItem -Path $BackupDir -Filter "${DatabaseName}_backup_*.custom" | 
            Where-Object { $_.CreationTime -lt $cutoffDate } | 
            Remove-Item -Force
            
        Write-Log "Backup process completed successfully"
        
        # Verify backup integrity
        Write-Log "Verifying backup integrity..."
        $verifyArgs = @(
            "--list",
            "$backupFile.custom"
        )
        
        $verifyOutput = & "pg_restore" @verifyArgs 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Backup integrity verified successfully"
        } else {
            Write-Log "WARNING: Backup integrity check failed: $verifyOutput"
        }
        
    } else {
        Write-Log "ERROR: Backup failed with exit code $LASTEXITCODE"
        exit 1
    }
    
} catch {
    Write-Log "ERROR: $($_.Exception.Message)"
    exit 1
}

Write-Log "Backup script completed" 