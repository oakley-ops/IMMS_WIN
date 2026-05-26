@echo off
echo Starting Fiserv Inventory Application...
echo.

:: Display network information
echo Network Configuration:
ipconfig | findstr IPv4
echo.

:: Kill any existing Node.js processes
taskkill /F /IM node.exe >nul 2>&1

:: Start the backend server (email monitoring disabled) in a minimized window
echo Starting Backend Server (http://0.0.0.0:4000)...
start /min cmd /k "cd backend && set PORT=4000 && set HOST=0.0.0.0 && npm start"

:: Wait for a moment to let backend initialize
timeout /t 8

:: Start MCS Backend
echo Starting MCS Backend (http://0.0.0.0:4001)...
start /min cmd /k "cd maintenance_call_system\backend && npm start"

timeout /t 3

:: Start MCS Frontend
echo Starting MCS Frontend (http://localhost:3003)...
start /min cmd /k "cd maintenance_call_system\frontend && npm run dev"

timeout /t 3

:: Start the frontend server for localhost (camera enabled)
echo Starting Frontend Server - Localhost (http://localhost:3002)...
start /min cmd /k "cd frontend && npm run start:localhost-3002"

:: Wait for localhost server to start
timeout /t 3

:: Start the frontend server for network access (with API URL for Pi access)
echo Starting Frontend Server - Network (http://10.1.10.50:3001)...
start /min cmd /k "cd frontend && npm run start:network-pi"

echo.
echo PC ACCESS: http://localhost:3002 (Camera enabled - Main interface)
echo MCS ACCESS: http://localhost:3003 (Maintenance Call System)
echo.
echo NETWORK ACCESS OPTIONS:
echo   - http://10.1.10.50:3001 (Ethernet - For Raspberry Pi and network devices)
echo   - http://10.1.10.171:3001 (WiFi - For other devices, if available)
echo.
echo Raspberry Pi can access via: http://10.1.10.50:3001
echo.

:: Wait for servers to fully initialize
echo Waiting for localhost server to be ready...
echo (React development server can take 15-20 seconds to start)
timeout /t 15

:: Open localhost for PC use (camera enabled)
echo Opening localhost for PC use (camera enabled)...
echo If you get a 404 error, wait a few more seconds and refresh the browser
start http://localhost:3002

:: Keep this window open
pause