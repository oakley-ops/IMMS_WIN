# Deploying to A2 Hosting

## Pre-deployment Checklist
- [ ] Update `frontend/.env.production` with your A2 Hosting domain
- [ ] Set secure database credentials in production
- [ ] Generate a strong JWT secret
- [ ] Configure SSL certificate in A2 Hosting
- [ ] Set up database backups

## Deployment Steps

1. **Prepare Your A2 Hosting Account**
   - Log in to A2 Hosting cPanel
   - Create a new Node.js application
   - Note down the Node.js version (should be >=14.0.0)
   - Set up a PostgreSQL database
   
2. **Configure Environment Variables**
   ```bash
   # In A2 Hosting cPanel
   NODE_ENV=production
   DB_USER=your_a2_db_user
   DB_HOST=localhost
   DB_NAME=your_a2_db_name
   DB_PASSWORD=your_secure_password
   DB_PORT=5432
   JWT_SECRET=your_secure_jwt_secret
   CORS_ORIGIN=https://your-domain.com
   ```

3. **Deploy Application**
   ```bash
   # Local machine
   npm run deploy
   # This will create deploy.zip
   ```

4. **Upload to A2 Hosting**
   - Upload `deploy.zip` via FTP or cPanel File Manager
   - Extract to your web root directory
   - Set proper permissions:
     ```bash
     chmod -R 755 .
     chmod -R 777 logs
     ```

5. **Database Setup**
   ```bash
   # Connect to your A2 Hosting database
   psql -U your_db_user -d your_db_name -h localhost
   # Run migrations
   npm run migrate
   ```

6. **Start Application**
   ```bash
   # In A2 Hosting SSH terminal
   cd ~/public_html
   npm run start:prod
   ```

7. **Configure Node.js Application**
   - Set up application as a service
   - Configure reverse proxy (if needed)
   - Set up SSL certificate

## Post-deployment Checklist
- [ ] Verify HTTPS is working
- [ ] Test all API endpoints
- [ ] Verify database connections
- [ ] Check error logging
- [ ] Test file uploads
- [ ] Verify CORS settings
- [ ] Test authentication flow

## Monitoring
- Set up monitoring in A2 Hosting cPanel
- Check application logs in `~/logs/`
- Monitor database performance

## Backup Strategy
1. Database Backups:
   ```bash
   # Add to crontab
   0 0 * * * pg_dump -U your_db_user your_db_name > ~/backups/db-$(date +%Y%m%d).sql
   ```
2. File Backups:
   - Use A2 Hosting's backup service
   - Set up automatic backups in cPanel

## Troubleshooting
1. If application fails to start:
   - Check logs in `~/logs/`
   - Verify environment variables
   - Check Node.js version
   - Verify database connection

2. If database connection fails:
   - Verify database credentials
   - Check database server status
   - Verify firewall settings

3. If CORS errors occur:
   - Verify CORS_ORIGIN in environment variables
   - Check frontend API_URL configuration

## Support
- A2 Hosting Support: support@a2hosting.com
- Application Support: your-email@domain.com
