# PostgreSQL Database Restore Script
# Use this script to restore from backup files

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [string]$DatabaseName = "fiservinventory",
    [string]$Username = "postgres",
    [string]$NewDatabaseName = "",
    [switch]$DropExisting = $false,
    [string]$LogFile = "C:\DatabaseBackups\restore.log"
)

# Function to write to log file
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -FilePath $LogFile -Append
    Write-Host "$timestamp - $Message"
}

# Validate backup file exists
if (!(Test-Path -Path $BackupFile)) {
    Write-Log "ERROR: Backup file not found: $BackupFile"
    exit 1
}

# Determine target database name
$targetDb = if ($NewDatabaseName) { $NewDatabaseName } else { $DatabaseName }

try {
    Write-Log "Starting database restore from: $BackupFile"
    Write-Log "Target database: $targetDb"
    
    # Set PostgreSQL password (you should set PGPASSWORD environment variable)
    # $env:PGPASSWORD = "your_password_here"
    
    # Check if it's a custom format backup or SQL
    $fileExtension = [System.IO.Path]::GetExtension($BackupFile)
    
    if ($fileExtension -eq ".custom") {
        # Custom format restore using pg_restore
        Write-Log "Restoring from custom format backup..."
        
        # Drop existing database if requested
        if ($DropExisting) {
            Write-Log "Dropping existing database: $targetDb"
            $dropArgs = @(
                "--host=localhost",
                "--port=5432",
                "--username=$Username",
                "--command=DROP DATABASE IF EXISTS $targetDb;"
            )
            & "psql" @dropArgs
        }
        
        # Create new database
        Write-Log "Creating database: $targetDb"
        $createArgs = @(
            "--host=localhost",
            "--port=5432",
            "--username=$Username",
            "--command=CREATE DATABASE $targetDb;"
        )
        & "psql" @createArgs
        
        # Restore from custom backup
        $restoreArgs = @(
            "--host=localhost",
            "--port=5432",
            "--username=$Username",
            "--dbname=$targetDb",
            "--verbose",
            "--clean",
            "--if-exists",
            $BackupFile
        )
        
        & "pg_restore" @restoreArgs
        
    } else {
        # SQL format restore using psql
        Write-Log "Restoring from SQL format backup..."
        
        # Handle compressed files
        if ($fileExtension -eq ".gz") {
            Write-Log "Decompressing backup file..."
            $decompressedFile = $BackupFile -replace "\.gz$", ""
            
            if (Get-Command "gzip" -ErrorAction SilentlyContinue) {
                & "gzip" "-d" $BackupFile
                $BackupFile = $decompressedFile
            } else {
                Write-Log "ERROR: gzip not found. Cannot decompress file."
                exit 1
            }
        }
        
        # Drop existing database if requested
        if ($DropExisting) {
            Write-Log "Dropping existing database: $targetDb"
            $dropArgs = @(
                "--host=localhost",
                "--port=5432",
                "--username=$Username",
                "--command=DROP DATABASE IF EXISTS $targetDb;"
            )
            & "psql" @dropArgs
        }
        
        # Create new database
        Write-Log "Creating database: $targetDb"
        $createArgs = @(
            "--host=localhost",
            "--port=5432",
            "--username=$Username",
            "--command=CREATE DATABASE $targetDb;"
        )
        & "psql" @createArgs
        
        # Restore from SQL backup
        $restoreArgs = @(
            "--host=localhost",
            "--port=5432",
            "--username=$Username",
            "--dbname=$targetDb",
            "--file=$BackupFile"
        )
        
        & "psql" @restoreArgs
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Database restore completed successfully"
        
        # Verify restore by checking table count
        Write-Log "Verifying restore..."
        $verifyArgs = @(
            "--host=localhost",
            "--port=5432",
            "--username=$Username",
            "--dbname=$targetDb",
            "--tuples-only",
            "--command=SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
        )
        
        $tableCount = & "psql" @verifyArgs
        Write-Log "Restored database contains $tableCount tables"
        
    } else {
        Write-Log "ERROR: Database restore failed with exit code $LASTEXITCODE"
        exit 1
    }
    
} catch {
    Write-Log "ERROR: $($_.Exception.Message)"
    exit 1
}

Write-Log "Database restore completed successfully" 