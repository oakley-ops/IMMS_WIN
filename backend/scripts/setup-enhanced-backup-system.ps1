# Enhanced Backup System Setup
# Sets up the complete backup system with monitoring, testing, and alerts

param(
    [string]$BackupDir = "C:\DatabaseBackups",
    [string]$DatabaseName = "fiservinventory",
    [bool]$EnableCloudSync = $true,
    [bool]$EnableEmailAlerts = $false,
    [string]$EmailTo = "",
    [string]$EmailFrom = "",
    [string]$SMTPServer = "",
    [string]$SMTPUsername = "",
    [string]$SMTPPassword = ""
)

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    if ($Level -eq "ERROR") {
        Write-Host "$timestamp [$Level] - $Message" -ForegroundColor Red
    } elseif ($Level -eq "WARN") {
        Write-Host "$timestamp [$Level] - $Message" -ForegroundColor Yellow
    } else {
        Write-Host "$timestamp [$Level] - $Message" -ForegroundColor Green
    }
}

function Test-Prerequisites {
    Write-Log "Checking prerequisites..."
    
    $allPrereqsMet = $true
    
    # Check if PostgreSQL is installed
    if (-not (Get-Command "pg_dump" -ErrorAction SilentlyContinue)) {
        Write-Log "ERROR: PostgreSQL not found in PATH. Please install PostgreSQL." "ERROR"
        $allPrereqsMet = $false
    } else {
        Write-Log "PostgreSQL found"
    }
    
    # Check if running as administrator
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
    if (-not $isAdmin) {
        Write-Log "ERROR: Please run this script as Administrator" "ERROR"
        $allPrereqsMet = $false
    } else {
        Write-Log "Running as Administrator"
    }
    
    return $allPrereqsMet
}

function Setup-BackupDirectories {
    Write-Log "Setting up backup directories..."
    
    $directories = @(
        $BackupDir,
        "$BackupDir\Archive",
        "$BackupDir\CloudSync",
        "$BackupDir\Logs"
    )
    
    foreach ($dir in $directories) {
        if (!(Test-Path -Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Log "Created directory: $dir"
        } else {
            Write-Log "Directory exists: $dir"
        }
    }
}

function Setup-ScheduledTasks {
    Write-Log "Setting up scheduled tasks..."
    
    $scriptDir = $PSScriptRoot
    
    # Main backup task (daily at 2 AM)
    $backupTaskName = "IMMSInventory-DatabaseBackup"
    $backupAction = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptDir\backup-database.ps1`""
    $backupTrigger = New-ScheduledTaskTrigger -Daily -At "02:00"
    $backupSettings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 2) -RestartCount 3
    $backupPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    
    try {
        Unregister-ScheduledTask -TaskName $backupTaskName -Confirm:$false -ErrorAction SilentlyContinue
    } catch {}
    
    Register-ScheduledTask -TaskName $backupTaskName -Action $backupAction -Trigger $backupTrigger -Settings $backupSettings -Principal $backupPrincipal -Description "Daily backup of IMMS Inventory database" | Out-Null
    Write-Log "Created scheduled task: $backupTaskName"
    
    # Health check task (daily at 8 AM)
    $healthTaskName = "IMMSInventory-BackupHealthCheck"
    $healthAction = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptDir\backup-health-check.ps1`""
    $healthTrigger = New-ScheduledTaskTrigger -Daily -At "08:00"
    $healthSettings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 1) -RestartCount 2
    $healthPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    
    try {
        Unregister-ScheduledTask -TaskName $healthTaskName -Confirm:$false -ErrorAction SilentlyContinue
    } catch {}
    
    Register-ScheduledTask -TaskName $healthTaskName -Action $healthAction -Trigger $healthTrigger -Settings $healthSettings -Principal $healthPrincipal -Description "Daily health check of backup system" | Out-Null
    Write-Log "Created scheduled task: $healthTaskName"
    
    # Alert system task (every 4 hours)
    $alertTaskName = "IMMSInventory-BackupAlerts"
    $alertAction = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptDir\backup-alert-system.ps1`""
    $alertTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 4) -RepetitionDuration (New-TimeSpan -Days 365)
    $alertSettings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -RestartCount 2
    $alertPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    
    try {
        Unregister-ScheduledTask -TaskName $alertTaskName -Confirm:$false -ErrorAction SilentlyContinue
    } catch {}
    
    Register-ScheduledTask -TaskName $alertTaskName -Action $alertAction -Trigger $alertTrigger -Settings $alertSettings -Principal $alertPrincipal -Description "Backup system alert monitoring" | Out-Null
    Write-Log "Created scheduled task: $alertTaskName"
    
    if ($EnableCloudSync) {
        # Cloud sync task (daily at 3 AM)
        $cloudTaskName = "IMMSInventory-CloudSync"
        $cloudAction = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptDir\cloud-sync-backup.ps1`""
        $cloudTrigger = New-ScheduledTaskTrigger -Daily -At "03:00"
        $cloudSettings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 2) -RestartCount 3
        $cloudPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        
        try {
            Unregister-ScheduledTask -TaskName $cloudTaskName -Confirm:$false -ErrorAction SilentlyContinue
        } catch {}
        
        Register-ScheduledTask -TaskName $cloudTaskName -Action $cloudAction -Trigger $cloudTrigger -Settings $cloudSettings -Principal $cloudPrincipal -Description "Daily cloud backup synchronization" | Out-Null
        Write-Log "Created scheduled task: $cloudTaskName"
    }
}

