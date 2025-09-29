-- Data migration script to transfer data from fiservinventory to imms database
-- Run this after creating the new IMMS database schema

-- Connect to the old database to extract data
\c fiservinventory;

-- Create temporary export tables for data transfer
CREATE TEMP TABLE temp_part_locations AS 
SELECT * FROM part_locations;

CREATE TEMP TABLE temp_parts AS 
SELECT 
    part_id,
    name,
    description,
    manufacturer_part_number,
    fiserv_part_number, -- Will be renamed to crc_part_number
    quantity,
    minimum_quantity,
    supplier,
    unit_cost,
    location_id,
    notes,
    COALESCE(status, 'active') as status,
    image_url,
    created_at,
    updated_at
FROM parts;

CREATE TEMP TABLE temp_machines AS 
SELECT * FROM machines;

CREATE TEMP TABLE temp_transactions AS 
SELECT * FROM transactions;

-- Clean users table - remove Fiserv emails
CREATE TEMP TABLE temp_users AS 
SELECT 
    user_id,
    username,
    CASE 
        WHEN email LIKE '%@company.com' THEN NULL 
        ELSE email 
    END as email,
    password_hash,
    role,
    first_name,
    last_name,
    created_at,
    updated_at
FROM users;

-- Clean contacts table - remove Fiserv emails
CREATE TEMP TABLE temp_contacts AS 
SELECT 
    contact_id,
    name,
    CASE 
        WHEN email LIKE '%@company.com' THEN NULL 
        ELSE email 
    END as email,
    phone,
    company,
    position,
    notes,
    created_at,
    updated_at
FROM contacts;

-- Clean purchase_orders table - remove Fiserv emails
CREATE TEMP TABLE temp_purchase_orders AS 
SELECT 
    po_id,
    po_number,
    supplier_id,
    status,
    order_date,
    expected_delivery_date,
    total_amount,
    notes,
    CASE 
        WHEN approved_by LIKE '%@company.com' THEN NULL 
        ELSE approved_by 
    END as approved_by,
    approved_at,
    CASE 
        WHEN approval_email LIKE '%@company.com' THEN NULL 
        ELSE approval_email 
    END as approval_email,
    created_at,
    updated_at
FROM purchase_orders;

CREATE TEMP TABLE temp_purchase_order_items AS 
SELECT * FROM purchase_order_items;

-- Switch to IMMS database and import data
\c imms;

-- Import part_locations
INSERT INTO part_locations SELECT * FROM temp_part_locations ON CONFLICT DO NOTHING;

-- Import parts with column name change (fiserv_part_number -> crc_part_number)
INSERT INTO parts (
    part_id,
    name,
    description,
    manufacturer_part_number,
    crc_part_number, -- Changed column name
    quantity,
    minimum_quantity,
    supplier,
    unit_cost,
    location_id,
    notes,
    status,
    image_url,
    created_at,
    updated_at
)
SELECT 
    part_id,
    name,
    description,
    manufacturer_part_number,
    -- Convert TBD-* part numbers to CRC-* format
    CASE 
        WHEN fiserv_part_number LIKE 'TBD-%' THEN 
            REPLACE(fiserv_part_number, 'TBD-', 'CRC-')
        ELSE 
            fiserv_part_number
    END as crc_part_number,
    quantity,
    minimum_quantity,
    supplier,
    unit_cost,
    location_id,
    notes,
    status,
    image_url,
    created_at,
    updated_at
FROM temp_parts ON CONFLICT DO NOTHING;

-- Import machines
INSERT INTO machines SELECT * FROM temp_machines ON CONFLICT DO NOTHING;

-- Import transactions
INSERT INTO transactions SELECT * FROM temp_transactions ON CONFLICT DO NOTHING;

-- Import cleaned users (without Fiserv emails)
INSERT INTO users SELECT * FROM temp_users ON CONFLICT DO NOTHING;

-- Import cleaned contacts (without Fiserv emails)
INSERT INTO contacts SELECT * FROM temp_contacts ON CONFLICT DO NOTHING;

-- Import cleaned purchase_orders (without Fiserv emails)
INSERT INTO purchase_orders SELECT * FROM temp_purchase_orders ON CONFLICT DO NOTHING;

-- Import purchase_order_items
INSERT INTO purchase_order_items SELECT * FROM temp_purchase_order_items ON CONFLICT DO NOTHING;

-- Update sequences to match imported data
SELECT setval('part_locations_location_id_seq', COALESCE((SELECT MAX(location_id) FROM part_locations), 1), false);
SELECT setval('parts_part_id_seq', COALESCE((SELECT MAX(part_id) FROM parts), 1), false);
SELECT setval('machines_machine_id_seq', COALESCE((SELECT MAX(machine_id) FROM machines), 1), false);
SELECT setval('transactions_transaction_id_seq', COALESCE((SELECT MAX(transaction_id) FROM transactions), 1), false);
SELECT setval('users_user_id_seq', COALESCE((SELECT MAX(user_id) FROM users), 1), false);
SELECT setval('contacts_contact_id_seq', COALESCE((SELECT MAX(contact_id) FROM contacts), 1), false);
SELECT setval('purchase_orders_po_id_seq', COALESCE((SELECT MAX(po_id) FROM purchase_orders), 1), false);
SELECT setval('purchase_order_items_poi_id_seq', COALESCE((SELECT MAX(poi_id) FROM purchase_order_items), 1), false);

-- Verify migration
SELECT 'part_locations' as table_name, COUNT(*) as row_count FROM part_locations
UNION ALL
SELECT 'parts' as table_name, COUNT(*) as row_count FROM parts
UNION ALL
SELECT 'machines' as table_name, COUNT(*) as row_count FROM machines
UNION ALL
SELECT 'transactions' as table_name, COUNT(*) as row_count FROM transactions
UNION ALL
SELECT 'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'contacts' as table_name, COUNT(*) as row_count FROM contacts
UNION ALL
SELECT 'purchase_orders' as table_name, COUNT(*) as row_count FROM purchase_orders
UNION ALL
SELECT 'purchase_order_items' as table_name, COUNT(*) as row_count FROM purchase_order_items;

-- Show sample of converted part numbers
SELECT 
    'Original TBD parts converted to CRC:' as info,
    COUNT(*) as count
FROM parts 
WHERE crc_part_number LIKE 'CRC-%';

-- Show cleaned email addresses
SELECT 
    'Users with cleaned emails:' as info,
    COUNT(*) as total_users,
    COUNT(email) as users_with_email,
    COUNT(*) - COUNT(email) as users_email_removed
FROM users;

SELECT 
    'Contacts with cleaned emails:' as info,
    COUNT(*) as total_contacts,
    COUNT(email) as contacts_with_email,
    COUNT(*) - COUNT(email) as contacts_email_removed
FROM contacts;
