# 🔧 QUICK FIX - Run This Now!

## The Problem
Your `work_orders` table still has the old schema with the `machine_id` foreign key.

## The Solution
Run this ONE command in your PowerShell terminal:

```powershell
node backend/run-db-fix.js
```

## What It Does
This script will:
1. Connect to your database
2. Remove the `machine_id` foreign key constraint
3. Add `machine_name` text field  
4. Add `technician_name` text field
5. Migrate any existing data

## After Running
Once you see "✅ SUCCESS!", you can:
1. Go back to your frontend
2. Create a work order
3. Type any machine name and technician name you want!

## If You Get an Error

### Error: "Cannot find module 'pg'"
Run this first:
```powershell
cd backend
npm install pg
```

Then try again:
```powershell
node run-db-fix.js
```

### Error: "DATABASE_URL is not defined"
Your `.env` file might not be set up correctly. Check that `backend/.env` has:
```
DATABASE_URL=postgresql://username:password@localhost:5432/your_database_name
```

### Still Having Issues?
Let me know what error you see and I'll help you fix it!

---

## Alternative: Manual SQL Fix

If the Node script doesn't work, you can run the SQL directly:

1. Open pgAdmin or your PostgreSQL client
2. Connect to your database
3. Open and run the file: `backend/fix-work-orders-table.sql`

OR use psql command line:
```powershell
# Find your database name first
$env:DATABASE_URL

# Then run (replace YOUR_DB_NAME):
psql -U postgres -d YOUR_DB_NAME -f backend/fix-work-orders-table.sql
```







