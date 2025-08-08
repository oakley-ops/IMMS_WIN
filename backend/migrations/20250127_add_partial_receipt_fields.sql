-- Add partial receipt fields to purchase_order_items table
-- This allows tracking which parts have been received without closing the entire PO

ALTER TABLE purchase_order_items 
ADD COLUMN quantity_received INTEGER DEFAULT 0,
ADD COLUMN received_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN received_by VARCHAR(255),
ADD COLUMN receipt_notes TEXT;

-- Update existing records to have quantity_received = 0 if NULL
UPDATE purchase_order_items 
SET quantity_received = 0 
WHERE quantity_received IS NULL;

-- Create an index for faster queries on received items
CREATE INDEX idx_purchase_order_items_received ON purchase_order_items(po_id, quantity_received);

-- Add a computed column view for quantity_pending (optional, for easier querying)
CREATE OR REPLACE VIEW purchase_order_items_with_pending AS
SELECT 
  *,
  (quantity - COALESCE(quantity_received, 0)) as quantity_pending,
  CASE 
    WHEN quantity_received = 0 THEN 'not_received'
    WHEN quantity_received < quantity THEN 'partially_received'
    WHEN quantity_received >= quantity THEN 'fully_received'
    ELSE 'unknown'
  END as receipt_status
FROM purchase_order_items; 