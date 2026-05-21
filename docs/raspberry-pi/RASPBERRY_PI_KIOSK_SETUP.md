# Raspberry Pi Kiosk Mode Setup Guide

Complete guide for setting up a Raspberry Pi as a secure kiosk that boots directly into the inventory application with internet access blocked.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Network Setup](#network-setup)
3. [Network Restrictions (Block Internet)](#network-restrictions-block-internet)
4. [Kiosk Mode Configuration](#kiosk-mode-configuration)
5. [Disable Keyring Prompts](#disable-keyring-prompts)
6. [Verification](#verification)
7. [Reverting Changes](#reverting-changes)
8. [Applying to Another Pi](#applying-to-another-pi)

---

## Prerequisites

- Raspberry Pi 3 or newer (with at least 1GB RAM)
- Raspberry Pi OS (64-bit) installed
- Network switch (Netgear GS105GE or similar)
- PC running the inventory application at `10.1.10.50:3001`
- Router providing internet access
- SSH access to the Pi

**Network Configuration:**
- PC IP: `10.1.10.50` (DHCP from router)
- Router Gateway: `10.1.10.1`
- Pi will receive IP via DHCP (e.g., `10.1.10.135`)

---

## Network Setup

### Step 1: Physical Connections

Connect all devices to the switch:
- Router → Switch (any port)
- PC → Switch (any port)
- Raspberry Pi → Switch (any port)

**Note:** Order of connection doesn't matter with unmanaged switches.

### Step 2: Configure Pi to Use DHCP

SSH into the Pi and configure network:

```bash
sudo raspi-config
```

Navigate to:
- **System Options** → **Network Configuration** → **Network Interface Names**
- Select your Ethernet interface (usually `eth0` or `end0`)
- Choose **"Automatic (DHCP)"**

Reboot:
```bash
sudo reboot
```

### Step 3: Verify Network Configuration

After reboot, check IP address:

```bash
ip addr show
```

Or:
```bash
ifconfig
```

You should see an IP in the `10.1.10.x` range from your router.

---

## Network Restrictions (Block Internet)

To prevent the Pi from accessing the internet while allowing access to your PC application:

### Step 1: Remove IPv4 Default Gateway

```bash
sudo ip route del default
```

### Step 2: Remove IPv6 Default Gateway

```bash
sudo ip -6 route del default
```

### Step 3: Disable IPv6 Router Advertisements

Prevent IPv6 default route from being re-added:

```bash
sudo nano /etc/sysctl.conf
```

Add these lines at the end:

```
# Disable IPv6 Router Advertisements
net.ipv6.conf.all.accept_ra = 0
net.ipv6.conf.default.accept_ra = 0
net.ipv6.conf.end0.accept_ra = 0
```

Apply changes:
```bash
sudo sysctl -p
```

### Step 4: Make Network Restrictions Persistent

Create a startup script to remove default routes on boot:

```bash
sudo nano /usr/local/bin/block-internet.sh
```

Add:

```bash
#!/bin/bash
# Remove IPv4 default gateway
ip route del default 2>/dev/null || true

# Remove IPv6 default gateway  
ip -6 route del default 2>/dev/null || true
```

Make executable:
```bash
sudo chmod +x /usr/local/bin/block-internet.sh
```

Add to crontab for startup:
```bash
sudo crontab -e
```

Add this line:
```
@reboot /usr/local/bin/block-internet.sh
```

### Step 5: Verify Internet is Blocked

Test that internet access is blocked:

```bash
ping google.com
```

Should fail or timeout.

Test that local access works:

```bash
curl http://10.1.10.50:3001
```

Should connect successfully.

---

## Kiosk Mode Configuration

### Step 1: Install Required Software

```bash
sudo apt update
sudo apt -y install wtype chromium
```

### Step 2: Create Refresh Script

Create a script to auto-refresh the page every 5 minutes:

```bash
nano ~/refresh-kiosk.sh
```

Add this content:

```bash
#!/bin/bash

# Wait for Chromium to start
sleep 10

# Find Chromium browser process ID
chromium_pid=$(pgrep chromium | head -1)

# Check if Chromium is running
while [[ -z $chromium_pid ]]; do
  echo "Chromium browser is not running yet."
  sleep 5
  chromium_pid=$(pgrep chromium | head -1)
done

echo "Chromium browser process ID: $chromium_pid"

# Loop to refresh the page every 5 minutes
while true; do
  sleep 300  # Wait 5 minutes (300 seconds)
  # Send Ctrl+R to refresh the page
  wtype -M ctrl -P r -p r
done
```

Make executable:
```bash
chmod +x ~/refresh-kiosk.sh
```

### Step 3: Configure Desktop Auto-Login

Enable desktop to start automatically:

```bash
sudo raspi-config
```

Navigate to:
- **System Options** → **Boot / Auto Login** → **Desktop Autologin**

### Step 4: Switch to X11 Desktop (if using Wayland)

If your Pi is using Wayland, switch to X11 for compatibility:

```bash
sudo nano /etc/lightdm/lightdm.conf
```

Find the line:
```
autologin-session=rpd-labwc
```

Change to:
```
autologin-session=rpd-x
```

### Step 5: Create LXDE Autostart File

Create the autostart file for LXDE:

```bash
mkdir -p ~/.config/lxsession/rpd-x
```

```bash
nano ~/.config/lxsession/rpd-x/autostart
```

Add this content (replace `10.1.10.50:3001` with your app URL if different):

```
@chromium http://10.1.10.50:3001 --kiosk --noerrdialogs --disable-infobars --no-first-run --enable-features=OverlayScrollbar --start-maximized
@~/refresh-kiosk.sh
```

**Chromium flags explained:**
- `--kiosk`: Full-screen kiosk mode
- `--noerrdialogs`: Suppress error dialogs
- `--disable-infobars`: Disable notification bars
- `--no-first-run`: Skip first-run setup
- `--enable-features=OverlayScrollbar`: Overlay scrollbars
- `--start-maximized`: Start maximized

### Step 6: Reboot to Test

```bash
sudo reboot
```

After reboot, the Pi should automatically:
1. Boot to desktop
2. Launch Chromium in kiosk mode
3. Display your application at `http://10.1.10.50:3001`
4. Auto-refresh every 5 minutes

---

## Disable Keyring Prompts

To prevent password prompts on startup:

### Option 1: Remove Keyring (Simplest)

```bash
rm -rf ~/.local/share/keyrings
```

On next login, when prompted to create a new keyring, set password to empty (press Enter).

### Option 2: Set Empty Password

When the keyring prompt appears:
1. Enter your current password (or leave blank)
2. Set new password to empty (press Enter)
3. Confirm the warning

This will stop the keyring prompts permanently.

---

## Verification

### Check Kiosk is Running

```bash
ps aux | grep chromium
```

Should show Chromium process running.

### Check Network Restrictions

```bash
# Should show only local network routes
ip route show

# Should fail (no internet)
ping google.com

# Should work (local access)
curl http://10.1.10.50:3001
```

### Check Autostart Files

```bash
cat ~/.config/lxsession/rpd-x/autostart
cat ~/refresh-kiosk.sh
```

Both files should exist and be executable.

---

## Reverting Changes

### Restore Internet Access

```bash
# Restore IPv4 default gateway
sudo ip route add default via 10.1.10.1

# Restore IPv6 default gateway (if needed)
sudo ip -6 route add default via fe80::7654:7dff:feb2:56f6 dev end0

# Remove startup script from crontab
sudo crontab -e
# Remove the @reboot line for block-internet.sh

# Re-enable IPv6 Router Advertisements
sudo nano /etc/sysctl.conf
# Change accept_ra values back to 1, or remove the lines
sudo sysctl -p
```

### Disable Kiosk Mode

```bash
# Remove autostart file
rm ~/.config/lxsession/rpd-x/autostart

# Or rename to backup
mv ~/.config/lxsession/rpd-x/autostart ~/.config/lxsession/rpd-x/autostart.bak

# Reboot
sudo reboot
```

### Disable Desktop Auto-Login

```bash
sudo raspi-config
```

Navigate to:
- **System Options** → **Boot / Auto Login** → **Console Autologin** or **To Desktop (require password)**

---

## Applying to Another Pi

### Option 1: Clone SD Card (Fastest)

**Pros:**
- Fastest method
- Exact copy of configuration
- All settings preserved

**Cons:**
- Requires physical access to SD cards
- IP address will need to be updated (or use DHCP)
- Hostname will be the same (may cause conflicts)

**Steps:**

1. **On your PC, use a disk imaging tool:**
   - Windows: Win32 Disk Imager, Raspberry Pi Imager, or `dd` (if using WSL)
   - Linux/Mac: `dd` command

2. **Using Win32 Disk Imager:**
   - Insert configured SD card into PC
   - Open Win32 Disk Imager
   - Select SD card as source
   - Click "Read" to create image file
   - Save as `pi-kiosk-backup.img`

3. **Write to new SD card:**
   - Insert new SD card
   - Select image file
   - Click "Write" to copy to new card

4. **Update network settings (if needed):**
   - Boot new Pi
   - SSH in
   - If IP conflicts, update hostname:
     ```bash
     sudo raspi-config
     # System Options → Hostname → Enter new hostname
     ```
   - Reboot

### Option 2: Manual Reconfiguration (Recommended for Multiple Pi's)

**Pros:**
- Can customize each Pi
- Avoids IP conflicts
- Better for production deployment

**Cons:**
- Takes longer
- Requires running setup steps on each Pi

**Steps:**

1. **Fresh Raspberry Pi OS Install:**
   - Use Raspberry Pi Imager
   - Enable SSH during setup
   - Set hostname (e.g., `pi-kiosk-1`, `pi-kiosk-2`, etc.)

2. **Follow this guide from the beginning:**
   - Network Setup
   - Network Restrictions
   - Kiosk Mode Configuration
   - Disable Keyring

3. **Create a setup script (optional):**
   
   Save all commands to a script file:
   
   ```bash
   nano ~/setup-kiosk.sh
   ```
   
   Add all setup commands, then run:
   ```bash
   chmod +x ~/setup-kiosk.sh
   sudo ./setup-kiosk.sh
   ```

### Option 3: Partial Clone with Updates

Best of both worlds:

1. **Clone SD card** (gets base configuration)
2. **SSH into new Pi**
3. **Update hostname:**
   ```bash
   sudo raspi-config
   ```
4. **Update app URL** (if different):
   ```bash
   nano ~/.config/lxsession/rpd-x/autostart
   # Update the URL if needed
   ```
5. **Reboot**

---

## Troubleshooting

### Kiosk Doesn't Start After Reboot

1. **Check if desktop is starting:**
   ```bash
   ps aux | grep Xorg
   ```

2. **Check autostart file:**
   ```bash
   cat ~/.config/lxsession/rpd-x/autostart
   ```

3. **Check for errors:**
   ```bash
   cat ~/.xsession-errors
   ```

4. **Test Chromium manually:**
   ```bash
   chromium http://10.1.10.50:3001 --kiosk
   ```

### Internet Still Works

1. **Check routes:**
   ```bash
   ip route show
   ip -6 route show
   ```

2. **Verify IPv6 is disabled:**
   ```bash
   cat /etc/sysctl.conf | grep accept_ra
   ```

3. **Check startup script:**
   ```bash
   sudo crontab -l
   ```

### Keyring Still Prompts

1. **Remove keyring again:**
   ```bash
   rm -rf ~/.local/share/keyrings
   ```

2. **On next login, set empty password**

### Can't Access App

1. **Verify PC app is running:**
   - Check `http://10.1.10.50:3001` from another device

2. **Test connectivity:**
   ```bash
   ping 10.1.10.50
   curl http://10.1.10.50:3001
   ```

3. **Check firewall on PC:**
   - Windows Firewall may need to allow port 3001

---

## Security Notes

- **Physical Security:** Place Pi in a locked case to prevent USB access
- **SSH Access:** Consider disabling password authentication and using SSH keys only
- **Read-Only SD Card:** Can enable overlay filesystem for extra protection
- **Network Isolation:** Pi can only access local network, not internet
- **No Desktop Access:** Kiosk mode prevents users from accessing system

---

## Summary

This setup creates a secure kiosk that:
- ✅ Boots directly into your application
- ✅ Blocks internet access
- ✅ Allows access only to `10.1.10.50:3001`
- ✅ Auto-refreshes every 5 minutes
- ✅ Prevents user access to desktop/system
- ✅ Can be easily cloned or reconfigured

**Key Files Created:**
- `~/refresh-kiosk.sh` - Auto-refresh script
- `~/.config/lxsession/rpd-x/autostart` - Kiosk autostart
- `/usr/local/bin/block-internet.sh` - Internet blocking script
- `/etc/sysctl.conf` - IPv6 router advertisement settings

**Last Updated:** January 2, 2026

