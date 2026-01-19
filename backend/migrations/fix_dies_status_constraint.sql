-- Fix dies status check constraint to include all used statuses
ALTER TABLE dies DROP CONSTRAINT IF EXISTS dies_status_check;

ALTER TABLE dies ADD CONSTRAINT dies_status_check
CHECK (status IN ('SHARP', 'USED', 'IN_MACHINE', 'OUT_FOR_SHARPENING',
                  'NEW', 'AVAILABLE', 'INSTALLED', 'NEEDS_SHARPENING',
                  'SCHEDULED_FOR_SHARPENING', 'SHIPPED_FOR_SHARPENING',
                  'AT_SHARPENING_VENDOR', 'RETURNING_FROM_SHARPENING', 'RETIRED'));
