-- Update Die Press machines to have correct machine_type
UPDATE machines 
SET machine_type = 'Die Press'
WHERE name ILIKE '%die press%';

-- Verify the update
SELECT machine_id, name, machine_type, location 
FROM machines 
WHERE machine_type = 'Die Press'
ORDER BY name;
