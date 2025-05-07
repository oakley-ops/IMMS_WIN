-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create part_suppliers junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS part_suppliers (
    part_supplier_id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(part_id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
    unit_cost DECIMAL(10, 2) NOT NULL,
    is_preferred BOOLEAN DEFAULT FALSE,
    lead_time_days INTEGER,
    minimum_order_quantity INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(part_id, supplier_id)  -- Prevent duplicate part-supplier relationships
);

-- Add supplier_id to purchase_orders table for multi-supplier support
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(supplier_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_part_suppliers_part_id ON part_suppliers(part_id);
CREATE INDEX IF NOT EXISTS idx_part_suppliers_supplier_id ON part_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);

-- Add supplier_id to parts table for backward compatibility and default supplier
ALTER TABLE parts ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(supplier_id);

-- Migration procedure to help transition data from vendors to suppliers
CREATE OR REPLACE FUNCTION migrate_vendors_to_suppliers()
RETURNS void AS $$
DECLARE
    v_record RECORD;
    new_supplier_id INTEGER;
BEGIN
    -- For each vendor, create a supplier
    FOR v_record IN SELECT * FROM vendors LOOP
        -- Insert into suppliers table
        INSERT INTO suppliers (name, contact_name, email, phone, address, notes)
        VALUES (v_record.name, v_record.contact_name, v_record.email, v_record.phone, v_record.address, v_record.notes)
        RETURNING supplier_id INTO new_supplier_id;
        
        -- Update purchase orders to reference the new supplier
        UPDATE purchase_orders 
        SET supplier_id = new_supplier_id 
        WHERE vendor_id = v_record.vendor_id;
        
        -- Create part-supplier relationships for parts with this vendor
        INSERT INTO part_suppliers (part_id, supplier_id, unit_cost)
        SELECT part_id, new_supplier_id, unit_cost 
        FROM parts 
        WHERE vendor_id = v_record.vendor_id AND unit_cost IS NOT NULL;
        
        -- Update parts table to reference the new supplier
        UPDATE parts 
        SET supplier_id = new_supplier_id 
        WHERE vendor_id = v_record.vendor_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the migration function (commented out - uncomment to run)
-- SELECT migrate_vendors_to_suppliers();
