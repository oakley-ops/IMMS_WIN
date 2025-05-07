-- First rename vendors table to suppliers for consistency
ALTER TABLE vendors RENAME TO suppliers;

-- Update sequence name for consistency
ALTER SEQUENCE vendors_vendor_id_seq RENAME TO suppliers_supplier_id_seq;

-- Rename the primary key column in the suppliers table
ALTER TABLE suppliers RENAME COLUMN vendor_id TO supplier_id;

-- Update foreign key constraints in the parts table
ALTER TABLE parts RENAME COLUMN vendor_id TO supplier_id;

-- Create a junction table for the many-to-many relationship between parts and suppliers
CREATE TABLE part_suppliers (
    id SERIAL PRIMARY KEY,
    part_id INTEGER NOT NULL REFERENCES parts(part_id) ON DELETE CASCADE,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
    is_preferred BOOLEAN DEFAULT false,
    unit_cost DECIMAL(10, 2),
    lead_time_days INTEGER,
    minimum_order_quantity INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(part_id, supplier_id)
);

-- Migrate existing supplier relationships to the junction table
-- This copies the current part-supplier relationships while setting them as preferred
INSERT INTO part_suppliers (part_id, supplier_id, is_preferred, unit_cost)
SELECT part_id, supplier_id, true, unit_cost 
FROM parts 
WHERE supplier_id IS NOT NULL;

-- Create an index for faster lookups
CREATE INDEX idx_part_suppliers_part_id ON part_suppliers(part_id);
CREATE INDEX idx_part_suppliers_supplier_id ON part_suppliers(supplier_id);
CREATE INDEX idx_part_suppliers_preferred ON part_suppliers(is_preferred);

-- Update purchase_orders table references to vendors
ALTER TABLE purchase_orders RENAME COLUMN vendor_id TO supplier_id;
ALTER TABLE purchase_orders RENAME COLUMN vendor_name TO supplier_name;
ALTER TABLE purchase_orders RENAME COLUMN vendor_address TO supplier_address;
