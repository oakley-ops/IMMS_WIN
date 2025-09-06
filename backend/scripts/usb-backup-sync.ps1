# USB Backup Synchronization Script
# Automatically detects USB drives and syncs backups

param(
    [string]$BackupDir = "C:\DatabaseBackups",
    [string]$DatabaseName = "fiservinventory",
    [string]$LogFile = "C:\DatabaseBackups\usb-sync.log",
    [int]$MaxBackupsToKeep = 7,
    [bool]$AutoDetectUSB = $true,
    [string]$PreferredUSBLabel = "",
    [string]$USBBackupFolder = "DatabaseBackups"
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

function Get-USBDrives {
    Write-Log "Detecting USB drives..."
    
    try {
        # Get all removable drives (USB drives)
        $usbDrives = Get-WmiObject -Class Win32_LogicalDisk | Where-Object {
            $_.DriveType -eq 2 -and  # Removable disk
            $_.DeviceID -ne $null -and
            $_.Size -gt 0
        }
        
        $validUSBs = @()
        
        foreach ($drive in $usbDrives) {
            $driveInfo = Get-Volume -DriveLetter $drive.DeviceID.Replace(":", "") -ErrorAction SilentlyContinue
            
            if ($driveInfo) {
                $usbInfo = [PSCustomObject]@{
                    DriveLetter = $drive.DeviceID
                    Label = $driveInfo.FileSystemLabel
                    SizeGB = [math]::Round($drive.Size / 1GB, 2)
                    FreeSpaceGB = [math]::Round($drive.FreeSpace / 1GB, 2)
                    FileSystem = $driveInfo.FileSystem
                    HealthStatus = $driveInfo.HealthStatus
                }
                
                $validUSBs += $usbInfo
                Write-Log "Found USB drive: $($usbInfo.DriveLetter) [$($usbInfo.Label)] - $($usbInfo.SizeGB)GB ($($usbInfo.FreeSpaceGB)GB free)"
            }
        }
        
        return $validUSBs
        
    } catch {
        Write-Log "ERROR: Failed to detect USB drives: $($_.Exception.Message)" "ERROR"
        return @()
    }
}

function Select-BestUSBDrive {
    param([array]$USBDrives)
    
    if ($USBDrives.Count -eq 0) {
        Write-Log "No USB drives detected" "WARN"
        return $null
    }
    
    # If preferred label is specified, try to find it
    if (-not [string]::IsNullOrEmpty($PreferredUSBLabel)) {
        $preferredDrive = $USBDrives | Where-Object { $_.Label -eq $PreferredUSBLabel }
        if ($preferredDrive) {
            Write-Log "Using preferred USB drive: $($preferredDrive.DriveLetter) [$($preferredDrive.Label)]"
            return $preferredDrive
        } else {
            Write-Log "Preferred USB drive '$PreferredUSBLabel' not found, selecting best available" "WARN"
        }
    }
    
    # Select drive with most free space and good health status
    $bestDrive = $USBDrives | 
        Where-Object { $_.HealthStatus -eq "Healthy" -and $_.FreeSpaceGB -gt 0.1 } |
        Sort-Object FreeSpaceGB -Descending | 
        Select-Object -First 1
    
    if ($bestDrive) {
        Write-Log "Selected USB drive: $($bestDrive.DriveLetter) [$($bestDrive.Label)] - $($bestDrive.FreeSpaceGB)GB free"
        return $bestDrive
    } else {
        Write-Log "No suitable USB drive found (need at least 100MB free space and healthy status)" "WARN"
        return $null
    }
}

function Test-USBSpace {
    param([object]$USBDrive, [long]$RequiredSpaceBytes)
    
    $requiredSpaceGB = [math]::Round($RequiredSpaceBytes / 1GB, 2)
    
    if ($USBDrive.FreeSpaceGB -lt $requiredSpaceGB) {
        Write-Log "ERROR: USB drive $($USBDrive.DriveLetter) has insufficient space. Required: $requiredSpaceGB GB, Available: $($USBDrive.FreeSpaceGB)GB" "ERROR"
        return $false
    }
    
    Write-Log "USB drive has sufficient space: $($USBDrive.FreeSpaceGB)GB available, $requiredSpaceGB GB required"
    return $true
}

function Copy-BackupsToUSB {
    param([object]$USBDrive)
    
    try {
        # Create backup folder on USB
        $usbBackupPath = "$($USBDrive.DriveLetter)\$USBBackupFolder"
        if (!(Test-Path -Path $usbBackupPath)) {
            New-Item -ItemType Directory -Path $usbBackupPath -Force | Out-Null
            Write-Log "Created backup folder on USB: $usbBackupPath"
        }
        
        # Get recent backup files (last 7 days or max specified)
        $backupFiles = Get-ChildItem -Path $BackupDir -Filter "${DatabaseName}_backup_*.custom" | 
            Where-Object { $_.CreationTime -gt (Get-Date).AddDays(-7) } |
            Sort-Object CreationTime -Descending |
            Select-Object -First $MaxBackupsToKeep
        
        if (-not $backupFiles) {
            Write-Log "No recent backup files found to copy" "WARN"
            return $false
        }
        
        $totalSize = ($backupFiles | Measure-Object -Property Length -Sum).Sum
        
        # Check if USB has enough space
        if (-not (Test-USBSpace -USBDrive $USBDrive -RequiredSpaceBytes $totalSize)) {
            return $false
        }
        
        $copiedCount = 0
        $totalCount = $backupFiles.Count
        
        foreach ($backup in $backupFiles) {
            $targetFile = Join-Path $usbBackupPath $backup.Name
            
            # Only copy if file doesn't exist or is different
            $needsCopy = $true
            if (Test-Path $targetFile) {
                $sourceHash = (Get-FileHash $backup.FullName -Algorithm MD5).Hash
                $targetHash = (Get-FileHash $targetFile -Algorithm MD5).Hash
                if ($sourceHash -eq $targetHash) {
                    $needsCopy = $false
                    Write-Log "File already exists and is identical: $($backup.Name)"
                }
            }
            
            if ($needsCopy) {
                Write-Log "Copying $($backup.Name) to USB ($($copiedCount + 1)/$totalCount)..."
                Copy-Item $backup.FullName $targetFile -Force
                
                # Verify copy
                if (Test-Path $targetFile) {
                    $copiedSize = (Get-Item $targetFile).Length
                    if ($copiedSize -eq $backup.Length) {
                        Write-Log "Successfully copied: $($backup.Name) ($([math]::Round($backup.Length/1MB, 2)) MB)"
                        $copiedCount++
                    } else {
                        Write-Log "ERROR: Copy verification failed for $($backup.Name)" "ERROR"
                        Remove-Item $targetFile -Force -ErrorAction SilentlyContinue
                    }
                } else {
                    Write-Log "ERROR: Failed to copy $($backup.Name)" "ERROR"
                }
            }
        }
        
        # Also copy recent logs
        $logFiles = @("backup.log", "health-check.log", "usb-sync.log") | ForEach-Object {
            $logPath = "$BackupDir\$_"
            if (Test-Path $logPath) { Get-Item $logPath }
        }
        
        foreach ($log in $logFiles) {
            if ($log) {
                $targetLog = Join-Path $usbBackupPath $log.Name
                Copy-Item $log.FullName $targetLog -Force -ErrorAction SilentlyContinue
                Write-Log "Copied log file: $($log.Name)"
            }
        }
        
        Write-Log "USB backup completed: $copiedCount/$totalCount files copied to $($USBDrive.DriveLetter)"
        return $true
        
    } catch {
        Write-Log "ERROR: Failed to copy backups to USB: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Cleanup-OldUSBBackups {
    param([object]$USBDrive)
    
    try {
        $usbBackupPath = "$($USBDrive.DriveLetter)\$USBBackupFolder"
        
        if (!(Test-Path $usbBackupPath)) {
            return
        }
        
        # Clean up old backup files (keep only latest according to MaxBackupsToKeep)
        $usbBackups = Get-ChildItem -Path $usbBackupPath -Filter "${DatabaseName}_backup_*.custom" |
            Sort-Object CreationTime -Descending
        
        if ($usbBackups.Count -gt $MaxBackupsToKeep) {
            $backupsToDelete = $usbBackups | Select-Object -Skip $MaxBackupsToKeep
            
            foreach ($oldBackup in $backupsToDelete) {
                Remove-Item $oldBackup.FullName -Force
                Write-Log "Removed old USB backup: $($oldBackup.Name)"
            }
            
            Write-Log "Cleaned up $($backupsToDelete.Count) old backups from USB"
        }
        
    } catch {
        Write-Log "ERROR: Failed to cleanup old USB backups: $($_.Exception.Message)" "ERROR"
    }
}

function Create-USBBackupReport {
    param([object]$USBDrive, [bool]$Success)
    
    $usbBackupPath = "$($USBDrive.DriveLetter)\$USBBackupFolder"
    
    if (Test-Path $usbBackupPath) {
        $usbBackups = Get-ChildItem -Path $usbBackupPath -Filter "${DatabaseName}_backup_*.custom" |
            Sort-Object CreationTime -Descending
        
        $reportPath = Join-Path $usbBackupPath "USB_BACKUP_REPORT.txt"
        
        $report = @"
USB BACKUP REPORT
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

USB DRIVE INFORMATION:
Drive: $($USBDrive.DriveLetter)
Label: $($USBDrive.Label)
Total Size: $($USBDrive.SizeGB) GB
Free Space: $($USBDrive.FreeSpaceGB) GB
File System: $($USBDrive.FileSystem)
Health Status: $($USBDrive.HealthStatus)

BACKUP STATUS:
Last Sync: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Status: $(if ($Success) { "SUCCESS" } else { "FAILED" })
Files Count: $($usbBackups.Count)

BACKUP FILES ON USB:
$($usbBackups | ForEach-Object { "  $($_.Name) - $($_.CreationTime) - $([math]::Round($_.Length/1MB, 2)) MB" } | Out-String)

BACKUP RETENTION:
Maximum backups kept: $MaxBackupsToKeep
Cleanup policy: Remove backups older than $MaxBackupsToKeep most recent

NEXT STEPS:
1. Safely eject USB drive when not needed
2. Store USB drive in secure offsite location
3. Monitor backup logs for issues
4. Test restore from USB backup monthly

=== USB BACKUP SYSTEM STATUS: $(if ($Success) { "OPERATIONAL" } else { "NEEDS ATTENTION" }) ===
"@
        
        $report | Out-File -FilePath $reportPath -Encoding UTF8
        Write-Log "Created USB backup report: $reportPath"
    }
}

# Main execution
try {
    Write-Log "=== USB BACKUP SYNC STARTED ==="
    
    # Check if local backups exist
    $localBackups = Get-ChildItem -Path $BackupDir -Filter "${DatabaseName}_backup_*.custom" -ErrorAction SilentlyContinue
    if (-not $localBackups) {
        Write-Log "ERROR: No local backup files found in $BackupDir" "ERROR"
        exit 1
    }
    
    Write-Log "Found $($localBackups.Count) local backup files"
    
    # Detect USB drives
    $usbDrives = Get-USBDrives
    
    if ($usbDrives.Count -eq 0) {
        Write-Log "ERROR: No USB drives detected. Please insert a USB drive and try again." "ERROR"
        exit 1
    }
    
    # Select best USB drive
    $selectedUSB = Select-BestUSBDrive -USBDrives $usbDrives
    
    if (-not $selectedUSB) {
        Write-Log "ERROR: No suitable USB drive found" "ERROR"
        exit 1
    }
    
    # Copy backups to USB
    $copySuccess = Copy-BackupsToUSB -USBDrive $selectedUSB
    
    if ($copySuccess) {
        # Cleanup old backups
        Cleanup-OldUSBBackups -USBDrive $selectedUSB
        
        # Create report
        Create-USBBackupReport -USBDrive $selectedUSB -Success $true
        
        Write-Log "=== USB BACKUP SYNC COMPLETED SUCCESSFULLY ==="
        Write-Log "USB Drive: $($selectedUSB.DriveLetter) [$($selectedUSB.Label)]"
        Write-Log "Backup Location: $($selectedUSB.DriveLetter)\$USBBackupFolder"
        exit 0
    } else {
        Create-USBBackupReport -USBDrive $selectedUSB -Success $false
        Write-Log "=== USB BACKUP SYNC FAILED ===" "ERROR"
        exit 1
    }
    
} catch {
    Write-Log "ERROR: USB backup sync script failed: $($_.Exception.Message)" "ERROR"
    exit 1
}
