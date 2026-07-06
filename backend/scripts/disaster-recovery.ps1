# Disaster Recovery Script for IMMS Inventory Database
# Handles various disaster recovery scenarios with guided recovery

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("DatabaseCorruption", "SystemFailure", "DataLoss", "PointInTimeRecovery", "FullSystemRestore")]
    [string]$RecoveryScenario,
    
    [string]$BackupFile = "",
    [string]$TargetDate = "",
    [string]$BackupDir = "C:\DatabaseBackups",
    [string]$DatabaseName = "fiservinventory",
    [string]$RecoveryDatabaseName = "fiservinventory_recovery",
    [bool]$InteractiveMode = $true,
    [string]$LogFile = "C:\DatabaseBackups\disaster-recovery.log"
)

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp [$Level] - $Message" | Out-File -FilePath $LogFile -Append
    
    if ($Level -eq "ERROR") {
        Write-Host "$timestamp [$Level] - $Message" -ForegroundColor Red
    } elseif ($Level -eq "WARN") {
        Write-Host "$timestamp [$Level] - $Message" -ForegroundColor Yellow
    } else {
        Write-Host "$timestamp [$Level] - $Message" -ForegroundColor Green
    }
}

function Get-UserConfirmation {
    param([string]$Message)
    
    if (-not $InteractiveMode) {
        return $true
    }
    
    do {
        $response = Read-Host "$Message (y/n)"
    } while ($response -notin @('y', 'yes', 'n', 'no'))
    
    return $response -in @('y', 'yes')
}

function Find-BackupByDate {
    param([string]$TargetDate)
    
    Write-Log "Searching for backup closest to: $TargetDate"
    
    $targetDateTime = [DateTime]::Parse($TargetDate)
    
    $backups = Get-ChildItem -Path $BackupDir -Filter "${DatabaseName}_backup_*.custom" |
        ForEach-Object {
            if ($_.Name -match "${DatabaseName}_backup_(\d{8})_(\d{6})\.custom") {
                $dateStr = $matches[1]
                $timeStr = $matches[2]
                $backupDateTime = [DateTime]::ParseExact("$dateStr $timeStr", "yyyyMMdd HHmmss", $null)
                
                [PSCustomObject]@{
                    File = $_
                    DateTime = $backupDateTime
                    Difference = [Math]::Abs(($targetDateTime - $backupDateTime).TotalSeconds)
                }
            }
        } |
        Sort-Object Difference |
        Select-Object -First 1
    
    if ($backups) {
        Write-Log "Found closest backup: $($backups.File.Name) (taken at $($backups.DateTime))"
        return $backups.File.FullName
    } else {
        Write-Log "ERROR: No suitable backup found for date $TargetDate" "ERROR"
        return $null
    }
}

