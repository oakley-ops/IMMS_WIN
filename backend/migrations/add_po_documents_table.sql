-- migrations/add_po_documents_table.sql
-- Create the purchase_order_documents table
CREATE TABLE IF NOT EXISTS purchase_order_documents (
  document_id SERIAL PRIMARY KEY,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  document_type VARCHAR(50) NOT NULL, -- 'receipt', 'invoice', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  notes TEXT
);

-- Add index on po_id for quick lookup
CREATE INDEX IF NOT EXISTS idx_po_documents_po_id ON purchase_order_documents(po_id); 