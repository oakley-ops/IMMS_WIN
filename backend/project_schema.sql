-- Project Management Schema

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    project_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(50) CHECK (status IN ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled')),
    budget DECIMAL(12, 2),
    facility_id INTEGER, -- Reference to facilities table if exists
    project_manager VARCHAR(255),
    priority VARCHAR(50) CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Equipment installation table
CREATE TABLE IF NOT EXISTS equipment_installations (
    installation_id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
    equipment_name VARCHAR(255) NOT NULL,
    equipment_type VARCHAR(255),
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    serial_number VARCHAR(100),
    planned_installation_date DATE,
    actual_installation_date DATE,
    status VARCHAR(50) CHECK (status IN ('pending', 'ordered', 'delivered', 'installed', 'tested', 'operational', 'delayed')),
    location_in_facility VARCHAR(255),
    installation_notes TEXT,
    dependencies TEXT, -- Other installations this one depends on
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Project milestones table
CREATE TABLE IF NOT EXISTS project_milestones (
    milestone_id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE,
    completion_date DATE,
    status VARCHAR(50) CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Project tasks table
CREATE TABLE IF NOT EXISTS project_tasks (
    task_id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
    milestone_id INTEGER REFERENCES project_milestones(milestone_id) ON DELETE SET NULL,
    installation_id INTEGER REFERENCES equipment_installations(installation_id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    assignee VARCHAR(255),
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) CHECK (status IN ('not_started', 'in_progress', 'completed', 'blocked', 'delayed')),
    priority VARCHAR(50) CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Project risks and issues
CREATE TABLE IF NOT EXISTS project_risks (
    risk_id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    impact VARCHAR(50) CHECK (impact IN ('low', 'medium', 'high', 'critical')),
    probability VARCHAR(50) CHECK (probability IN ('low', 'medium', 'high', 'certain')),
    status VARCHAR(50) CHECK (status IN ('identified', 'monitoring', 'mitigated', 'occurred', 'closed')),
    mitigation_plan TEXT,
    contingency_plan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Project documents
CREATE TABLE IF NOT EXISTS project_documents (
    document_id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(512),
    document_type VARCHAR(100),
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    uploader VARCHAR(255),
    description TEXT
);

-- Project notes and updates
CREATE TABLE IF NOT EXISTS project_notes (
    note_id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
    author VARCHAR(255),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Equipment dependencies (for installation sequence)
CREATE TABLE IF NOT EXISTS equipment_dependencies (
    dependency_id SERIAL PRIMARY KEY,
    equipment_id INTEGER REFERENCES equipment_installations(installation_id) ON DELETE CASCADE,
    depends_on_id INTEGER REFERENCES equipment_installations(installation_id) ON DELETE CASCADE,
    dependency_type VARCHAR(100), -- e.g., "must be installed before", "requires power from"
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
); 