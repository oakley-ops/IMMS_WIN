@echo off
title MCS - Stopping...
color 0C
echo.
echo  ================================================
echo    MAINTENANCE CALL SYSTEM - Shutting Down...
echo  ================================================
echo.

set NODE="C:\Program Files\nodejs\node.exe"
set PM2_SCRIPT="C:\Users\Fiser\AppData\Roaming\npm\node_modules\pm2\bin\pm2"
%NODE% %PM2_SCRIPT% stop all >nul 2>&1
if %errorlevel% equ 0 (
    echo  [*] MCS backend and frontend stopped.
) else (
    echo  [!] PM2 not running or processes already stopped.
)

echo.
echo  ================================================
echo    All MCS processes stopped.
echo  ================================================
echo.
echo  This window will close in 3 seconds.
timeout /t 3 /nobreak >nul
exit
