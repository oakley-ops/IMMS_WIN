# Production / Development Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Production runs from a dedicated clone (`C:\imms\prod`) under PM2 with built frontends and backup-gated tagged deploys, while the existing folder becomes dev-only with its own database and ports — so editing dev code can never reach the factory floor.

**Architecture:** Five PM2 apps defined in a repo-root `ecosystem.prod.config.js` (two node backends, `next start`, two PM2 static serves of CRA builds). A PowerShell deploy script (backup → checkout → install → migrate → build → reload → health-gate → tag) is the only way prod changes. Dev gets `fiservinventory_dev` (refreshed from prod dumps) and shifted ports 4100/4101/3100/3103.

**Tech Stack:** PM2 7.0.1 (global, `C:\Users\Fiser\AppData\Roaming\npm\node_modules\pm2\bin\pm2`), PowerShell 5.1, PostgreSQL 17 (`C:\Program Files\PostgreSQL\17\bin`), react-scripts 5.0.1 (`BUILD_PATH` supported), Next.js, cross-env (already a frontend dep), vitest (MCS backend tests).

**Spec:** `docs/superpowers/specs/2026-07-03-prod-dev-separation-design.md`

## Global Constraints

- Branch: all commits on `feat/prod-dev-separation`.
- PowerShell scripts MUST be Windows PowerShell 5.1-compatible: no `&&`/`||` pipeline chains, no ternary/null-coalescing, `Invoke-WebRequest` always with `-UseBasicParsing`, never redirect a native command's stderr (`2>&1`/`2>$null` wraps lines in ErrorRecords on 5.1).
- Native commands in scripts run through the `Exec` helper (cmd /c + `$LASTEXITCODE` check) — PS 5.1 does not stop on native-command failure.
- Prod paths are fixed: clone `C:\imms\prod`, backups `C:\imms\backups`, PG bin `C:\Program Files\PostgreSQL\17\bin`, PM2 bin `C:\Users\Fiser\AppData\Roaming\npm\node_modules\pm2\bin\pm2`.
- Floor-facing ports never change: 4000, 4001, 3001, 3002, 3003. Dev ports: 4100 (IMMS API), 4101 (MCS API), 3100 (IMMS CRA dev), 3103 (MCS Next dev).
- `ecosystem.prod.config.js` MUST NOT set `NODE_ENV` for `imms-api`: `backend/db.js` forces `ssl: { rejectUnauthorized: false }` whenever `NODE_ENV === 'production'`, and the local PostgreSQL 17 does not serve SSL — connections would fail. `NODE_ENV` for IMMS stays governed by `backend/.env`. (MCS backend gates SSL on `DB_SSL`, so it safely gets `NODE_ENV=production`.)
- Never commit `.env` files or secrets. `frontend/.env` is UTF-16 on disk — PowerShell `Get-Content` auto-detects it; anything copying it must re-save as UTF-8.
- The plan never restarts or kills the five currently-running production processes. Cutover (runbook, executed later in a quiet window with the user) is the only step that touches them.
- No new npm dependencies anywhere.
- No Fiserv naming in any NEW file, script name, PM2 app name, or doc (existing DB name `fiservinventory` is grandfathered; the dev DB `fiservinventory_dev` derives from it).

## File Structure

```
ecosystem.prod.config.js                     NEW  root PM2 definition of all five prod apps
scripts/
  lib/db-common.ps1                          NEW  shared: PG paths, DATABASE_URL parsing, backup fn
  deploy.ps1                                 NEW  the deploy pipeline (+ -BackupOnly ad-hoc backups)
  refresh-dev-db.ps1                         NEW  rebuild fiservinventory_dev from newest dump
start-dev.bat                                NEW  starts the four dev-port processes; kills nothing
start-app.bat                                DELETE (taskkill-all-node hazard)
maintenance_call_system/start-mcs.bat        DELETE (superseded by PM2 prod)
maintenance_call_system/ecosystem.config.js  DELETE (superseded by root ecosystem.prod.config.js)
maintenance_call_system/backend/src/database/migrate.js       NEW  MCS migration runner (+ --baseline)
maintenance_call_system/backend/src/database/migrate.test.js  NEW  vitest coverage
maintenance_call_system/backend/package.json MODIFY  add migrate / migrate:baseline scripts
frontend/package.json                        MODIFY  add build:localhost, build:network, start:dev
.gitignore                                   MODIFY  ignore frontend/build-localhost/, build-network/
docs/deployment/PROD_OPERATIONS.md           NEW  runbook: cutover, deploy, rollback, restore, troubleshooting
CLAUDE.md                                    MODIFY  dev commands + prod pointer
```

---

### Task 1: MCS migration runner

The MCS backend's `migrations/*.sql` are applied by hand with `psql` today. Build a tracked runner: applies pending files in filename order, records them in `mcs_schema_migrations`, supports `--baseline` (record without executing — required because the live DB already has every current migration applied manually).

**Files:**
- Create: `maintenance_call_system/backend/src/database/migrate.js`
- Create: `maintenance_call_system/backend/src/database/migrate.test.js`
- Modify: `maintenance_call_system/backend/package.json` (scripts)

**Interfaces:**
- Consumes: `src/database/db.js` — existing module exporting `{ query(text, params), getClient() }`; `getClient()` resolves a pg client with `query()`/`release()`.
- Produces: `runMigrations(db, { dir, baseline }) -> Promise<{ applied: string[], skipped: number }>` (exported for tests and future reuse); CLI `node src/database/migrate.js [--baseline]`; npm scripts `migrate`, `migrate:baseline`. Task 4's deploy script calls `npm run migrate` in `maintenance_call_system/backend`. The runbook (Task 7) calls `npm run migrate:baseline` once at cutover.

- [ ] **Step 1: Write the failing test**

