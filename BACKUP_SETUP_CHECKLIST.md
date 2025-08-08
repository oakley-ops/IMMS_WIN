# Database Backup Setup Checklist

## 🚀 Quick Setup (15 minutes)

### ✅ **Step 1: Run Setup Script**
```powershell
# Open PowerShell as Administrator
cd backend\scripts
.\setup-backup-system.ps1
```
- **What it does**: Creates backup system, schedules daily backups at 2 AM
- **You'll need**: PostgreSQL password

### ✅ **Step 2: Verify Automatic Backup**
1. Open **Task Scheduler** (Windows key + R, type `taskschd.msc`)
2. Look for task: **"FiservInventory-DatabaseBackup"**
3. Check that it's scheduled for **2:00 AM daily**
4. Verify backup directory exists: `C:\DatabaseBackups`

### ✅ **Step 3: Test Manual Backup**
- **Option A**: Double-click `run-backup.bat` (right-click → Run as administrator)
- **Option B**: Run PowerShell script directly:
  ```powershell
  .\backup-database.ps1
  ```

### ✅ **Step 4: Test Restore**
```powershell
# Find your backup file
ls C:\DatabaseBackups\*.custom

# Test restore to a test database
.\restore-database.ps1 -BackupFile "C:\DatabaseBackups\fiservinventory_backup_YYYYMMDD_HHMMSS.custom" -NewDatabaseName "fiservinventory_test"
```

---

## 🛡️ **Backup Protection Levels**

### Level 1: **Basic Protection** (Already Done!)
- ✅ Daily automated backups
- ✅ 30-day retention
- ✅ Local storage
- ✅ Backup verification

### Level 2: **Enhanced Protection** (Recommended)
- ⬜ **Cloud sync** (Google Drive, OneDrive)
- ⬜ **External drive** copy
- ⬜ **Weekly offsite backup**

### Level 3: **Enterprise Protection** (Optional)
- ⬜ **Encrypted backups**
- ⬜ **Multiple cloud providers**
- ⬜ **Disaster recovery site**

---

## 📂 **File Locations**

| Component | Location |
|-----------|----------|
| **Backup Files** | `C:\DatabaseBackups\` |
| **Backup Logs** | `C:\DatabaseBackups\backup.log` |
| **Scripts** | `backend\scripts\` |
| **Manual Backup** | `backend\scripts\run-backup.bat` |
| **Scheduled Task** | Windows Task Scheduler |

---

## 🔍 **Daily Monitoring**

### Check These Daily:
1. **Backup Status**: Look for new backup files in `C:\DatabaseBackups`
2. **Log File**: Check `backup.log` for errors
3. **Disk Space**: Ensure enough space for backups
4. **File Sizes**: Verify backup files aren't empty

### Quick Check Command:
```powershell
# Show recent backups
Get-ChildItem C:\DatabaseBackups\*.custom | Sort-Object CreationTime -Descending | Select-Object -First 5

# Check log for errors
Get-Content C:\DatabaseBackups\backup.log | Select-String "ERROR" | Select-Object -Last 10
```

---

## 🚨 **Emergency Procedures**

### Database Won't Start:
1. Check if backup exists: `C:\DatabaseBackups\`
2. Find latest backup file
3. Run restore: `.\restore-database.ps1 -BackupFile "LATEST_BACKUP.custom" -DropExisting`

### Accidental Data Loss:
1. **STOP** the application immediately
2. Find backup from before the incident
3. Restore to test database first
4. Verify data integrity
5. Restore to production if verified

---

## 📞 **Quick Reference**

### Commands:
```powershell
# Manual backup
.\backup-database.ps1

# Restore to main database
.\restore-database.ps1 -BackupFile "FILE.custom" -DropExisting

# Restore to test database
.\restore-database.ps1 -BackupFile "FILE.custom" -NewDatabaseName "test_db"
```

### Files to Monitor:
- `C:\DatabaseBackups\backup.log` (backup status)
- `C:\DatabaseBackups\fiservinventory_backup_*.custom` (backup files)

### Windows Task:
- **Name**: FiservInventory-DatabaseBackup
- **Schedule**: Daily at 2:00 AM
- **Location**: Task Scheduler

---

## ✅ **Setup Complete!**

Your database backup system is now configured and will:
- ✅ **Automatically backup** your database every night at 2 AM
- ✅ **Keep 30 days** of backup history
- ✅ **Verify backup integrity** after each backup
- ✅ **Log all activities** for monitoring
- ✅ **Provide easy restore** capabilities

### Next Steps:
1. **Set up cloud sync** for offsite backups
2. **Test restore procedure** monthly
3. **Monitor backup logs** daily
4. **Update retention policy** as needed

**🎉 Your data is now protected!** 