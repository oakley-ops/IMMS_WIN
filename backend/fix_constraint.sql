-- Remove the unique constraint
ALTER TABLE parts DROP CONSTRAINT IF EXISTS unique_internal_part_number; 