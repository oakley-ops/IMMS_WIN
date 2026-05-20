-- Maintenance Call System (Andon) tables

-- Badge registry: maps physical badge IDs to people
CREATE TABLE IF NOT EXISTS badge_registrations (
  badge_id VARCHAR(100) PRIMARY KEY,
  person_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('operator', 'technician')),
  technician_id INTEGER REFERENCES technicians(technician_id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Badge reader registry: maps physical readers to machines
CREATE TABLE IF NOT EXISTS badge_readers (
  reader_id SERIAL PRIMARY KEY,
  reader_key VARCHAR(100) UNIQUE NOT NULL,
  machine_id INTEGER REFERENCES machines(machine_id) ON DELETE SET NULL,
  location_label VARCHAR(255),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Maintenance calls: the core Andon call records
CREATE TABLE IF NOT EXISTS maintenance_calls (
  call_id SERIAL PRIMARY KEY,
  machine_id INTEGER REFERENCES machines(machine_id) ON DELETE SET NULL,
  reader_id INTEGER REFERENCES badge_readers(reader_id) ON DELETE SET NULL,
  operator_badge_id VARCHAR(100) REFERENCES badge_registrations(badge_id) ON DELETE SET NULL,
  operator_name VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'critical')),
  called_at TIMESTAMP NOT NULL DEFAULT NOW(),
  technician_arrived_at TIMESTAMP,
  resolved_at TIMESTAMP,
  technician_badge_id VARCHAR(100) REFERENCES badge_registrations(badge_id) ON DELETE SET NULL,
  technician_id INTEGER REFERENCES technicians(technician_id) ON DELETE SET NULL,
  technician_name VARCHAR(255),
  reason_category VARCHAR(50) CHECK (reason_category IN ('mechanical', 'electrical', 'tooling', 'material', 'operator_error', 'other')),
  problem_description TEXT,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_calls_status ON maintenance_calls(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_calls_machine ON maintenance_calls(machine_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_calls_called_at ON maintenance_calls(called_at DESC);
