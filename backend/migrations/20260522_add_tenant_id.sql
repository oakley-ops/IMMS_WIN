-- 20260522_add_tenant_id.sql
-- Step 2a of the SaaS-foundations roadmap. Adds tenant_id INT NOT NULL DEFAULT 1
-- with FK to auth.tenants and an index, to every IMMS domain table.
-- Idempotent — safe to re-run.
--
-- Excluded by design (see plan): migrations, users, user_sessions,
-- login_attempts, email_rerouting_log, failed_email_attempts, and every
-- auth.* table (already tenant-aware).

BEGIN;

-- Helper: shorthand. The same three statements repeat per table.
-- Idempotency comes from ADD COLUMN IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.

ALTER TABLE contacts                ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS contacts_tenant_id_idx ON contacts(tenant_id);

ALTER TABLE die_change_history      ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS die_change_history_tenant_id_idx ON die_change_history(tenant_id);

ALTER TABLE die_documents           ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS die_documents_tenant_id_idx ON die_documents(tenant_id);

ALTER TABLE die_maintenance_schedule ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS die_maintenance_schedule_tenant_id_idx ON die_maintenance_schedule(tenant_id);

ALTER TABLE die_sharpening_records  ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS die_sharpening_records_tenant_id_idx ON die_sharpening_records(tenant_id);

ALTER TABLE dies                    ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS dies_tenant_id_idx ON dies(tenant_id);

ALTER TABLE equipment_dependencies  ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS equipment_dependencies_tenant_id_idx ON equipment_dependencies(tenant_id);

ALTER TABLE equipment_installations ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS equipment_installations_tenant_id_idx ON equipment_installations(tenant_id);

ALTER TABLE machine_documents       ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS machine_documents_tenant_id_idx ON machine_documents(tenant_id);

ALTER TABLE machines                ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS machines_tenant_id_idx ON machines(tenant_id);

ALTER TABLE maintenance_logs        ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS maintenance_logs_tenant_id_idx ON maintenance_logs(tenant_id);

ALTER TABLE part_assignments        ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS part_assignments_tenant_id_idx ON part_assignments(tenant_id);

ALTER TABLE part_locations          ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS part_locations_tenant_id_idx ON part_locations(tenant_id);

ALTER TABLE part_suppliers          ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS part_suppliers_tenant_id_idx ON part_suppliers(tenant_id);

ALTER TABLE parts                   ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS parts_tenant_id_idx ON parts(tenant_id);

ALTER TABLE pm_checklists           ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS pm_checklists_tenant_id_idx ON pm_checklists(tenant_id);

ALTER TABLE pm_intervals            ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS pm_intervals_tenant_id_idx ON pm_intervals(tenant_id);

ALTER TABLE pm_sessions             ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS pm_sessions_tenant_id_idx ON pm_sessions(tenant_id);

ALTER TABLE pm_task_completions     ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS pm_task_completions_tenant_id_idx ON pm_task_completions(tenant_id);

ALTER TABLE pm_tasks                ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS pm_tasks_tenant_id_idx ON pm_tasks(tenant_id);

ALTER TABLE po_email_tracking       ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS po_email_tracking_tenant_id_idx ON po_email_tracking(tenant_id);

ALTER TABLE project_documents       ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS project_documents_tenant_id_idx ON project_documents(tenant_id);

ALTER TABLE project_milestones      ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS project_milestones_tenant_id_idx ON project_milestones(tenant_id);

ALTER TABLE project_notes           ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS project_notes_tenant_id_idx ON project_notes(tenant_id);

ALTER TABLE project_risks           ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS project_risks_tenant_id_idx ON project_risks(tenant_id);

ALTER TABLE project_tasks           ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS project_tasks_tenant_id_idx ON project_tasks(tenant_id);

ALTER TABLE projects                ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS projects_tenant_id_idx ON projects(tenant_id);

ALTER TABLE purchase_order_documents ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS purchase_order_documents_tenant_id_idx ON purchase_order_documents(tenant_id);

ALTER TABLE purchase_order_history  ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS purchase_order_history_tenant_id_idx ON purchase_order_history(tenant_id);

ALTER TABLE purchase_order_items    ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS purchase_order_items_tenant_id_idx ON purchase_order_items(tenant_id);

ALTER TABLE purchase_orders         ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS purchase_orders_tenant_id_idx ON purchase_orders(tenant_id);

ALTER TABLE suppliers               ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS suppliers_tenant_id_idx ON suppliers(tenant_id);

ALTER TABLE technicians             ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS technicians_tenant_id_idx ON technicians(tenant_id);

ALTER TABLE transactions            ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS transactions_tenant_id_idx ON transactions(tenant_id);

ALTER TABLE vendors                 ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS vendors_tenant_id_idx ON vendors(tenant_id);

ALTER TABLE work_order_attachments  ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS work_order_attachments_tenant_id_idx ON work_order_attachments(tenant_id);

ALTER TABLE work_order_comments     ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS work_order_comments_tenant_id_idx ON work_order_comments(tenant_id);

ALTER TABLE work_order_parts        ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS work_order_parts_tenant_id_idx ON work_order_parts(tenant_id);

ALTER TABLE work_order_tasks        ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS work_order_tasks_tenant_id_idx ON work_order_tasks(tenant_id);

ALTER TABLE work_orders             ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS work_orders_tenant_id_idx ON work_orders(tenant_id);

COMMIT;
