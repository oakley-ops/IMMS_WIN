-- Add custom part fields to purchase_order_items table
ALTER TABLE purchase_order_items 
ADD COLUMN IF NOT EXISTS custom_part_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS custom_part_number VARCHAR(100);

-- Make part_id nullable to allow for custom parts
ALTER TABLE purchase_order_items 
ALTER COLUMN part_id DROP NOT NULL; 