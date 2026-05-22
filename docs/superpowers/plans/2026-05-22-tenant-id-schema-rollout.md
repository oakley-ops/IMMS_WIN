# Tenant_id Schema Rollout — Implementation Plan (Step 2a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `tenant_id INT NOT NULL DEFAULT 1` column (with FK to `auth.tenants` and an index) to every IMMS and MCS domain table, plus a small `currentTenantId(req)` helper in each app. **Does not rewrite any existing SQL queries** — that work is deferred to Step 2b. Ships in hours, not weeks.

**Architecture:** Two SQL migrations (one per app, both idempotent), each app gets a tiny tenant helper for future use, and both READMEs gain a "Tenant_id rollout status" section so the next contributor knows where we are. Since every row has `tenant_id = 1` (the Fiserv tenant from Step 1) and no query filters on it yet, the behavior of both apps is **functionally unchanged** — same data, same responses, same tests. The migrations are a no-op at runtime; they just lay groundwork.

**Tech Stack:** PostgreSQL (existing `fiservinventory` database), node-pg, Node helper modules.

**Reference:** [Design spec](../specs/2026-05-21-mcs-imms-split-saas-foundations-design.md). This plan covers Step 2 of the spec's "Order of work" section — narrowed to schema only per the user's scoping decision on 2026-05-22.

---

## Why schema-only

The spec calls Step 2 "Tenant_id migrations" covering both schema **and** query rewrites. With one tenant, the WHERE-clause rewrites aren't load-bearing: every row has `tenant_id = 1`, so a missing filter and a present filter return identical results. The full ~280-query-site rewrite is deferred to Step 2b (which doesn't exist yet as a plan — it'll be written when needed, possibly broken further into Step 2b1/2b2/... by controller family). Schema-only Step 2 is cheap and lets the deferred work happen incrementally.

---

## File structure

```
backend/migrations/
└── 20260522_add_tenant_id.sql                       # NEW — adds tenant_id to 40 IMMS tables

maintenance_call_system/backend/migrations/
└── 20260522_add_tenant_id.sql                       # NEW — adds tenant_id to 6 MCS tables

backend/src/middleware/
└── tenantScope.js                                   # NEW — currentTenantId(req) helper

maintenance_call_system/backend/src/middleware/
└── tenantScope.js                                   # NEW — same helper, copied (DRY-cross-app-shim deferred)

backend/README.md                                    # MODIFY — add "Tenant_id status" section
maintenance_call_system/README.md                    # MODIFY — add "Tenant_id status" section
```

**Each file's one responsibility:**
- The migration files own the schema change for their app. Idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
- Each `tenantScope.js` exports one helper: `currentTenantId(req)` returning `req.user?.tenant_id || 1`. Safe to call now (returns 1) and after Step 3 lands (returns the real tenant).
- README sections document the rollout state so future contributors know what's wired and what's deferred.

---

## Table inventory (the source of truth for the migrations)

### IMMS domain tables (40) — all get `tenant_id`

`contacts`, `die_change_history`, `die_documents`, `die_maintenance_schedule`, `die_sharpening_records`, `dies`, `equipment_dependencies`, `equipment_installations`, `machine_documents`, `machines`, `maintenance_logs`, `part_assignments`, `part_locations`, `part_suppliers`, `parts`, `pm_checklists`, `pm_intervals`, `pm_sessions`, `pm_task_completions`, `pm_tasks`, `po_email_tracking`, `project_documents`, `project_milestones`, `project_notes`, `project_risks`, `project_tasks`, `projects`, `purchase_order_documents`, `purchase_order_history`, `purchase_order_items`, `purchase_orders`, `suppliers`, `technicians`, `transactions`, `vendors`, `work_order_attachments`, `work_order_comments`, `work_order_parts`, `work_order_tasks`, `work_orders`

### MCS domain tables (6) — all get `tenant_id`

`maintenance_calls`, `maintenance_call_parts`, `badge_readers`, `badge_registrations`, `call_board_layouts`, `call_board_tiles`

### Explicitly excluded (no `tenant_id`)

- `migrations` — schema versioning, global
- `users`, `user_sessions`, `login_attempts` — legacy IMMS auth, replaced by `auth.*` in Step 3; will be dropped later
- `email_rerouting_log`, `failed_email_attempts` — operational logs; per-tenant scoping deferred until/unless customer #2 needs separated logs
- All `auth.*` tables — already tenant-aware (Step 1)

---

## Conventions

