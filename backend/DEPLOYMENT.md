# Deployment Guide for IMMS App

## Prerequisites

- Node.js 16+ and npm
- PostgreSQL 12+
- SSL certificates
- Linux server with systemd
- Domain name and DNS configuration

## Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/oakley-ops/imms-win.git
cd imms-win
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
createdb -U postgres imms_inventory
```

2. Run migrations:
```bash
cd backend
psql -U postgres -d imms_inventory -f db/migrations/*.sql
```

## SSL Certificate Setup

1. Install SSL certificates:
```bash
sudo cp ssl/imms_inventory.key /etc/ssl/private/
sudo cp ssl/imms_inventory.crt /etc/ssl/certs/
```

2. Set proper permissions:
```bash
sudo chmod 600 /etc/ssl/private/imms_inventory.key
sudo chmod 644 /etc/ssl/certs/imms_inventory.crt
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
  - job_name: 'imms_inventory'
    static_configs:
      - targets: ['localhost:9090']
```

## Backup Configuration

1. Set up automated backups:
```bash
sudo mkdir -p /var/backups/imms_inventory
sudo chown -R $USER:$USER /var/backups/imms_inventory
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
sudo nano /etc/systemd/system/imms_inventory.service
```

Add:
```ini
[Unit]
Description=IMMS Application
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
sudo systemctl enable imms_inventory
sudo systemctl start imms_inventory
```

## Maintenance

### Logs
- Application logs: `/var/log/imms_inventory/app.log`
- Error logs: `/var/log/imms_inventory/error.log`
- Access logs: `/var/log/imms_inventory/access.log`

### Backup Management
- Daily backups: `/var/backups/imms_inventory/`
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
sudo systemctl status imms_inventory
```

2. View logs:
```bash
journalctl -u imms_inventory -f
```

3. Check database connection:
```bash
psql -U postgres -d imms_inventory -c "SELECT NOW();"
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