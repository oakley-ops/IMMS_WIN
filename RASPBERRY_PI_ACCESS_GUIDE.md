# Raspberry Pi Browser Access Guide for IMMS App

This guide documents all the steps needed to access the IMMS application from a Raspberry Pi web browser over the network.

## 🎯 **Objective**
Enable network access to the locally running IMMS app so it can be accessed from a Raspberry Pi web browser using the Windows machine's IP address.

## 📋 **Prerequisites**
- Windows machine running the IMMS app
- Raspberry Pi on the same network
- Both devices connected to the same network (WiFi or Ethernet)

## 🌐 **Network Configuration Discovery**

### Step 1: Check Windows Machine IP Address
```powershell
ipconfig | findstr IPv4
```

**Results found:**
- `192.168.50.1` (Alternative network interface)
- `10.1.10.171` (Primary network interface - used for this setup)

## ⚙️ **Application Configuration Changes**

### Step 2: Update start-app.bat for Network Access
**File:** `start-app.bat`

**Original issues:**
- Backend only listening on localhost
- No network IP information displayed
- No clear instructions for network access

**Updated configuration:**
```batch
@echo off
echo Starting IMMS Application...
echo.

:: Display network information
echo Network Configuration:
ipconfig | findstr IPv4
echo.

:: Kill any existing Node.js processes
taskkill /F /IM node.exe >nul 2>&1

:: Start the backend server with email monitoring in a minimized window
echo Starting Backend Server with Email Monitoring (http://0.0.0.0:4000)...
start /min cmd /k "cd backend && set PORT=4000 && set PGHOST=localhost && set PGUSER=postgres && set PGDATABASE=imms_inventory && set HOST=0.0.0.0 && npm run start:all"

:: Wait for a moment to let backend initialize
timeout /t 8

:: Start the frontend server in a minimized window
echo Starting Frontend Server (http://0.0.0.0:3000)...
start /min cmd /k "cd frontend && set HOST=0.0.0.0 && npm start"

echo.
echo Local Access: http://localhost:3000
echo Network Access Options:
echo   - http://10.1.10.171:3000
echo   - http://192.168.50.1:3000
echo.
echo For Raspberry Pi access, use one of the network URLs above
echo depending on which network your Pi is connected to.
echo.

:: Keep this window open
pause
```

**Key changes:**
- Added `HOST=0.0.0.0` to both backend and frontend startup commands
- Added network IP display on startup
- Clear instructions for network access URLs

### Step 3: Backend Network Configuration Verification
**File:** `backend/index.js`

