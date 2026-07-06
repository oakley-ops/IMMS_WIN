# Database Backup Alert System
# Monitors backup status and sends notifications when issues are detected

param(
    [string]$BackupDir = "C:\DatabaseBackups",
    [string]$LogFile = "C:\DatabaseBackups\alerts.log",
    [string]$EmailTo = "",
    [string]$EmailFrom = "",
    [string]$SMTPServer = "",
    [int]$SMTPPort = 587,
    [string]$SMTPUsername = "",
    [string]$SMTPPassword = "",
    [bool]$EnableEmailAlerts = $false,
    [bool]$EnableDesktopAlerts = $true,
    [bool]$EnableEventLog = $true
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

function Send-EmailAlert {
    param(
        [string]$Subject,
        [string]$Body,
        [string]$Priority = "Normal"
    )
    
    if (-not $EnableEmailAlerts -or [string]::IsNullOrEmpty($EmailTo)) {
        return
    }
    
    try {
        $securePassword = ConvertTo-SecureString $SMTPPassword -AsPlainText -Force
        $credential = New-Object System.Management.Automation.PSCredential($SMTPUsername, $securePassword)
        
        $mailParams = @{
            To = $EmailTo
            From = $EmailFrom
            Subject = $Subject
            Body = $Body
            SmtpServer = $SMTPServer
            Port = $SMTPPort
            UseSsl = $true
            Credential = $credential
            Priority = $Priority
        }
        
        Send-MailMessage @mailParams
        Write-Log "Email alert sent: $Subject"
        
    } catch {
        Write-Log "ERROR: Failed to send email alert: $($_.Exception.Message)" "ERROR"
    }
}

function Send-DesktopAlert {
    param(
        [string]$Title,
        [string]$Message,
        [string]$Icon = "Warning"
    )
    
    if (-not $EnableDesktopAlerts) {
        return
    }
    
    try {
        # Use Windows Toast Notification
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
        
        $toastXml = @"
<toast>
    <visual>
        <binding template="ToastGeneric">
            <text>$Title</text>
            <text>$Message</text>
        </binding>
    </visual>
    <actions>
        <action content="View Logs" arguments="logs" />
        <action content="Dismiss" arguments="dismiss" />
    </actions>
</toast>
"@
        
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml($toastXml)
        
        $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("IMMS Inventory Backup").Show($toast)
        
        Write-Log "Desktop alert sent: $Title"
        
    } catch {
        # Fallback to simple popup
        Add-Type -AssemblyName PresentationFramework
        [System.Windows.MessageBox]::Show($Message, $Title, "OK", $Icon)
        Write-Log "Desktop popup sent: $Title"
    }
}

function Write-EventLog {
    param(
        [string]$Message,
        [string]$EventType = "Warning",
        [int]$EventId = 1001
    )
    
    if (-not $EnableEventLog) {
        return
    }
    
    try {
        $source = "IMMSInventoryBackup"
        
        # Create event source if it doesn't exist
        if (-not [System.Diagnostics.EventLog]::SourceExists($source)) {
            [System.Diagnostics.EventLog]::CreateEventSource($source, "Application")
        }
        
        Write-EventLog -LogName "Application" -Source $source -EventType $EventType -EventId $EventId -Message $Message
        Write-Log "Event log entry created: $EventType - $Message"
        
    } catch {
        Write-Log "ERROR: Failed to write event log: $($_.Exception.Message)" "ERROR"
    }
}

function Check-BackupFailures {
    Write-Log "Checking for backup failures..."
    
    # Check if backup log exists
    $backupLogPath = "$BackupDir\backup.log"
    if (-not (Test-Path $backupLogPath)) {
        $alertMessage = "Backup log file not found: $backupLogPath"
        Write-Log $alertMessage "ERROR"
        
        Send-EmailAlert -Subject "CRITICAL: Backup Log Missing" -Body $alertMessage -Priority "High"
        Send-DesktopAlert -Title "Backup Alert" -Message $alertMessage -Icon "Error"
        Write-EventLog -Message $alertMessage -EventType "Error"
        return $false
    }
    
    # Check for recent errors in backup log
    $recentErrors = Get-Content $backupLogPath | Select-String "ERROR" | Select-Object -Last 5
    if ($recentErrors) {
        $alertMessage = "Recent backup errors detected:`n$($recentErrors -join "`n")"
        Write-Log $alertMessage "ERROR"
        
        Send-EmailAlert -Subject "WARNING: Backup Errors Detected" -Body $alertMessage -Priority "High"
        Send-DesktopAlert -Title "Backup Error Alert" -Message "Recent backup errors detected. Check logs." -Icon "Error"
        Write-EventLog -Message $alertMessage -EventType "Warning"
        return $false
    }
    
    return $true
}

function Check-BackupAge {
    Write-Log "Checking backup age..."
    
    $latestBackup = Get-ChildItem -Path $BackupDir -Filter "fiservinventory_backup_*.custom" |
        Sort-Object CreationTime -Descending | Select-Object -First 1
    
    if (-not $latestBackup) {
        $alertMessage = "No backup files found in $BackupDir"
        Write-Log $alertMessage "ERROR"
        
        Send-EmailAlert -Subject "CRITICAL: No Backup Files Found" -Body $alertMessage -Priority "High"
        Send-DesktopAlert -Title "Critical Backup Alert" -Message $alertMessage -Icon "Error"
        Write-EventLog -Message $alertMessage -EventType "Error"
        return $false
    }
    
    $backupAge = (Get-Date) - $latestBackup.CreationTime
    
    # Alert if backup is older than 25 hours (daily backup should have run)
    if ($backupAge.TotalHours -gt 25) {
        $alertMessage = "Latest backup is $($backupAge.TotalHours.ToString('F1')) hours old (file: $($latestBackup.Name))"
        Write-Log $alertMessage "WARN"
        
        Send-EmailAlert -Subject "WARNING: Backup Overdue" -Body $alertMessage -Priority "Normal"
        Send-DesktopAlert -Title "Backup Age Warning" -Message $alertMessage -Icon "Warning"
        Write-EventLog -Message $alertMessage -EventType "Warning"
        return $false
    }
    
    # Critical alert if backup is older than 48 hours
    if ($backupAge.TotalHours -gt 48) {
        $alertMessage = "CRITICAL: Latest backup is $($backupAge.TotalDays.ToString('F1')) days old!"
        Write-Log $alertMessage "ERROR"
        
        Send-EmailAlert -Subject "CRITICAL: Backup Severely Overdue" -Body $alertMessage -Priority "High"
        Send-DesktopAlert -Title "Critical Backup Alert" -Message $alertMessage -Icon "Error"
        Write-EventLog -Message $alertMessage -EventType "Error"
        return $false
    }
    
    Write-Log "Backup age check passed (age: $($backupAge.TotalHours.ToString('F1')) hours)"
    return $true
}

function Check-DiskSpace {
    Write-Log "Checking disk space..."
    
    $drive = (Get-Item $BackupDir).PSDrive
    $freeSpaceGB = [math]::Round($drive.Free / 1GB, 2)
    
    # Warning if less than 5GB free
    if ($drive.Free -lt 5GB) {
        $alertMessage = "Low disk space for backups: $freeSpaceGB GB remaining on drive $($drive.Name)"
        Write-Log $alertMessage "WARN"
        
        Send-EmailAlert -Subject "WARNING: Low Backup Disk Space" -Body $alertMessage -Priority "Normal"
        Send-DesktopAlert -Title "Disk Space Warning" -Message $alertMessage -Icon "Warning"
        Write-EventLog -Message $alertMessage -EventType "Warning"
        return $false
    }
    
    # Critical if less than 1GB free
    if ($drive.Free -lt 1GB) {
        $alertMessage = "CRITICAL: Very low disk space for backups: $freeSpaceGB GB remaining!"
        Write-Log $alertMessage "ERROR"
        
        Send-EmailAlert -Subject "CRITICAL: Backup Disk Space" -Body $alertMessage -Priority "High"
        Send-DesktopAlert -Title "Critical Disk Space Alert" -Message $alertMessage -Icon "Error"
        Write-EventLog -Message $alertMessage -EventType "Error"
        return $false
    }
    
    Write-Log "Disk space check passed ($freeSpaceGB GB free)"
    return $true
}

function Check-ScheduledTask {
    Write-Log "Checking scheduled task status..."
    
    try {
        $task = Get-ScheduledTask -TaskName "IMMSInventory-DatabaseBackup" -ErrorAction Stop
        
        if ($task.State -ne "Ready") {
            $alertMessage = "Backup scheduled task is not ready (State: $($task.State))"
            Write-Log $alertMessage "ERROR"
            
            Send-EmailAlert -Subject "ERROR: Backup Task Not Ready" -Body $alertMessage -Priority "High"
            Send-DesktopAlert -Title "Scheduled Task Alert" -Message $alertMessage -Icon "Error"
            Write-EventLog -Message $alertMessage -EventType "Error"
            return $false
        }
        
        # Check if task failed recently
        $taskInfo = Get-ScheduledTaskInfo -TaskName "IMMSInventory-DatabaseBackup"
        if ($taskInfo.LastTaskResult -ne 0) {
            $alertMessage = "Backup scheduled task last result was not successful (Code: $($taskInfo.LastTaskResult))"
            Write-Log $alertMessage "WARN"
            
            Send-EmailAlert -Subject "WARNING: Backup Task Failed" -Body $alertMessage -Priority "Normal"
            Send-DesktopAlert -Title "Task Failure Warning" -Message $alertMessage -Icon "Warning"
            Write-EventLog -Message $alertMessage -EventType "Warning"
            return $false
        }
        
        Write-Log "Scheduled task check passed"
        return $true
        
    } catch {
        $alertMessage = "Backup scheduled task not found or inaccessible"
        Write-Log $alertMessage "ERROR"
        
        Send-EmailAlert -Subject "CRITICAL: Backup Task Missing" -Body $alertMessage -Priority "High"
        Send-DesktopAlert -Title "Critical Task Alert" -Message $alertMessage -Icon "Error"
        Write-EventLog -Message $alertMessage -EventType "Error"
        return $false
    }
}

function Generate-StatusReport {
    Write-Log "Generating backup status report..."
    
    $report = @"
DATABASE BACKUP STATUS REPORT
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

BACKUP FILES:
$(Get-ChildItem -Path $BackupDir -Filter "*.custom" | Sort-Object CreationTime -Descending | Select-Object -First 5 | ForEach-Object { "  $($_.Name) - $($_.CreationTime) - $([math]::Round($_.Length/1MB, 2)) MB" } | Out-String)

DISK USAGE:
$((Get-Item $BackupDir).PSDrive | ForEach-Object { "  Drive $($_.Name): $([math]::Round($_.Free/1GB, 2)) GB free / $([math]::Round(($_.Used + $_.Free)/1GB, 2)) GB total" })

RECENT LOG ENTRIES:
$(Get-Content "$BackupDir\backup.log" | Select-Object -Last 10 | Out-String)
"@
    
    return $report
}

# Main execution
try {
    Write-Log "=== BACKUP ALERT SYSTEM CHECK STARTED ==="
    
    $allChecksPassed = $true
    
    # Run all checks
    $allChecksPassed = (Check-BackupFailures) -and $allChecksPassed
    $allChecksPassed = (Check-BackupAge) -and $allChecksPassed
    $allChecksPassed = (Check-DiskSpace) -and $allChecksPassed
    $allChecksPassed = (Check-ScheduledTask) -and $allChecksPassed
    
    if ($allChecksPassed) {
        Write-Log "=== ALL BACKUP CHECKS PASSED ==="
        
        # Send weekly status report (only on Sundays)
        if ((Get-Date).DayOfWeek -eq "Sunday") {
            $statusReport = Generate-StatusReport
            Send-EmailAlert -Subject "Weekly Backup Status Report" -Body $statusReport -Priority "Low"
        }
    } else {
        Write-Log "=== BACKUP ISSUES DETECTED ===" "WARN"
        
        # Send summary report when issues are found
        $statusReport = Generate-StatusReport
        Send-EmailAlert -Subject "Backup Issues Detected - Status Report" -Body $statusReport -Priority "Normal"
    }
    
} catch {
    Write-Log "ERROR: Alert system check failed: $($_.Exception.Message)" "ERROR"
    Send-EmailAlert -Subject "CRITICAL: Backup Alert System Failed" -Body "The backup alert system encountered an error: $($_.Exception.Message)" -Priority "High"
    exit 1
}
