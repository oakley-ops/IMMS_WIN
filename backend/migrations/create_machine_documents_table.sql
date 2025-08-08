-- Create machine_documents table for storing machine-related documents
CREATE TABLE IF NOT EXISTS machine_documents (
    document_id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL REFERENCES machines(machine_id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- file extension/type
    document_category VARCHAR(50) NOT NULL, -- 'schematic', 'parts_diagram', 'pm_instructions', 'pos', 'manual', 'other'
    title VARCHAR(255), -- User-friendly title
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    file_size INTEGER,
    mime_type VARCHAR(100),
    text_content TEXT -- For searchable PDF content
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_machine_documents_machine_id ON machine_documents(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_documents_category ON machine_documents(document_category);
CREATE INDEX IF NOT EXISTS idx_machine_documents_created_at ON machine_documents(created_at);

-- Create trigger to update text search functionality if we add it later
CREATE INDEX IF NOT EXISTS idx_machine_documents_text_content ON machine_documents USING gin(to_tsvector('english', text_content)) WHERE text_content IS NOT NULL; 