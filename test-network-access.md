# Testing Network Access - Step by Step

## ✅ Configuration Changes Completed

All the necessary configuration changes have been made:

1. **start-app.bat** - Updated for network access
2. **frontend/package.json** - Added `start:network` script  
3. **backend/index.js** - CORS configured for network IPs
4. **frontend config files** - API URLs updated to use `10.1.10.171:4000`
5. **Windows Firewall** - Rules already configured

## 🚀 Manual Testing Steps

### 1. Start Backend (Terminal 1)
```powershell
cd backend
$env:PGHOST="localhost"; $env:PGUSER="postgres"; $env:PGDATABASE="fiservinventory"; node index.js
```

### 2. Start Frontend (Terminal 2) 
```powershell
cd frontend
npm run start:network
```

### 3. Test Local Access
- Open browser: `http://localhost:3000`
- Login: admin / admin123

### 4. Test Network Access
- From another device: `http://10.1.10.171:3000`
- From Raspberry Pi: `http://10.1.10.171:3000`

## 🔧 If Frontend Still Has Issues

Try this alternative in frontend/package.json:
```json
"start:network": "react-scripts start --host 0.0.0.0 --port 3000"
```

## 🌐 Expected Results

- **Backend**: Should listen on `0.0.0.0:4000`
- **Frontend**: Should be accessible from network at `10.1.10.171:3000`
- **API calls**: Should work from `http://10.1.10.171:4000/api/v1/*`

## 📱 Raspberry Pi Access

Once both services are running:
1. Open browser on Raspberry Pi
2. Navigate to: `http://10.1.10.171:3000`  
3. Login with: **admin** / **admin123**

The application should be fully functional from the Raspberry Pi browser! 