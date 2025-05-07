-- Drop tables if they exist
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS parts_usage CASCADE;
DROP TABLE IF EXISTS part_assignments CASCADE;
DROP TABLE IF EXISTS parts CASCADE;
DROP TABLE IF EXISTS machines CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create machines table
CREATE TABLE machines (
    id SERIAL PRIMARY KEY,
    machine_name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    last_maintenance_date TIMESTAMP,
    next_maintenance_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create parts table
CREATE TABLE parts (
    id SERIAL PRIMARY KEY,
    part_name VARCHAR(255) NOT NULL,
    description TEXT,
    fiserv_part_number VARCHAR(255) UNIQUE,
    manufacturer VARCHAR(255),
    current_stock INTEGER DEFAULT 0,
    minimum_stock INTEGER DEFAULT 0,
    maximum_stock INTEGER DEFAULT 100,
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    barcode VARCHAR(255) UNIQUE,
    last_ordered_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create part_assignments table
CREATE TABLE part_assignments (
    id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
    machine_id INTEGER REFERENCES machines(id) ON DELETE CASCADE,
    quantity_required INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(part_id, machine_id)
);

-- Create parts_usage table
CREATE TABLE parts_usage (
    id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
    machine_id INTEGER REFERENCES machines(id) ON DELETE CASCADE,
    quantity_used INTEGER NOT NULL,
    usage_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER REFERENCES users(id),
    notes TEXT
);

-- Create transactions table
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER REFERENCES users(id),
    notes TEXT
);

-- Create indexes for better query performance
CREATE INDEX idx_parts_fiserv_part_number ON parts(fiserv_part_number);
CREATE INDEX idx_parts_barcode ON parts(barcode);
CREATE INDEX idx_parts_status ON parts(status);
CREATE INDEX idx_machines_status ON machines(status);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_parts_usage_date ON parts_usage(usage_date);
