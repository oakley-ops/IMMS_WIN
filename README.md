# Fiserv Inventory Management System

A comprehensive inventory management system for tracking parts, machines, and their usage.

## Features

- Part inventory management
- Machine tracking
- Part-to-machine assignment
- Usage history tracking
- Guest access for viewing inventory
- Admin access for managing inventory
- Real-time search functionality
- Low stock alerts
- Export functionality for reports

## Tech Stack

- Frontend:
  - React
  - TypeScript
  - React Bootstrap
  - Axios
  - Redux Toolkit

- Backend:
  - Node.js
  - Express
  - PostgreSQL
  - JWT Authentication

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/fiservinventory-app.git
   cd fiservinventory-app
   ```

2. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```

3. Install frontend dependencies:
   ```bash
   cd ../frontend
   npm install
   ```

4. Set up environment variables:
   - Create a `.env` file in the backend directory
   - Add the following variables:
     ```
     PORT=3001
     DB_HOST=localhost
     DB_PORT=5432
     DB_NAME=your_database_name
     DB_USER=your_database_user
     DB_PASSWORD=your_database_password
     JWT_SECRET=your_jwt_secret
     ```

5. Initialize the database:
   ```bash
   cd ../backend
   npm run db:init
   ```

### Running the Application

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Start the frontend development server:
   ```bash
   cd frontend
   npm start
   ```

3. Access the application at `http://localhost:3000`

## Deployment

### Backend Deployment (Example using AWS EC2)

1. Launch an EC2 instance:
   - Choose Ubuntu Server 22.04 LTS
   - t2.micro for testing, t2.small or larger for production
   - Configure security group to allow ports 22 (SSH), 80 (HTTP), 443 (HTTPS)

2. Install dependencies:
   ```bash
   sudo apt update
   sudo apt install -y nodejs npm postgresql nginx
   ```

3. Set up PostgreSQL:
   ```bash
   sudo -u postgres psql
   CREATE DATABASE fiserv_inventory;
   CREATE USER your_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE fiserv_inventory TO your_user;
   ```

4. Clone and setup the application:
   ```bash
   git clone https://github.com/yourusername/fiservinventory-app.git
   cd fiservinventory-app/backend
   npm install
   npm run migrate
   ```

5. Set up PM2 for process management:
   ```bash
   sudo npm install -g pm2
   pm2 start src/index.js
   pm2 startup
   ```

### Frontend Deployment (Example using AWS S3 + CloudFront)

1. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```

2. Create an S3 bucket:
   - Create a new S3 bucket
   - Enable static website hosting
   - Make the bucket public
   - Upload the build files:
   ```bash
   aws s3 sync build/ s3://your-bucket-name
   ```

3. Set up CloudFront:
   - Create a CloudFront distribution
   - Point it to your S3 bucket
   - Enable HTTPS
   - Set up custom domain if needed

### Alternative Deployment (Example using Heroku)

1. Create a new Heroku app:
   ```bash
   heroku create fiserv-inventory
   ```

2. Add PostgreSQL:
   ```bash
   heroku addons:create heroku-postgresql:hobby-dev
   ```

3. Configure environment variables:
   ```bash
   heroku config:set NODE_ENV=production
   ```

4. Deploy:
   ```bash
   git push heroku main
   ```

### Deployment Guide

### Prerequisites

- Ubuntu 20.04 LTS or later
- Node.js 16.x or later
- PostgreSQL 12 or later
- Nginx
- SSL certificate
- Domain name configured

### System Requirements

- Minimum 2 CPU cores
- 4GB RAM
- 20GB storage
- PostgreSQL with SSL enabled

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/fiservinventory-app.git
   cd fiservinventory-app
   ```

2. Run the deployment script:
   ```bash
   sudo chmod +x deploy.sh
   sudo ./deploy.sh
   ```

The deployment script will:
- Install system dependencies
- Configure SSL certificates
- Set up Nginx
- Initialize the database
- Configure environment variables
- Install application dependencies
- Set up process management
- Configure log rotation
- Set up database backups
- Configure monitoring

### Manual Configuration Steps

1. Update DNS records to point to your server
2. Configure firewall rules:
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

3. Verify SSL configuration:
   ```bash
   curl -vI https://fteinventory.netlify.app
   ```

### Environment Variables

Required environment variables in `.env.production`:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT tokens
- `SESSION_SECRET`: Secret for session management
- Other variables as specified in `.env.production`

### Database Backup

Backups are automatically scheduled daily and stored in `/var/backups/fiservinventory/db/`.

To manually backup:
   ```bash
   sudo -u postgres pg_dump fiservinventory > backup.sql
   ```

### Monitoring

The application is monitored using:
- Prometheus for metrics collection
- Node Exporter for system metrics
- Nginx Exporter for web server metrics
- PostgreSQL Exporter for database metrics

Access metrics at: `http://localhost:9090/metrics`

### Log Files

- Application logs: `/var/log/fiservinventory/app.log`
- Nginx access logs: `/var/log/nginx/access.log`
- Nginx error logs: `/var/log/nginx/error.log`

### Security Measures

1. Password Requirements:
   - Minimum 8 characters
   - At least 1 uppercase letter
   - At least 1 lowercase letter
   - At least 1 number
   - At least 1 special character

2. Rate Limiting:
   - Login attempts: 5 per 15 minutes
   - API requests: 10 per second

3. SSL/TLS Configuration:
   - TLS 1.2 and 1.3 only
   - Modern cipher suite
   - HSTS enabled

### Troubleshooting

1. Check application status:
   ```bash
   pm2 status
   pm2 logs
   ```

2. Check Nginx status:
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   ```

3. Check database status:
   ```bash
   sudo systemctl status postgresql
   ```

### Maintenance

1. Update application:
   ```bash
   git pull
   npm install
   pm2 restart all
   ```

2. Rotate logs:
   ```bash
   sudo logrotate -f /etc/logrotate.d/fiservinventory
   ```

3. Update SSL certificates:
   ```bash
   sudo certbot renew
   ```

### Support

For support, contact:
- Email: support@fiserv.com
- Phone: 1-800-XXX-XXXX

### License

Proprietary software. All rights reserved.

## Usage

### Guest Access
- Click "Continue as Guest" on the login page
- View parts inventory
- Search for parts
- View machine assignments
- View usage history

### Admin Access
- Log in with admin credentials
- Full access to all features
- Add/remove parts
- Manage machines
- Generate reports
- Export data

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