Create `maintenance_call_system/backend/src/database/migrate.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runMigrations } = require('./migrate');

// A fake db whose client records every SQL string it executes.
const makeDb = ({ appliedRows = [], failOn = null } = {}) => {
  const calls = [];
  const client = {
    query: vi.fn(async (sql) => {
      calls.push(sql);
      if (failOn && sql.includes(failOn)) throw new Error('boom: ' + failOn);
      if (/^SELECT filename FROM mcs_schema_migrations/i.test(sql)) {
        return { rows: appliedRows };
      }
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  return { db: { getClient: vi.fn(async () => client) }, client, calls };
};

const makeDir = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcs-mig-'));
  for (const [name, sql] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), sql);
  }
  return dir;
};

describe('runMigrations', () => {
  it('applies pending .sql files in filename order inside transactions and records them', async () => {
    const dir = makeDir({
      '002_second.sql': 'CREATE TABLE two (id int);',
      '001_first.sql': 'CREATE TABLE one (id int);',
      'notes.txt': 'ignore me',
    });
    const { db, calls } = makeDb();

    const result = await runMigrations(db, { dir });

    expect(result.applied).toEqual(['001_first.sql', '002_second.sql']);
    const oneIdx = calls.findIndex((s) => s.includes('CREATE TABLE one'));
    const twoIdx = calls.findIndex((s) => s.includes('CREATE TABLE two'));
    expect(oneIdx).toBeGreaterThan(-1);
    expect(twoIdx).toBeGreaterThan(oneIdx);
    // each file: BEGIN before, COMMIT after, INSERT tracking row
    expect(calls.filter((s) => s === 'BEGIN')).toHaveLength(2);
    expect(calls.filter((s) => s === 'COMMIT')).toHaveLength(2);
    expect(calls.filter((s) => s.startsWith('INSERT INTO mcs_schema_migrations'))).toHaveLength(2);
  });

  it('skips files already recorded in mcs_schema_migrations', async () => {
    const dir = makeDir({
      '001_first.sql': 'CREATE TABLE one (id int);',
      '002_second.sql': 'CREATE TABLE two (id int);',
    });
    const { db, calls } = makeDb({ appliedRows: [{ filename: '001_first.sql' }] });

    const result = await runMigrations(db, { dir });

    expect(result.applied).toEqual(['002_second.sql']);
    expect(result.skipped).toBe(1);
    expect(calls.some((s) => s.includes('CREATE TABLE one'))).toBe(false);
  });

  it('rolls back and rethrows with the filename when a migration fails', async () => {
    const dir = makeDir({ '001_bad.sql': 'CREATE TABLE broken (id int);' });
    const { db, calls, client } = makeDb({ failOn: 'CREATE TABLE broken' });

    await expect(runMigrations(db, { dir })).rejects.toThrow(/001_bad\.sql/);
    expect(calls).toContain('ROLLBACK');
    expect(calls.some((s) => s.startsWith('INSERT INTO mcs_schema_migrations'))).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('--baseline records pending files without executing their SQL', async () => {
    const dir = makeDir({ '001_first.sql': 'CREATE TABLE one (id int);' });
    const { db, calls } = makeDb();

    const result = await runMigrations(db, { dir, baseline: true });

    expect(result.applied).toEqual(['001_first.sql']);
    expect(calls.some((s) => s.includes('CREATE TABLE one'))).toBe(false);
    expect(calls.filter((s) => s.startsWith('INSERT INTO mcs_schema_migrations'))).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `maintenance_call_system/backend`): `npx vitest run src/database/migrate.test.js`
Expected: FAIL — `Cannot find module './migrate'`

- [ ] **Step 3: Write the implementation**

Create `maintenance_call_system/backend/src/database/migrate.js`:

```javascript
// Tracked SQL migration runner for the MCS backend.
//
//   node src/database/migrate.js              apply pending migrations/*.sql
//   node src/database/migrate.js --baseline   record pending files WITHOUT executing
//                                             (one-time cutover step: the live DB already
//                                              has every current migration applied by hand)
//
// Files apply in filename order; each file runs inside its own transaction and
// is recorded in mcs_schema_migrations so it never runs twice.
const fs = require('fs');
const path = require('path');

const DEFAULT_DIR = path.join(__dirname, '..', '..', 'migrations');

