@echo off
echo ===============================================
echo IMMS Inventory Network Setup Verification
echo ===============================================
echo.

echo 1. Network Configuration:
echo -------------------------
ipconfig | findstr IPv4
echo.

echo 2. Checking if ports are in use:
echo ----------------------------------
netstat -an | findstr ":3000\|:4000"
echo.

echo 3. Testing backend health endpoint:
echo ------------------------------------
timeout /t 2 >nul
curl -s http://10.1.10.171:4000/health 2>nul || echo Could not reach backend at 10.1.10.171:4000

echo.
echo 4. Testing localhost backend:
echo -----------------------------
curl -s http://localhost:4000/health 2>nul || echo Could not reach backend at localhost:4000

echo.
echo 5. Firewall status check:
echo -------------------------
netsh advfirewall firewall show rule name="IMMS Inventory Frontend" 2>nul | findstr "Rule Name" || echo Firewall rule for Frontend not found
netsh advfirewall firewall show rule name="IMMS Inventory Backend" 2>nul | findstr "Rule Name" || echo Firewall rule for Backend not found

echo.
echo ===============================================
echo Next Steps:
echo ===============================================
echo 1. If ports 3000/4000 are not listening: run start-dev.bat for the dev stack, or see docs\deployment\PROD_OPERATIONS.md for production.
echo 2. If firewall rules are missing, run as Administrator:
echo    netsh advfirewall firewall add rule name="IMMS Inventory Frontend" dir=in action=allow protocol=TCP localport=3000
echo    netsh advfirewall firewall add rule name="IMMS Inventory Backend" dir=in action=allow protocol=TCP localport=4000
echo 3. Access from Raspberry Pi: http://10.1.10.171:3000
echo 4. Login with: admin / admin123
echo.
pause 