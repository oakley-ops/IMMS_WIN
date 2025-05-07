-- Insert sample machines
INSERT INTO machines (name, model, serial_number, location, status) VALUES
('ATM Machine 1', 'Model X1', 'SN001', 'Building A', 'Active'),
('ATM Machine 2', 'Model X2', 'SN002', 'Building B', 'Active'),
('ATM Machine 3', 'Model X3', 'SN003', 'Building C', 'Maintenance');

-- Insert sample parts
INSERT INTO parts (
    name,
    description,
    manufacturer_part_number,
    fiserv_part_number,
    quantity,
    minimum_quantity,
    machine_id,
    supplier,
    unit_cost,
    location
) VALUES
('Receipt Printer', 'Thermal Receipt Printer', 'MPN001', 'FPN001', 15, 5, 1, 'Supplier A', 99.99, 'Shelf A1'),
('Card Reader', 'EMV Card Reader', 'MPN002', 'FPN002', 8, 10, 1, 'Supplier B', 149.99, 'Shelf B2'),
('Touch Screen', '15" Touch Screen Display', 'MPN003', 'FPN003', 5, 3, 2, 'Supplier C', 299.99, 'Shelf C1'),
('Cash Dispenser', 'Cash Dispenser Module', 'MPN004', 'FPN004', 3, 2, 2, 'Supplier A', 599.99, 'Shelf D1'),
('Receipt Paper', 'Thermal Paper Rolls', 'MPN005', 'FPN005', 100, 50, 3, 'Supplier D', 2.99, 'Shelf E1');

-- Insert sample transactions
INSERT INTO transactions (part_id, type, quantity, user_id, notes, reference_number) VALUES
(1, 'IN', 20, 'user1', 'Initial stock', 'REF001'),
(1, 'OUT', 5, 'user1', 'Regular maintenance', 'REF002'),
(2, 'IN', 15, 'user2', 'Restock', 'REF003'),
(2, 'OUT', 7, 'user2', 'Replacement', 'REF004'),
(3, 'IN', 10, 'user1', 'New inventory', 'REF005');
