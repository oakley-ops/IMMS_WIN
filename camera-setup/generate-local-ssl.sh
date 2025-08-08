#!/bin/bash

# Generate SSL certificate for local network access
# This enables HTTPS for camera functionality on Raspberry Pi

echo "🔒 Generating SSL certificate for local network access..."

# Create SSL directories if they don't exist
sudo mkdir -p /etc/ssl/certs
sudo mkdir -p /etc/ssl/private

# Generate private key
echo "📝 Generating private key..."
sudo openssl genrsa -out /etc/ssl/private/fiservinventory-local.key 2048

# Create certificate signing request configuration
echo "🔐 Creating certificate configuration..."
sudo tee /tmp/fiservinventory-local.conf > /dev/null <<EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = State
L = City
O = Fiserv Inventory
OU = IT Department
CN = 192.168.50.1

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = 192.168.50.1
IP.1 = 192.168.50.1
IP.2 = 127.0.0.1
EOF

# Generate self-signed certificate
echo "📋 Generating self-signed certificate..."
sudo openssl req -new -x509 -key /etc/ssl/private/fiservinventory-local.key \
    -out /etc/ssl/certs/fiservinventory-local.crt \
    -days 365 \
    -config /tmp/fiservinventory-local.conf \
    -extensions v3_req

# Set proper permissions
echo "🔑 Setting permissions..."
sudo chmod 600 /etc/ssl/private/fiservinventory-local.key
sudo chmod 644 /etc/ssl/certs/fiservinventory-local.crt

# Clean up temporary files
sudo rm /tmp/fiservinventory-local.conf

echo "✅ SSL certificate generated successfully!"
echo ""
echo "📍 Certificate files:"
echo "   Certificate: /etc/ssl/certs/fiservinventory-local.crt"
echo "   Private Key: /etc/ssl/private/fiservinventory-local.key"
echo ""
echo "🚀 Next steps:"
echo "1. Copy the nginx configuration: sudo cp nginx/fiservinventory-local.conf /etc/nginx/sites-available/"
echo "2. Enable the site: sudo ln -s /etc/nginx/sites-available/fiservinventory-local.conf /etc/nginx/sites-enabled/"
echo "3. Test nginx configuration: sudo nginx -t"
echo "4. Restart nginx: sudo systemctl restart nginx"
echo ""
echo "⚠️  Note: You'll need to accept the self-signed certificate warning in your browser"
echo "   or add the certificate to your device's trusted certificates." 