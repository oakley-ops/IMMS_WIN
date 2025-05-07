-- Remove unique constraint from fiserv_part_number
ALTER TABLE parts
DROP CONSTRAINT IF EXISTS unique_fiserv_part_number; 