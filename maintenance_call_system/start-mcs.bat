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

:: Use node directly to invoke PM2 — avoids bash-shim issues in detached contexts.
:: `pm2 startOrRestart` is idempotent: it starts the apps if they aren't
:: running, and restarts them in place if they are. This covers all three
:: states cleanly (daemon down / daemon up with zero processes / daemon up
:: with processes registered) without branching, and also avoids the prior
:: bug where a daemon survived but its managed processes did not — the old
:: branch ran `pm2 restart all` on an empty list and silently did nothing.
echo  [*] Starting / restarting MCS processes...
echo [%date% %time%] Running: pm2 startOrRestart ecosystem.config.js >> %LOGFILE%
%NODE% %PM2_SCRIPT% startOrRestart ecosystem.config.js >> %LOGFILE% 2>&1
echo [%date% %time%] pm2 startOrRestart errorlevel=%errorlevel% >> %LOGFILE%

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