**Verified configuration:**
```javascript
// Start server - already configured correctly
server.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Test URL: http://localhost:${port}/api/v1/test/email`);
  console.log(`Socket.io URL: http://localhost:${port}/socket.io`);
  console.log('Environment:', process.env.NODE_ENV);
});
```

**CORS configuration (already present):**
```javascript
app.use(cors({
  origin: [
    "http://localhost:3000", 
    "http://localhost:3001",
    "http://localhost:3002",
    "http://10.1.10.171:3000",
    "http://10.1.10.171:3002"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
```

## 🔥 **Windows Firewall Configuration**

### Step 4: Configure Windows Firewall Rules
**Issue:** Windows Firewall blocking network access to ports 3000 and 4000

**Solution:** Add firewall rules (requires Administrator privileges)
```cmd
netsh advfirewall firewall add rule name="IMMS Frontend" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="IMMS Backend" dir=in action=allow protocol=TCP localport=4000
```

**Note:** These commands must be run as Administrator in Command Prompt or PowerShell.

## 🔧 **Frontend API Configuration Fix**

### Step 5: Critical API URL Configuration Issue
**Problem discovered:** Double `/api/v1` paths causing 404 errors
- Error: `http://10.1.10.171:4000/api/v1/api/v1/auth/login` (404 Not Found)
- Correct: `http://10.1.10.171:4000/api/v1/auth/login`

### Step 6: Fix Frontend Configuration Files

**File 1:** `frontend/src/config/index.ts`
```typescript
// BEFORE (incorrect)
const apiUrl = process.env.REACT_APP_API_URL || 'http://10.1.10.171:4000/api/v1';

// AFTER (fixed)
const apiUrl = process.env.REACT_APP_API_URL || 'http://10.1.10.171:4000';
```

**File 2:** `frontend/src/utils/axios.ts`
```typescript
// BEFORE (incorrect)
const axiosInstance = axios.create({
  baseURL: 'http://10.1.10.171:4000/api/v1', // Hardcoded for external access
  headers: {
    'Content-Type': 'application/json'
  }
});

// AFTER (fixed)
const axiosInstance = axios.create({
  baseURL: 'http://10.1.10.171:4000', // Fixed: removed duplicate /api/v1
  headers: {
    'Content-Type': 'application/json'
  }
});
```

**File 3:** `frontend/src/services/api.js`
```javascript
// BEFORE (incorrect)
const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://10.1.10.171:4000/api/v1',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// AFTER (fixed)
const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://10.1.10.171:4000',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json'
  }
});
```

## 👤 **User Authentication Setup**

### Step 7: Test User Creation
**File:** `backend/create-test-users.js`

**Available test users:**
```javascript
const testUsers = [
  {
    username: 'admin',
    password: 'admin123',
    email: 'admin@example.com',
    role: 'admin'
  },
  {
    username: 'tech',
    password: 'tech123',
    email: 'tech@example.com',
    role: 'tech'
  },
  {
    username: 'purchasing',
    password: 'purchasing123',
    email: 'purchasing@example.com',
    role: 'purchasing'
  }
];
```

**Create test users (if not already present):**
```bash
node backend/create-test-users.js
```

## 🧪 **Testing and Verification**

### Step 8: Verify Server Status
**Check if both servers are listening on network interfaces:**
```powershell
netstat -an | Select-String ":3000|:4000"
```

**Expected output:**
```
TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING
TCP    0.0.0.0:4000           0.0.0.0:0              LISTENING
```

### Step 9: Test Network Connectivity
**Test backend health endpoint:**
```powershell
curl http://10.1.10.171:4000/health
```

**Expected response:**
```json
{"status":"healthy","timestamp":"2025-07-09T14:37:07.517Z"}
```

**Test frontend accessibility:**
```powershell
curl http://10.1.10.171:3000
```

**Expected:** HTTP 200 status with React app HTML

**Test authentication API:**
```powershell
Invoke-RestMethod -Uri "http://10.1.10.171:4000/api/v1/auth/login" -Method POST -Body '{"username":"admin","password":"admin123"}' -ContentType "application/json"
```

## 🚀 **Final Setup Process**

### Step 10: Complete Startup Procedure
1. **Stop any running processes:**
   ```powershell
   taskkill /F /IM node.exe
   ```

2. **Start the application:**
   ```powershell
   .\start-app.bat
   ```

3. **Verify network access:**
   ```powershell
   Start-Sleep -Seconds 25; netstat -an | Select-String ":3000|:4000"
   ```

## 📱 **Raspberry Pi Access Instructions**

### Step 11: Access from Raspberry Pi
1. **Open web browser on Raspberry Pi**
2. **Navigate to:** `http://10.1.10.171:3000`
3. **Login credentials:**
   - **Username:** `admin`
   - **Password:** `admin123`

### Alternative IP Address
If `10.1.10.171` doesn't work, try: `http://192.168.50.1:3000`

## 🛠️ **Troubleshooting**

### Common Issues and Solutions

**Issue 1: Cannot reach the application**
- **Solution:** Check if both devices are on the same network
- **Test:** Ping from Raspberry Pi: `ping 10.1.10.171`

**Issue 2: Frontend loads but API calls fail**
- **Check:** Browser console for API URL errors
- **Solution:** Refresh browser (Ctrl+F5) after configuration changes

**Issue 3: Firewall blocking access**
- **Solution:** Run firewall commands as Administrator
- **Alternative:** Temporarily disable Windows Firewall for testing

**Issue 4: Servers not starting**
- **Solution:** Use `.\start-app.bat` instead of manual npm start commands
- **Check:** Ensure no other Node.js processes are running

### Network Diagnostics (Raspberry Pi)
```bash
# Test basic connectivity
ping 10.1.10.171

# Test specific ports
curl -v http://10.1.10.171:4000/health
curl -I http://10.1.10.171:3000

# Check Pi's network configuration
ip addr show
ip route show
```

## ✅ **Verification Checklist**

- [ ] Windows machine IP address identified
- [ ] start-app.bat updated with network configuration
- [ ] Windows Firewall rules added for ports 3000 and 4000
- [ ] Frontend API configuration fixed (removed duplicate /api/v1)
- [ ] Test users created and verified
- [ ] Both servers listening on 0.0.0.0 (all interfaces)
- [ ] Network connectivity tested from Windows machine
- [ ] Raspberry Pi can access the application at http://10.1.10.171:3000
- [ ] Login functionality working with admin/admin123

## 📚 **Additional Notes**

### Socket.io Configuration
The socket.io configuration was already correct and didn't require changes:
```typescript
const socket = io(process.env.REACT_APP_API_URL || 'http://10.1.10.171:4000', {
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
  withCredentials: true,
  forceNew: true
});
```

### Environment Variables
No environment variables needed to be set if using the hardcoded IP approach. For dynamic configuration, set:
```
REACT_APP_API_URL=http://10.1.10.171:4000
```

## 🎉 **Success Criteria**
The setup is successful when:
1. You can access `http://10.1.10.171:3000` from the Raspberry Pi browser
2. The login page loads correctly
3. You can log in with admin/admin123
4. All application features work from the Raspberry Pi browser
5. Real-time updates work (if applicable)

---

**Date Created:** July 9, 2025  
**Last Updated:** July 9, 2025  
**Tested On:** Windows 10, Raspberry Pi (Chromium browser)  
**Network:** 10.1.10.x subnet 