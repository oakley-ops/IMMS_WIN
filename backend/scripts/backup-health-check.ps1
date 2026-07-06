# Database Backup Health Check Script
# Run this weekly to verify backup system health

param(
    [string]$BackupDir = "C:\DatabaseBackups",
    [string]$DatabaseName = "fiservinventory",
    [string]$TestDatabaseName = "fiservinventory_backup_test",
    [int]$MaxBackupAgeDays = 2,
    [string]$LogFile = "C:\DatabaseBackups\health-check.log"
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

function Test-BackupAge {
    Write-Log "Testing backup age..."
    
    $latestBackup = Get-ChildItem -Path $BackupDir -Filter "${DatabaseName}_backup_*.custom" |
        Sort-Object CreationTime -Descending | Select-Object -First 1
    
    if (-not $latestBackup) {
        Write-Log "ERROR: No backup files found!" "ERROR"
        return $false
    }
    
    $backupAge = (Get-Date) - $latestBackup.CreationTime
    
    if ($backupAge.TotalDays -gt $MaxBackupAgeDays) {
        Write-Log "ERROR: Latest backup is $($backupAge.TotalDays.ToString('F1')) days old (maximum: $MaxBackupAgeDays days)" "ERROR"
        return $false
    }
    
    Write-Log "Latest backup: $($latestBackup.Name) (age: $($backupAge.TotalHours.ToString('F1')) hours)"
    return $true
}

function Test-BackupSize {
    Write-Log "Testing backup size..."
    
    $backups = Get-ChildItem -Path $BackupDir -Filter "${DatabaseName}_backup_*.custom" |
        Sort-Object CreationTime -Descending | Select-Object -First 5
    
    if ($backups.Count -lt 2) {
        Write-Log "WARN: Less than 2 backups available for size comparison" "WARN"
        return $true
    }
    
    $latestSize = $backups[0].Length
    $previousSize = $backups[1].Length
    
    # Check if backup size decreased by more than 50%
    if ($latestSize -lt ($previousSize * 0.5)) {
        Write-Log "ERROR: Latest backup size ($([math]::Round($latestSize/1MB, 2)) MB) is significantly smaller than previous ($([math]::Round($previousSize/1MB, 2)) MB)" "ERROR"
        return $false
    }
    
    # Check if backup is suspiciously small (less than 1MB)
    if ($latestSize -lt 1MB) {
        Write-Log "ERROR: Latest backup size is suspiciously small ($([math]::Round($latestSize/1KB, 2)) KB)" "ERROR"
        return $false
    }
    
    Write-Log "Latest backup size: $([math]::Round($latestSize/1MB, 2)) MB"
    return $true
}

function Test-BackupIntegrity {
    Write-Log "Testing backup integrity..."
    
    $latestBackup = Get-ChildItem -Path $BackupDir -Filter "${DatabaseName}_backup_*.custom" |
        Sort-Object CreationTime -Descending | Select-Object -First 1
    
    if (-not $latestBackup) {
        Write-Log "ERROR: No backup file found for integrity test" "ERROR"
        return $false
    }
    
    try {
        $verifyOutput = & "pg_restore" --list $latestBackup.FullName 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $tableCount = ($verifyOutput | Where-Object { $_ -match "TABLE DATA" }).Count
            Write-Log "Backup integrity verified: $tableCount tables found"
            return $true
        } else {
            Write-Log "ERROR: Backup integrity check failed: $verifyOutput" "ERROR"
            return $false
        }
    } catch {
        Write-Log "ERROR: Failed to run integrity check: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Test-RestoreCapability {
    Write-Log "Testing restore capability (to test database)..."
    
    $latestBackup = Get-ChildItem -Path $BackupDir -Filter "${DatabaseName}_backup_*.custom" |
        Sort-Object CreationTime -Descending | Select-Object -First 1
    
    if (-not $latestBackup) {
        Write-Log "ERROR: No backup file found for restore test" "ERROR"
        return $false
    }
    
    try {
        # Drop test database if exists
        & "psql" -U postgres -d postgres -c "DROP DATABASE IF EXISTS $TestDatabaseName;" 2>$null
        
        # Create test database
        & "psql" -U postgres -d postgres -c "CREATE DATABASE $TestDatabaseName;" 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            Write-Log "ERROR: Failed to create test database" "ERROR"
            return $false
        }
        
        # Restore backup to test database
        & "pg_restore" --verbose --clean --no-acl --no-owner --dbname=$TestDatabaseName $latestBackup.FullName 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            # Verify tables exist
            $tableCount = & "psql" -U postgres -d $TestDatabaseName -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>&1
            
            Write-Log "Restore test successful: $($tableCount.Trim()) tables restored"
            
            # Clean up test database
            & "psql" -U postgres -d postgres -c "DROP DATABASE $TestDatabaseName;" 2>$null
            return $true
        } else {
            Write-Log "ERROR: Restore test failed" "ERROR"
            return $false
        }
    } catch {
        Write-Log "ERROR: Restore test exception: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Test-DiskSpace {
    Write-Log "Testing disk space..."
    
    $drive = (Get-Item $BackupDir).PSDrive
    $freeSpace = $drive.Free
    $totalSpace = $drive.Used + $drive.Free
    $freeSpaceGB = [math]::Round($freeSpace / 1GB, 2)
    $usedPercent = [math]::Round(($drive.Used / $totalSpace) * 100, 1)
    
    Write-Log "Disk space: $freeSpaceGB GB free ($usedPercent% used)"
    
    # Warning if less than 5GB free
    if ($freeSpace -lt 5GB) {
        Write-Log "WARN: Low disk space ($freeSpaceGB GB remaining)" "WARN"
        return $false
    }
    
    # Error if less than 1GB free
    if ($freeSpace -lt 1GB) {
        Write-Log "ERROR: Critical disk space ($freeSpaceGB GB remaining)" "ERROR"
        return $false
    }
    
    return $true
}

