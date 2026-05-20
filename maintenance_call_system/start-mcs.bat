@echo off
title MCS - Maintenance Call System
color 0A

set PM2="C:\Users\Fiser\AppData\Roaming\npm\pm2.cmd"
set NODE="C:\Program Files\nodejs\node.exe"
set PM2_SCRIPT="C:\Users\Fiser\AppData\Roaming\npm\node_modules\pm2\bin\pm2"
set LOGFILE="C:\Users\Fiser\fiservinventory_win\maintenance_call_system\logs\start-debug.log"

echo.
echo  ================================================
echo    MAINTENANCE CALL SYSTEM - Starting Up...
echo  ================================================
echo.

cd /d "C:\Users\Fiser\fiservinventory_win\maintenance_call_system"

echo [%date% %time%] START bat launched > %LOGFILE%

:: Use node directly to invoke PM2 — avoids bash-shim issues in detached contexts
echo [%date% %time%] Pinging PM2 daemon... >> %LOGFILE%
%NODE% %PM2_SCRIPT% ping >> %LOGFILE% 2>&1
set PING_ERR=%errorlevel%
echo [%date% %time%] PM2 ping errorlevel=%PING_ERR% >> %LOGFILE%

if %PING_ERR% neq 0 (
    echo  [*] Starting PM2 daemon and processes...
    echo [%date% %time%] Running: pm2 start ecosystem.config.js >> %LOGFILE%
    %NODE% %PM2_SCRIPT% start ecosystem.config.js >> %LOGFILE% 2>&1
    echo [%date% %time%] pm2 start errorlevel=%errorlevel% >> %LOGFILE%
) else (
    echo  [*] Starting / restarting MCS processes...
    echo [%date% %time%] Running: pm2 restart all >> %LOGFILE%
    %NODE% %PM2_SCRIPT% restart all >> %LOGFILE% 2>&1
    echo [%date% %time%] pm2 restart errorlevel=%errorlevel% >> %LOGFILE%
)

echo [%date% %time%] Waiting for servers... >> %LOGFILE%
echo  [*] Waiting for servers to be ready...
timeout /t 5 /nobreak >nul

:: Health check
curl -s -o nul -w "%%{http_code}" http://localhost:4001/health >> %LOGFILE% 2>&1
if %errorlevel% neq 0 (
    echo  [!] Backend still starting, waiting a few more seconds...
    timeout /t 4 /nobreak >nul
)

echo [%date% %time%] DONE - opening browser >> %LOGFILE%

echo.
echo  ================================================
echo    READY!
echo.
echo    Call Board : http://localhost:3003/board
echo    Admin Page : http://localhost:3003/calls   (redirects to IMMS login)
echo    Kiosk 701  : http://localhost:3003/station?reader=die-press-701
echo  ================================================
echo.

:: Open Chrome to the call board (no-auth kiosk URL). The admin pages now
:: redirect unauthenticated users to IMMS for login.
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://localhost:3003/board"

echo  [*] Browser opened. This window will close in 5 seconds.
timeout /t 5 /nobreak >nul
exit
