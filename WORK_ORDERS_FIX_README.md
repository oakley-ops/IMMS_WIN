# Work Orders Fix - Manual Machine & Technician Entry

## Problem
You were getting this error when creating work orders:
```
error: insert or update on table "work_orders" violates foreign key constraint "work_orders_machine_id_fkey"
detail: Key (machine_id)=(0) is not present in table "machines".
```

This happened because the work_orders table had a foreign key constraint requiring machine_id to reference an existing machine in the machines table.

## Solution
I've updated the system to allow you to **manually type in machine names and technician names** instead of using foreign key relationships.

## What Was Changed

### Backend Changes:
1. **Created new work orders route**: `backend/src/routes/workOrders.js`
   - Handles all work order CRUD operations
   - Uses `machine_name` (text field) instead of `machine_id` (foreign key)
   - Uses `technician_name` (text field) for manual entry
   - Auto-creates the table with the correct schema if it doesn't exist

2. **Registered the route**: Updated `backend/src/app.js` to include work orders routes

3. **Created database fix SQL**: `backend/fix-work-orders-table.sql`

### Frontend Changes:
1. **Added Work Orders API**: Updated `frontend/src/services/api.ts` with `workOrdersApi` functions

## How to Fix Your Database

You have **two options**:

### Option 1: Let the Backend Auto-Fix (Easiest)
1. Just restart your backend server
2. Try creating a work order again
3. The route will automatically check the table schema and fix it if needed

### Option 2: Run the SQL Fix Manually (Recommended)
If you have access to your PostgreSQL database (pgAdmin, psql, or any database client):

1. Open your PostgreSQL database client
2. Connect to your database (probably named `fiserv_inventory` or similar)
3. Run the SQL file: `backend/fix-work-orders-table.sql`

Or run this command from PowerShell (replace `your_database_name` with your actual database name):
```powershell
# First, find your database name from .env file
Get-Content backend\.env | Select-String "DATABASE_URL"

# Then run the SQL (example):
psql -U postgres -d your_database_name -f backend\fix-work-orders-table.sql
```

## What the Fix Does

1. **Removes the foreign key constraint** on `machine_id`
2. **Adds `machine_name` column** (VARCHAR/text field)
3. **Adds `technician_name` column** (VARCHAR/text field)
4. **Migrates existing data** from machine_id references to machine names
5. **Removes the `machine_id` column** completely

## Testing the Fix

After applying the fix, try creating a work order with these fields:

```javascript
{
  "title": "Test Work Order",
  "description": "Testing manual entry",
  "machine_name": "Machine XYZ-123",  // ← Type any machine name you want
  "technician_name": "John Smith",    // ← Type any technician name you want
  "status": "open",
  "priority": "medium",
  "notes": "This is a test"
}
```

## Work Order Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Work order title |
| `work_order_number` | string | No | Auto-generated if not provided |
| `description` | string | No | Detailed description |
| `machine_name` | string | No | **Manually type machine name** |
| `technician_name` | string | No | **Manually type technician name** |
| `status` | enum | No | `open`, `in_progress`, `completed`, `cancelled` (default: `open`) |
| `priority` | enum | No | `low`, `medium`, `high`, `urgent` (default: `medium`) |
| `scheduled_date` | date | No | When work is scheduled |
| `notes` | text | No | Additional notes |
| `created_by` | string | No | Who created it |
| `assigned_to` | string | No | Who it's assigned to |

## Need Help?

If you still encounter issues:
1. Check that your backend server has restarted
2. Check the backend console logs for any errors
3. Verify the database connection is working
4. Check that the work_orders table has been updated by running:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'work_orders';
   ```

The output should show `machine_name` (not `machine_id`) and `technician_name` columns.







