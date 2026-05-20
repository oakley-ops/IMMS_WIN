#!/usr/bin/env bash
# ── MCS Deploy Script ──────────────────────────────────────────────────────────
# Run from the maintenance_call_system/ directory on the production server.
# Usage: ./deploy.sh
#
# For multiple sites: create a wrapper script per site that sets env vars,
# then calls this script. E.g.:
#   SITE_NAME="Plant 1" DEPLOY_DIR="/opt/mcs-plant1" ./deploy.sh
# ──────────────────────────────────────────────────────────────────────────────

set -e

DEPLOY_DIR="${DEPLOY_DIR:-/opt/mcs}"
NGINX_STATIC="${NGINX_STATIC:-$DEPLOY_DIR/frontend/.next/static}"

echo "==> Pulling latest code..."
git pull

echo "==> Installing backend dependencies..."
cd backend && npm ci --omit=dev && cd ..

echo "==> Installing frontend dependencies..."
cd frontend && npm ci && cd ..

echo "==> Building Next.js frontend..."
cd frontend && npm run build && cd ..

echo "==> Syncing Next.js static files to Nginx serve path..."
mkdir -p "$NGINX_STATIC"
cp -r frontend/.next/static/. "$NGINX_STATIC/"

echo "==> Reloading app processes (zero-downtime)..."
pm2 reload ecosystem.config.js --update-env

echo "==> Reloading Nginx..."
sudo nginx -s reload

echo ""
echo "Deploy complete."
echo "  Board:   http://$(hostname)/board"
echo "  Kiosk:   http://$(hostname)/station?reader=<reader_key>"
echo "  Admin:   http://$(hostname)/calls"
echo "  Health:  http://$(hostname)/health"
