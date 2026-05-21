# Raspberry Pi DHCP Configuration

## Method 1: Using raspi-config (Easiest)

This method uses the built-in Raspberry Pi configuration tool to set up DHCP.

### Steps:

1. **SSH into your Pi or open a terminal**
   - If connecting remotely: `ssh pi@192.168.50.2` (or your Pi's current IP)
   - If using directly: Open Terminal from the desktop

2. **Run raspi-config:**
   ```bash
   sudo raspi-config
   ```

3. **Navigate through the menu:**
   - Select: **System Options** → **Network Configuration** → **Network Interface Names**
   - Choose your Ethernet interface (usually `eth0`)

4. **Select DHCP:**
   - Choose **"Automatic (DHCP)"**

5. **Exit and reboot:**
   - Press **Tab** to select "Finish" and press **Enter**
   - When prompted, select **Yes** to reboot
   
   Or manually reboot:
   ```bash
   sudo reboot
   ```

### Verify Configuration:

After the Pi reboots, check your IP address:
```bash
ip addr show eth0
```

or

```bash
ifconfig eth0
```

You should see an IP address in the 10.1.10.x range (from your router's DHCP server).

### Notes:

- Make sure your Pi is connected to the switch along with the router before making these changes
- The Pi will automatically receive an IP address from your router's DHCP server
- If you need to find your Pi's new IP address, check your router's DHCP client list or use `ip addr show eth0` on the Pi

