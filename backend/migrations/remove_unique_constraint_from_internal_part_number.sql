-- Remove unique constraint from internal_part_number
ALTER TABLE parts
DROP CONSTRAINT IF EXISTS unique_internal_part_number; 