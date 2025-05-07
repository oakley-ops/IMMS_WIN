-- Create part_locations table first (since parts table references it)
CREATE TABLE IF NOT EXISTS part_locations (
    location_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create parts table
CREATE TABLE IF NOT EXISTS parts (
    part_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    manufacturer_part_number VARCHAR(100),
    fiserv_part_number VARCHAR(100),
    quantity INTEGER NOT NULL DEFAULT 0,
    minimum_quantity INTEGER NOT NULL DEFAULT 0,
    supplier VARCHAR(255),
    unit_cost DECIMAL(10, 2),
    location_id INTEGER,
    notes TEXT,
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
    type VARCHAR(50) NOT NULL CHECK (type IN ('usage', 'restock')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Add foreign key constraint to parts table
ALTER TABLE parts
ADD CONSTRAINT fk_location
FOREIGN KEY (location_id)
REFERENCES part_locations(location_id)
ON DELETE SET NULL;
