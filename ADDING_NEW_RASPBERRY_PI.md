# Adding a New Raspberry Pi Kiosk to the Network

This guide explains how to connect an additional Raspberry Pi to the network switch to access the IMMS application.

## Prerequisites

- Raspberry Pi (Model 4 or 5 recommended)
- MicroSD card (16GB+ recommended)
- Ethernet cable
- Power supply for the Pi
- Access to the 6-port switch
- Keyboard/mouse/monitor for initial setup (or SSH access)

## Network Overview

```
[ Router (Internet) ]
         |
         v
  [ 6-Port Switch ]
    |      |      |
    v      v      v
  [ PC ] [ Pi 1 ] [ Pi 2 (new) ]

  PC:     10.1.10.50 (runs backend + frontend servers)
  Pi 1:   10.1.10.135 (existing kiosk)
  Pi 2:   10.1.10.XXX (new kiosk - you assign)
```

## Step 1: Prepare the Raspberry Pi OS

### Option A: Fresh Install
1. Download Raspberry Pi Imager from https://www.raspberrypi.com/software/
2. Flash **Raspberry Pi OS Lite** (or Desktop if preferred) to the SD card
3. In Imager settings (gear icon), configure:
   - Hostname: `imms-kiosk-2` (or similar)
   - Enable SSH
   - Set username/password (e.g., `imms` / `your-password`)
   - Configure WiFi (optional, for initial setup)

### Option B: Clone Existing Pi
If you want to clone your existing Pi setup:
```bash
# On existing Pi, create image
sudo dd if=/dev/mmcblk0 of=/path/to/backup.img bs=4M status=progress

# Write to new SD card using Raspberry Pi Imager or dd
```

## Step 2: Physical Connection

1. Insert the prepared SD card into the new Pi
2. Connect an Ethernet cable from the Pi to an available port on the 6-port switch
3. Connect power to the Pi
4. Wait for it to boot (green LED activity)

## Step 3: Find the Pi's IP Address

### From your PC (Windows):
```cmd
# Scan the network for devices
arp -a

# Or use Advanced IP Scanner (free download)
```

