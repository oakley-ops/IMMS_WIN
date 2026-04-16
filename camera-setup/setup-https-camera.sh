#!/bin/bash

# Setup HTTPS for Camera Access on Raspberry Pi
# This script configures SSL and nginx to enable camera functionality

set -e

echo "🔐 Setting up HTTPS for Camera Access on Raspberry Pi"
echo "=================================================="

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

# Step 1: Generate SSL certificate
echo "🔒 Step 1: Generating SSL certificate..."
bash scripts/generate-local-ssl.sh

echo ""

# Step 2: Configure nginx
echo "🌐 Step 2: Configuring nginx..."

# Backup existing configuration if it exists
if [ -f /etc/nginx/sites-enabled/imms_inventory-local.conf ]; then
    echo "📋 Backing up existing configuration..."
    sudo cp /etc/nginx/sites-enabled/imms_inventory-local.conf /etc/nginx/sites-enabled/imms_inventory-local.conf.backup
fi

# Copy new configuration
echo "📝 Installing nginx configuration..."
sudo cp nginx/imms_inventory-local.conf /etc/nginx/sites-available/

# Enable the site
echo "🔗 Enabling nginx site..."
sudo ln -sf /etc/nginx/sites-available/imms_inventory-local.conf /etc/nginx/sites-enabled/

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
echo "   🔒 https://localhost (Camera access enabled)"
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
echo "   - Test certificate: openssl s_client -connect 192.168.50.1:443 -servername 192.168.50.1"
echo ""
echo "📱 For mobile devices:"
echo "   Add the certificate to your device's trusted certificates to avoid security warnings." 