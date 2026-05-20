-- PM Scheduling Enhancements Migration
-- Adds missing machine types, checklists, and fixes schema gaps

-- 1. Ensure machine_type column exists
ALTER TABLE machines ADD COLUMN IF NOT EXISTS machine_type VARCHAR(255) DEFAULT 'Default';

-- 2. Add scheduled_technician column if it doesn't exist
ALTER TABLE machines ADD COLUMN IF NOT EXISTS scheduled_technician VARCHAR(255);

-- 3. Ensure maintenance_status column exists
ALTER TABLE machines ADD COLUMN IF NOT EXISTS maintenance_status VARCHAR(20) DEFAULT 'none';

-- 4. Ensure next_maintenance_date column exists
ALTER TABLE machines ADD COLUMN IF NOT EXISTS next_maintenance_date TIMESTAMP;

-- 5. Add scheduled_checklist_id to track which checklist was scheduled for the machine
ALTER TABLE machines ADD COLUMN IF NOT EXISTS scheduled_checklist_id INTEGER;

-- 6. Add technician_name column to pm_sessions if it doesn't exist
ALTER TABLE pm_sessions ADD COLUMN IF NOT EXISTS technician_name VARCHAR(255);

-- 7. Update existing machines with correct machine types based on actual machine names
UPDATE machines SET machine_type = 'Hot Stamp' WHERE name ILIKE 'Hot Stamp%' AND (machine_type IS NULL OR machine_type = 'Default');
UPDATE machines SET machine_type = 'EMV' WHERE name ILIKE 'EMV%' AND (machine_type IS NULL OR machine_type = 'Default');
UPDATE machines SET machine_type = 'Die Press' WHERE name ILIKE 'Die Press%' AND (machine_type IS NULL OR machine_type = 'Default');
UPDATE machines SET machine_type = 'Collator' WHERE name ILIKE 'Collator%' AND (machine_type IS NULL OR machine_type = 'Default');
UPDATE machines SET machine_type = 'CML' WHERE name ILIKE 'CML%' AND (machine_type IS NULL OR machine_type = 'Default');
UPDATE machines SET machine_type = 'Laminator' WHERE name ILIKE 'Laminator%' AND (machine_type IS NULL OR machine_type = 'Default');
UPDATE machines SET machine_type = 'Inspection' WHERE name ILIKE 'Inspection%' AND (machine_type IS NULL OR machine_type = 'Default');
UPDATE machines SET machine_type = 'Tipping' WHERE name ILIKE 'Tipping%' AND (machine_type IS NULL OR machine_type = 'Default');
UPDATE machines SET machine_type = 'Embosser' WHERE name ILIKE 'Emboss%' AND (machine_type IS NULL OR machine_type = 'Default');
UPDATE machines SET machine_type = 'Mailer' WHERE name ILIKE 'Mailer%' AND (machine_type IS NULL OR machine_type = 'Default');

-- 8. Create indexes
CREATE INDEX IF NOT EXISTS idx_machines_machine_type ON machines(machine_type);
CREATE INDEX IF NOT EXISTS idx_machines_scheduled_checklist_id ON machines(scheduled_checklist_id);

