-- Extended sample data for Fiserv Inventory System

-- Insert sample users (password: password123)
INSERT INTO users (username, password_hash, role, is_active) VALUES
    ('admin', '$2b$10$3euPcmQFCiblsZeEu5s7p.9MUZWg0TqhDrDqEK0OFCBxKG4Qz.YyS', 'admin', true),
    ('manager', '$2b$10$3euPcmQFCiblsZeEu5s7p.9MUZWg0TqhDrDqEK0OFCBxKG4Qz.YyS', 'manager', true),
    ('technician', '$2b$10$3euPcmQFCiblsZeEu5s7p.9MUZWg0TqhDrDqEK0OFCBxKG4Qz.YyS', 'technician', true);

-- Insert sample part locations
INSERT INTO part_locations (name, description) VALUES
    ('Warehouse B', 'Secondary storage location'),
    ('Shelf B2', 'Storage shelf in Building B'),
    ('Cabinet C3', 'High security storage'),
    ('Drawer D1', 'Small parts drawer');

-- Insert sample suppliers
INSERT INTO suppliers (name, contact_name, email, phone, address) VALUES
    ('TechCorp', 'John Smith', 'jsmith@techcorp.com', '555-1234', '123 Tech St, Silicon Valley, CA'),
    ('PrintTech', 'Mary Johnson', 'mjohnson@printtech.com', '555-2345', '456 Printer Ave, Inkton, NY'),
    ('MotorWorks', 'David Lee', 'dlee@motorworks.com', '555-3456', '789 Motor Blvd, Detroit, MI'),
    ('ElectroSupply', 'Sarah Chen', 'schen@electrosupply.com', '555-4567', '101 Circuit Ln, Edison, NJ'),
    ('ATM Parts Inc', 'Robert Taylor', 'rtaylor@atmparts.com', '555-5678', '202 ATM Way, Banking, IL');

-- Insert sample parts (using the correct schema)
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

-- Insert sample machines with new serial numbers
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

-- Insert purchase orders using the correct schema
INSERT INTO purchase_orders (
    po_number,
    supplier_id,
    status,
    total_amount,
    notes,
    is_urgent,
    priority
) VALUES
    ('PO-2024-101', 1, 'received', 2499.92, 'Regular quarterly order', false, 'medium'),
    ('PO-2024-102', 2, 'received', 1199.94, 'Emergency rush order', true, 'high'),
    ('PO-2024-103', 3, 'received', 4799.92, 'Bulk order discount applied', false, 'medium'),
    ('PO-2024-104', 4, 'received', 1299.90, 'Critical parts order', true, 'high'),
    ('PO-2024-105', 5, 'received', 1599.96, 'Regular stock replenishment', false, 'low');

-- Then add purchase order items after POs are created
INSERT INTO purchase_order_items (
    po_id,
    part_id,
    quantity,
    unit_price,
    total_price
) VALUES
    (1, 1, 5, 299.99, 1499.95),
    (1, 1, 10, 89.99, 899.90),
    (2, 2, 6, 199.99, 1199.94),
    (3, 3, 8, 599.99, 4799.92),
    (4, 4, 10, 129.99, 1299.90),
    (5, 5, 4, 399.99, 1599.96); 