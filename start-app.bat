@echo off
echo Starting Fiserv Inventory Application...
echo.

:: Display network information
echo Network Configuration:
ipconfig | findstr IPv4
echo.

:: Kill any existing Node.js processes
taskkill /F /IM node.exe >nul 2>&1

:: Start the backend server with email monitoring in a minimized window
echo Starting Backend Server with Email Monitoring (http://0.0.0.0:4000)...
start /min cmd /k "cd backend && set PORT=4000 && set PGHOST=localhost && set PGUSER=postgres && set PGDATABASE=fiservinventory && set HOST=0.0.0.0 && npm run start:all"

:: Wait for a moment to let backend initialize
timeout /t 8

:: Start the frontend server for localhost (camera enabled)
echo Starting Frontend Server - Localhost (http://localhost:3000)...
start /min cmd /k "cd frontend && npm run start:localhost"

:: Wait for localhost server to start
timeout /t 3

:: Start the frontend server for network access  
echo Starting Frontend Server - Network (http://192.168.50.1:3001)...
start /min cmd /k "cd frontend && npm run start:network-pi"

echo.
echo PC ACCESS: http://localhost:3000 (Camera enabled - Main interface)
echo.
echo NETWORK ACCESS OPTIONS:
echo   - http://192.168.50.1:3001 (Ethernet - For Raspberry Pi)
echo   - http://10.1.10.171:3001 (WiFi - For other devices)
echo.
echo Raspberry Pi can access via: http://192.168.50.1:3001
echo.

:: Wait for servers to fully initialize
echo Waiting for localhost server to be ready...
echo (React development server can take 15-20 seconds to start)
timeout /t 15

:: Open localhost for PC use (camera enabled)
echo Opening localhost for PC use (camera enabled)...
echo If you get a 404 error, wait a few more seconds and refresh the browser
start http://localhost:3000

:: Keep this window open
pause