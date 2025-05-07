-- Drop tables in correct order
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS parts_usage CASCADE;
DROP TABLE IF EXISTS parts CASCADE;
DROP TABLE IF EXISTS machines CASCADE;

-- Create machines table
CREATE TABLE machines (
    machine_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    model VARCHAR(255),
    serial_number VARCHAR(255) UNIQUE,
    location VARCHAR(255),
    status VARCHAR(50),
    manufacturer VARCHAR(255),
    installation_date TIMESTAMP,
    last_maintenance_date TIMESTAMP,
    next_maintenance_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create parts table
CREATE TABLE parts (
    part_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    manufacturer_part_number VARCHAR(255),
    fiserv_part_number VARCHAR(255),
    quantity INTEGER NOT NULL DEFAULT 0,
    minimum_quantity INTEGER DEFAULT 0,
    machine_id INTEGER REFERENCES machines(machine_id) ON DELETE SET NULL,
    supplier VARCHAR(255),
    unit_cost DECIMAL(10,2),
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    notes TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create transactions table
CREATE TABLE transactions (
    transaction_id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(part_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'IN' or 'OUT'
    quantity INTEGER NOT NULL,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(255),
    notes TEXT,
    reference_number VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create parts_usage table
CREATE TABLE parts_usage (
    usage_id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(part_id) ON DELETE CASCADE,
    machine_id INTEGER REFERENCES machines(machine_id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_parts_machine_id ON parts(machine_id);
CREATE INDEX idx_transactions_part_id ON transactions(part_id);
CREATE INDEX idx_parts_manufacturer_number ON parts(manufacturer_part_number);
CREATE INDEX idx_parts_fiserv_number ON parts(fiserv_part_number);
CREATE INDEX idx_parts_usage_part_id ON parts_usage(part_id);
CREATE INDEX idx_parts_usage_machine_id ON parts_usage(machine_id);

-- Create trigger to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_parts_updated_at
    BEFORE UPDATE ON parts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_machines_updated_at
    BEFORE UPDATE ON machines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
