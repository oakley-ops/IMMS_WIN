# Database Backup System Setup Script
# Run this once to set up automated backups

param(
    [string]$BackupDir = "C:\DatabaseBackups",
    [string]$TaskName = "FiservInventory-DatabaseBackup",
    [string]$BackupTime = "02:00",  # 2 AM daily
    [string]$ScriptPath = ""
)

# Auto-detect script path if not provided
if (-not $ScriptPath) {
    $ScriptPath = Join-Path $PSScriptRoot "backup-database.ps1"
}

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "$timestamp - $Message"
}

try {
    Write-Log "Setting up Database Backup System..."
    
    # Create backup directory
    if (!(Test-Path -Path $BackupDir)) {
        New-Item -ItemType Directory -Path $BackupDir -Force
        Write-Log "Created backup directory: $BackupDir"
    } else {
        Write-Log "Backup directory already exists: $BackupDir"
    }
    
    # Set up environment variable for PostgreSQL password
    Write-Log "Setting up PostgreSQL password environment variable..."
    Write-Host "Please enter your PostgreSQL password (it will be stored as an environment variable):"
    $securePassword = Read-Host -AsSecureString
    $password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))
    
    # Set system environment variable
    [Environment]::SetEnvironmentVariable("PGPASSWORD", $password, "Machine")
    Write-Log "PostgreSQL password environment variable set"
    
    # Create Windows Scheduled Task
    Write-Log "Creating Windows Scheduled Task..."
    
    # Remove existing task if it exists
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    } catch {
        # Task doesn't exist, continue
    }
    
    # Create new task
    $action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"$ScriptPath`""
    $trigger = New-ScheduledTaskTrigger -Daily -At $BackupTime
    $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 2) -RestartCount 3
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Daily backup of IMMS Inventory database"
    
    Write-Log "Scheduled task '$TaskName' created successfully"
    Write-Log "Task will run daily at $BackupTime"
    
    # Test the backup script
    Write-Log "Testing backup script..."
    $testResult = & PowerShell.exe -ExecutionPolicy Bypass -File $ScriptPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Backup script test completed successfully"
    } else {
        Write-Log "WARNING: Backup script test failed. Please check the configuration."
    }
    
    # Create desktop shortcut for manual backup
    $shortcutPath = "$env:USERPROFILE\Desktop\Manual Database Backup.lnk"
    $WScriptShell = New-Object -ComObject WScript.Shell
    $shortcut = $WScriptShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = "PowerShell.exe"
    $shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$ScriptPath`""
    $shortcut.WorkingDirectory = $PSScriptRoot
    $shortcut.Description = "Run manual database backup"
    $shortcut.Save()
    
    Write-Log "Desktop shortcut created: $shortcutPath"
    
    # Display summary
    Write-Log ""
    Write-Log "=== BACKUP SYSTEM SETUP COMPLETE ==="
    Write-Log "Backup Directory: $BackupDir"
    Write-Log "Scheduled Task: $TaskName (runs daily at $BackupTime)"
    Write-Log "Script Location: $ScriptPath"
    Write-Log "Desktop Shortcut: $shortcutPath"
    Write-Log ""
    Write-Log "Next Steps:"
    Write-Log "1. Verify the scheduled task in Task Scheduler"
    Write-Log "2. Test restore procedure with restore-database.ps1"
    Write-Log "3. Set up offsite backup storage (cloud/external drive)"
    Write-Log "4. Monitor backup logs regularly"
    
} catch {
    Write-Log "ERROR: $($_.Exception.Message)"
    exit 1
}

Write-Log "Setup completed successfully!" 