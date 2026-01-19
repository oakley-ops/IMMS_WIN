-- Create die_sharpening_records table
-- Tracks sharpening service history

BEGIN;

CREATE TABLE IF NOT EXISTS die_sharpening_records (
    sharpening_id SERIAL PRIMARY KEY,
    die_id INTEGER NOT NULL REFERENCES dies(die_id) ON DELETE CASCADE,
    
    sharpening_vendor VARCHAR(255),
    vendor_contact VARCHAR(255),
    vendor_phone VARCHAR(50),
    po_number VARCHAR(100),
    
    scheduled_date DATE,
    shipped_date DATE,
    received_by_vendor_date DATE,
    expected_return_date DATE,
    actual_return_date DATE,
    
    tracking_number_outbound VARCHAR(100),
    tracking_number_inbound VARCHAR(100),
    
    quoted_cost DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    
    condition_before VARCHAR(50),
    condition_after VARCHAR(50),
    inspection_passed BOOLEAN,
    inspection_notes TEXT,
    
    service_type VARCHAR(100),
    turnaround_days INTEGER,
    
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    
    CHECK (status IN ('SCHEDULED', 'SHIPPED', 'AT_VENDOR', 'COMPLETED', 'RETURNED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_die_sharpening_die_id ON die_sharpening_records(die_id);
CREATE INDEX IF NOT EXISTS idx_die_sharpening_status ON die_sharpening_records(status);
CREATE INDEX IF NOT EXISTS idx_die_sharpening_dates ON die_sharpening_records(scheduled_date, expected_return_date);

COMMENT ON TABLE die_sharpening_records IS 'Sharpening service history for dies';
COMMENT ON COLUMN die_sharpening_records.status IS 'Current status: SCHEDULED, SHIPPED, AT_VENDOR, COMPLETED, RETURNED, CANCELLED';

COMMIT;