function Test-DatabaseConnection {
    param([string]$TestDatabaseName = $DatabaseName)
    
    try {
        $result = & "psql" -U postgres -d $TestDatabaseName -c "SELECT 1;" 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Backup-CurrentDatabase {
    param([string]$EmergencyBackupName)
    
    Write-Log "Creating emergency backup of current database state..."
    
    try {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $emergencyBackupFile = "$BackupDir\${DatabaseName}_emergency_${EmergencyBackupName}_$timestamp.custom"
        
        & "pg_dump" --host=localhost --port=5432 --username=postgres --format=custom --verbose --file=$emergencyBackupFile --dbname=$DatabaseName 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Emergency backup created: $emergencyBackupFile"
            return $emergencyBackupFile
        } else {
            Write-Log "ERROR: Failed to create emergency backup" "ERROR"
            return $null
        }
    } catch {
        Write-Log "ERROR: Exception during emergency backup: $($_.Exception.Message)" "ERROR"
        return $null
    }
}

function Stop-Application {
    Write-Log "Stopping application services..."
    
    # Stop application processes that might be using the database
    $processNames = @("node", "npm", "pm2")
    
    foreach ($processName in $processNames) {
        $processes = Get-Process -Name $processName -ErrorAction SilentlyContinue
        if ($processes) {
            Write-Log "Stopping $($processes.Count) $processName process(es)..."
            $processes | Stop-Process -Force
        }
    }
    
    # Wait for connections to close
    Start-Sleep -Seconds 5
    Write-Log "Application services stopped"
}

function Start-Application {
    Write-Log "Starting application services..."
    
    # Navigate to application directory and start
    $appDir = Split-Path $PSScriptRoot -Parent
    $backendDir = Join-Path $appDir "backend"
    
    if (Test-Path $backendDir) {
        Set-Location $backendDir
        Start-Process "npm" -ArgumentList "start" -NoNewWindow
        Write-Log "Application services started"
    } else {
        Write-Log "WARN: Could not locate application directory for restart" "WARN"
    }
}

function Recover-DatabaseCorruption {
    Write-Log "=== STARTING DATABASE CORRUPTION RECOVERY ==="
    
    if ($InteractiveMode) {
        Write-Host "`nDATABASE CORRUPTION RECOVERY"
        Write-Host "=============================="
        Write-Host "This will restore the database from the latest backup."
        Write-Host "All data since the last backup will be lost."
        Write-Host ""
    }
    
    if (-not (Get-UserConfirmation "Are you sure you want to proceed with corruption recovery?")) {
        Write-Log "Recovery cancelled by user"
        return $false
    }
    
    # Find latest backup
    if ([string]::IsNullOrEmpty($BackupFile)) {
        $latestBackup = Get-ChildItem -Path $BackupDir -Filter "${DatabaseName}_backup_*.custom" |
            Sort-Object CreationTime -Descending | Select-Object -First 1
        
        if (-not $latestBackup) {
            Write-Log "ERROR: No backup files found" "ERROR"
            return $false
        }
        
        $BackupFile = $latestBackup.FullName
    }
    
    Write-Log "Using backup file: $BackupFile"
    
    # Create emergency backup if database is accessible
    if (Test-DatabaseConnection) {
        $emergencyBackup = Backup-CurrentDatabase -EmergencyBackupName "corruption"
        if ($emergencyBackup) {
            Write-Log "Emergency backup created at: $emergencyBackup"
        }
    }
    
    # Stop application
    Stop-Application
    
    try {
        # Drop and recreate database
        Write-Log "Dropping corrupted database..."
        & "psql" -U postgres -d postgres -c "DROP DATABASE IF EXISTS $DatabaseName;" 2>&1
        
        Write-Log "Creating new database..."
        & "psql" -U postgres -d postgres -c "CREATE DATABASE $DatabaseName;" 2>&1
        
        # Restore from backup
        Write-Log "Restoring from backup..."
        & "pg_restore" --verbose --clean --no-acl --no-owner --dbname=$DatabaseName $BackupFile 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Database corruption recovery completed successfully"
            
            # Verify restoration
            if (Test-DatabaseConnection) {
                Write-Log "Database connection verified"
                Start-Application
                return $true
            } else {
                Write-Log "ERROR: Database connection failed after restoration" "ERROR"
                return $false
            }
        } else {
            Write-Log "ERROR: Database restoration failed" "ERROR"
            return $false
        }
        
    } catch {
        Write-Log "ERROR: Exception during corruption recovery: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Recover-SystemFailure {
    Write-Log "=== STARTING SYSTEM FAILURE RECOVERY ==="
    
    if ($InteractiveMode) {
        Write-Host "`nSYSTEM FAILURE RECOVERY"
        Write-Host "======================="
        Write-Host "This will set up the database on a new system."
        Write-Host "Ensure PostgreSQL is installed and running."
        Write-Host ""
    }
    
    # Check PostgreSQL installation
    if (-not (Get-Command "psql" -ErrorAction SilentlyContinue)) {
        Write-Log "ERROR: PostgreSQL not found. Please install PostgreSQL first." "ERROR"
        return $false
    }
    
    # Find latest backup
    if ([string]::IsNullOrEmpty($BackupFile)) {
        $latestBackup = Get-ChildItem -Path $BackupDir -Filter "${DatabaseName}_backup_*.custom" |
            Sort-Object CreationTime -Descending | Select-Object -First 1
        
        if (-not $latestBackup) {
            Write-Log "ERROR: No backup files found in $BackupDir" "ERROR"
            Write-Log "Please copy backup files from offsite storage first." "ERROR"
            return $false
        }
        
        $BackupFile = $latestBackup.FullName
    }
    
    Write-Log "Using backup file: $BackupFile"
    
    try {
        # Create database
        Write-Log "Creating database: $DatabaseName"
        & "psql" -U postgres -d postgres -c "CREATE DATABASE $DatabaseName;" 2>&1
        
        # Restore from backup
        Write-Log "Restoring from backup..."
        & "pg_restore" --verbose --clean --no-acl --no-owner --dbname=$DatabaseName $BackupFile 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "System failure recovery completed successfully"
            
            # Verify restoration
            if (Test-DatabaseConnection) {
                Write-Log "Database connection verified"
                return $true
            } else {
                Write-Log "ERROR: Database connection failed after restoration" "ERROR"
                return $false
            }
        } else {
            Write-Log "ERROR: Database restoration failed" "ERROR"
            return $false
        }
        
    } catch {
        Write-Log "ERROR: Exception during system failure recovery: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Recover-DataLoss {
    Write-Log "=== STARTING DATA LOSS RECOVERY ==="
    
    if ($InteractiveMode) {
        Write-Host "`nDATA LOSS RECOVERY"
        Write-Host "=================="
        Write-Host "This will restore data to a recovery database for inspection."
        Write-Host "You can then extract specific data and import it back."
        Write-Host ""
    }
    
    # Find appropriate backup
    if ([string]::IsNullOrEmpty($BackupFile)) {
        if (-not [string]::IsNullOrEmpty($TargetDate)) {
            $BackupFile = Find-BackupByDate -TargetDate $TargetDate
        } else {
            # Show available backups for user selection
            $backups = Get-ChildItem -Path $BackupDir -Filter "${DatabaseName}_backup_*.custom" |
                Sort-Object CreationTime -Descending | Select-Object -First 10
            
            if ($InteractiveMode -and $backups) {
                Write-Host "`nAvailable backups:"
                for ($i = 0; $i -lt $backups.Count; $i++) {
                    Write-Host "$($i + 1). $($backups[$i].Name) - $($backups[$i].CreationTime)"
                }
                
                do {
                    $selection = Read-Host "Select backup number (1-$($backups.Count))"
                } while (-not ($selection -match '^\d+$') -or [int]$selection -lt 1 -or [int]$selection -gt $backups.Count)
                
                $BackupFile = $backups[[int]$selection - 1].FullName
            } else {
                $BackupFile = $backups[0].FullName
            }
        }
    }
    
    if (-not $BackupFile) {
        Write-Log "ERROR: No backup file selected" "ERROR"
        return $false
    }
    
    Write-Log "Using backup file: $BackupFile"
    
    try {
        # Drop recovery database if exists
        & "psql" -U postgres -d postgres -c "DROP DATABASE IF EXISTS $RecoveryDatabaseName;" 2>&1
        
        # Create recovery database
        Write-Log "Creating recovery database: $RecoveryDatabaseName"
        & "psql" -U postgres -d postgres -c "CREATE DATABASE $RecoveryDatabaseName;" 2>&1
        
        # Restore to recovery database
        Write-Log "Restoring to recovery database..."
        & "pg_restore" --verbose --clean --no-acl --no-owner --dbname=$RecoveryDatabaseName $BackupFile 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Data loss recovery completed successfully"
            Write-Log "Recovery database '$RecoveryDatabaseName' is ready for data extraction"
            
            if ($InteractiveMode) {
                Write-Host "`nRECOVERY DATABASE READY"
                Write-Host "======================"
                Write-Host "Database: $RecoveryDatabaseName"
                Write-Host "You can now connect to this database and extract the needed data."
                Write-Host "Example commands:"
                Write-Host "  psql -U postgres -d $RecoveryDatabaseName"
                Write-Host "  pg_dump -t specific_table $RecoveryDatabaseName | psql -d $DatabaseName"
            }
            
            return $true
        } else {
            Write-Log "ERROR: Recovery database restoration failed" "ERROR"
            return $false
        }
        
    } catch {
        Write-Log "ERROR: Exception during data loss recovery: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Recover-PointInTime {
    Write-Log "=== STARTING POINT-IN-TIME RECOVERY ==="
    
    if ([string]::IsNullOrEmpty($TargetDate)) {
        if ($InteractiveMode) {
            $TargetDate = Read-Host "Enter target date/time (YYYY-MM-DD HH:MM:SS)"
        } else {
            Write-Log "ERROR: Target date required for point-in-time recovery" "ERROR"
            return $false
        }
    }
    
    $BackupFile = Find-BackupByDate -TargetDate $TargetDate
    if (-not $BackupFile) {
        return $false
    }
    
    # Use data loss recovery procedure
    return Recover-DataLoss
}

function Recover-FullSystem {
    Write-Log "=== STARTING FULL SYSTEM RESTORE ==="
    
    # Combine system failure and application restart
    $result = Recover-SystemFailure
    
    if ($result) {
        Start-Application
        Write-Log "Full system restore completed successfully"
    }
    
    return $result
}

# Main execution
try {
    Write-Log "=== DISASTER RECOVERY STARTED: $RecoveryScenario ==="
    
    $recoveryResult = $false
    
    switch ($RecoveryScenario) {
        "DatabaseCorruption" { $recoveryResult = Recover-DatabaseCorruption }
        "SystemFailure" { $recoveryResult = Recover-SystemFailure }
        "DataLoss" { $recoveryResult = Recover-DataLoss }
        "PointInTimeRecovery" { $recoveryResult = Recover-PointInTime }
        "FullSystemRestore" { $recoveryResult = Recover-FullSystem }
    }
    
    if ($recoveryResult) {
        Write-Log "=== DISASTER RECOVERY COMPLETED SUCCESSFULLY ==="
        exit 0
    } else {
        Write-Log "=== DISASTER RECOVERY FAILED ===" "ERROR"
        exit 1
    }
    
} catch {
    Write-Log "ERROR: Disaster recovery script failed: $($_.Exception.Message)" "ERROR"
    exit 1
}
