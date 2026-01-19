-- Create die_documents table
-- Stores documents attached to dies (PO PDFs, invoices, inspection reports, etc.)

BEGIN;

CREATE TABLE IF NOT EXISTS die_documents (
    document_id SERIAL PRIMARY KEY,
    die_id INTEGER NOT NULL REFERENCES dies(die_id) ON DELETE CASCADE,
    sharpening_id INTEGER REFERENCES die_sharpening_records(sharpening_id) ON DELETE SET NULL,
    
    file_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    document_type VARCHAR(50) NOT NULL,
    
    document_category VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    description TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    uploaded_by_name VARCHAR(255),
    
    text_content TEXT,
    
    related_po_number VARCHAR(100),
    document_date DATE,
    
    notes TEXT,
    
    CHECK (document_category IN ('purchase_order', 'invoice', 'inspection_report', 
                                   'sharpening_receipt', 'specification', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_die_documents_die_id ON die_documents(die_id);
CREATE INDEX IF NOT EXISTS idx_die_documents_sharpening_id ON die_documents(sharpening_id);
CREATE INDEX IF NOT EXISTS idx_die_documents_category ON die_documents(document_category);
CREATE INDEX IF NOT EXISTS idx_die_documents_created_at ON die_documents(created_at);
CREATE INDEX IF NOT EXISTS idx_die_documents_po_number ON die_documents(related_po_number);

CREATE INDEX IF NOT EXISTS idx_die_documents_text_content ON die_documents 
    USING gin(to_tsvector('english', text_content)) 
    WHERE text_content IS NOT NULL;

COMMENT ON TABLE die_documents IS 'Stores documents related to dies including sharpening POs, invoices, and inspection reports';
COMMENT ON COLUMN die_documents.text_content IS 'Extracted text from PDF files for full-text search';
COMMENT ON COLUMN die_documents.document_category IS 'Category: purchase_order, invoice, inspection_report, sharpening_receipt, specification, other';

COMMIT;
