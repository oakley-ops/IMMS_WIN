# Network Connection Troubleshooting Guide

## Overview
This guide helps troubleshoot common network connection issues between the frontend and backend components of the Fiserv Inventory application.

## Common Error Messages

### Frontend Errors
```
Socket.io connection error: Error: timeout
Socket connection error: Error: timeout
Response error: {message: 'Network Error', status: undefined, url: '/api/v1/auth/login', ...}
Login error: AxiosError {message: 'Network Error', name: 'AxiosError', code: 'ERR_NETWORK', ...}
POST http://192.168.50.1:4000/api/v1/auth/login net::ERR_CONNECTION_TIMED_OUT
```

### Root Cause
The frontend is configured to connect to an IP address that is not currently accessible or active on your network.

## Diagnostic Steps

### 1. Check Current Network Configuration
```powershell
# Check your current IP addresses
ipconfig | findstr IPv4

# Expected output example:
# IPv4 Address. . . . . . . . . . . : 10.1.10.171 (WiFi)
# IPv4 Address. . . . . . . . . . . : 192.168.50.1 (Ethernet - if connected)
```

### 2. Verify Backend Server Status
```powershell
# Check if backend is running on port 4000
netstat -an | findstr :4000

# Expected output:
# TCP    0.0.0.0:4000           0.0.0.0:0              LISTENING
```

```powershell
# Check running Node.js processes
Get-Process -Name node -ErrorAction SilentlyContinue
```

### 3. Test Backend Connectivity
```powershell
# Test localhost connection (should work)
curl http://localhost:4000/api/v1/users/login

# Test specific IP connection (may fail)
curl http://192.168.50.1:4000/api/v1/users/login
```

### 4. Check Frontend Server Status
```powershell
# Check frontend servers
netstat -an | findstr :300

# Common ports: 3000, 3001, 3002
```

## Solution Steps

### Option 1: Use Localhost (Recommended for Development)
Update the following files to use `localhost:4000`:

#### 1. `frontend/src/config/index.ts`
```typescript
const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:4000';
```

#### 2. `frontend/src/config.ts`
```typescript
const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  return 'http://localhost:4000';
};
```

#### 3. `frontend/src/utils/socket.ts`
```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
```

#### 4. `frontend/src/services/socket.ts`
```typescript
const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:4000', {
```

#### 5. `frontend/src/services/api.js`
```javascript
const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000',
```

### Option 2: Use Current Network IP
If you need network access from other devices, update the files above to use your current IP address (e.g., `http://10.1.10.171:4000`).

### Option 3: Use Environment Variables
Create environment files:

#### `.env.local` (for localhost development)
```
REACT_APP_API_URL=http://localhost:4000
```

#### `.env.network` (for network access)
```
REACT_APP_API_URL=http://10.1.10.171:4000
```

## Network-Specific Configurations

### WiFi Network (10.1.10.x)
- Use `http://10.1.10.171:4000` (replace with your actual WiFi IP)
- Good for: Other devices on the same WiFi network

### Ethernet Network (192.168.50.x)
- Use `http://192.168.50.1:4000` (when Ethernet is connected)
- Good for: Raspberry Pi connections, direct Ethernet devices

### Localhost
- Use `http://localhost:4000`
- Good for: Development on the same machine

## Backend Server Configuration

### Verify Backend Binding
The backend should be configured to listen on all interfaces:

#### `backend/index.js` (line ~503)
```javascript
server.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});
```

### CORS Configuration
Ensure the backend allows connections from your frontend URLs:

#### `backend/index.js` (lines ~33-41, ~61-69)
```javascript
// Socket.io CORS
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000', 
      'http://localhost:3002',
      'http://10.1.10.171:3000',
      'http://10.1.10.171:3002',
      'http://192.168.50.1:3000',
      'http://192.168.50.1:3001',
      'http://192.168.50.1:3002'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Express CORS
app.use(cors({
  origin: [
    "http://localhost:3000", 
    "http://localhost:3001",
    "http://localhost:3002",
    "http://10.1.10.171:3000",
    "http://10.1.10.171:3002",
    "http://192.168.50.1:3000",
    "http://192.168.50.1:3002"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
```

## Quick Fix Commands

### Update All Frontend Config Files at Once
```powershell
# Navigate to project root
cd C:\Users\Fiser\fiservinventory_win

# Replace old IP with localhost in all relevant files
(Get-Content "frontend\src\config\index.ts") -replace "192\.168\.50\.1:4000", "localhost:4000" | Set-Content "frontend\src\config\index.ts"
(Get-Content "frontend\src\config.ts") -replace "192\.168\.50\.1:4000", "localhost:4000" | Set-Content "frontend\src\config.ts"
(Get-Content "frontend\src\utils\socket.ts") -replace "192\.168\.50\.1:4000", "localhost:4000" | Set-Content "frontend\src\utils\socket.ts"
(Get-Content "frontend\src\services\socket.ts") -replace "192\.168\.50\.1:4000", "localhost:4000" | Set-Content "frontend\src\services\socket.ts"
(Get-Content "frontend\src\services\api.js") -replace "192\.168\.50\.1:4000", "localhost:4000" | Set-Content "frontend\src\services\api.js"
```

## Testing the Fix

### 1. Restart Development Servers
```powershell
# Kill existing Node processes
taskkill /F /IM node.exe

# Restart using the start script
.\start-app.bat
```

### 2. Verify API Connection
Open browser console and check for:
- ✅ No more connection timeout errors
- ✅ Successful API requests
- ✅ Socket.io connection established

### 3. Test Login Functionality
- Navigate to login page
- Enter credentials
- Verify successful authentication

## Prevention

### Environment Variable Setup
Always use environment variables for API URLs:

#### `package.json` scripts
```json
{
  "scripts": {
    "start:localhost": "cross-env REACT_APP_API_URL=http://localhost:4000 react-scripts start",
    "start:wifi": "cross-env REACT_APP_API_URL=http://10.1.10.171:4000 react-scripts start",
    "start:ethernet": "cross-env REACT_APP_API_URL=http://192.168.50.1:4000 react-scripts start"
  }
}
```

### Network Monitoring
Create a simple connectivity check script:

#### `check-connectivity.js`
```javascript
const axios = require('axios');

async function checkConnectivity() {
  const endpoints = [
    'http://localhost:4000',
    'http://10.1.10.171:4000',
    'http://192.168.50.1:4000'
  ];
  
  for (const endpoint of endpoints) {
    try {
      await axios.get(`${endpoint}/api/v1/users/verify`, { timeout: 5000 });
      console.log(`✅ ${endpoint} - Connected`);
    } catch (error) {
      console.log(`❌ ${endpoint} - Failed: ${error.message}`);
    }
  }
}

checkConnectivity();
```

## Additional Resources

- [Socket.io Connection Issues](https://socket.io/docs/v4/troubleshooting-connection-issues/)
- [Axios Network Error Debugging](https://axios-http.com/docs/handling_errors)
- [React Environment Variables](https://create-react-app.dev/docs/adding-custom-environment-variables/)

## Common Gotchas

1. **Browser Cache**: Clear browser cache after configuration changes
2. **Firewall**: Ensure Windows Firewall allows Node.js connections
3. **Network Changes**: IP addresses change when switching between WiFi and Ethernet
4. **Development vs Production**: Different configurations needed for different environments
5. **CORS Errors**: Backend must explicitly allow frontend origins

---

*Last Updated: September 21, 2025*
