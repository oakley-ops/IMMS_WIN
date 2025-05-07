-- Create parts_usage table
CREATE TABLE IF NOT EXISTS parts_usage (
    usage_id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(part_id),
    machine_id INTEGER REFERENCES machines(machine_id),
    quantity INTEGER NOT NULL,
    usage_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    technician VARCHAR(255),
    reason TEXT,
    work_order_number VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
