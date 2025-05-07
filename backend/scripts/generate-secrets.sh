#!/bin/bash

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=$JWT_SECRET"

# Generate session secret
SESSION_SECRET=$(openssl rand -base64 32)
echo "SESSION_SECRET=$SESSION_SECRET"

# Generate CSRF token secret
CSRF_SECRET=$(openssl rand -base64 32)
echo "CSRF_SECRET=$CSRF_SECRET"

# Generate cookie secret
COOKIE_SECRET=$(openssl rand -base64 32)
echo "COOKIE_SECRET=$COOKIE_SECRET"

# Output to .env.production
echo "# Security Secrets - Generated on $(date)" >> ../.env.production
echo "JWT_SECRET=$JWT_SECRET" >> ../.env.production
echo "SESSION_SECRET=$SESSION_SECRET" >> ../.env.production
echo "CSRF_SECRET=$CSRF_SECRET" >> ../.env.production
echo "COOKIE_SECRET=$COOKIE_SECRET" >> ../.env.production

echo "Secrets have been generated and added to .env.production" 