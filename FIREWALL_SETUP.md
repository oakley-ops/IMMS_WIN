# Windows Firewall Setup for Network Access

## Required Firewall Rules

Run these commands as **Administrator** in Command Prompt or PowerShell:

```cmd
netsh advfirewall firewall add rule name="IMMS Frontend" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="IMMS Backend" dir=in action=allow protocol=TCP localport=4000
```

## How to Run as Administrator

1. Press `Win + X` and select "Windows PowerShell (Admin)" or "Command Prompt (Admin)"
2. Click "Yes" when prompted by User Account Control
3. Run the firewall commands above
4. You should see "Ok." after each command if successful

## Verification

To verify the rules were added:
```cmd
netsh advfirewall firewall show rule name="IMMS Frontend"
netsh advfirewall firewall show rule name="IMMS Backend"
```

## Alternative: Temporary Firewall Disable (Testing Only)

For testing purposes only, you can temporarily disable Windows Firewall:
1. Open Windows Security
2. Go to Firewall & network protection
3. Turn off firewall for your current network profile
4. **Remember to turn it back on after testing** 