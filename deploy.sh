#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting deployment..."

# Install dependencies
echo "📦 Installing dependencies..."
npm run install:all

# Run database migrations
echo "🗄️ Running database migrations..."
cd backend && npm run migrate
cd ..

# Build frontend
echo "🏗️ Building frontend..."
cd frontend && npm run build
cd ..

# Create production artifacts
echo "📦 Creating production artifacts..."
mkdir -p dist
cp -r backend/* dist/
cp -r frontend/build dist/public

# Zip for A2 Hosting
echo "🗜️ Creating deployment package..."
zip -r deploy.zip dist/

echo "✅ Deployment package created successfully!"
echo "Next steps:"
echo "1. Upload deploy.zip to your A2 Hosting account"
echo "2. Extract the contents to your web root directory"
echo "3. Set up your environment variables in A2 Hosting control panel"
echo "4. Restart your Node.js application"
