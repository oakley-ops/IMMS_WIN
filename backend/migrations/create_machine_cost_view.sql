-- Create a view to calculate machine parts usage costs
CREATE OR REPLACE VIEW machine_parts_cost_view AS
SELECT 
    m.machine_id,
    m.name AS machine_name,
    m.model,
    m.serial_number,
    m.location,
    SUM(t.quantity * p.unit_cost) AS total_parts_cost,
    COUNT(DISTINCT t.part_id) AS unique_parts_used,
    SUM(t.quantity) AS total_parts_quantity,
    MIN(t.date) AS first_usage_date,
    MAX(t.date) AS last_usage_date
FROM 
    machines m
LEFT JOIN 
    transactions t ON m.machine_id = t.machine_id
LEFT JOIN 
    parts p ON t.part_id = p.part_id
WHERE
    t.type = 'usage' OR t.type IS NULL
GROUP BY 
    m.machine_id, m.name, m.model, m.serial_number, m.location
ORDER BY 
    total_parts_cost DESC NULLS LAST;

-- Create a view for detailed machine parts usage
CREATE OR REPLACE VIEW machine_parts_detail_view AS
SELECT 
    m.machine_id,
    m.name AS machine_name,
    p.part_id,
    p.name AS part_name,
    p.fiserv_part_number,
    p.manufacturer_part_number,
    SUM(t.quantity) AS total_quantity_used,
    SUM(t.quantity * p.unit_cost) AS total_cost,
    COUNT(t.transaction_id) AS usage_count,
    MIN(t.date) AS first_usage_date,
    MAX(t.date) AS last_usage_date
FROM 
    machines m
JOIN 
    transactions t ON m.machine_id = t.machine_id
JOIN 
    parts p ON t.part_id = p.part_id
WHERE
    t.type = 'usage'
GROUP BY 
    m.machine_id, m.name, p.part_id, p.name, p.fiserv_part_number, p.manufacturer_part_number
ORDER BY 
    m.machine_id, total_cost DESC; 