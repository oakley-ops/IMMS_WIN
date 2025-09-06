-- Create contacts table for managing vendors, contractors, and suppliers
CREATE TABLE IF NOT EXISTS contacts (
    contact_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('vendor', 'contractor', 'supplier')),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(type);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

-- Add unique constraint for email to prevent duplicates
ALTER TABLE contacts ADD CONSTRAINT unique_contact_email UNIQUE (email);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_contacts_updated_at();

-- Insert some sample data
INSERT INTO contacts (name, company, type, email, phone, address, city, state, zip_code, notes) VALUES
('John Smith', 'ABC Supply Co', 'vendor', 'john.smith@abcsupply.com', '555-0101', '123 Main St', 'Chicago', 'IL', '60601', 'Primary parts supplier'),
('Sarah Johnson', 'Maintenance Masters', 'contractor', 'sarah@maintenancemasters.com', '555-0102', '456 Oak Ave', 'Milwaukee', 'WI', '53201', 'Specialized in equipment maintenance'),
('Mike Davis', 'Industrial Tools Inc', 'supplier', 'mike.davis@industrialtools.com', '555-0103', '789 Pine St', 'Detroit', 'MI', '48201', 'Industrial equipment and tools'),
('Lisa Wilson', 'TechFix Solutions', 'contractor', 'lisa@techfixsolutions.com', '555-0104', '321 Elm St', 'Madison', 'WI', '53703', 'Technology and automation services'),
('Robert Brown', 'Quality Parts Depot', 'vendor', 'robert@qualityparts.com', '555-0105', '654 Maple Dr', 'Indianapolis', 'IN', '46201', 'High-quality replacement parts')
ON CONFLICT (email) DO NOTHING;
