#!/bin/bash

# Setup HTTPS Proxy for Camera Access on Raspberry Pi
# This script configures the Pi to proxy HTTPS requests to Windows PC

set -e

echo "🔐 Setting up HTTPS Proxy for Camera Access on Raspberry Pi"
echo "=========================================================="

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ This script should not be run as root. Please run as a regular user."
   exit 1
fi

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "❌ nginx is not installed. Please install nginx first:"
    echo "   sudo apt update && sudo apt install nginx"
    exit 1
fi

# Check if openssl is installed
if ! command -v openssl &> /dev/null; then
    echo "❌ openssl is not installed. Please install openssl first:"
    echo "   sudo apt update && sudo apt install openssl"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Get Windows PC IP address
echo "🔍 Finding Windows PC IP address..."
echo "Common IP addresses for Windows PC:"
ip route | grep -E "192\.168\." | head -5
echo ""

read -p "Enter your Windows PC's IP address (e.g., 192.168.1.100): " WINDOWS_IP

if [[ -z "$WINDOWS_IP" ]]; then
    echo "❌ Windows PC IP address is required"
    exit 1
fi

# Test connection to Windows PC
echo "🧪 Testing connection to Windows PC at $WINDOWS_IP:3000..."
if curl -s --connect-timeout 5 "http://$WINDOWS_IP:3000" > /dev/null; then
    echo "✅ Connection to Windows PC successful"
else
    echo "⚠️  Warning: Cannot connect to $WINDOWS_IP:3000"
    echo "   Make sure your Windows PC is running the app on port 3000"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 1: Generate SSL certificate
echo "🔒 Step 1: Generating SSL certificate..."
bash generate-local-ssl.sh

echo ""

# Step 2: Configure nginx with proxy settings
echo "🌐 Step 2: Configuring nginx proxy..."

# Create nginx configuration with Windows PC IP
echo "📝 Creating nginx configuration for proxy to $WINDOWS_IP:3000..."
sed "s/WINDOWS_PC_IP/$WINDOWS_IP/g" imms_inventory-proxy.conf > imms_inventory-proxy-configured.conf

# Backup existing configuration if it exists
if [ -f /etc/nginx/sites-enabled/imms_inventory-proxy.conf ]; then
    echo "📋 Backing up existing configuration..."
    sudo cp /etc/nginx/sites-enabled/imms_inventory-proxy.conf /etc/nginx/sites-enabled/imms_inventory-proxy.conf.backup
fi

# Copy new configuration
echo "📝 Installing nginx proxy configuration..."
sudo cp imms_inventory-proxy-configured.conf /etc/nginx/sites-available/imms_inventory-proxy.conf

# Enable the site
echo "🔗 Enabling nginx proxy site..."
sudo ln -sf /etc/nginx/sites-available/imms_inventory-proxy.conf /etc/nginx/sites-enabled/

# Disable default site if it exists
if [ -f /etc/nginx/sites-enabled/default ]; then
    echo "🚫 Disabling default nginx site..."
    sudo rm /etc/nginx/sites-enabled/default
fi

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
if sudo nginx -t; then
    echo "✅ nginx configuration is valid"
else
    echo "❌ nginx configuration test failed"
    exit 1
fi

# Step 3: Restart nginx
echo "🔄 Step 3: Restarting nginx..."
sudo systemctl restart nginx

# Check if nginx is running
if sudo systemctl is-active --quiet nginx; then
    echo "✅ nginx is running"
else
    echo "❌ nginx failed to start"
    sudo systemctl status nginx
    exit 1
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📍 Your application is now available at:"
echo "   🔒 https://192.168.50.1 (Camera access enabled)"
echo "   🔗 Proxying to: http://$WINDOWS_IP:3000"
echo ""
echo "⚠️  Browser Security Notice:"
echo "   Since this is a self-signed certificate, your browser will show a security warning."
echo "   To proceed:"
echo "   1. Click 'Advanced' or 'More information'"
echo "   2. Click 'Continue to 192.168.50.1' or 'Accept the risk'"
echo "   3. The camera should now work!"
echo ""
echo "🔧 Troubleshooting:"
echo "   - Check nginx status: sudo systemctl status nginx"
echo "   - Check nginx logs: sudo journalctl -u nginx -f"
echo "   - Test Windows PC: curl http://$WINDOWS_IP:3000"
echo "   - Test certificate: openssl s_client -connect 192.168.50.1:443 -servername 192.168.50.1"
echo ""
echo "📱 For mobile devices:"
echo "   Add the certificate to your device's trusted certificates to avoid security warnings." 