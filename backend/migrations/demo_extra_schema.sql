-- Extra schema the app's routes expect that the base migrations don't create
-- on a fresh database. Pure DDL, fully idempotent — safe to run on every reseed.

-- Purchase order approval status (Dashboard PO widgets)
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50);

-- Work orders list query orders by due_date and can filter by work_type
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS work_type VARCHAR(50);

-- Machines PM-schedule query references these columns
ALTER TABLE machines ADD COLUMN IF NOT EXISTS machine_type VARCHAR(255);
ALTER TABLE machines ADD COLUMN IF NOT EXISTS maintenance_status VARCHAR(50);
ALTER TABLE machines ADD COLUMN IF NOT EXISTS scheduled_technician VARCHAR(255);

-- Transactions list (Parts Usage History) joins machines on t.machine_id
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS machine_id INTEGER;

-- Part locations (Parts list LEFT JOINs part_locations on parts.location_id)
CREATE TABLE IF NOT EXISTS part_locations (
  location_id SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE parts ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES part_locations(location_id);

-- Work order child tables (Work Orders list LEFT JOINs these)
CREATE TABLE IF NOT EXISTS work_order_parts (
  wo_part_id       SERIAL PRIMARY KEY,
  work_order_id    INTEGER REFERENCES work_orders(work_order_id) ON DELETE CASCADE,
  part_id          INTEGER REFERENCES parts(part_id) ON DELETE SET NULL,
  quantity_required INTEGER,
  quantity_used    INTEGER DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS work_order_tasks (
  task_id          SERIAL PRIMARY KEY,
  work_order_id    INTEGER REFERENCES work_orders(work_order_id) ON DELETE CASCADE,
  task_description TEXT,
  is_completed     BOOLEAN DEFAULT FALSE,
  completed_at     TIMESTAMP,
  sort_order       INTEGER DEFAULT 0,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS work_order_comments (
  comment_id    SERIAL PRIMARY KEY,
  work_order_id INTEGER REFERENCES work_orders(work_order_id) ON DELETE CASCADE,
  user_id       INTEGER,
  comment_text  TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PM system tables (PM checklists + schedule). technician_id intentionally has no
-- users(id) FK — the users PK is user_id, and the base migration failed on that.
CREATE TABLE IF NOT EXISTS pm_intervals (
  interval_id          SERIAL PRIMARY KEY,
  machine_type         VARCHAR(255) NOT NULL UNIQUE,
  interval_days        INTEGER NOT NULL,
  interval_description VARCHAR(255),
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS pm_checklists (
  checklist_id SERIAL PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  machine_type VARCHAR(255),
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS pm_tasks (
  task_id          SERIAL PRIMARY KEY,
  checklist_id     INTEGER NOT NULL REFERENCES pm_checklists(checklist_id) ON DELETE CASCADE,
  task_name        VARCHAR(255) NOT NULL,
  task_description TEXT,
  is_required      BOOLEAN DEFAULT true,
  order_position   INTEGER DEFAULT 1,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS pm_sessions (
  session_id      SERIAL PRIMARY KEY,
  machine_id      INTEGER REFERENCES machines(machine_id) ON DELETE CASCADE,
  checklist_id    INTEGER REFERENCES pm_checklists(checklist_id) ON DELETE CASCADE,
  technician_id   INTEGER,
  technician_name VARCHAR(255),
  status          VARCHAR(50) DEFAULT 'in_progress',
  started_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at    TIMESTAMP,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS pm_task_completions (
  completion_id SERIAL PRIMARY KEY,
  session_id    INTEGER NOT NULL REFERENCES pm_sessions(session_id) ON DELETE CASCADE,
  task_id       INTEGER NOT NULL REFERENCES pm_tasks(task_id) ON DELETE CASCADE,
  is_completed  BOOLEAN DEFAULT false,
  completed_at  TIMESTAMP,
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, task_id)
);
