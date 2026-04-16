-- SQL Query to extract all parts from your database
-- Copy this query and run it in your database management tool
-- Then export the results to Excel with the filename "Database_Parts_Export.xlsx"

SELECT 
    p.part_id as "Part ID",
    p.name as "Name",
    p.description as "Description",
    p.manufacturer_part_number as "Manufacturer Part Number",
    p.internal_part_number as "Internal Part Number",
    p.quantity as "Quantity",
    p.minimum_quantity as "Minimum Quantity",
    p.supplier as "Supplier",
    p.unit_cost as "Unit Cost",
    COALESCE(pl.name, 'Unknown Location') as "Location",
    COALESCE(pl.description, '') as "Location Description",
    CASE 
        WHEN p.quantity = 0 THEN 'Out of Stock'
        WHEN p.quantity <= p.minimum_quantity THEN 'Low Stock'
        ELSE 'In Stock'
    END as "Stock Status",
    p.notes as "Notes",
    p.created_at::date as "Created At",
    p.updated_at::date as "Updated At"
FROM parts p
LEFT JOIN part_locations pl ON p.location_id = pl.location_id
ORDER BY p.part_id;

-- Alternative simplified query if you don't have part_locations table:
-- 
-- SELECT 
--     part_id as "Part ID",
--     name as "Name", 
--     description as "Description",
--     manufacturer_part_number as "Manufacturer Part Number",
--     internal_part_number as "Internal Part Number",
--     quantity as "Quantity",
--     minimum_quantity as "Minimum Quantity",
--     supplier as "Supplier",
--     unit_cost as "Unit Cost",
--     'Unknown' as "Location",
--     '' as "Location Description", 
--     CASE 
--         WHEN quantity = 0 THEN 'Out of Stock'
--         WHEN quantity <= minimum_quantity THEN 'Low Stock'
--         ELSE 'In Stock'
--     END as "Stock Status",
--     notes as "Notes",
--     created_at::date as "Created At",
--     updated_at::date as "Updated At"
-- FROM parts
-- ORDER BY part_id;
