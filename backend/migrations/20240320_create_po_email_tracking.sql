-- Drop existing indexes first
DROP INDEX IF EXISTS idx_po_email_tracking_po_id;
DROP INDEX IF EXISTS idx_po_email_tracking_tracking_code;
DROP INDEX IF EXISTS idx_po_email_tracking_status;
DROP INDEX IF EXISTS idx_po_email_tracking_rerouted_tracking_code;

-- Drop existing table
DROP TABLE IF EXISTS po_email_tracking;

-- Create the po_email_tracking table
CREATE TABLE IF NOT EXISTS po_email_tracking (
  tracking_id SERIAL PRIMARY KEY,
  po_id INTEGER REFERENCES purchase_orders(po_id),
  recipient_email VARCHAR(255) NOT NULL,
  sent_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  email_subject VARCHAR(255),
  tracking_code VARCHAR(50) UNIQUE,
  status VARCHAR(50) DEFAULT 'pending', -- Possible values: 'pending', 'approved', 'on_hold', 'rejected'
  approval_date TIMESTAMP,
  approval_email VARCHAR(255),
  notes TEXT, -- Added notes field for holding information about required changes
  pdf_data TEXT, -- Store the PDF data temporarily for re-routing
  rerouted_to VARCHAR(255), -- Store the email address the PO was re-routed to
  rerouted_date TIMESTAMP, -- Store when the PO was re-routed
  rerouted_tracking_code VARCHAR(50), -- Store the tracking code for the re-routed email
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add approval columns to purchase_orders table
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50), -- Possible values: 'pending', 'approved', 'on_hold', 'rejected'
ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS approval_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS notes TEXT; -- Added notes field for holding information about required changes

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_po_email_tracking_po_id ON po_email_tracking(po_id);
CREATE INDEX IF NOT EXISTS idx_po_email_tracking_tracking_code ON po_email_tracking(tracking_code);
CREATE INDEX IF NOT EXISTS idx_po_email_tracking_status ON po_email_tracking(status);
CREATE INDEX IF NOT EXISTS idx_po_email_tracking_rerouted_tracking_code ON po_email_tracking(rerouted_tracking_code); 