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
if "%choice%"=="3" type "C:\DatabaseBackups\backup.log" | more
if "%choice%"=="4" powershell -ExecutionPolicy Bypass -File "%~dp0disaster-recovery.ps1"
if "%choice%"=="5" powershell -ExecutionPolicy Bypass -File "%~dp0cloud-sync-backup.ps1"
if "%choice%"=="6" explorer "C:\DatabaseBackups"
if "%choice%"=="7" exit

pause
goto start
