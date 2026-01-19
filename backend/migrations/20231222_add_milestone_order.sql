-- Migration to add order_index column to project_milestones
ALTER TABLE project_milestones 
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_milestones_order ON project_milestones(project_id, order_index);