function Setup-Environment {
    Write-Log "Setting up environment..."
    
    # Set PostgreSQL password
    Write-Host "Please enter your PostgreSQL password (it will be stored as an environment variable):"
    $securePassword = Read-Host -AsSecureString
    $password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))
    
    [Environment]::SetEnvironmentVariable("PGPASSWORD", $password, "Machine")
    Write-Log "PostgreSQL password environment variable set"
    
    # Configure email settings if provided
    if ($EnableEmailAlerts -and -not [string]::IsNullOrEmpty($EmailTo)) {
        [Environment]::SetEnvironmentVariable("BACKUP_EMAIL_TO", $EmailTo, "Machine")
        [Environment]::SetEnvironmentVariable("BACKUP_EMAIL_FROM", $EmailFrom, "Machine")
        [Environment]::SetEnvironmentVariable("BACKUP_SMTP_SERVER", $SMTPServer, "Machine")
        [Environment]::SetEnvironmentVariable("BACKUP_SMTP_USERNAME", $SMTPUsername, "Machine")
        [Environment]::SetEnvironmentVariable("BACKUP_SMTP_PASSWORD", $SMTPPassword, "Machine")
        Write-Log "Email alert configuration saved"
    }
}

function Create-ShortcutsAndUtilities {
    Write-Log "Creating shortcuts and utilities..."
    
    $desktopPath = "$env:USERPROFILE\Desktop"
    $scriptDir = $PSScriptRoot
    
    try {
        # Manual backup shortcut (batch file)
        $manualBackupPath = "$desktopPath\Manual Database Backup.bat"
        $manualBackupContent = @"
@echo off
title Manual Database Backup
echo Starting manual database backup...
powershell -ExecutionPolicy Bypass -File "$scriptDir\backup-database.ps1"
pause
"@
        $manualBackupContent | Out-File -FilePath $manualBackupPath -Encoding ASCII
        Write-Log "Created desktop shortcut: Manual Database Backup.bat"
        
        # Health check shortcut (batch file)
        $healthCheckPath = "$desktopPath\Backup Health Check.bat"
        $healthCheckContent = @"
@echo off
title Backup Health Check
echo Running backup system health check...
powershell -ExecutionPolicy Bypass -File "$scriptDir\backup-health-check.ps1"
pause
"@
        $healthCheckContent | Out-File -FilePath $healthCheckPath -Encoding ASCII
        Write-Log "Created desktop shortcut: Backup Health Check.bat"
        
        # Disaster recovery shortcut (batch file)
        $disasterRecoveryPath = "$desktopPath\Disaster Recovery.bat"
        $disasterRecoveryContent = @"
@echo off
title Disaster Recovery
echo Launching disaster recovery tool...
powershell -ExecutionPolicy Bypass -File "$scriptDir\disaster-recovery.ps1"
pause
"@
        $disasterRecoveryContent | Out-File -FilePath $disasterRecoveryPath -Encoding ASCII
        Write-Log "Created desktop shortcut: Disaster Recovery.bat"
    } catch {
        Write-Log "WARN: Could not create desktop shortcuts: $($_.Exception.Message)" "WARN"
    }
    
    # Create quick access batch file
    $quickAccessBat = "$scriptDir\backup-control-panel.bat"
    $batContent = @"
@echo off
title IMMS Inventory Backup Control Panel
echo.
echo ===================================
echo   Backup Control Panel
echo ===================================
echo.
echo 1. Run Manual Backup
echo 2. Health Check
echo 3. View Recent Logs
echo 4. Disaster Recovery
echo 5. Cloud Sync
echo 6. View Backup Files
echo 7. Exit
echo.
set /p choice="Enter your choice (1-7): "

if "%choice%"=="1" powershell -ExecutionPolicy Bypass -File "%~dp0backup-database.ps1"
if "%choice%"=="2" powershell -ExecutionPolicy Bypass -File "%~dp0backup-health-check.ps1"
if "%choice%"=="3" type "$BackupDir\backup.log" | more
if "%choice%"=="4" powershell -ExecutionPolicy Bypass -File "%~dp0disaster-recovery.ps1"
if "%choice%"=="5" powershell -ExecutionPolicy Bypass -File "%~dp0cloud-sync-backup.ps1"
if "%choice%"=="6" explorer "$BackupDir"
if "%choice%"=="7" exit

pause
goto start
"@
    
    $batContent | Out-File -FilePath $quickAccessBat -Encoding ASCII
    Write-Log "Created backup control panel: $quickAccessBat"
}