### From the router:
- Log into your router admin panel (typically http://10.1.10.1)
- Look for connected devices / DHCP leases

### From the Pi (if you have monitor connected):
```bash
ip addr show eth0
```

## Step 4: Configure Static IP Address

SSH into the new Pi:
```bash
ssh imms@<pi-ip-address>
```

### Edit the network configuration:

#### For Raspberry Pi OS Bookworm (newer):
```bash
sudo nmcli con mod "Wired connection 1" ipv4.addresses 10.1.10.140/24
sudo nmcli con mod "Wired connection 1" ipv4.gateway 10.1.10.1
sudo nmcli con mod "Wired connection 1" ipv4.dns "10.1.10.1,8.8.8.8"
sudo nmcli con mod "Wired connection 1" ipv4.method manual
sudo nmcli con up "Wired connection 1"
```

#### For older Raspberry Pi OS (dhcpcd):
```bash
sudo nano /etc/dhcpcd.conf
```

Add at the bottom:
```
interface eth0
static ip_address=10.1.10.140/24
static routers=10.1.10.1
static domain_name_servers=10.1.10.1 8.8.8.8
```

Save and reboot:
```bash
sudo reboot
```

**Note:** Choose an IP that doesn't conflict with existing devices:
- PC: 10.1.10.50
- Pi 1: 10.1.10.135
- Pi 2: 10.1.10.140 (example)

## Step 5: Install Kiosk Dependencies

SSH into the Pi with its new static IP:
```bash
ssh imms@10.1.10.140
```

### Install Chromium and X server:
```bash
sudo apt update
sudo apt install -y chromium-browser xserver-xorg x11-xserver-utils xinit openbox
```

### Install unclutter (hides mouse cursor):
```bash
sudo apt install -y unclutter
```

## Step 6: Configure Kiosk Auto-Start

### Create the kiosk startup script:
```bash
nano ~/kiosk.sh
```

Add the following:
```bash
#!/bin/bash

# Disable screen blanking
xset s off
xset s noblank
xset -dpms

# Hide mouse cursor after 0.5 seconds of inactivity
unclutter -idle 0.5 -root &

# Wait for network
sleep 5

# Start Chromium in kiosk mode pointing to the PC
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --enable-features=OverlayScrollbar \
  --start-maximized \
  --disable-translate \
  --disable-features=TranslateUI \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  http://10.1.10.50:3001
```

Make it executable:
```bash
chmod +x ~/kiosk.sh
```

### Configure auto-login and auto-start:

#### Create Openbox autostart:
```bash
mkdir -p ~/.config/openbox
nano ~/.config/openbox/autostart
```

Add:
```bash
~/kiosk.sh &
```

#### Configure auto-login to start X:
```bash
nano ~/.bash_profile
```

Add:
```bash
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  startx -- -nocursor
fi
```

#### Enable auto-login:
```bash
sudo raspi-config
```
Navigate to: **System Options** > **Boot / Auto Login** > **Console Autologin**

## Step 7: Test the Kiosk

Reboot the Pi:
```bash
sudo reboot
```

The Pi should:
1. Boot up
2. Auto-login
3. Start X server
4. Launch Chromium in kiosk mode
5. Display the IMMS application

## Step 8: Verify Connectivity

From the new Pi, test the connections:

### Test frontend:
```bash
curl -I http://10.1.10.50:3001
```
Expected: `HTTP/1.1 200 OK`

### Test backend API:
```bash
curl http://10.1.10.50:4000/api/v1/dies/stats
```
Expected: JSON response with die statistics

## Troubleshooting

### Pi can't reach the PC
```bash
# Test basic connectivity
ping 10.1.10.50

# Check if ports are open
nc -zv 10.1.10.50 3001
nc -zv 10.1.10.50 4000
```

If ping works but ports don't, check Windows Firewall on the PC.

### White screen on kiosk
- Wait longer - React dev server can take time
- Check if `start-app.bat` is running on the PC
- Try accessing http://10.1.10.50:3001 from another device

### Kiosk doesn't auto-start
```bash
# Check if X is running
ps aux | grep X

# Manually start kiosk to see errors
startx
```

### Need to exit kiosk mode
- Press `Alt + F4` to close Chromium
- Or SSH in and run: `pkill chromium`

### Clear browser cache
```bash
rm -rf ~/.cache/chromium
rm -rf ~/.config/chromium/Default/Cache
rm -rf ~/.config/chromium/Default/Code\ Cache
sudo reboot
```

## Quick Reference

| Device | IP Address | Purpose |
|--------|------------|---------|
| PC | 10.1.10.50 | Runs backend (4000) + frontend (3001, 3002) |
| Pi 1 | 10.1.10.135 | Existing kiosk |
| Pi 2 | 10.1.10.140 | New kiosk (example) |
| Router | 10.1.10.1 | Gateway |

| URL | Purpose |
|-----|---------|
| http://10.1.10.50:3001 | Frontend for Pi kiosks |
| http://10.1.10.50:3002 | Frontend for PC (with camera) |
| http://10.1.10.50:4000 | Backend API |

## Adding More Pis

Repeat Steps 1-8 for each additional Pi, ensuring:
1. Each Pi has a **unique static IP** (e.g., 10.1.10.141, 10.1.10.142, etc.)
2. Each Pi has a **unique hostname** (e.g., `imms-kiosk-3`, `imms-kiosk-4`)
3. All Pis point to the same PC URL: `http://10.1.10.50:3001`

## Optional: Create a Pi Image for Faster Deployment

Once you have one Pi fully configured:

1. Shut down the Pi
2. Remove the SD card
3. Create an image using Raspberry Pi Imager or Win32DiskImager
4. For new Pis, flash this image and only change:
   - Hostname
   - Static IP address
