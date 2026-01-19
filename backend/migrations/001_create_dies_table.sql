-- Create dies table for die inventory tracking
-- Part of Die Tracker System - Phase 1

BEGIN;

CREATE TABLE IF NOT EXISTS dies (
    die_id SERIAL PRIMARY KEY,
    die_number VARCHAR(50) UNIQUE NOT NULL,
    die_name VARCHAR(255) NOT NULL,
    die_type VARCHAR(100) NOT NULL,
    die_size VARCHAR(50),
    manufacturer VARCHAR(255),
    manufacturer_part_number VARCHAR(100),
    purchase_date DATE,
    purchase_cost DECIMAL(10,2),
    
    status VARCHAR(50) NOT NULL DEFAULT 'NEW',
    current_location VARCHAR(255),
    machine_id INTEGER REFERENCES machines(machine_id) ON DELETE SET NULL,
    
    total_cycles INTEGER DEFAULT 0,
    max_cycles_before_sharpening INTEGER,
    sharpenings_count INTEGER DEFAULT 0,
    max_sharpenings INTEGER,
    
    last_inspection_date DATE,
    last_inspection_notes TEXT,
    expected_life_cycles INTEGER,
    
    barcode VARCHAR(255) UNIQUE,
    qr_code_path VARCHAR(500),
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    
    CHECK (status IN ('NEW', 'AVAILABLE', 'INSTALLED', 'NEEDS_SHARPENING', 
                      'SCHEDULED_FOR_SHARPENING', 'SHIPPED_FOR_SHARPENING',
                      'AT_SHARPENING_VENDOR', 'RETURNING_FROM_SHARPENING', 'RETIRED'))
);

CREATE INDEX IF NOT EXISTS idx_dies_status ON dies(status);
CREATE INDEX IF NOT EXISTS idx_dies_machine_id ON dies(machine_id);
CREATE INDEX IF NOT EXISTS idx_dies_die_number ON dies(die_number);
CREATE INDEX IF NOT EXISTS idx_dies_barcode ON dies(barcode);

COMMENT ON TABLE dies IS 'Die inventory tracking for card punch machines';
COMMENT ON COLUMN dies.status IS 'Current die status in lifecycle';
COMMENT ON COLUMN dies.total_cycles IS 'Total number of cycles/uses for this die';
COMMENT ON COLUMN dies.sharpenings_count IS 'Number of times die has been sharpened';

COMMIT;
