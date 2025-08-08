@echo off
REM Manual Database Backup - Double-click to run
echo.
echo =====================================
echo  Fiserv Inventory Database Backup
echo =====================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Please run as Administrator
    echo Right-click this file and select "Run as administrator"
    pause
    exit /b 1
)

REM Change to script directory
cd /d %~dp0

REM Run backup script
echo Running backup script...
powershell.exe -ExecutionPolicy Bypass -File "backup-database.ps1"

if %ERRORLEVEL% equ 0 (
    echo.
    echo SUCCESS: Backup completed successfully!
    echo Check C:\DatabaseBackups for backup files
) else (
    echo.
    echo ERROR: Backup failed. Check the log file for details.
    echo Log file: C:\DatabaseBackups\backup.log
)

echo.
pause 