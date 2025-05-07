INSERT INTO machines (name, model, serial_number, location, status)
VALUES 
    ('ATM 1', 'NCR 6632', 'SN123456', 'Branch 1', 'active'),
    ('ATM 2', 'NCR 6632', 'SN123457', 'Branch 2', 'active'),
    ('ATM 3', 'Diebold 429', 'SN789012', 'Branch 3', 'active'),
    ('ATM 4', 'Diebold 429', 'SN789013', 'Branch 4', 'active')
ON CONFLICT (serial_number) DO NOTHING;
