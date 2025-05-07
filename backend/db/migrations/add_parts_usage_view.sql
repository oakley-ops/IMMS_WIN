-- Drop existing view
DROP VIEW IF EXISTS parts_usage CASCADE;

-- Create a view for parts usage that includes the usage_date
CREATE OR REPLACE VIEW parts_usage AS
SELECT 
    t.transaction_id,
    t.part_id,
    NULL::integer as machine_id,  -- Since the original table doesn't have machine_id
    t.quantity,
    t.created_at as usage_date,
    t.notes,
    t.reference_number,
    t.user_id
FROM transactions t
WHERE t.type = 'usage';

-- Add index to improve query performance
CREATE INDEX IF NOT EXISTS idx_transactions_type 
ON transactions(type); 