function Test-BackupSystem {
    Write-Log "Testing backup system..."
    
    try {
        # Run a test backup
        Write-Log "Running test backup..."
        $testResult = & PowerShell.exe -ExecutionPolicy Bypass -File "$PSScriptRoot\backup-database.ps1" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Test backup completed successfully"
            
            # Run health check
            Write-Log "Running health check..."
            $healthResult = & PowerShell.exe -ExecutionPolicy Bypass -File "$PSScriptRoot\backup-health-check.ps1" 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Log "Health check passed"
                return $true
            } else {
                Write-Log "WARN: Health check failed" "WARN"
                return $false
            }
        } else {
            Write-Log "ERROR: Test backup failed" "ERROR"
            return $false
        }
    } catch {
        Write-Log "ERROR: Test execution failed: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Generate-SetupReport {
    $report = @"

===============================================
    ENHANCED BACKUP SYSTEM SETUP COMPLETE
===============================================

Backup Directory: $BackupDir
Database: $DatabaseName
Cloud Sync: $(if ($EnableCloudSync) { "Enabled" } else { "Disabled" })
Email Alerts: $(if ($EnableEmailAlerts) { "Enabled" } else { "Disabled" })

SCHEDULED TASKS:
- Database Backup: Daily at 2:00 AM
- Health Check: Daily at 8:00 AM  
- Alert System: Every 4 hours
$(if ($EnableCloudSync) { "- Cloud Sync: Daily at 3:00 AM" })

DESKTOP SHORTCUTS:
- Manual Database Backup
- Backup Health Check
- Disaster Recovery

CONTROL PANEL:
$PSScriptRoot\backup-control-panel.bat

NEXT STEPS:
1. Test restore procedure using restore-database.ps1
2. Set up cloud storage (Google Drive, OneDrive, or AWS S3)
3. Configure email alerts (if not done)
4. Review and customize retention policies
5. Train staff on disaster recovery procedures

MONITORING:
- Check backup logs daily: $BackupDir\backup.log
- Monitor disk space usage
- Verify cloud sync status
- Test restore monthly

===============================================
        Your data is now fully protected!
===============================================

"@
    
    Write-Host $report -ForegroundColor Green
    
    # Save report to file
    $report | Out-File -FilePath "$BackupDir\setup-report.txt" -Encoding UTF8
    Write-Log "Setup report saved to: $BackupDir\setup-report.txt"
}

# Main execution
try {
    Write-Log "=== ENHANCED BACKUP SYSTEM SETUP STARTED ==="
    
    if (-not (Test-Prerequisites)) {
        Write-Log "ERROR: Prerequisites not met. Please resolve issues and try again." "ERROR"
        exit 1
    }
    
    Setup-BackupDirectories
    Setup-Environment
    Setup-ScheduledTasks
    Create-ShortcutsAndUtilities
    
    if (Test-BackupSystem) {
        Write-Log "Backup system test completed successfully"
    } else {
        Write-Log "WARN: Backup system test had issues, but setup is complete" "WARN"
    }
    
    Generate-SetupReport
    
    Write-Log "=== ENHANCED BACKUP SYSTEM SETUP COMPLETED ==="
    
} catch {
    Write-Log "ERROR: Setup failed: $($_.Exception.Message)" "ERROR"
    exit 1
}