- **Idempotent SQL** — every ALTER uses `ADD COLUMN IF NOT EXISTS`. Every index uses `CREATE INDEX IF NOT EXISTS`. Safe to re-run.
- **FK to `auth.tenants(tenant_id)`** with default action (`NO ACTION` / `RESTRICT`). Cross-schema FKs work fine in Postgres.
- **`DEFAULT 1`** because the seeded Fiserv tenant has `tenant_id = 1`. This default stays through Step 2a; it's dropped in a later step once code is migrated.
- **One index per table on `tenant_id` alone.** Compound indexes (`(tenant_id, foo)`) are deferred — we don't know the query patterns yet because queries aren't rewritten.
- **TDD does not apply** — these are pure SQL migrations and a trivial helper. Verification is done by running the migration and inspecting the schema, plus running existing test suites to confirm no regressions.

---

## Task 1: Verify prerequisites + capture baseline

**Files:** none (verification only)

- [ ] **Step 1: Confirm Step 1 prerequisites are in place**

```bash
psql "postgres://postgres:1234@localhost:5432/fiservinventory" -c "SELECT tenant_id, slug FROM auth.tenants ORDER BY tenant_id;"
```

Expected: at least one row, `(1, 'fiserv')`. If absent, run `cd auth-service && SEED_ADMIN_PASSWORD=changemeplease npm run seed` first.

- [ ] **Step 2: Capture the row counts of every domain table (baseline)**

```bash
psql "postgres://postgres:1234@localhost:5432/fiservinventory" <<'SQL' > /tmp/tenant_baseline.txt
SELECT 'parts' AS t, COUNT(*) FROM parts
UNION ALL SELECT 'machines', COUNT(*) FROM machines
UNION ALL SELECT 'purchase_orders', COUNT(*) FROM purchase_orders
UNION ALL SELECT 'work_orders', COUNT(*) FROM work_orders
UNION ALL SELECT 'dies', COUNT(*) FROM dies
UNION ALL SELECT 'maintenance_calls', COUNT(*) FROM maintenance_calls
ORDER BY t;
SQL
cat /tmp/tenant_baseline.txt
```

You'll compare this to a post-migration count in Task 7 to confirm zero data loss.

- [ ] **Step 3: Run the existing test suites to confirm green baseline**

```bash
cd backend && npm test 2>&1 | tail -5
cd ../maintenance_call_system/backend && npm test 2>&1 | tail -5
```

Note pass/fail counts. The migration must not regress these.

- [ ] **Step 4: No commit (verification only).**

---

## Task 2: Write the IMMS migration

**Files:**
- Create: `backend/migrations/20260522_add_tenant_id.sql`

- [ ] **Step 1: Write the migration file**

```sql
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
```

- [ ] **Step 2: Save the file. Do not apply yet.**

---

## Task 3: Apply the IMMS migration

**Files:** none (DB-side effect only)

- [ ] **Step 1: Apply against the local DB**

```bash
psql "postgres://postgres:1234@localhost:5432/fiservinventory" -f backend/migrations/20260522_add_tenant_id.sql 2>&1 | tail -20
```

Expected: a series of `ALTER TABLE` and `CREATE INDEX` notices (or `NOTICE: column "tenant_id" of relation "X" already exists, skipping` if you re-run). No errors.

- [ ] **Step 2: Verify a sample table has the column with FK + index**

```bash
psql "postgres://postgres:1234@localhost:5432/fiservinventory" -c "\d+ parts" | grep -E "tenant_id|fiserv|tenants"
```

Expected: a `tenant_id` column (`integer`, `not null`, default `1`), and a row in the "Foreign-key constraints" section pointing to `auth.tenants(tenant_id)`, and `parts_tenant_id_idx`.

- [ ] **Step 3: Verify all 40 IMMS tables got the column**

```bash
psql "postgres://postgres:1234@localhost:5432/fiservinventory" -c "
SELECT table_name FROM information_schema.columns
WHERE column_name = 'tenant_id' AND table_schema = 'public'
ORDER BY table_name;" | wc -l
```

Expected: 46 lines of output total (40 IMMS + 6 MCS once Task 5 lands... but right now only IMMS = 40, plus the header lines from psql). Adjust your count expectation accordingly. After Task 5, this query returns 46 + headers.

For now, expect exactly 40 IMMS tables to appear in the output (excluding header rows).

- [ ] **Step 4: Verify row counts unchanged (no data loss)**

Re-run the baseline query from Task 1, Step 2:

```bash
psql "postgres://postgres:1234@localhost:5432/fiservinventory" <<'SQL'
SELECT 'parts' AS t, COUNT(*) FROM parts
UNION ALL SELECT 'machines', COUNT(*) FROM machines
UNION ALL SELECT 'purchase_orders', COUNT(*) FROM purchase_orders
UNION ALL SELECT 'work_orders', COUNT(*) FROM work_orders
UNION ALL SELECT 'dies', COUNT(*) FROM dies
UNION ALL SELECT 'maintenance_calls', COUNT(*) FROM maintenance_calls
ORDER BY t;
SQL
```