const runMigrations = async (db, { dir = DEFAULT_DIR, baseline = false } = {}) => {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const client = await db.getClient();
  const applied = [];
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcs_schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const done = await client.query('SELECT filename FROM mcs_schema_migrations');
    const doneSet = new Set(done.rows.map((r) => r.filename));

    for (const file of files) {
      if (doneSet.has(file)) continue;
      if (baseline) {
        await client.query('INSERT INTO mcs_schema_migrations (filename) VALUES ($1)', [file]);
        applied.push(file);
        continue;
      }
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO mcs_schema_migrations (filename) VALUES ($1)', [file]);
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
  const db = require('./db');
  const baseline = process.argv.includes('--baseline');
  runMigrations(db, { baseline })
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

Run: `npx vitest run src/database/migrate.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Add npm scripts**

In `maintenance_call_system/backend/package.json`, change the `scripts` block from:

```json
 "scripts": {
  "start": "node index.js",
  "dev": "nodemon index.js",
```

to:

```json
 "scripts": {
  "start": "node index.js",
  "dev": "nodemon index.js",
  "migrate": "node src/database/migrate.js",
  "migrate:baseline": "node src/database/migrate.js --baseline",
```

(leave the test scripts that follow untouched).

- [ ] **Step 6: Run the full MCS backend suite**

Run (from `maintenance_call_system/backend`): `npx vitest run`
Expected: all files PASS (was 87 tests; now 91).

- [ ] **Step 7: Commit**

```bash
git add maintenance_call_system/backend/src/database/migrate.js maintenance_call_system/backend/src/database/migrate.test.js maintenance_call_system/backend/package.json
git commit -m "feat(mcs): tracked SQL migration runner with --baseline mode"
```

---

### Task 2: CRA production build variants

CRA bakes env at build time, so the two IMMS frontends become two builds. `build:network` mirrors `start:network-pi`'s env (`REACT_APP_API_URL=http://10.1.10.50:4000`); `build:localhost` mirrors `start:localhost-3002` (no API override — the app default / `frontend/.env` value applies, exactly as the running :3002 server behaves today). Also add the `start:dev` script Task 6's `start-dev.bat` uses.

**Files:**
- Modify: `frontend/package.json` (scripts block)
- Modify: `.gitignore` (line ~61, next to `frontend/build/`)

**Interfaces:**
- Produces: `npm run build:localhost` → `frontend/build-localhost/`; `npm run build:network` → `frontend/build-network/`; `npm run start:dev` → CRA dev server on :3100 pointed at the :4100 dev API. Task 3's ecosystem serves the two build dirs; Task 4's deploy runs both builds; Task 6's bat runs `start:dev`.

- [ ] **Step 1: Add the three scripts**

In `frontend/package.json`, after the existing `"start:hotspot"` line, add:

```json
 "start:dev": "cross-env HOST=localhost PORT=3100 REACT_APP_API_URL=http://localhost:4100 REACT_APP_RETURN_TO_ALLOWLIST=http://localhost:3103 GENERATE_SOURCEMAP=false BROWSER=none react-scripts start",
 "build:localhost": "cross-env BUILD_PATH=build-localhost GENERATE_SOURCEMAP=false react-scripts build",
 "build:network": "cross-env BUILD_PATH=build-network REACT_APP_API_URL=http://10.1.10.50:4000 GENERATE_SOURCEMAP=false react-scripts build",
```

- [ ] **Step 2: Ignore the new build dirs**

In `.gitignore`, directly below the existing `frontend/build/` line, add:

```
frontend/build-localhost/
frontend/build-network/
```

- [ ] **Step 3: Run both builds and verify output**

Run (from `frontend/`): `npm run build:localhost` then `npm run build:network` (each takes 1–3 minutes).
Expected: both exit 0; `frontend/build-localhost/index.html` and `frontend/build-network/index.html` exist.

- [ ] **Step 4: Verify the network build baked the Pi API URL**

Run (Git Bash, from `frontend/`): `grep -l "10.1.10.50:4000" build-network/static/js/*.js && grep -L "10.1.10.50:4000" build-localhost/static/js/main*.js`
Expected: a `build-network` bundle matches; the `build-localhost` main bundle does not.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json .gitignore
git commit -m "feat(frontend): production build variants and dev-port start script"
```

---

### Task 3: `ecosystem.prod.config.js`

**Files:**
- Create: `ecosystem.prod.config.js` (repo root)
- Delete: `maintenance_call_system/ecosystem.config.js` (superseded; its two apps move here)

**Interfaces:**
- Consumes: `frontend/build-localhost/`, `frontend/build-network/` (Task 2); existing backend entrypoints `backend/index.js`, `maintenance_call_system/backend/index.js`; MCS `next` bin.
- Produces: PM2 app names `imms-api`, `mcs-api`, `mcs-web`, `imms-web-local`, `imms-web-network` — Task 4's deploy runs `pm2 startOrReload ecosystem.prod.config.js`; the runbook references these names for `pm2 logs`/`pm2 restart`.

- [ ] **Step 1: Create the config**

Create `ecosystem.prod.config.js`:

```javascript
/**
 * PM2 ecosystem — PRODUCTION (all five services).
 *
 * Runs only from the production clone (C:\imms\prod). Deploys go through
 * scripts/deploy.ps1 — do not `pm2 start` new code by hand.
 *
 *   node <pm2-bin> startOrReload ecosystem.prod.config.js
 *   node <pm2-bin> save
 *
 * pm2-bin: C:\Users\Fiser\AppData\Roaming\npm\node_modules\pm2\bin\pm2
 */
const path = require('path');

const common = {
  watch: false,
  restart_delay: 3000,
  max_restarts: 10,
  log_date_format: 'YYYY-MM-DD HH:mm:ss',
};

module.exports = {
  apps: [
    {
      ...common,
      name: 'imms-api',
      cwd: path.join(__dirname, 'backend'),
      script: 'index.js',
      // NODE_ENV deliberately NOT set: backend/db.js forces SSL when
      // NODE_ENV === 'production' and the local PostgreSQL has no SSL.
      // NODE_ENV stays governed by backend/.env.
      env: { PORT: 4000, HOST: '0.0.0.0' },
      max_memory_restart: '500M',
    },
    {
      ...common,
      name: 'mcs-api',
      cwd: path.join(__dirname, 'maintenance_call_system', 'backend'),
      script: 'index.js',
      env: { NODE_ENV: 'production', PORT: 4001 },
      max_memory_restart: '200M',
    },
    {
      ...common,
      name: 'mcs-web',
      cwd: path.join(__dirname, 'maintenance_call_system', 'frontend'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3003',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '300M',
    },
    {
      ...common,
      name: 'imms-web-local',
      script: 'serve', // PM2 built-in static server
      env: {
        PM2_SERVE_PATH: path.join(__dirname, 'frontend', 'build-localhost'),
        PM2_SERVE_PORT: 3002,
        PM2_SERVE_SPA: 'true',
      },
      max_memory_restart: '150M',
    },
    {
      ...common,
      name: 'imms-web-network',
      script: 'serve',
      env: {
        PM2_SERVE_PATH: path.join(__dirname, 'frontend', 'build-network'),
        PM2_SERVE_PORT: 3001,
        PM2_SERVE_SPA: 'true',
      },
      max_memory_restart: '150M',
    },
  ],
};
```

- [ ] **Step 2: Verify it parses and lists the right apps**

Run (repo root): `node -e "const c=require('./ecosystem.prod.config.js'); console.log(c.apps.map(a=>a.name+':'+(a.env.PORT||a.env.PM2_SERVE_PORT)).join(' '))"`
Expected: `imms-api:4000 mcs-api:4001 mcs-web:undefined imms-web-local:3002 imms-web-network:3001` (mcs-web's port lives in `args`).

- [ ] **Step 3: Smoke-test the PM2 static-serve shape on scratch ports**

The two `serve` apps are the only PM2 feature we haven't used before. Verify against the Task 2 build output without touching real ports:

Run (repo root, Git Bash):
```bash
node "C:/Users/Fiser/AppData/Roaming/npm/node_modules/pm2/bin/pm2" serve frontend/build-localhost 3902 --spa --name scratch-serve
curl -s -o /dev/null -w "%{http_code}" http://localhost:3902/
node "C:/Users/Fiser/AppData/Roaming/npm/node_modules/pm2/bin/pm2" delete scratch-serve
```
Expected: curl prints `200`; the app deletes cleanly. (This starts the PM2 daemon; that's fine — it manages nothing else yet.)

- [ ] **Step 4: Delete the superseded MCS ecosystem file**

```bash
git rm maintenance_call_system/ecosystem.config.js
```

- [ ] **Step 5: Commit**

```bash
git add ecosystem.prod.config.js
git commit -m "feat(ops): root PM2 ecosystem for all five production services"
```

---

### Task 4: `scripts/lib/db-common.ps1` + `scripts/deploy.ps1`

**Files:**
- Create: `scripts/lib/db-common.ps1`
- Create: `scripts/deploy.ps1`

**Interfaces:**
- Consumes: `ecosystem.prod.config.js` (Task 3), `npm run migrate` in both backends (Task 1 + existing IMMS `migrations/run-migrations.js`), `npm run build:localhost|network` (Task 2).
- Produces: `deploy.ps1 [-Ref <ref>] [-Yes] [-BackupOnly] [-EnvFile <path>]`; `db-common.ps1` exports `Get-DatabaseUrl`, `Set-PgEnvFromUrl` (returns db name), `Invoke-DbBackup` (returns dump path) — Task 5 dot-sources the same lib. Deploy tags are `deploy-yyyyMMdd-HHmm` (lexically sortable = chronologically sortable).
- Note: IMMS `npm run migrate` only applies `db/schema.sql` once (tracked in a `migrations` table) — it is an idempotent no-op on the existing DB and does NOT run the numbered files in `backend/migrations/`. Wiring it in satisfies the spec and future-proofs fresh installs; extending IMMS to a tracked per-file runner like Task 1's is deliberately out of scope.

- [ ] **Step 1: Create the shared DB library**

Create `scripts/lib/db-common.ps1`:

```powershell
# Shared DB helpers for deploy.ps1 / refresh-dev-db.ps1 (Windows PowerShell 5.1).
Set-StrictMode -Version 2.0

$script:PgBin = 'C:\Program Files\PostgreSQL\17\bin'

function Get-DatabaseUrl {
    param([Parameter(Mandatory = $true)][string]$EnvFile)
    if (-not (Test-Path $EnvFile)) { throw "Env file not found: $EnvFile" }
    # Get-Content auto-detects UTF-16 BOM files (frontend/.env is one).
    $line = Get-Content $EnvFile | Where-Object { $_ -match '^\s*DATABASE_URL=' } | Select-Object -First 1
    if (-not $line) { throw "DATABASE_URL not found in $EnvFile" }
    return ($line -replace '^\s*DATABASE_URL=', '').Trim()
}

function Set-PgEnvFromUrl {
    # Parses postgres://user:pass@host:port/dbname into PG* env vars for the CLI
    # tools and returns the database name.
    param([Parameter(Mandatory = $true)][string]$Url)
    if ($Url -notmatch '^postgres(ql)?://([^:/@]+)(:([^@]*))?@([^:/@]+)(:(\d+))?/([^?\s]+)') {
        throw "Unparseable DATABASE_URL (expected postgres://user:pass@host:port/db)"
    }
    $env:PGUSER     = [uri]::UnescapeDataString($Matches[2])
    if ($Matches[4]) { $env:PGPASSWORD = [uri]::UnescapeDataString($Matches[4]) }
    $env:PGHOST     = $Matches[5]
    if ($Matches[7]) { $env:PGPORT = $Matches[7] } else { $env:PGPORT = '5432' }
    return $Matches[8]
}

function Invoke-DbBackup {
    # pg_dump -Fc of the database in $Url into $OutDir; prunes to newest 30 dumps.
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][string]$OutDir,
        [string]$Prefix = 'backup'
    )
    if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force $OutDir | Out-Null }
    $dbName = Set-PgEnvFromUrl $Url
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $file = Join-Path $OutDir "$Prefix-$dbName-$stamp.dump"
    & (Join-Path $script:PgBin 'pg_dump.exe') -Fc -d $dbName -f $file
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed (exit $LASTEXITCODE) for $dbName" }
    Get-ChildItem (Join-Path $OutDir '*.dump') |
        Sort-Object LastWriteTime -Descending |
        Select-Object -Skip 30 |
        Remove-Item -Force -Confirm:$false
    Write-Host "Backup written: $file"
    return $file
}
```

- [ ] **Step 2: Create the deploy script**

Create `scripts/deploy.ps1`:

```powershell
<#
Deploy the IMMS + MCS production stack at C:\imms\prod.

  deploy.ps1                  deploy latest origin/main (confirm prompt)
  deploy.ps1 -Yes             skip the confirm prompt
  deploy.ps1 -Ref deploy-20260701-0900   ROLLBACK to (or deploy) any ref/tag
  deploy.ps1 -BackupOnly      just take a pg_dump into C:\imms\backups
  deploy.ps1 -BackupOnly -EnvFile <path> backup using a specific .env's DATABASE_URL

Pipeline: preflight -> BACKUP (gate) -> checkout -> npm ci (changed roots only)
          -> migrate -> build -> pm2 reload -> health gate -> tag + push.
Any failure stops the script; prod processes keep running whatever was last
loaded until the pm2 reload step succeeds.
#>
param(
    [string]$Ref = 'origin/main',
    [switch]$Yes,
    [switch]$BackupOnly,
    [string]$EnvFile = ''
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\db-common.ps1')

$ProdRoot  = 'C:\imms\prod'
$BackupDir = 'C:\imms\backups'
$Pm2Bin    = 'C:\Users\Fiser\AppData\Roaming\npm\node_modules\pm2\bin\pm2'
$Roots     = @('backend', 'frontend', 'maintenance_call_system\backend', 'maintenance_call_system\frontend')

function Exec {
    param([string]$Command, [string]$Cwd = $ProdRoot)
    Write-Host ">> $Command" -ForegroundColor Cyan
    Push-Location $Cwd
    try {
        cmd /c $Command
        if ($LASTEXITCODE -ne 0) { throw "Command failed (exit $LASTEXITCODE): $Command" }
    } finally { Pop-Location }
}

function Wait-Healthy {
    param([string]$Url, [int]$TimeoutSec = 60)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($r.StatusCode -eq 200) { Write-Host "OK  $Url"; return }
        } catch { }
        Start-Sleep -Seconds 2
    }
    throw "Health check failed: $Url did not return 200 within $TimeoutSec s"
}

# ---- Backup (also the -BackupOnly path) -------------------------------------
if (-not $EnvFile) { $EnvFile = Join-Path $ProdRoot 'backend\.env' }
$dbUrl = Get-DatabaseUrl $EnvFile
$dump = Invoke-DbBackup -Url $dbUrl -OutDir $BackupDir -Prefix 'pre-deploy'
if ($BackupOnly) { Write-Host 'Backup-only run complete.'; exit 0 }

# ---- Preflight ---------------------------------------------------------------
if (-not (Test-Path (Join-Path $ProdRoot '.git'))) {
    throw "No production clone at $ProdRoot - run the cutover in docs/deployment/PROD_OPERATIONS.md first."
}
Exec 'git fetch origin --tags'
Write-Host "`nIncoming commits (HEAD..$Ref):" -ForegroundColor Yellow
Exec "git log --oneline HEAD..$Ref"
$prevTag = ''
Push-Location $ProdRoot
try { $prevTag = (& git tag --list 'deploy-*' | Sort-Object | Select-Object -Last 1) } finally { Pop-Location }
if (-not $Yes) {
    $answer = Read-Host "Deploy '$Ref' to production? Old code keeps running until the reload step. (y/N)"
    if ($answer -ne 'y') { Write-Host 'Aborted.'; exit 1 }
}

# ---- Checkout -----------------------------------------------------------------
Exec "git checkout --detach $Ref"

# ---- Install (only roots whose lockfile changed since the previous deploy) ----
foreach ($root in $Roots) {
    $needInstall = $true
    if ($prevTag) {
        $gitPath = $root -replace '\\', '/'
        Push-Location $ProdRoot
        try { $changed = (& git diff --name-only $prevTag HEAD -- "$gitPath/package-lock.json") } finally { Pop-Location }
        $needInstall = [bool]$changed
    }
    if ($needInstall) { Exec 'npm ci' (Join-Path $ProdRoot $root) }
    else { Write-Host "npm ci skipped (lockfile unchanged): $root" }
}

# ---- Migrate -------------------------------------------------------------------
# IMMS migrate is an idempotent no-op on an existing DB (applies db/schema.sql once).
Exec 'npm run migrate' (Join-Path $ProdRoot 'backend')
Exec 'npm run migrate' (Join-Path $ProdRoot 'maintenance_call_system\backend')

# ---- Build ---------------------------------------------------------------------
Exec 'npm run build' (Join-Path $ProdRoot 'maintenance_call_system\frontend')
Exec 'npm run build:localhost' (Join-Path $ProdRoot 'frontend')
Exec 'npm run build:network' (Join-Path $ProdRoot 'frontend')

# ---- Reload --------------------------------------------------------------------
Exec "node `"$Pm2Bin`" startOrReload ecosystem.prod.config.js"
Exec "node `"$Pm2Bin`" save"

# ---- Health gate ----------------------------------------------------------------
try {
    Wait-Healthy 'http://localhost:4000/health'
    Wait-Healthy 'http://localhost:4001/health'
    Wait-Healthy 'http://localhost:3001/'
    Wait-Healthy 'http://localhost:3002/'
    Wait-Healthy 'http://localhost:3003/board'
} catch {
    Write-Host "`nHEALTH GATE FAILED. Pre-deploy dump: $dump" -ForegroundColor Red
    if ($prevTag) {
        Write-Host "Roll back with:  powershell -File scripts\deploy.ps1 -Ref $prevTag -Yes" -ForegroundColor Red
    }
    throw
}

# ---- Tag ------------------------------------------------------------------------
$newTag = 'deploy-' + (Get-Date -Format 'yyyyMMdd-HHmm')
Exec "git tag $newTag HEAD"
Exec "git push origin $newTag"
Write-Host "`nDeployed and tagged $newTag. Previous: $(if ($prevTag) { $prevTag } else { '(first deploy)' })" -ForegroundColor Green
```

- [ ] **Step 3: Syntax-check both scripts**

Run (repo root, PowerShell):
```powershell
$errs = $null; [System.Management.Automation.Language.Parser]::ParseFile("$PWD\scripts\deploy.ps1", [ref]$null, [ref]$errs) | Out-Null; if ($errs.Count) { $errs } else { 'deploy.ps1 parses clean' }
$errs2 = $null; [System.Management.Automation.Language.Parser]::ParseFile("$PWD\scripts\lib\db-common.ps1", [ref]$null, [ref]$errs2) | Out-Null; if ($errs2.Count) { $errs2 } else { 'db-common.ps1 parses clean' }
```
Expected: both print `... parses clean`.

- [ ] **Step 4: Live-verify the backup path (safe read-only against prod DB)**

Run (repo root, PowerShell): `powershell -NoProfile -File scripts\deploy.ps1 -BackupOnly -EnvFile C:\Users\Fiser\fiservinventory_win\backend\.env`
Expected: `Backup written: C:\imms\backups\pre-deploy-fiservinventory-<stamp>.dump` then `Backup-only run complete.`; file exists and is > 100 KB. This proves the PG bin path, URL parsing, and credentials — and seeds the dump Task 5 restores from.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/db-common.ps1 scripts/deploy.ps1
git commit -m "feat(ops): backup-gated tagged deploy script with shared db lib"
```

---

### Task 5: `scripts/refresh-dev-db.ps1`

**Files:**
- Create: `scripts/refresh-dev-db.ps1`

**Interfaces:**
- Consumes: `scripts/lib/db-common.ps1` (Task 4); dumps in `C:\imms\backups` (Task 4 Step 4 created the first one).
- Produces: a rebuilt `fiservinventory_dev` database. The dev `.env` files point at it after cutover (runbook). Every run doubles as a restore drill (spec acceptance test 4).

- [ ] **Step 1: Create the script**

Create `scripts/refresh-dev-db.ps1`:

```powershell
<#
Rebuild the DEV database (fiservinventory_dev) from the newest production dump.

  refresh-dev-db.ps1            restore newest C:\imms\backups\*.dump
  refresh-dev-db.ps1 -Fresh     take a new prod dump first, then restore it

Never touches the production database (read-only pg_dump at most).
#>
param(
    [switch]$Fresh,
    [string]$EnvFile = 'C:\imms\prod\backend\.env'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\db-common.ps1')

$BackupDir = 'C:\imms\backups'
$DevDb = 'fiservinventory_dev'

# Before cutover the prod clone may not exist yet - fall back to the dev checkout's env.
if (-not (Test-Path $EnvFile)) {
    $EnvFile = Join-Path (Split-Path $PSScriptRoot -Parent) 'backend\.env'
    Write-Host "Prod clone env not found; using $EnvFile"
}

$dbUrl = Get-DatabaseUrl $EnvFile
$sourceDb = Set-PgEnvFromUrl $dbUrl   # sets PGHOST/PGPORT/PGUSER/PGPASSWORD
if ($sourceDb -eq $DevDb) { throw "Refusing: $EnvFile points DATABASE_URL at $DevDb itself." }

if ($Fresh) { Invoke-DbBackup -Url $dbUrl -OutDir $BackupDir -Prefix 'manual' | Out-Null }

$dump = Get-ChildItem (Join-Path $BackupDir '*.dump') -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime | Select-Object -Last 1
if (-not $dump) { throw "No dumps in $BackupDir - run scripts\deploy.ps1 -BackupOnly first (or use -Fresh)." }
Write-Host "Restoring $($dump.Name) -> $DevDb"

& (Join-Path $script:PgBin 'dropdb.exe') --if-exists --force $DevDb
if ($LASTEXITCODE -ne 0) { throw "dropdb failed (exit $LASTEXITCODE)" }
& (Join-Path $script:PgBin 'createdb.exe') $DevDb
if ($LASTEXITCODE -ne 0) { throw "createdb failed (exit $LASTEXITCODE)" }

# pg_restore exits 1 on ignorable warnings (extensions, ownership) - verify by query instead.
& (Join-Path $script:PgBin 'pg_restore.exe') --no-owner --no-privileges -d $DevDb $dump.FullName
$restoreCode = $LASTEXITCODE

$parts = & (Join-Path $script:PgBin 'psql.exe') -d $DevDb -tAc 'SELECT COUNT(*) FROM parts'
if ($LASTEXITCODE -ne 0 -or -not $parts) {
    throw "Restore verification failed (pg_restore exit $restoreCode; parts query failed)."
}
Write-Host "OK: $DevDb rebuilt from $($dump.Name) - parts rows: $($parts.Trim()) (pg_restore exit $restoreCode; nonzero = warnings only)" -ForegroundColor Green
```

- [ ] **Step 2: Syntax-check**

Run (repo root, PowerShell):
```powershell
$errs = $null; [System.Management.Automation.Language.Parser]::ParseFile("$PWD\scripts\refresh-dev-db.ps1", [ref]$null, [ref]$errs) | Out-Null; if ($errs.Count) { $errs } else { 'parses clean' }
```
Expected: `parses clean`.

- [ ] **Step 3: Run it for real (creates the dev DB — this is spec acceptance test 4)**

Run: `powershell -NoProfile -File scripts\refresh-dev-db.ps1`
Expected: falls back to the dev checkout's `.env` (prod clone doesn't exist yet), restores the Task 4 dump, prints `OK: fiservinventory_dev rebuilt from pre-deploy-... - parts rows: <n>` where `<n>` > 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/refresh-dev-db.ps1
git commit -m "feat(ops): dev-database refresh script (doubles as restore drill)"
```

---

### Task 6: `start-dev.bat`; retire `start-app.bat` and `start-mcs.bat`

**Files:**
- Create: `start-dev.bat`
- Delete: `start-app.bat`
- Delete: `maintenance_call_system/start-mcs.bat`

**Interfaces:**
- Consumes: `npm run start:dev` (Task 2), dev ports from Global Constraints. Port env vars set inline in the bat override `.env` values (dotenv never overrides existing env vars); `DATABASE_URL`/secrets still come from each app's `.env` — those flip to dev values at cutover.
- Produces: the only sanctioned way to run the stack in this folder. Referenced by CLAUDE.md (Task 7).

- [ ] **Step 1: Create `start-dev.bat`**

```bat
@echo off
title IMMS + MCS - DEV (ports 4100/4101/3100/3103)
echo Starting the DEV stack. This never touches production (C:\imms\prod, ports 4000/4001/3001/3002/3003).
echo.
echo NOTE: DATABASE_URL comes from each app's .env file. After cutover those point at
echo fiservinventory_dev. Before cutover they still point at the LIVE database - see
echo docs\deployment\PROD_OPERATIONS.md before relying on this script.
echo.

