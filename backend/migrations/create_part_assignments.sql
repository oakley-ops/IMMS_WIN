CREATE TABLE IF NOT EXISTS part_assignments (
    assignment_id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL REFERENCES machines(machine_id),
    part_id INTEGER NOT NULL REFERENCES parts(part_id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    assignment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE(machine_id, part_id)
);
