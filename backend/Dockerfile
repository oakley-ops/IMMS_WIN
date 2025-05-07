FROM node:18-slim

# Install PostgreSQL client and other utilities
RUN apt-get update && apt-get install -y \
    postgresql-client \
    curl \
    gzip \
    cron \
    && rm -rf /var/lib/apt/lists/*

# Install supercronic for better cron management in containers
RUN curl -fsSLo /usr/local/bin/supercronic \
    "https://github.com/aptible/supercronic/releases/download/v0.2.1/supercronic-linux-amd64" \
    && chmod +x /usr/local/bin/supercronic

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create backup directory
RUN mkdir -p /app/backups

# Make scripts executable
RUN chmod +x /app/scripts/backup-db.sh \
    && chmod +x /app/scripts/run-migrations.js \
    && chmod +x /app/start.sh

# Create crontab file
RUN echo "0 0 * * * /app/scripts/backup-db.sh >> /app/backups/backup.log 2>&1" > /app/crontab

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Start the application using the start script
CMD ["/bin/bash", "-c", "/app/start.sh"]
