# Raspberry Pi Kiosk Network Setup

This document explains how the Raspberry Pi kiosk connects to the IMMS application running on the PC.

## Network Architecture

```
[ Router (Internet) ]
         |
         v
  [ 6-Port Switch ]
    |          |
    v          v
  [ PC ]   [ Raspberry Pi 5 ]
```

- **PC IP**: 10.1.10.50
- **Raspberry Pi IP**: 10.1.10.135 (or similar on the same subnet)
- **Backend runs on PC**: Port 4000
- **Frontend (localhost)**: Port 3002 (for PC use with camera)
- **Frontend (network)**: Port 3001 (for Pi access)

## The Problem

When the Pi kiosk loads the frontend from the PC (`http://10.1.10.50:3001`), API calls that use `localhost:4000` fail because from the Pi's perspective, `localhost` refers to the Pi itself, not the PC.

### Symptoms
- Pi shows "Failed to load die data"
- Pi shows "No die press machines found"
- PC works fine, Pi doesn't
- `curl` from Pi to PC backend works, but browser doesn't

## The Solution

### 1. Environment Variable Configuration

The frontend uses `REACT_APP_API_URL` to determine the backend location. This is configured in `frontend/package.json`:

```json
"start:network-pi": "cross-env HOST=0.0.0.0 PORT=3001 REACT_APP_API_URL=http://10.1.10.50:4000 GENERATE_SOURCEMAP=false BROWSER=none react-scripts start"
```

**Key points:**
- `HOST=0.0.0.0` - Makes the frontend accessible from any network interface
- `PORT=3001` - Network-accessible port
- `REACT_APP_API_URL=http://10.1.10.50:4000` - Points to the PC's backend IP (without `/api/v1`)

### 2. Code Pattern for API URL

In components that make direct axios calls (like `DieTracker.tsx`), the API_URL must append `/api/v1`:

```typescript
const API_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/v1`
  : 'http://localhost:4000/api/v1';
```

This ensures:
- When `REACT_APP_API_URL` is set (Pi): Uses `http://10.1.10.50:4000/api/v1`
- When not set (PC localhost): Uses `http://localhost:4000/api/v1`

### 3. Centralized API Configuration

The app also has centralized API configuration in:
- `frontend/src/config.ts` - Exports `API_URL`
- `frontend/src/utils/axios.ts` - Creates axios instance with `baseURL`

These use the pattern:
```typescript
// config.ts
const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  return 'http://localhost:4000';
};
```

API calls using the centralized axios instance include `/api/v1` in their paths:
```typescript
api.get('/api/v1/parts');  // baseURL + path
```

## Startup Configuration

The `start-app.bat` script starts three servers:

1. **Backend** (Port 4000) - Binds to `0.0.0.0` for network access
2. **Frontend localhost** (Port 3002) - For PC use with camera
3. **Frontend network** (Port 3001) - For Pi with correct `REACT_APP_API_URL`

## Raspberry Pi Kiosk Configuration

The Pi runs Chromium in kiosk mode pointing to the PC:

```bash
chromium --kiosk http://10.1.10.50:3001
```

### Clearing Pi Browser Cache (via SSH)

When changes aren't reflecting on the Pi:

```bash
# Clear Chromium cache
rm -rf ~/.cache/chromium
rm -rf ~/.config/chromium/Default/Cache
rm -rf ~/.config/chromium/Default/Code\ Cache

# Restart Chromium
pkill chromium
```

Or reboot:
```bash
sudo reboot
```

## Troubleshooting

### 1. Pi shows white screen
- Check if frontend server is running on PC: `netstat -ano | findstr :3001`
- Test connectivity from Pi: `curl http://10.1.10.50:3001`

### 2. Pi loads UI but no data
- Test API from Pi: `curl http://10.1.10.50:4000/api/v1/dies/stats`
- Check Windows Firewall allows port 4000
- Verify `REACT_APP_API_URL` is set correctly

### 3. API path doubled (`/api/v1/api/v1/...`)
- The env var should NOT include `/api/v1`
- Code that uses env var should append `/api/v1` itself

### 4. Changes not showing on Pi
- Clear browser cache (see commands above)
- Restart Chromium
- Verify you restarted `start-app.bat` after code changes

## Windows Firewall

If the Pi can't reach the PC, add firewall rules:

```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "IMMS Backend" -Direction Inbound -Port 4000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "IMMS Frontend Network" -Direction Inbound -Port 3001 -Protocol TCP -Action Allow
```

## File Locations

| File | Purpose |
|------|---------|
| `start-app.bat` | Starts all servers |
| `frontend/package.json` | Contains `start:network-pi` script with env vars |
| `frontend/src/config.ts` | Centralized API URL configuration |
| `frontend/src/utils/axios.ts` | Axios instance with baseURL |
| `frontend/src/pages/DieTracker.tsx` | Example of component with direct API calls |
