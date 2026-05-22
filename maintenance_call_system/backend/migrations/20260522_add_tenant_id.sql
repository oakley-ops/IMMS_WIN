-- 20260522_add_tenant_id.sql
-- Step 2a of the SaaS-foundations roadmap. Adds tenant_id INT NOT NULL DEFAULT 1
-- with FK to auth.tenants and an index, to every MCS domain table.
-- Idempotent — safe to re-run.

BEGIN;

ALTER TABLE maintenance_calls       ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS maintenance_calls_tenant_id_idx ON maintenance_calls(tenant_id);

ALTER TABLE maintenance_call_parts  ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS maintenance_call_parts_tenant_id_idx ON maintenance_call_parts(tenant_id);

ALTER TABLE badge_readers           ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS badge_readers_tenant_id_idx ON badge_readers(tenant_id);

ALTER TABLE badge_registrations     ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS badge_registrations_tenant_id_idx ON badge_registrations(tenant_id);

ALTER TABLE call_board_layouts      ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS call_board_layouts_tenant_id_idx ON call_board_layouts(tenant_id);

ALTER TABLE call_board_tiles        ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id);
CREATE INDEX IF NOT EXISTS call_board_tiles_tenant_id_idx ON call_board_tiles(tenant_id);

COMMIT;
