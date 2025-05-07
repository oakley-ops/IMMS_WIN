-- Sample data for Fiserv Inventory System - Simple version

-- Insert sample part locations
INSERT INTO part_locations (name, description) VALUES
    ('Warehouse B', 'Secondary storage location'),
    ('Shelf B2', 'Storage shelf in Building B'),
    ('Cabinet C3', 'High security storage'),
    ('Drawer D1', 'Small parts drawer');

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
    notes
) VALUES
    ('ATM Card Reader V2', 'Standard magnetic stripe card reader', 'CR-200', 'FSV-CR-002', 15, 5, 'TechCorp', 299.99, 'Compatible with all ATM models'),
    ('Receipt Printer V2', 'Thermal receipt printer', 'TP-300', 'FSV-TP-003', 8, 3, 'PrintTech', 199.99, 'High-speed thermal printing'),
    ('Cash Dispenser Motor V2', 'Motor for cash dispensing mechanism', 'CDM-400', 'FSV-CDM-004', 4, 2, 'MotorWorks', 599.99, 'Requires special installation'),
    ('Touchscreen Display V2', '15" LCD touchscreen', 'TD-500', 'FSV-TD-005', 6, 2, 'TechCorp', 449.99, 'High resolution display'),
    ('Power Supply Unit V2', '24V DC power unit', 'PS-600', 'FSV-PS-006', 10, 3, 'ElectroSupply', 129.99, 'Compatible with all ATM models');

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
    ('ATM-201', 'CashMaster 2000', 'CM2K-223456', 'Branch K - Main Lobby', 'TechCorp', '2023-01-15', '2024-01-15', '2024-07-15', 'High-traffic location'),
    ('ATM-202', 'CashMaster 2000', 'CM2K-223457', 'Branch L - Drive Through', 'TechCorp', '2023-02-20', '2024-02-20', '2024-08-20', 'Outdoor unit'),
    ('ATM-203', 'CashMaster 3000', 'CM3K-223458', 'Branch M - Mall Location', 'TechCorp', '2023-03-25', '2024-03-25', '2024-09-25', 'New model installation'),
    ('ATM-204', 'CashMaster 3000', 'CM3K-223459', 'Branch N - Airport', 'TechCorp', '2023-04-10', '2024-04-10', '2024-10-10', '24/7 operation'),
    ('ATM-205', 'CashMaster 3000', 'CM3K-223460', 'Branch O - Downtown', 'TechCorp', '2023-05-05', '2024-05-05', '2024-11-05', 'Recently upgraded'); 