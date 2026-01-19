-- Alter machines table to add die tracking fields

BEGIN;

ALTER TABLE machines 
ADD COLUMN IF NOT EXISTS current_die_id INTEGER REFERENCES dies(die_id) ON DELETE SET NULL;

ALTER TABLE machines 
ADD COLUMN IF NOT EXISTS die_installed_date TIMESTAMP;

ALTER TABLE machines 
ADD COLUMN IF NOT EXISTS die_installed_by INTEGER REFERENCES technicians(technician_id);

ALTER TABLE machines 
ADD COLUMN IF NOT EXISTS machine_type VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_machines_current_die ON machines(current_die_id);

COMMENT ON COLUMN machines.current_die_id IS 'Currently installed die in this machine';
COMMENT ON COLUMN machines.die_installed_date IS 'Date when current die was installed';
COMMENT ON COLUMN machines.die_installed_by IS 'Technician who installed current die';

COMMIT;
