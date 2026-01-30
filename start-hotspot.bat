@echo off
echo Starting IMMS in Hotspot Mode...
echo.

:: Display network information
echo Network Configuration:
ipconfig | findstr IPv4
echo.

:: Kill any existing Node.js processes
taskkill /F /IM node.exe >nul 2>&1

:: Start the backend server in a minimized window
echo Starting Backend Server (http://192.168.137.1:4000)...
start /min cmd /k "cd backend && npm run dev"

:: Wait for backend to initialize
timeout /t 8

:: Start the frontend server for hotspot access
echo Starting Frontend Server - Hotspot (http://192.168.137.1:3001)...
start /min cmd /k "cd frontend && npm run start:hotspot"

echo.
echo =============================================
echo   HOTSPOT MODE
echo =============================================
echo.
echo   WiFi Network: DESKTOP-R872S9E 3075
echo   Password:     21iK@641
echo.
echo   Frontend: http://192.168.137.1:3001
echo   Backend:  http://192.168.137.1:4000
echo.
echo   Connect any device to the WiFi above
echo   then open http://192.168.137.1:3001
echo =============================================
echo.

:: Wait for frontend to compile
echo Waiting for frontend to compile...
timeout /t 30

:: Open browser on this PC
start http://192.168.137.1:3001

:: Keep this window open
pause
