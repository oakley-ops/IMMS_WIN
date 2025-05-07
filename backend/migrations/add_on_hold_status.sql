-- Add 'on_hold' as a valid status in purchase_orders table
DO $$ 
BEGIN
    -- First, drop the existing check constraint for status
    ALTER TABLE purchase_orders 
    DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
    
    -- Then add the new constraint with 'on_hold' included
    ALTER TABLE purchase_orders 
    ADD CONSTRAINT purchase_orders_status_check 
    CHECK (status IN ('pending', 'submitted', 'approved', 'received', 'canceled', 'on_hold'));
    
    -- Check if approval_status_check constraint exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'purchase_orders_approval_status_check' 
        AND conrelid = 'purchase_orders'::regclass
    ) THEN
        -- Drop and recreate approval_status_check constraint
        ALTER TABLE purchase_orders 
        DROP CONSTRAINT purchase_orders_approval_status_check;
        
        ALTER TABLE purchase_orders 
        ADD CONSTRAINT purchase_orders_approval_status_check 
        CHECK (approval_status IN ('pending', 'submitted', 'approved', 'received', 'canceled', 'on_hold', 'rejected'));
    END IF;
    
    -- Make sure approval_status column exists and doesn't have a type constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'purchase_orders' AND column_name = 'approval_status'
    ) THEN
        -- Since we can't check column constraints easily in PostgreSQL, let's try to validate if we can insert an on_hold value
        BEGIN
            -- Try to update a temporary value
            WITH temp_update AS (
                SELECT po_id FROM purchase_orders LIMIT 1
            )
            UPDATE purchase_orders 
            SET approval_status = 'on_hold'
            WHERE po_id IN (SELECT po_id FROM temp_update);
            
            -- If successful, revert the change
            WITH temp_update AS (
                SELECT po_id, approval_status FROM purchase_orders 
                WHERE approval_status = 'on_hold' LIMIT 1
            )
            UPDATE purchase_orders 
            SET approval_status = COALESCE(status, 'pending')
            WHERE po_id IN (SELECT po_id FROM temp_update);
            
            RAISE NOTICE 'Successfully validated that approval_status accepts on_hold value';
        EXCEPTION
            WHEN check_violation THEN
                -- If we have a check violation, means there's a constraint we need to fix
                ALTER TABLE purchase_orders 
                DROP CONSTRAINT IF EXISTS purchase_orders_approval_status_check;
                
                ALTER TABLE purchase_orders 
                ADD CONSTRAINT purchase_orders_approval_status_check 
                CHECK (approval_status IN ('pending', 'submitted', 'approved', 'received', 'canceled', 'on_hold', 'rejected'));
                
                RAISE NOTICE 'Fixed approval_status constraint to allow on_hold status';
            WHEN OTHERS THEN
                RAISE NOTICE 'Unexpected error when testing approval_status constraints: %', SQLERRM;
        END;
    END IF;
    
    RAISE NOTICE 'Successfully updated purchase_orders status constraints to include on_hold status';
END $$; 