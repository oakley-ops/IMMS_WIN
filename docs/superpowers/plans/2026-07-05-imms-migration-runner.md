# IMMS Tracked Migration Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tracked, transactional IMMS migration runner (`imms_schema_migrations`) that applies pending `backend/migrations/*.sql` once each, with a `--baseline` mode and a first-run guard that prevents running the 72 hand-applied migrations against an already-populated DB.

**Architecture:** Port the proven MCS runner (`maintenance_call_system/backend/src/database/migrate.js`) to `backend/src/database/migrate.js`, adapted for IMMS (new table name, `backend/migrations/` dir, `backend/db.js` client, a guard + `--force`). CI-safe jest tests use a mocked db client + a temp `.sql` dir (no Postgres). Deploy safety comes from the guard aborting a pre-baseline deploy.

**Tech Stack:** Node, node-pg (via `backend/db.js`), jest.

**Spec:** `docs/superpowers/specs/2026-07-05-imms-migration-runner-design.md`
**Reference:** `maintenance_call_system/backend/src/database/migrate.js` + `.../migrate.test.js` (the pattern being ported).

## Global Constraints

- Branch: all commits on `feat/imms-migration-runner`.
- Tracking table `imms_schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`. Do NOT touch the legacy `migrations` table or `backend/migrations/run-migrations.js` behavior.
- Runner reads `backend/migrations/`, filters `*.sql` (ignores `.js`), sorts by filename, each file in its own `BEGIN`/`COMMIT` transaction, recorded so it never re-runs.
- `--baseline`: record each pending file with an `INSERT` but NEVER execute its SQL.
- First-run guard (apply mode only): if `0` rows are recorded AND pending files `> 5` AND not `--force`, throw `Existing database detected (<n> pending, none recorded) — run "npm run migrate:baseline" first, or pass --force to apply all.` and apply nothing.
- Signature: `runMigrations(db, { dir, baseline = false, force = false }) -> { applied: string[], skipped: number }`. `db.getClient()` returns a node-pg client (`query`, `release`).
- Tests must need NO real Postgres and NO `DATABASE_URL` (fully mocked db); place them at `backend/__tests__/unit/database/migrate.test.js` (outside the CI quarantine, so they run in `npm run test:ci`).
- Do NOT run apply-mode against any populated DB during implementation. The only real-DB action is `--baseline` against `fiservinventory_dev` in the controller validation (after all tasks).

## File Structure

```
backend/src/database/migrate.js                       NEW   the runner (+ CLI)
backend/__tests__/unit/database/migrate.test.js       NEW   jest, mocked db
backend/package.json                                  MODIFY  migrate / migrate:baseline / migrate:bootstrap
scripts/deploy.ps1                                    MODIFY  update the migrate-step comment
docs/deployment/PROD_OPERATIONS.md                    MODIFY  one-time baseline runbook + naming convention
docs/ENGINEERING_MATURITY_ROADMAP.md                  MODIFY  mark §2.3 tooling done
```

---

### Task 1: The runner + tests

**Files:**
- Create: `backend/src/database/migrate.js`
- Test: `backend/__tests__/unit/database/migrate.test.js`

**Interfaces:**
- Produces: `runMigrations(db, { dir, baseline, force }) -> { applied, skipped }` and a CLI (`require.main === module`). Consumed by Task 2's npm scripts.

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/unit/database/migrate.test.js`:

```javascript
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runMigrations } = require('../../../src/database/migrate');

// A fake db whose client records every SQL string it executes.
const makeDb = ({ appliedRows = [], failOn = null } = {}) => {
  const calls = [];
  const client = {
    query: jest.fn(async (sql) => {
      calls.push(sql);
      if (failOn && typeof sql === 'string' && sql.includes(failOn)) throw new Error('boom: ' + failOn);
      if (typeof sql === 'string' && /^SELECT filename FROM imms_schema_migrations/i.test(sql)) {
        return { rows: appliedRows };
      }
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  return { db: { getClient: jest.fn(async () => client) }, client, calls };
};

const makeDir = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'imms-mig-'));
  for (const [name, sql] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), sql);
  return dir;
};

