-- IMMS (Inventory Management & Maintenance System) Database Schema
-- Updated schema with CRC part numbers and cleaned of Fiserv references

-- Create part_locations table first (since parts table references it)
CREATE TABLE IF NOT EXISTS part_locations (
    location_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create parts table with CRC part number
CREATE TABLE IF NOT EXISTS parts (
    part_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    manufacturer_part_number VARCHAR(100),
    crc_part_number VARCHAR(100), -- Changed from fiserv_part_number to crc_part_number
    quantity INTEGER NOT NULL DEFAULT 0,
    minimum_quantity INTEGER NOT NULL DEFAULT 0,
    supplier VARCHAR(255),
    unit_cost DECIMAL(10, 2),
    location_id INTEGER,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'active',
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create machines table
CREATE TABLE IF NOT EXISTS machines (
    machine_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    model VARCHAR(255),
    serial_number VARCHAR(100),
    location VARCHAR(255),
    manufacturer VARCHAR(255),
    installation_date DATE,
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(part_id),
    machine_id INTEGER REFERENCES machines(machine_id),
    quantity INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('usage', 'restock', 'checkout', 'return_unused', 'purchase_order_receipt', 'purchase_order_adjustment', 'return')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    user_id INTEGER,
    reference_number VARCHAR(100)
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'tech',
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
    contact_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    company VARCHAR(255),
    position VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id SERIAL PRIMARY KEY,
    po_number VARCHAR(100) UNIQUE NOT NULL,
    supplier_id INTEGER REFERENCES suppliers(supplier_id),
    status VARCHAR(20) DEFAULT 'pending',
    order_date DATE DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    total_amount DECIMAL(12, 2),
    notes TEXT,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    approval_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create purchase_order_items table
CREATE TABLE IF NOT EXISTS purchase_order_items (
    poi_id SERIAL PRIMARY KEY,
    po_id INTEGER REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    part_id INTEGER REFERENCES parts(part_id),
    part_name VARCHAR(255),
    manufacturer_part_number VARCHAR(100),
    quantity INTEGER NOT NULL,
    unit_cost DECIMAL(10, 2),
    total_cost DECIMAL(12, 2),
    received_quantity INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create preventive_maintenance table
CREATE TABLE IF NOT EXISTS preventive_maintenance (
    pm_id SERIAL PRIMARY KEY,
    machine_id INTEGER REFERENCES machines(machine_id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    frequency_days INTEGER NOT NULL,
    last_performed DATE,
    next_due DATE,
    assigned_to VARCHAR(255),
    status VARCHAR(20) DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraints
ALTER TABLE parts
ADD CONSTRAINT fk_location
FOREIGN KEY (location_id)
REFERENCES part_locations(location_id)
ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_parts_crc_part_number ON parts(crc_part_number);
CREATE INDEX IF NOT EXISTS idx_parts_status ON parts(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_part_id ON transactions(part_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_machines_name ON machines(name);

-- Add unique constraints
ALTER TABLE parts ADD CONSTRAINT unique_crc_part_number UNIQUE (crc_part_number);

-- Add comments to document the schema
COMMENT ON TABLE parts IS 'Parts inventory table with CRC internal part numbering';
COMMENT ON COLUMN parts.crc_part_number IS 'CRC internal part number (formerly fiserv_part_number)';
COMMENT ON COLUMN transactions.type IS 'Transaction type: usage (part taken from inventory), restock (part added to inventory via purchase), return (unused part returned to inventory), checkout (deprecated), return_unused (deprecated in favor of return), purchase_order_receipt (part received from PO), purchase_order_adjustment (PO quantity adjustment)';
COMMENT ON TABLE users IS 'System users table - emails cleaned of fiserv.com addresses';
COMMENT ON TABLE contacts IS 'Contact information table - emails cleaned of fiserv.com addresses';
COMMENT ON TABLE purchase_orders IS 'Purchase orders table - approval emails cleaned of fiserv.com addresses';
