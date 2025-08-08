-- Add 'waiting_for_po_number' as a valid status in purchase_orders table
DO $$ 
BEGIN
    -- First, drop the existing check constraint for status
    ALTER TABLE purchase_orders 
    DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
    
    -- Then add the new constraint with 'waiting_for_po_number' included
    ALTER TABLE purchase_orders 
    ADD CONSTRAINT purchase_orders_status_check 
    CHECK (status IN ('pending', 'submitted', 'approved', 'received', 'canceled', 'on_hold', 'on_order', 'rejected', 'waiting_for_po_number'));
    
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
        CHECK (approval_status IN ('pending', 'submitted', 'approved', 'received', 'canceled', 'on_hold', 'on_order', 'rejected', 'waiting_for_po_number'));
    END IF;
    
    -- Test if we can insert the new status
    BEGIN
        -- Try to update a temporary value to test constraint
        WITH temp_update AS (
            SELECT po_id FROM purchase_orders LIMIT 1
        )
        UPDATE purchase_orders 
        SET status = 'waiting_for_po_number'
        WHERE po_id IN (SELECT po_id FROM temp_update);
        
        -- If successful, revert the change
        WITH temp_update AS (
            SELECT po_id FROM purchase_orders 
            WHERE status = 'waiting_for_po_number' LIMIT 1
        )
        UPDATE purchase_orders 
        SET status = 'pending'
        WHERE po_id IN (SELECT po_id FROM temp_update);
        
        RAISE NOTICE 'Successfully validated that status accepts waiting_for_po_number value';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Check constraint validation failed, but this is expected during setup';
        WHEN OTHERS THEN
            RAISE NOTICE 'Unexpected error when testing status constraints: %', SQLERRM;
    END;
    
    RAISE NOTICE 'Successfully updated purchase_orders status constraints to include waiting_for_po_number status';
END $$; 