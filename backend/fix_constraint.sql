-- Remove the unique constraint
ALTER TABLE parts DROP CONSTRAINT IF EXISTS unique_fiserv_part_number; 