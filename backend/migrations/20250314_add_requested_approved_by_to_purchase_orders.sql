-- Add requested_by and approved_by columns to purchase_orders table
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS requested_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);
