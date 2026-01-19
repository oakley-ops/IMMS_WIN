-- Create die_maintenance_schedule table
-- Preventive maintenance scheduling for dies

BEGIN;

CREATE TABLE IF NOT EXISTS die_maintenance_schedule (
    schedule_id SERIAL PRIMARY KEY,
    die_id INTEGER NOT NULL REFERENCES dies(die_id) ON DELETE CASCADE,
    machine_id INTEGER REFERENCES machines(machine_id) ON DELETE SET NULL,
    
    maintenance_type VARCHAR(100) NOT NULL,
    scheduled_date DATE NOT NULL,
    frequency_days INTEGER,
    
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
    completed_date DATE,
    completed_by INTEGER REFERENCES technicians(technician_id),
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'OVERDUE')),
    CHECK (maintenance_type IN ('SHARPENING', 'INSPECTION', 'REPLACEMENT'))
);

CREATE INDEX IF NOT EXISTS idx_die_maintenance_die_id ON die_maintenance_schedule(die_id);
CREATE INDEX IF NOT EXISTS idx_die_maintenance_scheduled_date ON die_maintenance_schedule(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_die_maintenance_status ON die_maintenance_schedule(status);

COMMENT ON TABLE die_maintenance_schedule IS 'Preventive maintenance scheduling for dies';
COMMENT ON COLUMN die_maintenance_schedule.maintenance_type IS 'Type: SHARPENING, INSPECTION, REPLACEMENT';

COMMIT;
