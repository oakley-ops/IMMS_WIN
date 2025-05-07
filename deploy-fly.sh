#!/bin/bash

echo "Starting Fly.io deployment..."

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
    echo "Error: flyctl is not installed. Please install it first."
    exit 1
fi

# Check if logged in to Fly.io
if ! flyctl auth whoami &> /dev/null; then
    echo "Error: Not logged in to Fly.io. Please run 'flyctl auth login' first."
    exit 1
fi

# Deploy the application
echo "Deploying application to Fly.io..."
cd backend
flyctl deploy

# Get the Postgres connection details
echo "Getting Postgres connection details..."
DB_URL=$(flyctl postgres show)

if [ $? -ne 0 ]; then
    echo "Error: Failed to get Postgres connection details."
    exit 1
fi

# Run database migrations
echo "Running database migrations..."
flyctl ssh console -C "cd /app && npm run migrate"

# Verify the deployment
echo "Verifying deployment..."
HEALTH_CHECK=$(curl -s https://fiserv-inventory-api.fly.dev/health)

if [[ $HEALTH_CHECK == *"healthy"* ]]; then
    echo "Deployment successful! Application is healthy."
else
    echo "Warning: Health check failed. Please check the logs."
    flyctl logs
fi

echo "Deployment process completed!"

# Show important information
echo "
Important Information:
---------------------
Frontend URL: https://your-app.netlify.app
Backend API: https://fiserv-inventory-api.fly.dev
Health Check: https://fiserv-inventory-api.fly.dev/health

To monitor the application:
- View logs: flyctl logs
- Check status: flyctl status
- Monitor metrics: flyctl metrics
"
