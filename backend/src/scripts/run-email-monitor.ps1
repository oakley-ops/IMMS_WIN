# PowerShell script to run the email monitor
# This script provides better Windows compatibility for running the email monitor

# Change to the backend directory
cd $PSScriptRoot\..\..

# Check if failed_email_attempts table exists and create it if needed
Write-Host "Ensuring database tables exist..."
node src/scripts/createFailedEmailTable.js

# Function to check internet connectivity
function Test-InternetConnection {
    try {
        $result = Test-Connection -ComputerName 'google.com' -Count 1 -Quiet
        return $result
    }
    catch {
        return $false
    }
}

# Check internet connection first
Write-Host "Checking internet connection..."
$hasConnection = Test-InternetConnection
if (-not $hasConnection) {
    Write-Host "No internet connection detected. The script will start but emails won't be sent until connection is restored." -ForegroundColor Yellow
}

# Start the email monitor script
Write-Host "Starting email monitor..."
try {
    node src/scripts/monitorEmails.js
}
catch {
    Write-Host "Error occurred while running the email monitor: $_" -ForegroundColor Red
    Write-Host "Email monitor will restart automatically in 10 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    # Try running it again
    node src/scripts/monitorEmails.js
}

# Keep the window open if there was an error
if ($LASTEXITCODE -ne 0) {
    Write-Host "Email monitor exited with an error (code $LASTEXITCODE). Press any key to exit..." -ForegroundColor Red
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} 