@echo off
echo Starting Fiserv Inventory Application...
echo.

:: Kill any existing Node.js processes
taskkill /F /IM node.exe >nul 2>&1

:: Start the backend server with email monitoring in a minimized window
echo Starting Backend Server with Email Monitoring (http://localhost:4000)...
start /min cmd /k "cd backend && set PORT=4000 && set PGHOST=localhost && set PGUSER=postgres && set PGDATABASE=fiservinventory && npm run start:all"

:: Wait for a moment to let backend initialize
timeout /t 8

:: Start the frontend server in a minimized window
echo Starting Frontend Server (http://localhost:3000)...
start /min cmd /k "cd frontend && npm start"

:: Start the email monitoring system in a minimized window
echo Starting Email Monitoring System...
start /min cmd /k "cd backend && src\scripts\run-email-monitor.bat"

echo.
echo Navigate to http://localhost:3000 in your browser
echo.

:: Keep this window open
pause