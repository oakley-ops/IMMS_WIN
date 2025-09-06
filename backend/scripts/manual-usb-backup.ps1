# Manual USB Backup Script
# Run this to manually backup to USB drive

param(
    [string]$PreferredUSBLabel = "",
    [bool]$ShowUSBList = $true
)

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

try {
    Write-ColorOutput "=== MANUAL USB BACKUP TOOL ===" "Cyan"
    Write-ColorOutput ""
    
    # Check if we're in the right directory
    $currentDir = Get-Location
    if (-not (Test-Path "backup-database.ps1")) {
        Write-ColorOutput "ERROR: Please run this script from the backend\scripts directory" "Red"
        Write-ColorOutput "Current directory: $currentDir" "Yellow"
        Write-ColorOutput "Expected files: backup-database.ps1, usb-backup-sync.ps1" "Yellow"
        exit 1
    }
    
    Write-ColorOutput "✅ Found backup scripts in current directory" "Green"
    
    # Show available USB drives
    if ($ShowUSBList) {
        Write-ColorOutput "Detecting USB drives..." "Yellow"
        
        $usbDrives = Get-WmiObject -Class Win32_LogicalDisk | Where-Object {
            $_.DriveType -eq 2 -and $_.DeviceID -ne $null -and $_.Size -gt 0
        }
        
        if ($usbDrives.Count -eq 0) {
            Write-ColorOutput "❌ NO USB DRIVES DETECTED" "Red"
            Write-ColorOutput ""
            Write-ColorOutput "Please ensure:" "Yellow"
            Write-ColorOutput "1. USB drive is properly connected" "White"
            Write-ColorOutput "2. USB drive is recognized by Windows" "White"
            Write-ColorOutput "3. USB drive has available space" "White"
            exit 1
        }
        
        Write-ColorOutput "Found USB drives:" "Green"
        foreach ($drive in $usbDrives) {
            $driveInfo = Get-Volume -DriveLetter $drive.DeviceID.Replace(":", "") -ErrorAction SilentlyContinue
            $label = if ($driveInfo.FileSystemLabel) { $driveInfo.FileSystemLabel } else { "No Label" }
            $sizeGB = [math]::Round($drive.Size / 1GB, 2)
            $freeGB = [math]::Round($drive.FreeSpace / 1GB, 2)
            
            Write-ColorOutput "  💾 Drive $($drive.DeviceID) [$label] - $sizeGB GB ($freeGB GB free)" "White"
        }
        Write-ColorOutput ""
    }
    
    # Check for existing backups
    $backupDir = "C:\DatabaseBackups"
    $backupFiles = Get-ChildItem -Path $backupDir -Filter "fiservinventory_backup_*.custom" -ErrorAction SilentlyContinue
    
    if (-not $backupFiles) {
        Write-ColorOutput "❌ No backup files found in $backupDir" "Red"
        Write-ColorOutput "Would you like to create a backup first? (y/n)" "Yellow"
        $response = Read-Host
        
        if ($response -eq 'y' -or $response -eq 'yes') {
            Write-ColorOutput "Creating database backup..." "Yellow"
            .\backup-database.ps1
            
            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput "✅ Backup created successfully!" "Green"
            } else {
                Write-ColorOutput "❌ Backup creation failed" "Red"
                exit 1
            }
        } else {
            Write-ColorOutput "Cannot proceed without backup files. Exiting..." "Red"
            exit 1
        }
    } else {
        $latestBackup = $backupFiles | Sort-Object CreationTime -Descending | Select-Object -First 1
        $backupAge = (Get-Date) - $latestBackup.CreationTime
        
        Write-ColorOutput "Found $($backupFiles.Count) backup files" "Green"
        Write-ColorOutput "Latest backup: $($latestBackup.Name)" "White"
        Write-ColorOutput "Backup age: $($backupAge.TotalHours.ToString('F1')) hours" "White"
        Write-ColorOutput ""
    }
    
    # Run USB sync
    Write-ColorOutput "Starting USB backup sync..." "Yellow"
    
    if ($PreferredUSBLabel) {
        .\usb-backup-sync.ps1 -PreferredUSBLabel $PreferredUSBLabel
    } else {
        .\usb-backup-sync.ps1
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput ""
        Write-ColorOutput "🎉 USB BACKUP COMPLETED SUCCESSFULLY!" "Green"
        Write-ColorOutput ""
        Write-ColorOutput "Your database backups are now safely stored on the USB drive!" "Green"
        Write-ColorOutput ""
        Write-ColorOutput "Next steps:" "Cyan"
        Write-ColorOutput "1. ✅ Safely eject the USB drive" "White"
        Write-ColorOutput "2. ✅ Store USB drive in a secure location" "White"
        Write-ColorOutput "3. ✅ Label the USB drive with backup date" "White"
        Write-ColorOutput "4. ✅ Test restore monthly" "White"
        
    } else {
        Write-ColorOutput ""
        Write-ColorOutput "❌ USB BACKUP FAILED" "Red"
        Write-ColorOutput ""
        Write-ColorOutput "Possible issues:" "Yellow"
        Write-ColorOutput "• No USB drive detected" "White"
        Write-ColorOutput "• Insufficient space on USB drive" "White"
        Write-ColorOutput "• USB drive is write-protected" "White"
        Write-ColorOutput "• Permission issues" "White"
        Write-ColorOutput ""
        Write-ColorOutput "Check the log file: C:\DatabaseBackups\usb-sync.log" "White"
    }
    
} catch {
    Write-ColorOutput "ERROR: $($_.Exception.Message)" "Red"
    exit 1
}

Write-ColorOutput ""
Write-ColorOutput "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
