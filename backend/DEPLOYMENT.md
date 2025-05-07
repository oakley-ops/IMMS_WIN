# Deployment Guide for Fiserv Inventory App

## Prerequisites

- Node.js 16+ and npm
- PostgreSQL 12+
- SSL certificates
- Linux server with systemd
- Domain name and DNS configuration

## Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/oakley-ops/fiservinventory-app.git
cd fiservinventory-app
```

2. Install dependencies:
```bash
cd backend
npm install
cd ../frontend
npm install
```

3. Set up environment variables:
- Copy `.env.production.example` to `.env.production`
- Update all environment variables with production values
- Ensure all sensitive credentials are properly secured

## Database Setup

1. Create production database:
```bash
createdb -U postgres fiservinventory
```

2. Run migrations:
```bash
cd backend
psql -U postgres -d fiservinventory -f db/migrations/*.sql
```

## SSL Certificate Setup

1. Install SSL certificates:
```bash
sudo cp ssl/fiservinventory.key /etc/ssl/private/
sudo cp ssl/fiservinventory.crt /etc/ssl/certs/
```

2. Set proper permissions:
```bash
sudo chmod 600 /etc/ssl/private/fiservinventory.key
sudo chmod 644 /etc/ssl/certs/fiservinventory.crt
```

## Monitoring Setup

1. Install Prometheus and Grafana:
```bash
sudo apt-get update
sudo apt-get install -y prometheus grafana
```

2. Configure Prometheus to scrape metrics:
```yaml
# /etc/prometheus/prometheus.yml
scrape_configs:
  - job_name: 'fiservinventory'
    static_configs:
      - targets: ['localhost:9090']
```

## Backup Configuration

1. Set up automated backups:
```bash
sudo mkdir -p /var/backups/fiservinventory
sudo chown -R $USER:$USER /var/backups/fiservinventory
```

2. Add backup script to crontab:
```bash
crontab -e
# Add: 0 0 * * * /path/to/app/backend/scripts/backup.sh
```

## Application Deployment

1. Build frontend:
```bash
cd frontend
npm run build
```

2. Set up systemd service:
```bash
sudo nano /etc/systemd/system/fiservinventory.service
```

Add:
```ini
[Unit]
Description=Fiserv Inventory Application
After=network.target

[Service]
Type=simple
User=nodeuser
WorkingDirectory=/path/to/app/backend
ExecStart=/usr/bin/npm start
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

3. Start service:
```bash
sudo systemctl enable fiservinventory
sudo systemctl start fiservinventory
```

## Maintenance

### Logs
- Application logs: `/var/log/fiservinventory/app.log`
- Error logs: `/var/log/fiservinventory/error.log`
- Access logs: `/var/log/fiservinventory/access.log`

### Backup Management
- Daily backups: `/var/backups/fiservinventory/`
- Retention: 7 days

### Monitoring
- Metrics endpoint: `http://localhost:9090/metrics`
- Grafana dashboard: `http://localhost:3000`

### Security
- Regular security updates:
```bash
npm audit fix
npm update
```
- SSL certificate renewal (every 90 days)
- Regular password rotation
- Security log review

## Troubleshooting

1. Check application status:
```bash
sudo systemctl status fiservinventory
```

2. View logs:
```bash
journalctl -u fiservinventory -f
```

3. Check database connection:
```bash
psql -U postgres -d fiservinventory -c "SELECT NOW();"
```

4. Verify monitoring:
```bash
curl http://localhost:9090/metrics
```

## Contact

For support, contact:
- System Administrator: [Add contact]
- Database Administrator: [Add contact]
- Application Owner: [Add contact] 