Expected: identical counts to baseline.

- [ ] **Step 5: Verify every row now has `tenant_id = 1`**

```bash
psql "postgres://postgres:1234@localhost:5432/fiservinventory" -c "
SELECT 'parts', COUNT(*) FILTER (WHERE tenant_id IS NULL OR tenant_id != 1), COUNT(*) FROM parts
UNION ALL SELECT 'machines', COUNT(*) FILTER (WHERE tenant_id IS NULL OR tenant_id != 1), COUNT(*) FROM machines
UNION ALL SELECT 'purchase_orders', COUNT(*) FILTER (WHERE tenant_id IS NULL OR tenant_id != 1), COUNT(*) FROM purchase_orders;"
```

Expected: the middle column (anomalies) is `0` for every row.

---

## Task 4: Commit the IMMS migration

- [ ] **Step 1: Commit**

```bash
git add backend/migrations/20260522_add_tenant_id.sql
git commit -m "feat(db): add tenant_id to IMMS domain tables (Step 2a)"
```

---

## Task 5: Write the MCS migration

**Files:**
- Create: `maintenance_call_system/backend/migrations/20260522_add_tenant_id.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

---

## Task 6: Apply the MCS migration

- [ ] **Step 1: Apply**

```bash
psql "postgres://postgres:1234@localhost:5432/fiservinventory" -f maintenance_call_system/backend/migrations/20260522_add_tenant_id.sql 2>&1 | tail -10
```

Expected: 6 `ALTER TABLE` + 6 `CREATE INDEX` notices. No errors.

- [ ] **Step 2: Verify each MCS table has the column**

```bash
psql "postgres://postgres:1234@localhost:5432/fiservinventory" -c "
SELECT table_name FROM information_schema.columns
WHERE column_name = 'tenant_id' AND table_schema = 'public' AND table_name IN
('maintenance_calls','maintenance_call_parts','badge_readers','badge_registrations','call_board_layouts','call_board_tiles')
ORDER BY table_name;"
```

Expected: all 6 names appear.

- [ ] **Step 3: Count anomalies — should be zero**

```bash
psql "postgres://postgres:1234@localhost:5432/fiservinventory" -c "
SELECT 'maintenance_calls', COUNT(*) FILTER (WHERE tenant_id IS NULL OR tenant_id != 1) FROM maintenance_calls;"
```

Expected: `0` anomalies.

---

## Task 7: Commit the MCS migration

- [ ] **Step 1: Commit**

```bash
git add maintenance_call_system/backend/migrations/20260522_add_tenant_id.sql
git commit -m "feat(db): add tenant_id to MCS domain tables (Step 2a)"
```

---

## Task 8: Add `currentTenantId(req)` helper to IMMS

**Files:**
- Create: `backend/src/middleware/tenantScope.js`

- [ ] **Step 1: Write the helper**

```js
// backend/src/middleware/tenantScope.js
// Single source of truth for "which tenant is this request?". Until Step 3
// wires the auth-service JWT into req.user, this returns 1 (the Fiserv
// tenant) for every call. After Step 3, it returns req.user.tenant_id.
//
// Usage in a service or controller:
//   const { currentTenantId } = require('../middleware/tenantScope');
//   const tenantId = currentTenantId(req);
//
// Step 2b will add a tenantScope() express middleware that enforces this
// at the route level. For now the helper is plumbing — nothing calls it.

const FALLBACK_TENANT_ID = 1; // Fiserv

const currentTenantId = (req) => {
  return req?.user?.tenant_id ?? FALLBACK_TENANT_ID;
};

module.exports = { currentTenantId, FALLBACK_TENANT_ID };
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/middleware/tenantScope.js
git commit -m "feat(backend): add currentTenantId(req) helper"
```

---

## Task 9: Add `currentTenantId(req)` helper to MCS

**Files:**
- Create: `maintenance_call_system/backend/src/middleware/tenantScope.js`

- [ ] **Step 1: Write the helper** (identical content; same contract)

```js
// maintenance_call_system/backend/src/middleware/tenantScope.js
// Single source of truth for "which tenant is this request?". Until Step 3
// wires the auth-service JWT into req.user, this returns 1 (the Fiserv
// tenant) for every call. After Step 3, it returns req.user.tenant_id.
//
// Cross-app DRY shim deferred — both apps keep their own copy until/unless
// we extract a shared package.

const FALLBACK_TENANT_ID = 1; // Fiserv

const currentTenantId = (req) => {
  return req?.user?.tenant_id ?? FALLBACK_TENANT_ID;
};