-- 9. Insert PM intervals for actual machine types (if they don't exist)
INSERT INTO pm_intervals (machine_type, interval_days) VALUES
    ('Hot Stamp', 30),
    ('EMV', 60),
    ('Die Press', 30),
    ('Collator', 60),
    ('CML', 60),
    ('Laminator', 45),
    ('Inspection', 90),
    ('Tipping', 45),
    ('Embosser', 60),
    ('Mailer', 60)
ON CONFLICT DO NOTHING;

-- 10. Insert PM checklists for actual machine types
INSERT INTO pm_checklists (name, description, machine_type, is_active) VALUES
    ('Hot Stamp Maintenance', 'Standard maintenance checklist for Hot Stamp machines', 'Hot Stamp', true),
    ('EMV Machine Maintenance', 'Standard maintenance checklist for EMV machines', 'EMV', true),
    ('Die Press Maintenance', 'Standard maintenance checklist for Die Press machines', 'Die Press', true),
    ('Collator Maintenance', 'Standard maintenance checklist for Collator machines', 'Collator', true),
    ('CML Maintenance', 'Standard maintenance checklist for CML machines', 'CML', true),
    ('Laminator Maintenance', 'Standard maintenance checklist for Laminator machines', 'Laminator', true)
ON CONFLICT DO NOTHING;

-- 11. Insert tasks for new checklists
DO $$
DECLARE
    hot_stamp_id INTEGER;
    emv_id INTEGER;
    die_press_id INTEGER;
    collator_id INTEGER;
    cml_id INTEGER;
    laminator_id INTEGER;
BEGIN
    -- Get Hot Stamp checklist ID
    SELECT checklist_id INTO hot_stamp_id FROM pm_checklists WHERE name = 'Hot Stamp Maintenance' LIMIT 1;
    IF hot_stamp_id IS NOT NULL THEN
        -- Check if tasks already exist for this checklist
        IF NOT EXISTS (SELECT 1 FROM pm_tasks WHERE checklist_id = hot_stamp_id) THEN
            INSERT INTO pm_tasks (checklist_id, task_name, description, is_required, sort_order) VALUES
                (hot_stamp_id, 'Check foil supply levels', 'Verify foil supply and replace if low', true, 1),
                (hot_stamp_id, 'Clean hot stamp die', 'Clean die face and remove debris', true, 2),
                (hot_stamp_id, 'Check heating element', 'Verify heating element temperature and function', true, 3),
                (hot_stamp_id, 'Inspect pressure system', 'Check pressure settings and pneumatic components', true, 4),
                (hot_stamp_id, 'Lubricate moving parts', 'Apply lubricant to all moving components', true, 5),
                (hot_stamp_id, 'Test stamp alignment', 'Run test cards and verify alignment', true, 6),
                (hot_stamp_id, 'Check sensors', 'Verify all sensors are functioning properly', true, 7),
                (hot_stamp_id, 'Clean feed mechanism', 'Clean and inspect card feed system', true, 8);
        END IF;
    END IF;

    -- Get EMV checklist ID
    SELECT checklist_id INTO emv_id FROM pm_checklists WHERE name = 'EMV Machine Maintenance' LIMIT 1;
    IF emv_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM pm_tasks WHERE checklist_id = emv_id) THEN
            INSERT INTO pm_tasks (checklist_id, task_name, description, is_required, sort_order) VALUES
                (emv_id, 'Clean chip module', 'Clean EMV chip embedding module', true, 1),
                (emv_id, 'Check chip inventory', 'Verify chip inventory levels', true, 2),
                (emv_id, 'Calibrate placement system', 'Calibrate chip placement accuracy', true, 3),
                (emv_id, 'Inspect adhesive system', 'Check adhesive dispenser and levels', true, 4),
                (emv_id, 'Test chip encoding', 'Run test cards and verify encoding', true, 5),
                (emv_id, 'Clean card transport', 'Clean card transport mechanism', true, 6),
                (emv_id, 'Check rejection system', 'Verify reject bin and sensors', true, 7),
                (emv_id, 'Update firmware', 'Check for and apply firmware updates', false, 8);
        END IF;
    END IF;

    -- Get Die Press checklist ID
    SELECT checklist_id INTO die_press_id FROM pm_checklists WHERE name = 'Die Press Maintenance' LIMIT 1;
    IF die_press_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM pm_tasks WHERE checklist_id = die_press_id) THEN
            INSERT INTO pm_tasks (checklist_id, task_name, description, is_required, sort_order) VALUES
                (die_press_id, 'Inspect die condition', 'Check die for wear and damage', true, 1),
                (die_press_id, 'Check die sharpness', 'Verify die cutting edge sharpness', true, 2),
                (die_press_id, 'Clean die surface', 'Clean die cutting surface', true, 3),
                (die_press_id, 'Check press alignment', 'Verify press alignment and registration', true, 4),
                (die_press_id, 'Lubricate press mechanism', 'Apply lubricant to press components', true, 5),
                (die_press_id, 'Test cut quality', 'Run test cuts and verify quality', true, 6),
                (die_press_id, 'Check safety guards', 'Verify all safety guards are in place', true, 7),
                (die_press_id, 'Inspect hydraulics', 'Check hydraulic fluid and connections', true, 8);
        END IF;
    END IF;

    -- Get Collator checklist ID
    SELECT checklist_id INTO collator_id FROM pm_checklists WHERE name = 'Collator Maintenance' LIMIT 1;
    IF collator_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM pm_tasks WHERE checklist_id = collator_id) THEN
            INSERT INTO pm_tasks (checklist_id, task_name, description, is_required, sort_order) VALUES
                (collator_id, 'Clean card bins', 'Clean all card input and output bins', true, 1),
                (collator_id, 'Check sensors', 'Verify all card detection sensors', true, 2),
                (collator_id, 'Inspect transport belts', 'Check belt condition and tension', true, 3),
                (collator_id, 'Clean card path', 'Clean entire card transport path', true, 4),
                (collator_id, 'Test card counting', 'Verify card counting accuracy', true, 5),
                (collator_id, 'Check stack quality', 'Test card stacking alignment', true, 6),
                (collator_id, 'Lubricate bearings', 'Apply lubricant to all bearings', true, 7);
        END IF;
    END IF;

    -- Get CML checklist ID
    SELECT checklist_id INTO cml_id FROM pm_checklists WHERE name = 'CML Maintenance' LIMIT 1;
    IF cml_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM pm_tasks WHERE checklist_id = cml_id) THEN
            INSERT INTO pm_tasks (checklist_id, task_name, description, is_required, sort_order) VALUES
                (cml_id, 'Check laser alignment', 'Verify laser alignment and focus', true, 1),
                (cml_id, 'Clean optics', 'Clean laser optics and mirrors', true, 2),
                (cml_id, 'Test engraving quality', 'Run test engravings and verify quality', true, 3),
                (cml_id, 'Check ventilation system', 'Verify fume extraction is working', true, 4),
                (cml_id, 'Inspect card transport', 'Check card feed and positioning', true, 5),
                (cml_id, 'Verify power settings', 'Check laser power calibration', true, 6),
                (cml_id, 'Clean work area', 'Remove debris from engraving area', true, 7);
        END IF;
    END IF;

    -- Get Laminator checklist ID
    SELECT checklist_id INTO laminator_id FROM pm_checklists WHERE name = 'Laminator Maintenance' LIMIT 1;
    IF laminator_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM pm_tasks WHERE checklist_id = laminator_id) THEN
            INSERT INTO pm_tasks (checklist_id, task_name, description, is_required, sort_order) VALUES
                (laminator_id, 'Check laminate supply', 'Verify laminate roll levels', true, 1),
                (laminator_id, 'Clean laminating rollers', 'Clean and inspect rollers for debris', true, 2),
                (laminator_id, 'Check temperature settings', 'Verify heating element temperatures', true, 3),
                (laminator_id, 'Inspect pressure settings', 'Check roller pressure calibration', true, 4),
                (laminator_id, 'Test adhesion quality', 'Run test cards and check laminate adhesion', true, 5),
                (laminator_id, 'Clean card path', 'Clean card transport mechanism', true, 6),
                (laminator_id, 'Check tension system', 'Verify laminate web tension', true, 7),
                (laminator_id, 'Inspect cutting mechanism', 'Check laminate cutter condition', true, 8);
        END IF;
    END IF;
END $$;
