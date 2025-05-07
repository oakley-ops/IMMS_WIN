-- Extended sample data for Fiserv Inventory System

-- Insert sample users (password: password123)
INSERT INTO users (username, password_hash, email, role) VALUES
    ('admin', '$2b$10$3euPcmQFCiblsZeEu5s7p.9MUZWg0TqhDrDqEK0OFCBxKG4Qz.YyS', 'admin@example.com', 'admin'),
    ('manager', '$2b$10$3euPcmQFCiblsZeEu5s7p.9MUZWg0TqhDrDqEK0OFCBxKG4Qz.YyS', 'manager@example.com', 'manager'),
    ('technician', '$2b$10$3euPcmQFCiblsZeEu5s7p.9MUZWg0TqhDrDqEK0OFCBxKG4Qz.YyS', 'tech@example.com', 'technician');

-- Insert sample part locations
INSERT INTO part_locations (name, description) VALUES
    ('Warehouse A', 'Main storage warehouse'),
    ('Warehouse B', 'Secondary storage location'),
    ('Shelf B1', 'Storage shelf in Building B'),
    ('Shelf B2', 'Storage shelf in Building B'),
    ('Cabinet C2', 'Secure cabinet in maintenance room'),
    ('Cabinet C3', 'High security storage'),
    ('Drawer D1', 'Small parts drawer');

-- Insert sample suppliers
INSERT INTO suppliers (name, contact_name, email, phone, address) VALUES
    ('TechCorp', 'John Smith', 'jsmith@techcorp.com', '555-1234', '123 Tech St, Silicon Valley, CA'),
    ('PrintTech', 'Mary Johnson', 'mjohnson@printtech.com', '555-2345', '456 Printer Ave, Inkton, NY'),
    ('MotorWorks', 'David Lee', 'dlee@motorworks.com', '555-3456', '789 Motor Blvd, Detroit, MI'),
    ('ElectroSupply', 'Sarah Chen', 'schen@electrosupply.com', '555-4567', '101 Circuit Ln, Edison, NJ'),
    ('ATM Parts Inc', 'Robert Taylor', 'rtaylor@atmparts.com', '555-5678', '202 ATM Way, Banking, IL');

-- Insert sample parts (without location_id)
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
    ('ATM Card Reader', 'Standard magnetic stripe card reader', 'CR-100', 'FSV-CR-001', 15, 5, 'TechCorp', 299.99, 'Compatible with all ATM models'),
    ('Receipt Printer', 'Thermal receipt printer', 'TP-200', 'FSV-TP-002', 8, 3, 'PrintTech', 199.99, 'High-speed thermal printing'),
    ('Cash Dispenser Motor', 'Motor for cash dispensing mechanism', 'CDM-300', 'FSV-CDM-003', 4, 2, 'MotorWorks', 599.99, 'Requires special installation'),
    ('Touchscreen Display', '15" LCD touchscreen', 'TD-400', 'FSV-TD-004', 6, 2, 'TechCorp', 449.99, 'High resolution display'),
    ('Power Supply Unit', '24V DC power unit', 'PS-500', 'FSV-PS-005', 10, 3, 'ElectroSupply', 129.99, 'Compatible with all ATM models'),
    ('Network Card', 'Gigabit ethernet card', 'NC-600', 'FSV-NC-006', 12, 4, 'TechCorp', 89.99, 'Includes encryption module'),
    ('Keypad', 'PIN entry keypad with encryption', 'KP-700', 'FSV-KP-007', 7, 2, 'ElectroSupply', 249.99, 'PCI compliant'),
    ('Cash Counter', 'Optical note counter sensor', 'CC-800', 'FSV-CC-008', 5, 2, 'ATM Parts Inc', 399.99, 'Precision counting mechanism'),
    ('Check Scanner', 'High-speed check scanner', 'CS-900', 'FSV-CS-009', 3, 1, 'PrintTech', 699.99, 'Requires regular cleaning'),
    ('Dispenser Belt', 'Replacement belt for cash dispenser', 'DB-1000', 'FSV-DB-010', 20, 5, 'MotorWorks', 39.99, 'Wear item, replace every 6 months');

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
    ('ATM-103', 'CashMaster 3000', 'CM3K-123458', 'Branch C - Mall Location', 'TechCorp', '2023-03-25', '2024-03-25', '2024-09-25', 'New model installation'),
    ('ATM-104', 'CashMaster 3000', 'CM3K-123459', 'Branch D - Airport', 'TechCorp', '2023-04-10', '2024-04-10', '2024-10-10', '24/7 operation'),
    ('ATM-105', 'CashMaster 3000', 'CM3K-123460', 'Branch E - Downtown', 'TechCorp', '2023-05-05', '2024-05-05', '2024-11-05', 'Recently upgraded'),
    ('ATM-106', 'ValueCash 1000', 'VC1K-234567', 'Branch F - Suburban', 'ValueTech', '2023-06-12', '2024-06-12', '2024-12-12', 'Basic model'),
    ('ATM-107', 'ValueCash 2000', 'VC2K-234568', 'Branch G - University', 'ValueTech', '2023-07-18', '2024-07-18', '2025-01-18', 'Heavy usage'),
    ('ATM-108', 'CashMaster 4000', 'CM4K-123461', 'Branch H - Corporate HQ', 'TechCorp', '2023-08-22', '2024-08-22', '2025-02-22', 'Premium model'),
    ('ATM-109', 'ValueCash 1000', 'VC1K-234569', 'Branch I - Shopping Center', 'ValueTech', '2023-09-30', '2024-09-30', '2025-03-30', 'Needs software update'),
    ('ATM-110', 'CashMaster 3000', 'CM3K-123462', 'Branch J - Train Station', 'TechCorp', '2023-10-15', '2024-10-15', '2025-04-15', 'Protected installation');

