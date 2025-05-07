-- Create test suppliers
INSERT INTO suppliers (name, contact_name, email, phone, address, notes) VALUES
('TechSupply Co.', 'John Smith', 'john@techsupply.example.com', '555-123-4567', '123 Tech Way, Silicon Valley, CA 94025', 'Primary supplier for printer parts'),
('ServerParts Inc.', 'Alice Johnson', 'alice@serverparts.example.com', '555-987-6543', '456 Server Road, Austin, TX 78701', 'Specializes in server and networking equipment'),
('Electronics Warehouse', 'Bob Williams', 'bob@electronics.example.com', '555-555-5555', '789 Circuit Drive, Boston, MA 02108', 'Good prices on bulk electronic components'),
('Global Tech Distributors', 'Maria Garcia', 'maria@globaltechdist.example.com', '555-333-2222', '101 Distribution Ave, Chicago, IL 60601', 'International distributor with competitive pricing'),
('Office Solutions', 'David Lee', 'david@officesolutions.example.com', '555-444-1111', '202 Office Blvd, Denver, CO 80201', 'Specializes in office equipment and supplies');

-- Create test parts (without directly associating with suppliers yet)
INSERT INTO parts (name, description, manufacturer_part_number, fiserv_part_number, location, quantity, minimum_quantity, unit_cost, status) VALUES
('HP Toner Cartridge', 'Black toner cartridge for HP LaserJet printers', 'HP78A-BLK', 'FS-T001', 'Shelf A1', 15, 5, 89.99, 'active'),
('Power Supply 650W', '650W ATX power supply for workstations', 'PS650W-ATX', 'FS-P001', 'Shelf D1', 7, 3, 65.75, 'active'),
('Wireless Mouse', 'Logitech wireless mouse', 'LOGI-M720', 'FS-M002', 'Shelf G1', 18, 10, 34.99, 'active'),
('Keyboard', 'USB wired keyboard', 'KB-USB-STD', 'FS-K001', 'Shelf K3', 11, 8, 29.99, 'active'),
('Dell Server RAM', '16GB DDR4 RAM for Dell PowerEdge servers', 'DELL-RAM16', 'FS-M001', 'Cabinet B3', 8, 4, 129.50, 'active'),
('USB-C Dock', 'Universal USB-C docking station', 'DOCK-USB-C', 'FS-D001', 'Cabinet E2', 12, 5, 149.99, 'active'),
('SSD Drive 1TB', '1TB SATA SSD for workstations', 'SSD1TB-SATA', 'FS-S001', 'Cabinet H2', 9, 5, 119.95, 'active'),
('Network Cable Cat6', '10ft Cat6 Ethernet cable', 'CC-CAT6-10FT', 'FS-N001', 'Drawer C2', 42, 20, 12.99, 'active'),
('Laptop Battery', 'Replacement battery for Dell Latitude laptops', 'BATT-DELL-LAT', 'FS-B001', 'Drawer F3', 4, 6, 89.95, 'active'),
('LCD Monitor 24"', '24-inch LCD monitor 1080p', 'LCD24-1080P', 'FS-L001', 'Room J1', 3, 2, 179.99, 'active');

-- Create part-supplier relationships
-- TechSupply Co. (supplier_id = 1) as the preferred supplier for some parts
INSERT INTO part_suppliers (part_id, supplier_id, unit_cost, is_preferred, lead_time_days, minimum_order_quantity, notes) VALUES
(1, 1, 89.99, true, 3, 1, 'Best quality toner cartridges'),
(2, 1, 65.75, true, 5, 2, 'Reliable power supplies'),
(3, 1, 34.99, true, 2, 5, 'Standard mice we order'),
(4, 1, 29.99, true, 2, 5, 'Standard keyboards we order');

-- ServerParts Inc. (supplier_id = 2) as the preferred supplier for some parts
INSERT INTO part_suppliers (part_id, supplier_id, unit_cost, is_preferred, lead_time_days, minimum_order_quantity, notes) VALUES
(5, 2, 129.50, true, 7, 2, 'Server-grade RAM modules'),
(6, 2, 149.99, true, 4, 1, 'Universal docking stations'),
(7, 2, 119.95, true, 3, 3, 'Fast SSDs for workstations');

-- Electronics Warehouse (supplier_id = 3) as the preferred supplier for some parts
INSERT INTO part_suppliers (part_id, supplier_id, unit_cost, is_preferred, lead_time_days, minimum_order_quantity, notes) VALUES
(8, 3, 12.99, true, 1, 10, 'Bulk discounts available for cables'),
(9, 3, 89.95, true, 10, 3, 'OEM laptop batteries'),
(10, 3, 179.99, true, 14, 1, 'Good value monitors');

-- Global Tech Distributors (supplier_id = 4) as an alternative supplier for some parts
INSERT INTO part_suppliers (part_id, supplier_id, unit_cost, is_preferred, lead_time_days, minimum_order_quantity, notes) VALUES
(1, 4, 92.50, false, 7, 5, 'Alternative supplier with longer lead time'),
(5, 4, 125.99, false, 10, 5, 'Similar quality, sometimes better availability'),
(7, 4, 124.50, false, 5, 5, 'Slightly higher price but better warranty');

-- Office Solutions (supplier_id = 5) as an alternative supplier
INSERT INTO part_suppliers (part_id, supplier_id, unit_cost, is_preferred, lead_time_days, minimum_order_quantity, notes) VALUES
(3, 5, 32.99, false, 3, 10, 'Cheaper but still good quality'),
(4, 5, 27.50, false, 3, 10, 'Cheaper but still good quality'),
(10, 5, 169.95, false, 7, 2, 'Better price but longer shipping time');

-- Update parts table to reference the preferred supplier (for backward compatibility)
UPDATE parts SET supplier_id = 
  (SELECT supplier_id FROM part_suppliers WHERE part_id = parts.part_id AND is_preferred = true LIMIT 1);

-- Create some purchase orders using the suppliers
INSERT INTO purchase_orders (po_number, supplier_id, status, total_amount, notes) VALUES
('PO-2025-001', 1, 'pending', 1245.67, 'Monthly restock of printer supplies'),
('PO-2025-002', 2, 'submitted', 875.43, 'Server RAM upgrade project'),
('PO-2025-003', 3, 'approved', 530.85, 'Office monitors replacement');

-- Add items to purchase orders
INSERT INTO purchase_order_items (po_id, part_id, quantity, unit_price, total_price) VALUES
(1, 1, 5, 89.99, 449.95),
(1, 3, 10, 34.99, 349.90),
(1, 4, 15, 29.99, 449.85),
(2, 5, 4, 129.50, 518.00),
(2, 7, 3, 119.95, 359.85),
(3, 10, 3, 179.99, 539.97);