module.exports = { currentTenantId, FALLBACK_TENANT_ID };
```

- [ ] **Step 2: Commit**

```bash
git add maintenance_call_system/backend/src/middleware/tenantScope.js
git commit -m "feat(mcs): add currentTenantId(req) helper"
```

---

## Task 10: Document tenant_id rollout status in both READMEs

**Files:**
- Modify: `backend/README.md` (only if it exists)
- Modify: `maintenance_call_system/README.md`

If `backend/README.md` does not exist, skip it — add the section only to the root `README.md` of the IMMS app if/wherever an IMMS README is conventional. Do not create a new file just for this section.

- [ ] **Step 1: Inspect existing READMEs**

```bash
ls backend/README.md maintenance_call_system/README.md 2>&1
```

If `backend/README.md` doesn't exist, that's fine — Step 2 will note tenancy at the top-level repo README instead. Adapt accordingly: only edit files that exist.

- [ ] **Step 2: Add a "Multi-tenancy status" section near the top of each README that exists**

Section content (paste verbatim into both files, just below the project title or after the existing top paragraph):

```markdown
## Multi-tenancy status (Step 2a complete)

Every domain table has a `tenant_id INT NOT NULL DEFAULT 1` column with a FK to `auth.tenants(tenant_id)` and an index on `tenant_id`. The seeded `fiserv` tenant has `tenant_id = 1`, so every existing row is correctly scoped.

**What works today:** schema is multi-tenant-ready; one tenant in operation.

**What is NOT yet done (Step 2b — deferred):** existing SQL queries do not filter by `tenant_id`. The `currentTenantId(req)` helper at `src/middleware/tenantScope.js` returns `1` for every call. Until query sites are rewritten, do not onboard a second tenant — cross-tenant data leakage would result.

See `docs/superpowers/specs/2026-05-21-mcs-imms-split-saas-foundations-design.md` and `docs/superpowers/plans/2026-05-22-tenant-id-schema-rollout.md`.
```

- [ ] **Step 3: Commit**

```bash
git add backend/README.md maintenance_call_system/README.md
git commit -m "docs: tenant_id schema rollout status (Step 2a)"
```

(If only one README exists, `git add` only that file.)

---

## Task 11: Re-run existing test suites — confirm no regressions

**Files:** none

- [ ] **Step 1: IMMS backend tests**

```bash
cd backend && npm test 2>&1 | tail -10
```

Expected: pass/fail counts identical to Task 1's baseline.

- [ ] **Step 2: MCS backend tests**

```bash
cd maintenance_call_system/backend && npm test 2>&1 | tail -10
```

Expected: same as baseline.

- [ ] **Step 3: auth-service tests (sanity, since we touched its referenced schema)**

```bash
cd auth-service && npm test 2>&1 | tail -10
```

Expected: 29/29 passing (unchanged from Step 1).

- [ ] **Step 4: If anything regresses, STOP** — investigate before declaring Step 2a done. Most likely cause if a test breaks: a test fixture inserts rows directly via raw SQL without specifying `tenant_id` — which is fine because of `DEFAULT 1`, but if there's a test that introspects table structure or uses a strict mode that complains about extra columns, it'll surface here.

---

## Task 12: Final verification + branch handoff

- [ ] **Step 1: Confirm 46 tables now have `tenant_id`**

```bash
psql "postgres://postgres:1234@localhost:5432/fiservinventory" -c "
SELECT COUNT(*) AS tables_with_tenant_id
FROM information_schema.columns
WHERE column_name = 'tenant_id' AND table_schema = 'public';"
```

Expected: `46` (40 IMMS + 6 MCS).

- [ ] **Step 2: Confirm clean git status**

```bash
git status
git log --oneline main..HEAD 2>/dev/null || git log --oneline -10
```

Expected: clean working tree; 5 new commits on the feature branch (IMMS migration, MCS migration, IMMS helper, MCS helper, README docs).

- [ ] **Step 3: Done.** Branch ready for PR.

---

## What's NOT in this plan (deferred to later)

These come in Step 2b (a future plan, not yet written) or later spec steps:

- Rewriting ~250 IMMS SQL queries to include `WHERE tenant_id = $tenantId` (Step 2b — by far the largest chunk)
- Rewriting ~30 MCS repository queries similarly (Step 2b)
- A `tenantScope()` Express middleware that *enforces* tenant scoping (Step 2b — turns the helper into a guard)
- The CI grep guard that fails the build on un-scoped SQL on tenant-scoped tables (Step 2b — pointless to add when 100% of existing SQL would flag)
- Dropping the `DEFAULT 1` from every column (after Step 2b, once code explicitly passes `tenant_id`)
- IMMS / MCS validating the auth-service JWT (Step 3)
- MCS standalone UI changes (Step 4)
- Portal page (Step 5)
- Cutover and deleting old login flows (Step 6)
- Schema reorg moving MCS tables into `mcs` schema (Step 7)
