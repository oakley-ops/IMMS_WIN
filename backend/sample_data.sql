-- Insert sample part locations
INSERT INTO part_locations (name, description) VALUES
    ('Warehouse A', 'Main storage warehouse'),
    ('Shelf B1', 'Storage shelf in Building B'),
    ('Cabinet C2', 'Secure cabinet in maintenance room');

-- Insert sample parts
INSERT INTO parts (
    name,
    description,
    manufacturer_part_number,
    fiserv_part_number,
    quantity,
    minimum_quantity,
    supplier,
    unit_cost,
    location_id,
    notes
) VALUES
    ('ATM Card Reader', 'Standard magnetic stripe card reader', 'CR-100', 'FSV-CR-001', 15, 5, 'TechCorp', 299.99, 1, 'Compatible with all ATM models'),
    ('Receipt Printer', 'Thermal receipt printer', 'TP-200', 'FSV-TP-002', 8, 3, 'PrintTech', 199.99, 2, 'High-speed thermal printing'),
    ('Cash Dispenser Motor', 'Motor for cash dispensing mechanism', 'CDM-300', 'FSV-CDM-003', 4, 2, 'MotorWorks', 599.99, 3, 'Requires special installation');

-- Insert sample machines
INSERT INTO machines (
    name,
    model,
    serial_number,
    location,
    manufacturer,
    installation_date,
    last_maintenance_date,
    next_maintenance_date,
    notes
) VALUES
    ('ATM-101', 'CashMaster 2000', 'CM2K-123456', 'Branch A - Main Lobby', 'TechCorp', '2023-01-15', '2024-01-15', '2024-07-15', 'High-traffic location'),
    ('ATM-102', 'CashMaster 2000', 'CM2K-123457', 'Branch B - Drive Through', 'TechCorp', '2023-02-20', '2024-02-20', '2024-08-20', 'Outdoor unit'),
    ('ATM-103', 'CashMaster 3000', 'CM3K-123458', 'Branch C - Mall Location', 'TechCorp', '2023-03-25', '2024-03-25', '2024-09-25', 'New model installation');

-- Insert sample transactions
INSERT INTO transactions (
    part_id,
    machine_id,
    quantity,
    type,
    notes
) VALUES
    (1, 1, 1, 'usage', 'Routine replacement'),
    (2, 2, 1, 'usage', 'Emergency repair'),
    (3, 3, 2, 'restock', 'Regular inventory restock');
