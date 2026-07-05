# IMMS Tracked Migration Runner — Design

**Date:** 2026-07-05
**Status:** Approved — ready for implementation planning
**Branch:** `feat/imms-migration-runner`
**Roadmap:** §2.3 of `docs/ENGINEERING_MATURITY_ROADMAP.md`

## Why

The IMMS deploy pipeline's migrate step is a no-op for real schema changes:
`npm run migrate` (`backend/migrations/run-migrations.js`) only applies
`db/schema.sql` + `db/seed.sql` once behind an `initial_schema` marker. The 72
numbered `.sql` files in `backend/migrations/` are applied by hand — exactly the
unaudited, hand-psql-against-prod change class the prod/dev-separation effort set
out to eliminate. This ports the proven MCS tracked-migration pattern to IMMS so
schema changes are versioned, recorded, and applied by the deploy pipeline.

## Goals

1. A tracked runner applies pending `backend/migrations/*.sql` in order, once each,
   recording them in a tracking table — mirroring the MCS runner.
2. A `--baseline` mode records existing files as applied **without executing them**
   (prod already has all 72 applied by hand).
3. A **first-run guard** prevents the catastrophic "run 70 migrations against an
   already-populated DB" mistake.
4. The deploy pipeline uses the runner safely.
5. CI-testable without a live Postgres (so it actually gates).

**Non-goals (YAGNI):** cleaning up / renumbering the 72-file historical mess
(baselining makes it irrelevant); migrating the 8 legacy `.js` migration files
(already hand-applied; future migrations are `.sql`); running any real migration
against **prod** (a separate deliberate runbook step); a down/rollback mechanism
(forward-only, like MCS); moving seed-data files out of `migrations/`.

## Decisions (confirmed with the user)

| Question | Decision |
|---|---|
| The messy folder | **Baseline all `.sql` as-is**; ignore the 8 legacy `.js`; timestamp convention for NEW files only |
| Safety | **Add a first-run guard** (0 tracked rows + >5 pending → refuse in apply mode), with a `--force` escape hatch |
| Prod timing | **Build + test + baseline DEV this session**; prod baseline is a deliberate runbook step run later |
| Old runner | Keep `run-migrations.js` as `migrate:bootstrap` (rare empty-DB initial-schema load) |

## Architecture

### Unit 1 — the runner (`backend/src/database/migrate.js`)

Ports the MCS runner (`maintenance_call_system/backend/src/database/migrate.js`)
with IMMS adaptations. Signature (unchanged shape, for testability):

```
runMigrations(db, { dir = <backend/migrations>, baseline = false, force = false })
  -> { applied: string[], skipped: number }
```

- Tracking table **`imms_schema_migrations`** (`filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()`) — `CREATE TABLE IF NOT EXISTS`. Distinct
  from the legacy `migrations` table, which is left untouched.
- Reads `dir`, filters `*.sql` (ignores `.js`), sorts by filename.
- Loads already-applied filenames into a set.
- **First-run guard:** in apply mode (`!baseline`), if the tracking set is empty
  AND the number of pending files `> 5` AND `!force`, throw a clear error:
  `Existing database detected (N pending, none recorded) — run "npm run
  migrate:baseline" first, or pass --force to apply all.` This fires on any
  populated-but-unbaselined DB (prod's 72) and is bypassed by `--baseline` (which
  doesn't apply) or `--force`.
- For each pending file:
  - `baseline`: `INSERT` the filename only (no execution).
  - apply: `BEGIN` → run the file SQL → `INSERT` the filename → `COMMIT`; on error
    `ROLLBACK` and throw `Migration <file> failed: <msg>`.
- Uses `db.getClient()` (IMMS `backend/db.js` exposes it) and releases in `finally`.
- CLI entry (`require.main === module`): requires `../db` (`backend/db.js`), reads
  `--baseline` / `--force` from argv, prints a summary, exits 0/1.

### Unit 2 — scripts + deploy integration

- `backend/package.json` scripts:
  - `migrate` → `node src/database/migrate.js`
  - `migrate:baseline` → `node src/database/migrate.js --baseline`
  - `migrate:bootstrap` → `node migrations/run-migrations.js` (the old initial-
    schema loader, preserved for a genuinely empty DB)
- `scripts/deploy.ps1` already runs `npm run migrate` for IMMS (line ~140). It now
  invokes the new runner. **Safety:** if prod is deployed before being baselined,
  the guard makes `npm run migrate` exit non-zero, so `Exec` aborts the deploy with
  a clear message instead of corrupting the schema. Update the adjacent comment
  (currently "IMMS migrate is an idempotent no-op…") to describe the tracked runner.

### Unit 3 — tests (jest, CI-safe)

Port the MCS test style (`migrate.test.js`) to jest, using a **fake db** whose
client records executed SQL + a real temp dir of test `.sql` files — **no live
Postgres**, so it runs in `test:ci` (path `backend/__tests__/unit/...`, outside the
quarantine). Cases:

- Applies pending `.sql` in filename order, each inside `BEGIN`/`COMMIT`, recording
  a tracking row; non-`.sql` files ignored.
- Skips files already in `imms_schema_migrations`.
- `--baseline`: records each pending file with `INSERT`, and **never executes the
  file SQL** (assert the file's SQL string is absent from the recorded calls).
- Guard: empty tracking set + >5 pending in apply mode → throws the guard error and
  applies nothing; `force: true` bypasses it and applies all.
- A failing migration triggers `ROLLBACK` and a wrapped error.

### Unit 4 — docs

- `docs/deployment/PROD_OPERATIONS.md`: a "one-time IMMS migration baseline"
  subsection (mirroring the existing MCS baseline note) — `cd backend && npm run
  migrate:baseline` against prod, run once before the next deploy; plus the
  go-forward naming convention `YYYYMMDDHHMM_description.sql` and "new migrations
  are `.sql`, forward-only, one concern per file."
- `docs/ENGINEERING_MATURITY_ROADMAP.md §2.3`: mark the tooling done; note the
  prod-baseline as the remaining operational step.

## Dev validation (this session, real DB)

After the runner + tests land, validate end-to-end against `fiservinventory_dev`
(safe, isolated): `npm run migrate:baseline` → records all 72 `.sql`; then
`npm run migrate` → reports 0 pending (guard does not fire because the set is now
populated). This proves the tooling before any prod use. (Controller-run, not a
subagent — it touches the real dev DB.)

## Error handling / edge cases

- Guard vs genuinely-empty new DB: IMMS never bootstraps an empty DB via this
  runner (dev comes from prod dumps that already carry `imms_schema_migrations`
  once prod is baselined; prod is singular). `--force` covers the hypothetical.
- A new migration's filename need only sort correctly **relative to other pending
  files** (timestamp prefix guarantees this); historical files are all baselined,
  so their messy ordering never affects new applies.
- Each migration must be independently valid SQL; a mid-file failure rolls back
  that file only (its tracking row is not written), so a fixed re-run resumes.
- The runner must not touch the legacy `migrations` table or `run-migrations.js`
  behavior.

## Risks / plan-level checks

- Confirm `backend/db.js` `getClient()` returns a node-pg client with `query` and
  `release` (it does: `getClient: () => pool.connect()`).
- Keep the guard threshold (5) and messages exactly as specified so the tests and
  runbook match.
- Ensure the jest tests need no `DATABASE_URL` / no real DB (fully mocked db), so
  they run in `test:ci` and are not swept into the quarantine.
- Do NOT run `migrate` (apply mode) against any populated DB during implementation
  — only `--baseline` against dev in the validation step.
