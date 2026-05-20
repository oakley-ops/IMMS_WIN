-- Migration: Drop crc_part_number column from parts table
-- Date: 2026-03-17
-- Reason: CRC part number is no longer used. manufacturer_part_number is the primary part identifier.

BEGIN;

-- Drop the unique constraint on crc_part_number if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_crc_part_number'
  ) THEN
    ALTER TABLE parts DROP CONSTRAINT unique_crc_part_number;
  END IF;
END $$;

-- Drop the index on crc_part_number if it exists
DROP INDEX IF EXISTS idx_parts_crc_part_number;
DROP INDEX IF EXISTS idx_crc_part_number;

-- Recreate the machine_parts_detail_view without crc_part_number if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views WHERE viewname = 'machine_parts_detail_view'
  ) THEN
    DROP VIEW machine_parts_detail_view;
  END IF;
END $$;

-- Drop the crc_part_number column
ALTER TABLE parts DROP COLUMN IF EXISTS crc_part_number;

COMMIT;