function Test-ScheduledTask {
    Write-Log "Testing scheduled task..."
    
    try {
        $task = Get-ScheduledTask -TaskName "IMMSInventory-DatabaseBackup" -ErrorAction Stop
        
        if ($task.State -eq "Ready") {
            Write-Log "Scheduled task is active and ready"
            
            # Check last run time
            $taskInfo = Get-ScheduledTaskInfo -TaskName "IMMSInventory-DatabaseBackup"
            if ($taskInfo.LastRunTime) {
                $lastRun = (Get-Date) - $taskInfo.LastRunTime
                Write-Log "Last run: $($taskInfo.LastRunTime) ($($lastRun.TotalHours.ToString('F1')) hours ago)"
                
                if ($lastRun.TotalDays -gt 2) {
                    Write-Log "WARN: Scheduled task hasn't run in $($lastRun.TotalDays.ToString('F1')) days" "WARN"
                    return $false
                }
            }
            
            return $true
        } else {
            Write-Log "ERROR: Scheduled task is not ready (State: $($task.State))" "ERROR"
            return $false
        }
    } catch {
        Write-Log "ERROR: Scheduled task not found or inaccessible" "ERROR"
        return $false
    }
}

# Main health check execution
try {
    Write-Log "=== DATABASE BACKUP HEALTH CHECK STARTED ==="
    
    $allTestsPassed = $true
    
    # Run all tests
    $allTestsPassed = (Test-BackupAge) -and $allTestsPassed
    $allTestsPassed = (Test-BackupSize) -and $allTestsPassed
    $allTestsPassed = (Test-BackupIntegrity) -and $allTestsPassed
    $allTestsPassed = (Test-RestoreCapability) -and $allTestsPassed
    $allTestsPassed = (Test-DiskSpace) -and $allTestsPassed
    $allTestsPassed = (Test-ScheduledTask) -and $allTestsPassed
    
    if ($allTestsPassed) {
        Write-Log "=== HEALTH CHECK PASSED: All tests successful ==="
        exit 0
    } else {
        Write-Log "=== HEALTH CHECK FAILED: Some tests failed ===" "ERROR"
        exit 1
    }
    
} catch {
    Write-Log "ERROR: Health check script failed: $($_.Exception.Message)" "ERROR"
    exit 1
}
