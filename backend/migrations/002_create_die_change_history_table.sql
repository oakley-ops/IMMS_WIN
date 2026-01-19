-- Create die_change_history table
-- Tracks every installation and removal of dies from machines

BEGIN;

CREATE TABLE IF NOT EXISTS die_change_history (
    change_id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL REFERENCES machines(machine_id) ON DELETE SET NULL,
    die_id INTEGER NOT NULL REFERENCES dies(die_id) ON DELETE CASCADE,
    
    action VARCHAR(20) NOT NULL,
    change_reason_code VARCHAR(50) NOT NULL,
    change_reason_notes TEXT,
    
    technician_id INTEGER REFERENCES technicians(technician_id),
    technician_name VARCHAR(255),
    change_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    expected_runtime_hours INTEGER,
    expected_cycles INTEGER,
    
    actual_runtime_hours INTEGER,
    actual_cycles INTEGER,
    cycles_at_removal INTEGER,
    die_condition VARCHAR(50),
    
    previous_die_id INTEGER REFERENCES dies(die_id) ON DELETE SET NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (action IN ('INSTALL', 'REMOVE')),
    CHECK (die_condition IN ('GOOD', 'FAIR', 'POOR', NULL))
);

CREATE INDEX IF NOT EXISTS idx_die_change_history_machine_id ON die_change_history(machine_id);
CREATE INDEX IF NOT EXISTS idx_die_change_history_die_id ON die_change_history(die_id);
CREATE INDEX IF NOT EXISTS idx_die_change_history_date ON die_change_history(change_date);
CREATE INDEX IF NOT EXISTS idx_die_change_history_technician ON die_change_history(technician_id);

COMMENT ON TABLE die_change_history IS 'Complete audit trail of all die installations and removals';
COMMENT ON COLUMN die_change_history.action IS 'INSTALL or REMOVE';
COMMENT ON COLUMN die_change_history.change_reason_code IS 'Reason code: SCH_MAINT, DULL, DAMAGED, QUALITY, etc.';

COMMIT;
