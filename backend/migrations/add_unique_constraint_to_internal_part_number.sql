-- Add unique constraint to internal_part_number
ALTER TABLE parts
ADD CONSTRAINT unique_internal_part_number UNIQUE (internal_part_number);
