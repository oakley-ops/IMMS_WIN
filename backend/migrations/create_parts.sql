CREATE TABLE IF NOT EXISTS parts (
    part_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    manufacturer_part_number VARCHAR(100),
    fiserv_part_number VARCHAR(100),
    quantity INTEGER NOT NULL DEFAULT 0,
    minimum_quantity INTEGER NOT NULL DEFAULT 0,
    machine_id INTEGER REFERENCES machines(machine_id),
    supplier VARCHAR(255),
    unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    location VARCHAR(255),
    image_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
