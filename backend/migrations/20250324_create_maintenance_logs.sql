-- Create maintenance_logs table to track machine maintenance history
CREATE TABLE IF NOT EXISTS maintenance_logs (
    log_id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL REFERENCES machines(machine_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('completed', 'in_progress', 'scheduled', 'cancelled')),
    log_date TIMESTAMP NOT NULL DEFAULT NOW(),
    completion_date TIMESTAMP,
    technician VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add index on machine_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_machine_id ON maintenance_logs(machine_id);

-- Add index on log_date for date-based queries
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_log_date ON maintenance_logs(log_date);

-- Trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_maintenance_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_maintenance_logs_timestamp
BEFORE UPDATE ON maintenance_logs
FOR EACH ROW
EXECUTE FUNCTION update_maintenance_logs_updated_at(); 