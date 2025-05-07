-- Add is_urgent, next_day_air, shipping_cost, and tax_amount columns to purchase_orders table
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS next_day_air BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal')),
ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10, 2) DEFAULT 0.00;
