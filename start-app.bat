@echo off
setlocal enabledelayedexpansion

title Fiserv Inventory Application Startup

echo Starting Fiserv Inventory Application...
echo.

:: PostgreSQL check - more generic approach that doesn't rely on service name
echo Checking PostgreSQL connection...
set PGPASSWORD=postgres
psql -h localhost -U postgres -d fiservinventory -c "SELECT 1" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Cannot connect to PostgreSQL database.
    echo Please ensure PostgreSQL is running and database "fiservinventory" exists.
    choice /c YN /m "Continue anyway? (Y/N)"
    if !ERRORLEVEL! NEQ 1 exit /b
)

:: Kill any existing Node.js processes - more targeted
echo Terminating any existing Node.js processes for this application...
taskkill /F /FI "WINDOWTITLE eq Backend Server*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Frontend Server*" >nul 2>&1
timeout /t 1 >nul

:: Start backend with better error handling
echo Starting Backend Server (http://localhost:4000)...
cd backend
if not exist node_modules (
    echo Installing backend dependencies...
    call npm install
    if !ERRORLEVEL! NEQ 0 (
        echo ERROR: Failed to install backend dependencies
        cd ..
        pause
        exit /b 1
    )
)

start /min "Backend Server" cmd /k "title Backend Server && set PORT=4000 && set PGHOST=localhost && set PGUSER=postgres && set PGPASSWORD=postgres && set PGDATABASE=fiservinventory && npm run start:all"
cd ..

:: Wait with progress indicator
echo Waiting for backend to initialize...
for /l %%i in (1,1,10) do (
    timeout /t 1 /nobreak >nul
    echo | set /p="."
)
echo.

:: Start frontend with better error handling
echo Starting Frontend Server (http://localhost:3002)...
cd frontend
if not exist node_modules (
    echo Installing frontend dependencies...
    call npm install
    if !ERRORLEVEL! NEQ 0 (
        echo ERROR: Failed to install frontend dependencies
        cd ..
        pause
        exit /b 1
    )
)

start /min "Frontend Server" cmd /k "title Frontend Server && npm start"
cd ..

echo.
echo All services started!
echo Navigate to http://localhost:3002 in your browser
echo.
echo Press any key to close all services and exit...

pause

:: Clean up when user exits
echo Shutting down services...
taskkill /F /FI "WINDOWTITLE eq Backend Server*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Frontend Server*" >nul 2>&1
echo Done.

endlocal