# Cloud Backup Synchronization Script
# Syncs local backups to multiple cloud providers

param(
    [string]$BackupDir = "C:\DatabaseBackups",
    [string]$LogFile = "C:\DatabaseBackups\cloud-sync.log",
    [bool]$EnableGoogleDrive = $true,
    [bool]$EnableOneDrive = $true,
    [bool]$EnableAWS = $false,
    [string]$GoogleDriveFolder = "DatabaseBackups",
    [string]$OneDriveFolder = "DatabaseBackups",
    [string]$AWSBucket = "imms-inventory-backups"
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

function Sync-ToGoogleDrive {
    if (-not $EnableGoogleDrive) {
        Write-Log "Google Drive sync disabled"
        return $true
    }
    
    Write-Log "Starting Google Drive sync..."
    
    # Check if Google Drive is installed and running
    $googleDrivePath = "$env:USERPROFILE\Google Drive"
    if (-not (Test-Path $googleDrivePath)) {
        $googleDrivePath = "$env:USERPROFILE\GoogleDrive"
    }
    
    if (-not (Test-Path $googleDrivePath)) {
        Write-Log "WARN: Google Drive not found. Install Google Drive for Desktop." "WARN"
        return $false
    }
    
    $targetPath = "$googleDrivePath\$GoogleDriveFolder"
    
    try {
        # Create target directory if it doesn't exist
        if (!(Test-Path -Path $targetPath)) {
            New-Item -ItemType Directory -Path $targetPath -Force
            Write-Log "Created Google Drive backup folder: $targetPath"
        }
        
        # Copy recent backups (last 7 days)
        $recentBackups = Get-ChildItem -Path $BackupDir -Filter "*.custom" | 
            Where-Object { $_.CreationTime -gt (Get-Date).AddDays(-7) }
        
        foreach ($backup in $recentBackups) {
            $targetFile = Join-Path $targetPath $backup.Name
            
            # Only copy if file doesn't exist or is different
            if (-not (Test-Path $targetFile) -or (Get-FileHash $backup.FullName).Hash -ne (Get-FileHash $targetFile).Hash) {
                Copy-Item $backup.FullName $targetFile -Force
                Write-Log "Synced to Google Drive: $($backup.Name)"
            }
        }
        
        Write-Log "Google Drive sync completed successfully"
        return $true
        
    } catch {
        Write-Log "ERROR: Google Drive sync failed: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Sync-ToOneDrive {
    if (-not $EnableOneDrive) {
        Write-Log "OneDrive sync disabled"
        return $true
    }
    
    Write-Log "Starting OneDrive sync..."
    
    # Check if OneDrive is available
    $oneDrivePath = "$env:USERPROFILE\OneDrive"
    if (-not (Test-Path $oneDrivePath)) {
        Write-Log "WARN: OneDrive not found. Ensure OneDrive is installed and syncing." "WARN"
        return $false
    }
    
    $targetPath = "$oneDrivePath\$OneDriveFolder"
    
    try {
        # Create target directory if it doesn't exist
        if (!(Test-Path -Path $targetPath)) {
            New-Item -ItemType Directory -Path $targetPath -Force
            Write-Log "Created OneDrive backup folder: $targetPath"
        }
        
        # Copy recent backups (last 7 days)
        $recentBackups = Get-ChildItem -Path $BackupDir -Filter "*.custom" | 
            Where-Object { $_.CreationTime -gt (Get-Date).AddDays(-7) }
        
        foreach ($backup in $recentBackups) {
            $targetFile = Join-Path $targetPath $backup.Name
            
            # Only copy if file doesn't exist or is different
            if (-not (Test-Path $targetFile) -or (Get-FileHash $backup.FullName).Hash -ne (Get-FileHash $targetFile).Hash) {
                Copy-Item $backup.FullName $targetFile -Force
                Write-Log "Synced to OneDrive: $($backup.Name)"
            }
        }
        
        Write-Log "OneDrive sync completed successfully"
        return $true
        
    } catch {
        Write-Log "ERROR: OneDrive sync failed: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Sync-ToAWS {
    if (-not $EnableAWS) {
        Write-Log "AWS S3 sync disabled"
        return $true
    }
    
    Write-Log "Starting AWS S3 sync..."
    
    # Check if AWS CLI is installed
    if (-not (Get-Command "aws" -ErrorAction SilentlyContinue)) {
        Write-Log "WARN: AWS CLI not found. Install AWS CLI to enable S3 sync." "WARN"
        return $false
    }
    
    try {
        # Sync recent backups to S3 (last 7 days)
        $recentBackups = Get-ChildItem -Path $BackupDir -Filter "*.custom" | 
            Where-Object { $_.CreationTime -gt (Get-Date).AddDays(-7) }
        
        foreach ($backup in $recentBackups) {
            $s3Key = "db-backups/$($backup.Name)"
            
            # Upload to S3
            & aws s3 cp $backup.FullName "s3://$AWSBucket/$s3Key" --storage-class STANDARD_IA 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Log "Synced to AWS S3: $($backup.Name)"
            } else {
                Write-Log "ERROR: Failed to sync $($backup.Name) to AWS S3" "ERROR"
                return $false
            }
        }
        
        # Clean up old S3 backups (older than 30 days)
        $cutoffDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
        & aws s3 ls "s3://$AWSBucket/db-backups/" --recursive | 
            Where-Object { $_ -match "(\d{4}-\d{2}-\d{2})" -and $matches[1] -lt $cutoffDate } |
            ForEach-Object {
                $key = ($_ -split "\s+")[-1]
                & aws s3 rm "s3://$AWSBucket/$key"
                Write-Log "Removed old S3 backup: $key"
            }
        
        Write-Log "AWS S3 sync completed successfully"
        return $true
        
    } catch {
        Write-Log "ERROR: AWS S3 sync failed: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Test-CloudConnectivity {
    Write-Log "Testing cloud connectivity..."
    
    $connectivityPassed = $true
    
    # Test internet connectivity
    try {
        $response = Invoke-WebRequest -Uri "https://www.google.com" -TimeoutSec 10 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Log "Internet connectivity: OK"
        } else {
            Write-Log "WARN: Internet connectivity test failed" "WARN"
            $connectivityPassed = $false
        }
    } catch {
        Write-Log "ERROR: No internet connectivity" "ERROR"
        $connectivityPassed = $false
    }
    
    # Test AWS connectivity (if enabled)
    if ($EnableAWS -and (Get-Command "aws" -ErrorAction SilentlyContinue)) {
        try {
            & aws s3 ls "s3://$AWSBucket" --region us-east-1 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Log "AWS S3 connectivity: OK"
            } else {
                Write-Log "WARN: AWS S3 connectivity failed" "WARN"
                $connectivityPassed = $false
            }
        } catch {
            Write-Log "WARN: AWS S3 connectivity test failed" "WARN"
        }
    }
    
    return $connectivityPassed
}

# Main execution
try {
    Write-Log "=== CLOUD BACKUP SYNC STARTED ==="
    
    # Test connectivity first
    if (-not (Test-CloudConnectivity)) {
        Write-Log "WARN: Cloud connectivity issues detected, but continuing with available services" "WARN"
    }
    
    $syncResults = @()
    
    # Sync to all enabled cloud providers
    $syncResults += Sync-ToGoogleDrive
    $syncResults += Sync-ToOneDrive
    $syncResults += Sync-ToAWS
    
    # Summary
    $successfulSyncs = ($syncResults | Where-Object { $_ -eq $true }).Count
    $totalSyncs = $syncResults.Count
    
    Write-Log "=== CLOUD SYNC COMPLETED: $successfulSyncs/$totalSyncs services successful ==="
    
    if ($successfulSyncs -eq 0) {
        Write-Log "ERROR: All cloud sync operations failed" "ERROR"
        exit 1
    } elseif ($successfulSyncs -lt $totalSyncs) {
        Write-Log "WARN: Some cloud sync operations failed" "WARN"
        exit 2
    } else {
        Write-Log "All cloud sync operations successful"
        exit 0
    }
    
} catch {
    Write-Log "ERROR: Cloud sync script failed: $($_.Exception.Message)" "ERROR"
    exit 1
}
