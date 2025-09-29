-- IMMS Database Initialization Script
-- Clean initialization without any Fiserv references

-- Create the IMMS database
CREATE DATABASE imms;

-- Connect to the new database
\c imms;

-- Load the schema
\i schema_imms.sql

-- Insert initial part locations
INSERT INTO part_locations (name, description) VALUES
('Main Warehouse', 'Primary parts storage facility'),
('Production Floor', 'Parts stored on production floor'),
('Hot Stamp Area', 'Parts specific to hot stamp operations'),
('EMV Station', 'Parts for EMV processing equipment'),
('Die Press Area', 'Parts for die press operations'),
('Inspection Area', 'Parts used in quality inspection'),
('Maintenance Shop', 'Maintenance and repair parts storage');

-- Insert sample machines (clean of Fiserv references)
INSERT INTO machines (name, model, location, manufacturer) VALUES
('Hot Stamp 1A', 'HS-1000', 'Production Line 1', 'Industrial Equipment Co'),
('Hot Stamp 1B', 'HS-1000', 'Production Line 1', 'Industrial Equipment Co'),
('Hot Stamp 2A', 'HS-2000', 'Production Line 2', 'Industrial Equipment Co'),
('Hot Stamp 2B', 'HS-2000', 'Production Line 2', 'Industrial Equipment Co'),
('Die Press 701', 'DP-701', 'Press Area', 'Press Systems Inc'),
('Die Press 704', 'DP-704', 'Press Area', 'Press Systems Inc'),
('EMV 2', 'EMV-2000', 'EMV Station', 'Card Tech Solutions'),
('EMV 5', 'EMV-5000', 'EMV Station', 'Card Tech Solutions'),
('EMV 6', 'EMV-6000', 'EMV Station', 'Card Tech Solutions'),
('Collator 2', 'COL-200', 'Finishing Area', 'Automation Systems'),
('Inspection 5', 'INS-500', 'Quality Control', 'Testing Equipment Ltd'),
('CML 1', 'CML-100', 'Card Manufacturing', 'Card Production Systems');

-- Insert sample suppliers
INSERT INTO suppliers (name, contact_person, phone, address) VALUES
('Industrial Parts Supply', 'John Smith', '555-0101', '123 Industrial Blvd, Manufacturing City, ST 12345'),
('Precision Components Inc', 'Sarah Johnson', '555-0102', '456 Precision Way, Tech Valley, ST 12346'),
('Automation Solutions LLC', 'Mike Davis', '555-0103', '789 Automation Dr, Innovation Park, ST 12347'),
('Quality Parts Direct', 'Lisa Wilson', '555-0104', '321 Quality St, Reliability Town, ST 12348');

-- Insert sample parts with CRC part numbers
INSERT INTO parts (name, description, manufacturer_part_number, crc_part_number, quantity, minimum_quantity, supplier, unit_cost, location_id) VALUES
('Pressure Control Valve', 'Main pressure control for hot stamp operations', 'ARM55A-08-A', 'CRC-001', 5, 2, 'Industrial Parts Supply', 1.00, 1),
('Solenoid Valve', 'Pneumatic control valve for automated systems', 'SV1100-5FUD', 'CRC-002', 3, 1, 'Automation Solutions LLC', 70.00, 1),
('Thermocouple', 'Temperature sensor for hot stamp monitoring', 'MR170015', 'CRC-003', 8, 2, 'Precision Components Inc', 1.90, 3),
('Input Cylinder', 'Card separator cylinder for EMV systems', 'MXH16-20Z', 'CRC-004', 2, 1, 'Quality Parts Direct', 230.00, 4),
('Amplifier OLVTI', 'Signal amplifier for hot stamp systems', '700078', 'CRC-005', 3, 1, 'Industrial Parts Supply', 488.00, 3),
('Vacuum Channel EMV', 'Vacuum system component for card transport', '6000037900', 'CRC-006', 4, 2, 'Automation Solutions LLC', 0.00, 4),
('Welding Head Thermal Fuse', 'Safety fuse for welding operations', '2801000046', 'CRC-007', 6, 3, 'Precision Components Inc', 1.60, 1),
('Card Stopper Cylinder', 'Pneumatic cylinder for card positioning', 'CDUJB', 'CRC-008', 1, 1, 'Quality Parts Direct', 32.42, 4);

-- Create initial admin user (no email for now)
INSERT INTO users (username, password_hash, role, first_name, last_name) VALUES
('admin', '$2b$10$example.hash.here', 'admin', 'System', 'Administrator');

-- Create sample preventive maintenance schedules
INSERT INTO preventive_maintenance (machine_id, title, description, frequency_days, next_due) VALUES
(1, 'Hot Stamp 1A - Monthly Inspection', 'Monthly inspection and lubrication', 30, CURRENT_DATE + INTERVAL '30 days'),
(2, 'Hot Stamp 1B - Monthly Inspection', 'Monthly inspection and lubrication', 30, CURRENT_DATE + INTERVAL '30 days'),
(5, 'Die Press 701 - Weekly Check', 'Weekly pressure and alignment check', 7, CURRENT_DATE + INTERVAL '7 days'),
(6, 'Die Press 704 - Weekly Check', 'Weekly pressure and alignment check', 7, CURRENT_DATE + INTERVAL '7 days'),
(7, 'EMV 2 - Calibration', 'Monthly calibration and cleaning', 30, CURRENT_DATE + INTERVAL '30 days'),
(8, 'EMV 5 - Calibration', 'Monthly calibration and cleaning', 30, CURRENT_DATE + INTERVAL '30 days'),
(9, 'EMV 6 - Calibration', 'Monthly calibration and cleaning', 30, CURRENT_DATE + INTERVAL '30 days');

-- Print initialization summary
SELECT 'IMMS Database Initialized Successfully' as status;
SELECT 'Part Locations:' as info, COUNT(*) as count FROM part_locations;
SELECT 'Machines:' as info, COUNT(*) as count FROM machines;
SELECT 'Suppliers:' as info, COUNT(*) as count FROM suppliers;
SELECT 'Parts:' as info, COUNT(*) as count FROM parts;
SELECT 'Users:' as info, COUNT(*) as count FROM users;
SELECT 'PM Schedules:' as info, COUNT(*) as count FROM preventive_maintenance;
