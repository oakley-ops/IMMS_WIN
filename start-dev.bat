@echo off
title IMMS + MCS - DEV (ports 4100/4101/3100/3103)
echo Starting the DEV stack. This never touches production (C:\imms\prod, ports 4000/4001/3001/3002/3003).
echo.
echo NOTE: DATABASE_URL comes from each app's .env file. After cutover those point at
echo fiservinventory_dev. Before cutover they still point at the LIVE database - see
echo docs\deployment\PROD_OPERATIONS.md before relying on this script.
echo.

:: IMMS backend (dev) - PORT set inline overrides .env (dotenv does not override existing env)
start "IMMS API (dev 4100)" /min cmd /k "cd /d %~dp0backend && set PORT=4100&& npm run dev"

:: MCS backend (dev)
start "MCS API (dev 4101)" /min cmd /k "cd /d %~dp0maintenance_call_system\backend && set PORT=4101&& set IMMS_API_URL=http://localhost:4100/api/v1&& npm run dev"

:: MCS frontend (dev) - NEXT_PUBLIC_* baked per-process for dev URLs
start "MCS UI (dev 3103)" /min cmd /k "cd /d %~dp0maintenance_call_system\frontend && set NEXT_PUBLIC_API_URL=http://localhost:4101/api/v1&& set NEXT_PUBLIC_SOCKET_URL=http://localhost:4101&& set NEXT_PUBLIC_IMMS_LOGIN_URL=http://localhost:3100/login&& npx next dev -p 3103"

:: IMMS frontend (dev)
start "IMMS UI (dev 3100)" /min cmd /k "cd /d %~dp0frontend && npm run start:dev"

echo.
echo   IMMS API : http://localhost:4100/health
echo   MCS API  : http://localhost:4101/health
echo   IMMS UI  : http://localhost:3100
echo   MCS UI   : http://localhost:3103
echo.
echo This window can be closed; the four minimized windows keep running.
pause
