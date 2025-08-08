# Database Backup System Guide
## Comprehensive Backup Strategy for Fiserv Inventory System

### 📋 Overview
This guide covers a complete database backup and recovery system for your PostgreSQL database, following industry best practices.

---

## 🎯 Backup Strategy (3-2-1 Rule)

### **3** Copies of Data
- **Original**: Production database
- **Local Backup**: Daily automated backups on local machine
- **Offsite Backup**: Cloud storage or external drive

### **2** Different Storage Types
- **Local Storage**: Fast access for quick recovery
- **Cloud Storage**: Protection against local disasters

### **1** Offsite Location
- **Cloud Services**: Google Drive, OneDrive, AWS S3
- **External Drive**: Stored in different physical location

---

## 🔧 System Components

### 1. **backup-database.ps1**
- **Purpose**: Automated daily database backups
- **Features**:
  - Creates both custom and SQL format backups
  - Compresses files to save space
  - Automatic cleanup of old backups (30-day retention)
  - Integrity verification
  - Detailed logging
- **Schedule**: Runs daily at 2:00 AM via Windows Task Scheduler

### 2. **restore-database.ps1**
- **Purpose**: Restore database from backup files
- **Features**:
  - Supports both custom and SQL format backups
  - Can restore to different database name
  - Handles compressed files
  - Verification after restore
  - Detailed logging

### 3. **setup-backup-system.ps1**
- **Purpose**: One-time setup of the backup system
- **Features**:
  - Creates backup directories
  - Sets up Windows Task Scheduler
  - Configures PostgreSQL authentication
  - Creates desktop shortcuts
  - Tests backup functionality

---

## 🚀 Quick Start Guide

### Step 1: Initial Setup
```powershell
# Run as Administrator
cd backend\scripts
.\setup-backup-system.ps1
```

### Step 2: Verify Setup
1. Check Task Scheduler for "FiservInventory-DatabaseBackup"
2. Verify backup directory exists: `C:\DatabaseBackups`
3. Check that first backup was created

### Step 3: Test Restore
```powershell
# Test restore to a different database
.\restore-database.ps1 -BackupFile "C:\DatabaseBackups\fiservinventory_backup_20250127_020000.custom" -NewDatabaseName "fiservinventory_test"
```

---

## 📊 Backup Types & Formats

### Custom Format (`.custom`)
- **Best for**: Production use
- **Advantages**: 
  - Compressed automatically
  - Parallel restore capability
  - Selective restore options
  - Cross-platform compatibility

### SQL Format (`.sql`)
- **Best for**: Development/debugging
- **Advantages**:
  - Human-readable
  - Easy to modify
  - Version control friendly
  - Universal compatibility

---

## 🔒 Security Best Practices

### 1. Password Management
- Uses `PGPASSWORD` environment variable
- Stored securely in system environment
- Never hardcoded in scripts

### 2. File Permissions
- Backup files readable only by administrators
- Scripts require elevated privileges
- Log files protected from unauthorized access

### 3. Encryption (Optional)
```powershell
# Encrypt backup files using Windows BitLocker or third-party tools
# Example with 7-Zip encryption:
7z a -p"YourPassword" backup_encrypted.7z backup_file.custom
```

---

## 📈 Monitoring & Maintenance

### Daily Monitoring
- Check backup logs: `C:\DatabaseBackups\backup.log`
- Verify backup file creation
- Monitor disk space usage

### Weekly Tasks
- Test restore procedure
- Review backup file sizes
- Check offsite backup sync

### Monthly Tasks
- Disaster recovery drill
- Update backup retention policy
- Review and update documentation

---

## 🚨 Disaster Recovery Procedures

### Scenario 1: Database Corruption
```powershell
# Stop application
# Restore from latest backup
.\restore-database.ps1 -BackupFile "C:\DatabaseBackups\fiservinventory_backup_LATEST.custom" -DropExisting
# Restart application
```

### Scenario 2: Complete System Failure
1. Install PostgreSQL on new system
2. Copy backup files from offsite storage
3. Run restore script
4. Verify data integrity
5. Restart application

### Scenario 3: Accidental Data Deletion
```powershell
# Restore to temporary database for data recovery
.\restore-database.ps1 -BackupFile "BACKUP_FILE" -NewDatabaseName "recovery_db"
# Extract needed data
# Import back to main database
```

---

## 🔍 Troubleshooting

### Common Issues

#### Backup Fails - Permission Denied
```powershell
# Solution: Run as administrator or check PostgreSQL permissions
# Verify PGPASSWORD environment variable is set
```

#### Large Backup Files
```powershell
# Solution: Implement additional compression
# Use backup-database.ps1 with built-in compression
```

#### Restore Takes Too Long
```powershell
# Solution: Use custom format with parallel restore
pg_restore --jobs=4 --verbose backup_file.custom
```

---

## 📝 Usage Examples

### Manual Backup
```powershell
# Create immediate backup
.\backup-database.ps1

# Backup to specific location
.\backup-database.ps1 -BackupDir "D:\Backups"

# Backup with custom retention
.\backup-database.ps1 -RetentionDays 60
```

### Restore Operations
```powershell
# Basic restore (overwrites existing)
.\restore-database.ps1 -BackupFile "backup.custom" -DropExisting

# Restore to new database
.\restore-database.ps1 -BackupFile "backup.custom" -NewDatabaseName "test_db"

# Restore compressed SQL backup
.\restore-database.ps1 -BackupFile "backup.sql.gz"
```

---

## 🌐 Cloud Storage Integration

### Google Drive Setup
1. Install Google Drive for Desktop
2. Sync backup folder to Drive
3. Set up automatic sync schedule

### OneDrive Setup
1. Move backup folder to OneDrive directory
2. Ensure sufficient storage space
3. Monitor sync status

### AWS S3 Setup
```powershell
# Install AWS CLI
# Configure AWS credentials
# Create S3 sync script
aws s3 sync C:\DatabaseBackups s3://your-backup-bucket/db-backups/
```

---

## 📊 Backup Monitoring Dashboard

### Key Metrics to Track
- **Backup Success Rate**: >99.5%
- **Backup Size Trend**: Monitor growth
- **Backup Duration**: Should be consistent
- **Storage Usage**: Plan for growth
- **Recovery Time**: Test regularly

### Log Analysis
```powershell
# Check recent backup status
Get-Content C:\DatabaseBackups\backup.log | Select-String "ERROR|SUCCESS" | Select-Object -Last 10
```

---

## 🎯 Best Practices Summary

### ✅ DO
- Test restores regularly (monthly)
- Monitor backup logs daily
- Keep multiple backup copies
- Document recovery procedures
- Train staff on restore process
- Use offsite storage
- Encrypt sensitive backups

### ❌ DON'T
- Rely on single backup location
- Skip backup testing
- Ignore backup failures
- Store passwords in scripts
- Forget to monitor disk space
- Delay addressing backup issues

---

## 📞 Emergency Contacts

### Internal
- **Database Administrator**: [Your Name]
- **IT Support**: [Contact Info]
- **System Administrator**: [Contact Info]

### External
- **Cloud Provider Support**: [Contact Info]
- **Database Consultant**: [Contact Info]
- **Hardware Vendor**: [Contact Info]

---

## 📚 Additional Resources

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [Windows Task Scheduler Guide](https://docs.microsoft.com/en-us/windows/desktop/taskschd/task-scheduler-start-page)
- [PowerShell Scripting Best Practices](https://docs.microsoft.com/en-us/powershell/scripting/dev-cross-plat/writing-portable-modules)

---

*Last Updated: January 2025*
*Version: 1.0* 