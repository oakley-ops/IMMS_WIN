# Raspberry Pi Connection Troubleshooting Guide

## Problem Description
When accessing the Fiserv Inventory application from a Raspberry Pi, you may encounter connection errors like:
- `net::ERR_CONNECTION_REFUSED`
- `WebSocket connection to 'ws://localhost:4000/socket.io/' failed`
- `Socket.io connection error: TransportError: websocket error`

## Root Cause
The Raspberry Pi frontend is trying to connect to `localhost:4000`, but it should connect to the PC's IP address where the backend server is running.

## Network Setup Overview

### PC Network Configuration
- **Ethernet Interface**: `192.168.50.1` (connected to Pi)
- **WiFi Interface**: `10.1.10.171` (internet connection)
- **Backend Server**: Running on `0.0.0.0:4000` (accessible from both networks)

### Raspberry Pi Network Configuration
- **Ethernet Interface**: `192.168.50.2` (connected to PC)
- **Frontend**: Should connect to `http://192.168.50.1:4000`

## Quick Solution

### 1. Verify Network Connectivity
From your PC, check the current network status:
```powershell
# Check IP configuration
ipconfig | findstr IPv4

# Expected output:
# IPv4 Address. . . . . . . . . . . : 192.168.50.1    (Ethernet)
# IPv4 Address. . . . . . . . . . . : 10.1.10.171     (Wi-Fi)
```

### 2. Test Backend Accessibility
```powershell
# Test if backend is accessible via Ethernet interface
curl http://192.168.50.1:4000/api/v1/users/verify

# Expected response: {"error":"Access denied. No token provided or invalid format."}
# This error is GOOD - it means the server is responding
```

### 3. Update Frontend Configuration
The Pi frontend needs to use the correct API URL. This is configured in the `package.json` script:

**File**: `frontend/package.json`
```json
{
  "scripts": {
    "start:network-pi": "cross-env HOST=0.0.0.0 PORT=3001 REACT_APP_API_URL=http://192.168.50.1:4000 GENERATE_SOURCEMAP=false BROWSER=none react-scripts start"
  }
}
```

### 4. Restart the Application
```powershell
# Stop all Node.js processes
taskkill /F /IM node.exe

# Restart the application
.\start-app.bat
```

## Detailed Diagnostics

### Check Current Server Status
```powershell
# Check backend server
netstat -an | findstr :4000
# Should show: TCP    0.0.0.0:4000    0.0.0.0:0    LISTENING

# Check frontend servers
netstat -an | findstr :300
# Should show servers on ports 3001 and 3002
```

### Verify Pi Connection
```powershell
# Check active connections to Pi
netstat -an | findstr 192.168.50
# Should show established connections from 192.168.50.2 (Pi)
```

## Frontend Server Configuration

### Localhost Server (Port 3002)
- **URL**: `http://localhost:3002`
- **API Target**: `http://localhost:4000`
- **Purpose**: PC development and camera access

### Network Server (Port 3001)
- **URL**: `http://192.168.50.1:3001`
- **API Target**: `http://192.168.50.1:4000`
- **Purpose**: Raspberry Pi and network device access

## Access URLs

### From PC
- **Primary Interface**: `http://localhost:3002` (camera enabled)
- **Network Interface**: `http://192.168.50.1:3001`

### From Raspberry Pi
- **Primary Interface**: `http://192.168.50.1:3001`
- **API Endpoint**: `http://192.168.50.1:4000`

### From WiFi Devices
- **Interface**: `http://10.1.10.171:3001` (if configured)

## Backend CORS Configuration

Ensure the backend allows connections from Pi:

**File**: `backend/index.js`
```javascript
// Socket.io CORS
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000', 
      'http://localhost:3002',
      'http://10.1.10.171:3000',
      'http://10.1.10.171:3002',
      'http://192.168.50.1:3000',    // Pi access
      'http://192.168.50.1:3001',    // Pi access
      'http://192.168.50.1:3002'     // Pi access
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
    "http://192.168.50.1:3000",     // Pi access
    "http://192.168.50.1:3002"      // Pi access
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true
}));
```

## Troubleshooting Steps

### Step 1: Verify Network Layer
```bash
# On Raspberry Pi, test connectivity to PC
ping 192.168.50.1

# Test HTTP connectivity
curl http://192.168.50.1:4000/api/v1/users/verify
```

### Step 2: Check Frontend Configuration
On the Raspberry Pi browser, open Developer Tools (F12) and check:
- Console for JavaScript errors
- Network tab for failed requests
- Look for requests going to `localhost` instead of `192.168.50.1`

### Step 3: Verify API URL
In the browser console on Pi, check:
```javascript
console.log('API URL:', process.env.REACT_APP_API_URL);
```

### Step 4: Socket.io Debugging
Look for WebSocket connection attempts:
- Should connect to `ws://192.168.50.1:4000/socket.io/`
- NOT to `ws://localhost:4000/socket.io/`

## Environment Variables for Different Scenarios

### Development Scripts
```json
{
  "scripts": {
    "start:localhost": "cross-env REACT_APP_API_URL=http://localhost:4000 react-scripts start",
    "start:pi-ethernet": "cross-env REACT_APP_API_URL=http://192.168.50.1:4000 react-scripts start",
    "start:pi-wifi": "cross-env REACT_APP_API_URL=http://10.1.10.171:4000 react-scripts start"
  }
}
```

### Environment Files
Create different `.env` files for different scenarios:

**`.env.pi`**
```
REACT_APP_API_URL=http://192.168.50.1:4000
```

**`.env.local`**
```
REACT_APP_API_URL=http://localhost:4000
```

## Common Issues and Solutions

### Issue: Pi connects to wrong IP
**Symptom**: Connection refused errors
**Solution**: Update `REACT_APP_API_URL` in the Pi frontend startup script

### Issue: CORS errors
**Symptom**: `Access-Control-Allow-Origin` errors
**Solution**: Add Pi URLs to backend CORS configuration

### Issue: Socket.io fails
**Symptom**: WebSocket transport errors
**Solution**: Ensure Socket.io uses same API URL as HTTP requests

### Issue: Intermittent connections
**Symptom**: Sometimes works, sometimes doesn't
**Solution**: Check network stability and DHCP reservations

## Network Setup Recommendations

### Static IP Configuration
Set static IPs to avoid connection issues:

**PC Ethernet**: `192.168.50.1/24`
**Pi Ethernet**: `192.168.50.2/24`

### Firewall Configuration
Ensure Windows Firewall allows:
- Port 4000 (backend API)
- Port 3001 (Pi frontend)
- Port 3002 (localhost frontend)

### DHCP Reservations
Configure your router to assign consistent IPs:
- PC: `192.168.50.1`
- Pi: `192.168.50.2`

## Testing Checklist

- [ ] PC backend accessible via `http://192.168.50.1:4000`
- [ ] Pi can ping `192.168.50.1`
- [ ] Pi frontend loads at `http://192.168.50.1:3001`
- [ ] Pi frontend connects to correct API URL
- [ ] Socket.io connects successfully
- [ ] Login works from Pi
- [ ] Camera functionality works (if required)

---

*Last Updated: September 22, 2025*