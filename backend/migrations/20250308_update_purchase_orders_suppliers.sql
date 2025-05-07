-- Update purchase_orders table to use supplier_id instead of vendor_id
ALTER TABLE purchase_orders 
ADD COLUMN supplier_id INTEGER REFERENCES suppliers(supplier_id);

-- Migrate data from vendor_id to supplier_id (if there's a corresponding supplier with the same name)
UPDATE purchase_orders po
SET supplier_id = s.supplier_id
FROM vendors v
JOIN suppliers s ON v.name = s.name
WHERE po.vendor_id = v.vendor_id;

-- Add estimated_delivery_days column to purchase_order_items
ALTER TABLE purchase_order_items 
ADD COLUMN IF NOT EXISTS estimated_delivery_days INTEGER DEFAULT 0;

-- Remove vendor_id column from parts table
ALTER TABLE parts DROP COLUMN IF EXISTS vendor_id;

-- Now drop the vendor_id column from purchase_orders
-- Note: This could be done later after ensuring all data is migrated correctly
-- ALTER TABLE purchase_orders DROP COLUMN vendor_id;
