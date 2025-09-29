-- Migration to add 'return' transaction type to existing databases
-- This migration allows parts to be returned to inventory

-- Drop the existing constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

-- Add the new constraint with 'return' type (keeping all existing types)
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check 
CHECK (type IN ('usage', 'restock', 'checkout', 'return_unused', 'purchase_order_receipt', 'purchase_order_adjustment', 'return'));

-- Add an index on type for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- Add an index on created_at for better performance on time-based queries
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- Add comment to document the return functionality
COMMENT ON COLUMN transactions.type IS 'Transaction type: usage (part taken from inventory), restock (part added to inventory via purchase), return (unused part returned to inventory), checkout (deprecated), return_unused (deprecated in favor of return), purchase_order_receipt (part received from PO), purchase_order_adjustment (PO quantity adjustment)';