:: IMMS backend (dev) - PORT set inline overrides .env (dotenv does not override existing env)
start /min cmd /k "cd /d %~dp0backend && set PORT=4100&& npm run dev"

:: MCS backend (dev)
start /min cmd /k "cd /d %~dp0maintenance_call_system\backend && set PORT=4101&& set IMMS_API_URL=http://localhost:4100/api/v1&& npm run dev"

:: MCS frontend (dev) - NEXT_PUBLIC_* baked per-process for dev URLs
start /min cmd /k "cd /d %~dp0maintenance_call_system\frontend && set NEXT_PUBLIC_API_URL=http://localhost:4101/api/v1&& set NEXT_PUBLIC_SOCKET_URL=http://localhost:4101&& set NEXT_PUBLIC_IMMS_LOGIN_URL=http://localhost:3100/login&& npx next dev -p 3103"

:: IMMS frontend (dev)
start /min cmd /k "cd /d %~dp0frontend && npm run start:dev"

echo.
echo   IMMS API : http://localhost:4100/health
echo   MCS API  : http://localhost:4101/health
echo   IMMS UI  : http://localhost:3100
echo   MCS UI   : http://localhost:3103
echo.
echo This window can be closed; the four minimized windows keep running.
pause
```

- [ ] **Step 2: Delete the hazardous/superseded bats**

```bash
git rm start-app.bat maintenance_call_system/start-mcs.bat
```

- [ ] **Step 3: Check nothing in code references the deleted bats**

Run (Git Bash, repo root): `grep -rn "start-app.bat\|start-mcs.bat" --include="*.js" --include="*.ts" --include="*.json" . | grep -v node_modules | grep -v coverage`
Expected: no output. (Doc references get updated in Task 7; older docs under `docs/archive` may keep stale mentions.)

- [ ] **Step 4: Smoke-test the bat (brief, then kill)**

Run `start-dev.bat` from Explorer or cmd; wait ~20s; then in PowerShell:
`(Invoke-WebRequest -Uri http://localhost:4100/health -UseBasicParsing).StatusCode`
Expected: `200`. Note: pre-cutover this dev backend is reading the LIVE DB (same as today's status quo — acceptable for a smoke test).
Then close the four spawned windows (or `Stop-Process` on the node PIDs listening on 4100/4101/3103/3100 ONLY — verify each PID's port before killing; never touch 4000/4001/3001/3002/3003).

- [ ] **Step 5: Commit**

```bash
git add start-dev.bat
git commit -m "feat(ops): dev-only startup script; retire taskkill-all start-app.bat and start-mcs.bat"
```

---

### Task 7: Runbook + CLAUDE.md

**Files:**
- Create: `docs/deployment/PROD_OPERATIONS.md`
- Modify: `CLAUDE.md` (Quick Start + Network Configuration sections)

**Interfaces:**
- Consumes: every artifact from Tasks 1–6 (exact commands referenced by name).
- Produces: the cutover checklist executed later with the user; the routine deploy/rollback/restore procedures.

- [ ] **Step 1: Write the runbook**

Create `docs/deployment/PROD_OPERATIONS.md` with exactly these sections (full content below):

```markdown
# Production Operations Runbook

Production = `C:\imms\prod` under PM2. Dev = this repo folder, ports
4100/4101/3100/3103, database `fiservinventory_dev`. Floor URLs never change:
4000/4001/3001/3002/3003.

## Daily operations

| I want to… | Command (from `C:\imms\prod`) |
|---|---|
| Deploy latest main | `powershell -File scripts\deploy.ps1` |
| Roll back | `powershell -File scripts\deploy.ps1 -Ref <previous deploy-* tag> -Yes` |
| Ad-hoc DB backup | `powershell -File scripts\deploy.ps1 -BackupOnly` |
| Tail logs | `node <pm2> logs imms-api` (apps: imms-api, mcs-api, mcs-web, imms-web-local, imms-web-network) |
| Process status | `node <pm2> status` |
| Refresh dev DB | `powershell -File scripts\refresh-dev-db.ps1` (add `-Fresh` for a new dump first) |

`<pm2>` = `C:\Users\Fiser\AppData\Roaming\npm\node_modules\pm2\bin\pm2`

## One-time cutover (quiet window, ~30 min)

1. `git clone https://github.com/oakley-ops/IMMS_WIN.git C:\imms\prod` and
   `cd C:\imms\prod`, then `git checkout main` (after this branch merges).
2. Copy the four env files from the dev folder into the same relative paths in
   `C:\imms\prod`: `backend\.env`, `frontend\.env`, 
   `maintenance_call_system\backend\.env`,
   `maintenance_call_system\frontend\.env`.
   Re-save each as **UTF-8** (`frontend\.env` is UTF-16 today; PS 5.1's
   `Out-File` default is UTF-16 — use an editor or `-Encoding utf8`).
3. `npm ci` in all four package roots (backend, frontend,
   maintenance_call_system\backend, maintenance_call_system\frontend).
4. Builds: `npm run build` (mcs frontend), `npm run build:localhost` and
   `npm run build:network` (frontend).
5. First backup: `powershell -File scripts\deploy.ps1 -BackupOnly` (from
   C:\imms\prod; uses the prod clone's backend\.env now).
6. MCS migration baseline (records already-applied SQL without executing):
   `npm run migrate:baseline` from `C:\imms\prod\maintenance_call_system\backend`.
7. Stop the five old processes BY PID (never `taskkill /IM node.exe`):
   `Get-NetTCPConnection -LocalPort 4000,4001,3001,3002,3003 -State Listen | Select LocalPort,OwningProcess`
   then `Stop-Process -Id <pid> -Force` for each.
8. Start production: from `C:\imms\prod`:
   `node <pm2> startOrReload ecosystem.prod.config.js` then `node <pm2> save`.
9. Health: 200s from :4000/health, :4001/health, :3001/, :3002/, :3003/board.
10. Boot persistence (run once, elevated):
    `schtasks /Create /TN "IMMS Prod Resurrect" /SC ONSTART /RU <windows-user> /RP /TR "\"C:\Program Files\nodejs\node.exe\" \"C:\Users\Fiser\AppData\Roaming\npm\node_modules\pm2\bin\pm2\" resurrect"`
    (must be the same user account that ran `pm2 save`).
11. Convert the dev folder:
    - `backend\.env`: `PORT=4100`, `DATABASE_URL=...\/fiservinventory_dev`,
      `CORS_ORIGIN` add `http://localhost:3100`, NEW dev-only `JWT_SECRET`.
    - `maintenance_call_system\backend\.env`: `PORT=4101`, dev DATABASE_URL,
      `CORS_ORIGIN=http://localhost:3103`, same dev `JWT_SECRET`,
      `IMMS_API_URL=http://localhost:4100/api/v1`.
    - (MCS/IMMS frontend dev URLs are injected by `start-dev.bat`; .env edits
      are only needed for the two backends.)
    - Refresh dev data: `powershell -File scripts\refresh-dev-db.ps1`.
12. Acceptance tests:
    - Edit any dev frontend file → :3003/:3002/:3001 pages provably unchanged.
    - Reboot the PC → all five PM2 apps return (`node <pm2> status`).
    - Deploy a trivial commit; roll back to the prior deploy tag.
13. Cutover rollback (if PM2 misbehaves): stop PM2 apps
    (`node <pm2> delete all`) and relaunch the old way from the dev folder:
    backend `set PORT=4000&& set HOST=0.0.0.0&& npm start`, MCS backend
    `npm start`, MCS frontend `npm run dev`, frontend
    `npm run start:localhost-3002` and `npm run start:network-pi`.

## Restore production from a dump (last resort)

1. Stop the two APIs: `node <pm2> stop imms-api mcs-api`.
2. From `C:\Program Files\PostgreSQL\17\bin` (credentials from backend\.env):
   `pg_restore --clean --if-exists --no-owner -d fiservinventory <dump>`.
3. `node <pm2> start imms-api mcs-api`; verify health endpoints.

## Troubleshooting

- **imms-api crash-loops with an SSL/connection error** → something set
  `NODE_ENV=production` for it; `backend/db.js` forces SSL then. Remove the
  override (see comment in ecosystem.prod.config.js).
- **Half-styled page right after a deploy** → hard-refresh; builds swap in
  place during the deploy window.
- **`pm2 resurrect` did nothing after reboot** → Task Scheduler job must run
  as the same user that ran `pm2 save`; check `schtasks /Query /TN "IMMS Prod Resurrect"`.
- **Env file edits ignored** → check encoding; save as UTF-8 (PS 5.1 writes
  UTF-16 by default).
```

- [ ] **Step 2: Update CLAUDE.md**

Replace the Quick Start block:

```markdown
### Quick Start (Windows)
```bash
.\start-app.bat    # Starts backend:4000, frontend-localhost:3002, frontend-network:3001
```
```

with:

```markdown
### Quick Start (Windows)
```bash
.\start-dev.bat    # DEV stack only: IMMS API :4100, MCS API :4101, IMMS UI :3100, MCS UI :3103
```

**Production** runs separately from `C:\imms\prod` under PM2 (ports 4000/4001/3001/3002/3003 — the floor-facing URLs). Never edit or run servers there directly; deploy with `powershell -File scripts\deploy.ps1` and see `docs/deployment/PROD_OPERATIONS.md` for cutover/rollback/restore. Dev uses the `fiservinventory_dev` database (refresh via `scripts/refresh-dev-db.ps1`).
```

And in the **Network Configuration** section, replace:

```markdown
Multi-device setup:
- `localhost:3002` - PC with camera
- `10.1.10.50:3001` - Raspberry Pi ethernet
- Backend binds to `0.0.0.0:4000`
```

with:

```markdown
Multi-device setup (production, served from C:\imms\prod):
- `localhost:3002` - PC with camera
- `10.1.10.50:3001` - Raspberry Pi ethernet
- Backend binds to `0.0.0.0:4000`
Dev ports (this folder): 4100/4101/3100/3103 — invisible to floor devices.
```

- [ ] **Step 3: Commit**

```bash
git add docs/deployment/PROD_OPERATIONS.md CLAUDE.md
git commit -m "docs(ops): production runbook and CLAUDE.md dev/prod split"
```

---

### Task 8: Final verification + PR

- [ ] **Step 1: Run both backend test suites**

Run: `npx vitest run` in `maintenance_call_system/backend` (expect 91 passing) and `npx jest --silent` in `backend` (expect the same 78/84 as main — the 6 failures are pre-existing DB/Selenium setup issues).

- [ ] **Step 2: Re-verify no stray references**

Run (Git Bash, repo root): `grep -rn "ecosystem.config.js" --include="*.js" --include="*.md" --include="*.bat" . | grep -v node_modules | grep -v coverage | grep -v archive | grep -v "ecosystem.prod"`
Expected: no hits outside `docs/superpowers/` history docs. Fix any live references found.

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin feat/prod-dev-separation
gh pr create --title "feat(ops): prod/dev separation - PM2 prod clone, tagged deploys, dev DB" --body "<summary per repo convention>"
```

- [ ] **Step 4: Schedule cutover**

The runbook's cutover section executes ONLY in a quiet window agreed with the user — it stops the five live processes. Nothing before this step touches them.

---

## Self-Review (completed at write time)

- **Spec coverage:** clone+PM2+five apps (T3), deploy pipeline with backup gate/lockfile-aware installs/migrations/builds/health gate/tags (T4), MCS tracked migrations + baseline (T1), build variants (T2), dev DB + refresh drill (T5), dev ports + bat retirement (T6), boot persistence + cutover + acceptance tests (T7 runbook), CLAUDE.md (T7). Spec's plan-level verifications all resolved: react-scripts 5.0.1 ✓, PG bin path ✓, PM2 via node bin ✓, next build ordering ✓, IMMS migrate verified idempotent-no-op (documented in T4).
- **Deviation from spec (documented):** ecosystem sets `NODE_ENV=production` only for `mcs-api`/`mcs-web`, not `imms-api` — `backend/db.js` forces SSL under production and local PG has no SSL. Recorded in Global Constraints, config comment, and runbook troubleshooting.
- **Placeholder scan:** every code/script step contains complete content; no TBDs.
- **Type consistency:** `runMigrations(db, { dir, baseline })` consistent between T1 test/impl/CLI; PM2 app names consistent T3/T4/T7; tag format `deploy-yyyyMMdd-HHmm` consistent T4/T7; lib function names consistent T4/T5.
```
