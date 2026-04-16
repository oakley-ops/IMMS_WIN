#!/bin/bash

echo "🔒 Starting Security Audit..."

# Check Node.js dependencies
echo "📦 Checking Node.js dependencies..."
npm audit

# Check environment variables
echo "🔑 Checking environment variables..."
required_vars=(
    "JWT_SECRET"
    "SESSION_SECRET"
    "CSRF_SECRET"
    "COOKIE_SECRET"
    "DB_USER"
    "DB_PASSWORD"
    "DB_HOST"
    "DB_NAME"
    "CORS_ORIGIN"
)

missing_vars=0
for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" ../.env.production; then
        echo "❌ Missing required environment variable: $var"
        missing_vars=$((missing_vars + 1))
    fi
done

# Check SSL configuration
echo "🔐 Checking SSL configuration..."
if [ ! -f "/etc/ssl/private/imms_inventory.key" ] || [ ! -f "/etc/ssl/certs/imms_inventory.crt" ]; then
    echo "❌ SSL certificates not found"
    missing_vars=$((missing_vars + 1))
fi

# Check file permissions
echo "📁 Checking file permissions..."
if [ -f "../.env.production" ]; then
    file_perms=$(stat -f "%OLp" "../.env.production")
    if [ "$file_perms" != "600" ]; then
        echo "❌ .env.production file permissions should be 600, current: $file_perms"
        missing_vars=$((missing_vars + 1))
    fi
fi

# Check database backup
echo "💾 Checking database backups..."
if [ ! -d "/var/backups/imms_inventory" ]; then
    echo "❌ Backup directory not found"
    missing_vars=$((missing_vars + 1))
fi

# Check monitoring setup
echo "📊 Checking monitoring setup..."
if ! curl -s http://localhost:9090/metrics > /dev/null; then
    echo "❌ Monitoring metrics endpoint not accessible"
    missing_vars=$((missing_vars + 1))
fi

# Summary
echo "🔍 Security Audit Summary:"
if [ $missing_vars -eq 0 ]; then
    echo "✅ All security checks passed!"
else
    echo "❌ Found $missing_vars security issues that need attention"
    exit 1
fi 