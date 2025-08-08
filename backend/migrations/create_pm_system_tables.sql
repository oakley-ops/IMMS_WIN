-- Create PM system tables for robust preventive maintenance

-- 1. PM intervals table - allows configurable intervals per machine type
CREATE TABLE IF NOT EXISTS pm_intervals (
    interval_id SERIAL PRIMARY KEY,
    machine_type VARCHAR(255) NOT NULL,
    interval_days INTEGER NOT NULL,
    interval_description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. PM checklists table - reusable maintenance checklists
CREATE TABLE IF NOT EXISTS pm_checklists (
    checklist_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    machine_type VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. PM tasks table - individual checklist items
CREATE TABLE IF NOT EXISTS pm_tasks (
    task_id SERIAL PRIMARY KEY,
    checklist_id INTEGER NOT NULL REFERENCES pm_checklists(checklist_id) ON DELETE CASCADE,
    task_name VARCHAR(255) NOT NULL,
    task_description TEXT,
    is_required BOOLEAN DEFAULT true,
    order_position INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. PM sessions table - tracks active maintenance sessions with technician
CREATE TABLE IF NOT EXISTS pm_sessions (
    session_id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL REFERENCES machines(machine_id) ON DELETE CASCADE,
    checklist_id INTEGER NOT NULL REFERENCES pm_checklists(checklist_id) ON DELETE CASCADE,
    technician_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'paused', 'cancelled')),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. PM task completions table - tracks individual task completion
CREATE TABLE IF NOT EXISTS pm_task_completions (
    completion_id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES pm_sessions(session_id) ON DELETE CASCADE,
    task_id INTEGER NOT NULL REFERENCES pm_tasks(task_id) ON DELETE CASCADE,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, task_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pm_intervals_machine_type ON pm_intervals(machine_type);
CREATE INDEX IF NOT EXISTS idx_pm_checklists_machine_type ON pm_checklists(machine_type);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_checklist_id ON pm_tasks(checklist_id);
CREATE INDEX IF NOT EXISTS idx_pm_sessions_machine_id ON pm_sessions(machine_id);
CREATE INDEX IF NOT EXISTS idx_pm_sessions_technician_id ON pm_sessions(technician_id);
CREATE INDEX IF NOT EXISTS idx_pm_sessions_status ON pm_sessions(status);
CREATE INDEX IF NOT EXISTS idx_pm_task_completions_session_id ON pm_task_completions(session_id);

-- Create trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_pm_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pm_intervals_updated_at
    BEFORE UPDATE ON pm_intervals
    FOR EACH ROW
    EXECUTE FUNCTION update_pm_updated_at_column();

CREATE TRIGGER update_pm_checklists_updated_at
    BEFORE UPDATE ON pm_checklists
    FOR EACH ROW
    EXECUTE FUNCTION update_pm_updated_at_column();

CREATE TRIGGER update_pm_tasks_updated_at
    BEFORE UPDATE ON pm_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_pm_updated_at_column();

CREATE TRIGGER update_pm_sessions_updated_at
    BEFORE UPDATE ON pm_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_pm_updated_at_column();

CREATE TRIGGER update_pm_task_completions_updated_at
    BEFORE UPDATE ON pm_task_completions
    FOR EACH ROW
    EXECUTE FUNCTION update_pm_updated_at_column();

-- Insert default PM intervals for common machine types
INSERT INTO pm_intervals (machine_type, interval_days, interval_description) VALUES
    ('ATM', 90, 'Quarterly maintenance for ATM machines'),
    ('Printer', 60, 'Bi-monthly maintenance for printers'),
    ('Server', 30, 'Monthly maintenance for servers'),
    ('Network Equipment', 180, 'Semi-annual maintenance for network equipment'),
    ('HVAC', 90, 'Quarterly maintenance for HVAC systems'),
    ('Default', 90, 'Default quarterly maintenance')
ON CONFLICT DO NOTHING;

-- Insert sample PM checklist for ATM machines
INSERT INTO pm_checklists (name, description, machine_type) VALUES
    ('ATM Quarterly Maintenance', 'Standard quarterly maintenance checklist for ATM machines', 'ATM'),
    ('Printer Maintenance', 'Standard maintenance checklist for printers', 'Printer'),
    ('Server Maintenance', 'Standard maintenance checklist for servers', 'Server'),
    ('General Equipment Check', 'Basic maintenance checklist for all equipment', 'Default')
ON CONFLICT DO NOTHING;

-- Insert sample PM tasks for ATM maintenance
INSERT INTO pm_tasks (checklist_id, task_name, task_description, is_required, order_position) VALUES
    (1, 'Visual Inspection', 'Check exterior for damage, wear, or tampering', true, 1),
    (1, 'Clean Card Reader', 'Clean card reader slot and mechanism', true, 2),
    (1, 'Check Cash Dispenser', 'Test cash dispenser mechanism and alignment', true, 3),
    (1, 'Verify Receipt Printer', 'Test receipt printer and replace paper if needed', true, 4),
    (1, 'Check Display Screen', 'Clean and test display screen functionality', true, 5),
    (1, 'Test Keypad', 'Test all keypad buttons for proper response', true, 6),
    (1, 'Check Security Features', 'Verify all security mechanisms are functioning', true, 7),
    (1, 'Update Software', 'Check for and install software updates', false, 8),
    (1, 'Document Issues', 'Record any issues or concerns found', true, 9)
ON CONFLICT DO NOTHING;

-- Insert sample PM tasks for printer maintenance
INSERT INTO pm_tasks (checklist_id, task_name, task_description, is_required, order_position) VALUES
    (2, 'Clean Print Heads', 'Clean print heads and nozzles', true, 1),
    (2, 'Replace Ink/Toner', 'Check and replace ink or toner cartridges', true, 2),
    (2, 'Clean Paper Path', 'Clean paper feed and output paths', true, 3),
    (2, 'Test Print Quality', 'Print test page and verify quality', true, 4),
    (2, 'Check Connections', 'Verify all cables and connections', true, 5),
    (2, 'Update Drivers', 'Check for and install driver updates', false, 6)
ON CONFLICT DO NOTHING;

-- Insert sample PM tasks for server maintenance
INSERT INTO pm_tasks (checklist_id, task_name, task_description, is_required, order_position) VALUES
    (3, 'Check System Health', 'Review system logs and health status', true, 1),
    (3, 'Update Security Patches', 'Install latest security updates', true, 2),
    (3, 'Check Disk Space', 'Monitor disk usage and clean up if needed', true, 3),
    (3, 'Test Backups', 'Verify backup systems are working', true, 4),
    (3, 'Check Network Connectivity', 'Test all network connections', true, 5),
    (3, 'Monitor Performance', 'Check CPU, memory, and disk performance', true, 6),
    (3, 'Clean Hardware', 'Clean dust from server components', true, 7)
ON CONFLICT DO NOTHING;

-- Insert sample PM tasks for general equipment
INSERT INTO pm_tasks (checklist_id, task_name, task_description, is_required, order_position) VALUES
    (4, 'Visual Inspection', 'Check for obvious damage or wear', true, 1),
    (4, 'Clean Equipment', 'Clean exterior and accessible interior', true, 2),
    (4, 'Test Basic Functions', 'Verify equipment operates normally', true, 3),
    (4, 'Check Connections', 'Verify all cables and connections', true, 4),
    (4, 'Document Status', 'Record equipment condition and any issues', true, 5)
ON CONFLICT DO NOTHING; 