const sixFiles = () => {
  const files = {};
  for (let i = 1; i <= 6; i++) files[`00${i}_m.sql`] = `CREATE TABLE t${i} (id int);`;
  return files;
};

describe('runMigrations', () => {
  test('applies pending .sql in filename order inside transactions and records them', async () => {
    const dir = makeDir({
      '002_second.sql': 'CREATE TABLE two (id int);',
      '001_first.sql': 'CREATE TABLE one (id int);',
      'notes.txt': 'ignore me',
    });
    const { db, calls } = makeDb();
    const result = await runMigrations(db, { dir });
    expect(result.applied).toEqual(['001_first.sql', '002_second.sql']);
    const oneIdx = calls.findIndex((s) => typeof s === 'string' && s.includes('CREATE TABLE one'));
    const twoIdx = calls.findIndex((s) => typeof s === 'string' && s.includes('CREATE TABLE two'));
    expect(oneIdx).toBeGreaterThan(-1);
    expect(twoIdx).toBeGreaterThan(oneIdx);
    expect(calls.filter((s) => s === 'BEGIN')).toHaveLength(2);
    expect(calls.filter((s) => s === 'COMMIT')).toHaveLength(2);
    expect(calls.filter((s) => typeof s === 'string' && s.startsWith('INSERT INTO imms_schema_migrations'))).toHaveLength(2);
  });

  test('skips files already recorded', async () => {
    const dir = makeDir({ '001_first.sql': 'CREATE TABLE one (id int);', '002_second.sql': 'CREATE TABLE two (id int);' });
    const { db, calls } = makeDb({ appliedRows: [{ filename: '001_first.sql' }] });
    const result = await runMigrations(db, { dir });
    expect(result.applied).toEqual(['002_second.sql']);
    expect(calls.some((s) => typeof s === 'string' && s.includes('CREATE TABLE one'))).toBe(false);
    expect(calls.some((s) => typeof s === 'string' && s.includes('CREATE TABLE two'))).toBe(true);
  });

  test('--baseline records pending files WITHOUT executing their SQL', async () => {
    const dir = makeDir({ '001_first.sql': 'CREATE TABLE one (id int);', '002_second.sql': 'CREATE TABLE two (id int);' });
    const { db, calls } = makeDb();
    const result = await runMigrations(db, { dir, baseline: true });
    expect(result.applied).toEqual(['001_first.sql', '002_second.sql']);
    // no MIGRATION-file DDL ran (the tracking-table bootstrap CREATE TABLE is expected and excluded)
    expect(calls.filter((s) => typeof s === 'string' && /CREATE TABLE/i.test(s) && !/imms_schema_migrations/i.test(s))).toHaveLength(0);
    expect(calls.some((s) => s === 'BEGIN')).toBe(false);
    expect(calls.filter((s) => typeof s === 'string' && s.startsWith('INSERT INTO imms_schema_migrations'))).toHaveLength(2);
  });

  test('first-run guard: refuses to apply when nothing recorded and >5 pending', async () => {
    const dir = makeDir(sixFiles());
    const { db, calls } = makeDb(); // appliedRows empty -> 0 recorded
    await expect(runMigrations(db, { dir })).rejects.toThrow(/Existing database detected/);
    // no MIGRATION-file DDL ran (the tracking-table bootstrap CREATE TABLE is expected and excluded)
    expect(calls.filter((s) => typeof s === 'string' && /CREATE TABLE/i.test(s) && !/imms_schema_migrations/i.test(s))).toHaveLength(0);
  });

  test('--force bypasses the guard and applies all', async () => {
    const dir = makeDir(sixFiles());
    const { db, calls } = makeDb();
    const result = await runMigrations(db, { dir, force: true });
    expect(result.applied).toHaveLength(6);
    expect(calls.filter((s) => s === 'COMMIT')).toHaveLength(6);
  });

  test('guard does not fire once files are recorded (0 pending)', async () => {
    const files = sixFiles();
    const dir = makeDir(files);
    const appliedRows = Object.keys(files).map((filename) => ({ filename }));
    const { db } = makeDb({ appliedRows });
    const result = await runMigrations(db, { dir });
    expect(result.applied).toEqual([]);
  });

  test('a failing migration rolls back and throws a wrapped error', async () => {
    const dir = makeDir({ '001_first.sql': 'CREATE TABLE one (id int);', '002_bad.sql': 'THIS IS BAD SQL;' });
    const { db, calls } = makeDb({ failOn: 'THIS IS BAD SQL' });
    await expect(runMigrations(db, { dir })).rejects.toThrow(/Migration 002_bad\.sql failed/);
    expect(calls.some((s) => s === 'ROLLBACK')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx jest __tests__/unit/database/migrate.test.js --silent`
Expected: FAIL — `Cannot find module '../../../src/database/migrate'`.

- [ ] **Step 3: Write the runner**

Create `backend/src/database/migrate.js`:

```javascript
// Tracked SQL migration runner for the IMMS backend.
//
//   node src/database/migrate.js              apply pending migrations/*.sql
//   node src/database/migrate.js --baseline   record pending files WITHOUT executing
//                                             (one-time step: the live DB already has
//                                              every current migration applied by hand)
//   node src/database/migrate.js --force      apply even when the first-run guard trips
//
// Files apply in filename order; each runs in its own transaction and is recorded
// in imms_schema_migrations so it never runs twice. A first-run guard refuses to
// apply when nothing is recorded yet and many files are pending (an existing DB
// that hasn't been baselined), unless --force is given.
const fs = require('fs');
const path = require('path');

const DEFAULT_DIR = path.join(__dirname, '..', '..', 'migrations');
const GUARD_THRESHOLD = 5;

const runMigrations = async (db, { dir = DEFAULT_DIR, baseline = false, force = false } = {}) => {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const client = await db.getClient();
  const applied = [];
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS imms_schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const done = await client.query('SELECT filename FROM imms_schema_migrations');
    const doneSet = new Set(done.rows.map((r) => r.filename));
    const pending = files.filter((f) => !doneSet.has(f));

    // First-run guard: an existing DB (nothing recorded) with many pending files
    // almost certainly already has them applied by hand — refuse to re-run them.
    if (!baseline && !force && doneSet.size === 0 && pending.length > GUARD_THRESHOLD) {
      throw new Error(
        `Existing database detected (${pending.length} pending, none recorded) — ` +
        `run "npm run migrate:baseline" first, or pass --force to apply all.`
      );
    }

    for (const file of pending) {
      if (baseline) {
        await client.query('INSERT INTO imms_schema_migrations (filename) VALUES ($1)', [file]);
        applied.push(file);
        continue;
      }
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO imms_schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        err.message = `Migration ${file} failed: ${err.message}`;
        throw err;
      }
    }
    return { applied, skipped: files.length - applied.length };
  } finally {
    client.release();
  }
};

module.exports = { runMigrations };

if (require.main === module) {
  const db = require('../../db');
  const baseline = process.argv.includes('--baseline');
  const force = process.argv.includes('--force');
  runMigrations(db, { baseline, force })
    .then(({ applied, skipped }) => {
      const verb = baseline ? 'baselined' : 'applied';
      console.log(`${verb}: ${applied.length ? applied.join(', ') : '(none)'} | already recorded: ${skipped}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `npx jest __tests__/unit/database/migrate.test.js --silent`
Expected: PASS (7 tests).

- [ ] **Step 5: Confirm CI-safety (no real DB needed) + full suite**

Run (from `backend/`): `node -e "require('./src/database/migrate'); console.log('loads without a DB')"` → prints `loads without a DB` (proves requiring the module does not touch `backend/db.js` / need `DATABASE_URL`).
Then: `npm run test:ci` → all green (adds the migrate suite, ~25 suites).

- [ ] **Step 6: Commit**

```bash
git add backend/src/database/migrate.js backend/__tests__/unit/database/migrate.test.js
git commit -m "feat(migrations): tracked IMMS migration runner with first-run guard"
```

---

### Task 2: npm scripts + deploy comment

**Files:**
- Modify: `backend/package.json` (scripts)
- Modify: `scripts/deploy.ps1` (comment on the migrate step)

**Interfaces:**
- Consumes: `backend/src/database/migrate.js` (Task 1).

- [ ] **Step 1: Repoint + add the npm scripts**

In `backend/package.json`, replace the existing migrate line:

```json
    "migrate": "node migrations/run-migrations.js",
```

with:

```json
    "migrate": "node src/database/migrate.js",
    "migrate:baseline": "node src/database/migrate.js --baseline",
    "migrate:bootstrap": "node migrations/run-migrations.js",
```

- [ ] **Step 2: Verify the scripts resolve**

Run (from `backend/`): `node -e "const s=require('./package.json').scripts; console.log(s.migrate, '||', s['migrate:baseline'], '||', s['migrate:bootstrap'])"`
Expected: `node src/database/migrate.js || node src/database/migrate.js --baseline || node migrations/run-migrations.js`.

- [ ] **Step 3: Update the deploy.ps1 comment**

In `scripts/deploy.ps1`, replace the comment line (currently at ~line 139):

```
# IMMS migrate is an idempotent no-op on an existing DB (applies db/schema.sql once).
```

with:

```
# IMMS migrate runs the tracked runner (backend/src/database/migrate.js): applies
# pending backend/migrations/*.sql. Its first-run guard aborts this deploy if prod
# has not been baselined yet (run `npm run migrate:baseline` once) — see
# docs/deployment/PROD_OPERATIONS.md, "IMMS schema migrations".
```

Do NOT change the two `Exec 'npm run migrate'` lines themselves.

- [ ] **Step 4: Sanity-check the PowerShell still parses**

Run (repo root): `pwsh -NoProfile -Command "$null = [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path scripts/deploy.ps1), [ref]$null, [ref]$null); 'parse OK'"` (if `pwsh` is unavailable, use `powershell` instead of `pwsh`).
Expected: `parse OK`. (This only edits a comment, so it should parse; the check guards against an accidental stray character.)

- [ ] **Step 5: Commit**

```bash
git add backend/package.json scripts/deploy.ps1
git commit -m "feat(migrations): wire migrate/migrate:baseline/migrate:bootstrap + deploy note"
```

---

### Task 3: Docs — runbook baseline + naming convention + roadmap

**Files:**
- Modify: `docs/deployment/PROD_OPERATIONS.md`
- Modify: `docs/ENGINEERING_MATURITY_ROADMAP.md`

- [ ] **Step 1: Add the IMMS migrations runbook subsection**

In `docs/deployment/PROD_OPERATIONS.md`, add a new `### IMMS schema migrations` subsection. Place it near the existing deploy/migration content (find an anchor with: `grep -n "migrate\|baseline\|Migrate" docs/deployment/PROD_OPERATIONS.md` and insert after the most relevant deploy/migration section). Content to add verbatim:

```markdown
### IMMS schema migrations

IMMS schema changes are tracked, per-file, by `backend/src/database/migrate.js`
(table `imms_schema_migrations`), the same pattern as MCS.

**One-time prod baseline (do this ONCE, before the next deploy).** Prod already
has all current `backend/migrations/*.sql` applied by hand, so record them as
applied without re-running:

```
cd C:\imms\prod\backend
npm run migrate:baseline
```

Expected: `baselined: <all current .sql files> | already recorded: 0`. Until this
runs, the deploy's migrate step will **abort** with "Existing database detected …"
— that is the first-run guard protecting prod, not a failure to fix by forcing.

**Adding a new migration.** Create `backend/migrations/YYYYMMDDHHMM_description.sql`
(timestamp prefix so it sorts after everything baselined; one concern per file;
forward-only — there is no down step). The next deploy applies it automatically via
`npm run migrate`; each file runs in its own transaction and is recorded once.

**Manual apply (outside a deploy):** `cd backend && npm run migrate`. Legacy `.js`
migrations in `backend/migrations/` are ignored (already applied historically). The
old initial-schema loader remains available as `npm run migrate:bootstrap` for a
genuinely empty database.
```

- [ ] **Step 2: Mark roadmap §2.3 tooling done**

In `docs/ENGINEERING_MATURITY_ROADMAP.md`, in the `### 2.3 IMMS per-file tracked migration runner` section, replace the `- **Trigger:**` line (the line beginning `- **Trigger:** The first IMMS schema change`) with:

```markdown
- **Status:** ✅ Tooling done 2026-07-05 — `backend/src/database/migrate.js`
  (table `imms_schema_migrations`) applies tracked `backend/migrations/*.sql`
  with `migrate:baseline` and a first-run guard; wired into `deploy.ps1`. The
  remaining step is the **one-time prod baseline** (`npm run migrate:baseline`,
  see PROD_OPERATIONS.md) before the next prod deploy that changes schema.
```

- [ ] **Step 3: Commit**

```bash
git add docs/deployment/PROD_OPERATIONS.md docs/ENGINEERING_MATURITY_ROADMAP.md
git commit -m "docs(migrations): IMMS baseline runbook + naming convention; roadmap §2.3"
```

---

### Controller validation (after all tasks — NOT a subagent task)

Run by the controller against the isolated dev DB to prove the tooling end-to-end
(safe: `--baseline` never executes migration SQL). Never run apply-mode against a
populated DB.

- [ ] From `backend/` with the dev DB env (`fiservinventory_dev`): `npm run migrate:baseline` → records all current `.sql` (expect `baselined: … | already recorded: 0`); confirm row count: `SELECT count(*) FROM imms_schema_migrations` equals the number of `.sql` files.
- [ ] `npm run migrate` → expect `applied: (none) | already recorded: <n>` (guard does NOT fire because the set is now populated), proving idempotence and that a baselined DB is a no-op.

---

## Self-Review (completed at write time)

- **Spec coverage:** runner with table/dir/`.sql`-only/transactions/guard/`--force`/`--baseline` (T1); scripts migrate/baseline/bootstrap + deploy comment + guard-aborts-deploy (T2); CI-safe mocked-db jest tests covering apply-order/skip/baseline-no-exec/guard/force/rollback (T1); runbook baseline + naming + roadmap §2.3 (T3); dev-only validation, prod baseline deferred (controller step). Non-goals (folder cleanup, `.js` migration, prod run, rollback) excluded.
- **Placeholder scan:** all code/test/command steps complete. The one soft anchor (T3 S1 "find an anchor with grep") is a doc-placement instruction with exact content supplied — acceptable for a docs insertion.
- **Type consistency:** `runMigrations(db, { dir, baseline, force }) -> { applied, skipped }` identical in T1 impl, test, and Global Constraints; table name `imms_schema_migrations`, guard message, and `GUARD_THRESHOLD` 5 consistent across impl/tests/runbook; script names `migrate`/`migrate:baseline`/`migrate:bootstrap` consistent T2/T3.
- **CI-safety:** tests require no `DATABASE_URL` (mocked db; `require('../../db')` is inside the CLI guard, not at module top — verified in the runner code) and live at `__tests__/unit/database/`, outside the quarantine patterns, so they gate in `test:ci`.
```
