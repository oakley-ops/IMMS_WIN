-- First, drop the existing foreign key constraint
ALTER TABLE part_assignments
DROP CONSTRAINT part_assignments_machine_id_fkey;

-- Then add it back with ON DELETE CASCADE
ALTER TABLE part_assignments
ADD CONSTRAINT part_assignments_machine_id_fkey
FOREIGN KEY (machine_id)
REFERENCES machines(machine_id)
ON DELETE CASCADE;