-- Insert purchase orders with simpler fields
INSERT INTO purchase_orders (
    po_number,
    supplier_id,
    status,
    total_amount,
    payment_terms,
    shipping_method,
    notes
) VALUES
    ('PO-2024-001', 1, 'received', 2499.92, 'Net 30', 'Ground', 'Regular quarterly order'),
    ('PO-2024-002', 2, 'received', 1199.94, 'Net 30', 'Ground', 'Emergency rush order'),
    ('PO-2024-003', 3, 'received', 4799.92, 'Net 45', 'Ground', 'Bulk order discount applied'),
    ('PO-2024-004', 4, 'received', 1299.90, 'Net 30', 'Express', 'Critical parts order'),
    ('PO-2024-005', 5, 'received', 1599.96, 'Net 30', 'Ground', 'Regular stock replenishment'),
    ('PO-2024-006', 1, 'shipped', 1799.94, 'Net 30', 'Ground', 'Monthly scheduled order'),
    ('PO-2024-007', 2, 'pending', 2799.93, 'Net 30', 'Ground', 'Waiting for approval'),
    ('PO-2024-008', 3, 'ordered', 3599.94, 'Net 45', 'Ground', 'Special order with custom parts'),
    ('PO-2024-009', 4, 'draft', 1949.85, 'Net 30', 'Ground', 'Draft order not yet submitted'),
    ('PO-2024-010', 5, 'cancelled', 1199.97, 'Net 30', 'Ground', 'Order cancelled due to vendor issues');

-- Then add purchase order items after POs are created
INSERT INTO purchase_order_items (
    po_id,
    part_id,
    quantity,
    unit_price,
    total_price
) VALUES
    (1, 1, 5, 299.99, 1499.95),
    (1, 6, 10, 89.99, 899.90),
    (1, 10, 5, 39.99, 199.95),
    (2, 2, 6, 199.99, 1199.94),
    (3, 3, 8, 599.99, 4799.92),
    (4, 5, 10, 129.99, 1299.90),
    (5, 4, 4, 399.99, 1599.96),
    (6, 7, 6, 249.99, 1499.94),
    (6, 10, 10, 39.99, 399.90),
    (7, 8, 7, 399.99, 2799.93),
    (8, 9, 5, 699.99, 3499.95),
    (8, 10, 5, 39.99, 199.95),
    (9, 2, 5, 199.99, 999.95),
    (9, 6, 10, 89.99, 899.90),
    (9, 10, 5, 39.99, 199.95),
    (10, 2, 6, 199.99, 1199.94); 