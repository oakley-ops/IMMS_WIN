-- Add unique constraint to fiserv_part_number
ALTER TABLE parts
ADD CONSTRAINT unique_fiserv_part_number UNIQUE (fiserv_part_number);
