# Raspberry Pi Camera Setup Guide

## Problem Description

The camera functionality in the inventory system requires HTTPS to work properly. This is a security requirement enforced by modern web browsers for accessing the camera API (`navigator.mediaDevices.getUserMedia`).

### Error Symptoms
- `navigator.mediaDevices: undefined`
- `getUserMedia: undefined`
- `Camera API available: false`
- Error message: "Camera access requires HTTPS"

## Solution Overview

To enable camera access on your Raspberry Pi, you need to configure HTTPS with a self-signed SSL certificate for local network access.

## Quick Setup (Recommended)

### 1. Run the Automated Setup Script

```bash
# Navigate to your project directory
cd /path/to/your/fiservinventory_win

# Run the automated setup script
bash scripts/setup-https-camera.sh
```

This script will:
- Generate a self-signed SSL certificate
- Configure nginx for HTTPS
- Enable the new configuration
- Restart nginx

### 2. Access via HTTPS

After running the setup script, access your application via:
- **https://192.168.50.1** (Camera access enabled)
- **https://localhost** (Camera access enabled)

### 3. Accept the Security Certificate

Since this is a self-signed certificate, your browser will show a security warning:
1. Click "Advanced" or "More information"
2. Click "Continue to 192.168.50.1" or "Accept the risk"
3. The camera should now work!

## Manual Setup (Advanced)

### Step 1: Generate SSL Certificate

```bash
# Make the script executable
chmod +x scripts/generate-local-ssl.sh

# Generate SSL certificate
bash scripts/generate-local-ssl.sh
```

### Step 2: Configure nginx

```bash
# Copy the nginx configuration
sudo cp nginx/fiservinventory-local.conf /etc/nginx/sites-available/

# Enable the site
sudo ln -s /etc/nginx/sites-available/fiservinventory-local.conf /etc/nginx/sites-enabled/

# Test the configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

### Step 3: Verify Setup

```bash
# Check nginx status
sudo systemctl status nginx

# Test SSL certificate
openssl s_client -connect 192.168.50.1:443 -servername 192.168.50.1
```

## Alternative Solutions

### Option 1: Use Localhost

If you're accessing the application locally on the Raspberry Pi:
```bash
# Access via localhost (no HTTPS required)
http://localhost:3000
```

### Option 2: File Upload Only

If you don't need camera functionality, you can:
1. Use the file upload buttons in the interface
2. Upload images directly from your device's gallery
3. Use drag & drop functionality

## Troubleshooting

### nginx Won't Start
```bash
# Check nginx error logs
sudo journalctl -u nginx -f

# Check configuration syntax
sudo nginx -t
```

### Certificate Issues
```bash
# Regenerate certificate
bash scripts/generate-local-ssl.sh

# Check certificate validity
openssl x509 -in /etc/ssl/certs/fiservinventory-local.crt -text -noout
```

### Camera Still Not Working
1. **Clear browser cache** - Old HTTP content might be cached
2. **Check browser permissions** - Ensure camera access is allowed
3. **Try different browsers** - Chrome, Firefox, Safari, Edge
4. **Check camera hardware** - Test with other applications

### Mobile Device Access

To avoid security warnings on mobile devices:
1. Export the certificate: `/etc/ssl/certs/fiservinventory-local.crt`
2. Install it on your mobile device as a trusted certificate
3. Access the site via HTTPS

## Technical Details

### Why HTTPS is Required

Modern web browsers enforce HTTPS for:
- Camera access (`getUserMedia`)
- Microphone access
- Location services
- Other sensitive APIs

This is a security feature to prevent malicious websites from accessing your camera over unencrypted connections.

### Certificate Configuration

The generated certificate includes:
- **Subject**: 192.168.50.1
- **Alt Names**: localhost, 192.168.50.1, 127.0.0.1
- **Validity**: 365 days
- **Key Size**: 2048 bits RSA

### nginx Configuration

The nginx configuration includes:
- **SSL/TLS**: Modern cipher suites
- **Security Headers**: XSS protection, content type options
- **File Uploads**: Increased limits for image uploads
- **Rate Limiting**: API request protection

## Testing Camera Functionality

After setup, test the camera by:
1. Navigate to a part in your inventory
2. Click "Take Photo" or the camera icon
3. Accept camera permissions when prompted
4. The camera view should appear
5. Take a photo and verify it uploads successfully

## Security Considerations

### Self-Signed Certificate Warnings
- Browsers will show security warnings
- This is normal for self-signed certificates
- Safe to proceed on your local network

### Network Security
- Certificate is only valid for your local network
- HTTPS traffic is encrypted
- Camera access is restricted to your domain

### Production Recommendations
For production deployment:
1. Use a proper SSL certificate from a Certificate Authority
2. Configure proper domain names
3. Implement proper certificate management
4. Consider using Let's Encrypt for free certificates

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review nginx logs: `sudo journalctl -u nginx -f`
3. Verify certificate: `openssl x509 -in /etc/ssl/certs/fiservinventory-local.crt -text -noout`
4. Test network connectivity: `curl -k https://192.168.50.1`

## Files Created

The setup process creates these files:
- `nginx/fiservinventory-local.conf` - nginx configuration
- `scripts/generate-local-ssl.sh` - SSL certificate generation
- `scripts/setup-https-camera.sh` - Automated setup script
- `/etc/ssl/certs/fiservinventory-local.crt` - SSL certificate
- `/etc/ssl/private/fiservinventory-local.key` - SSL private key 