# Production / Development Separation — Design

**Date:** 2026-07-03
**Status:** Approved (all four sections) — ready for implementation planning
**Owner:** Isaac Rodriguez

## Why

Production currently runs from the development working copy
(`C:\Users\Fiser\fiservinventory_win`), started by `start-app.bat`. The two
backends run as plain `node` (frozen at whatever code was on disk at launch),
but all three frontends run as **dev servers that hot-reload from disk**.

On 2026-07-03 this bit us: backends launched 2026-06-23 were serving
pre-PR-#17 code from memory while the hot-reloading frontends picked up
PR #17's changes from the checked-out feature branch — a live API-shape
mismatch on the "resolve call with parts" flow that could strand technicians
on a stuck dialog. It was resolved by restarting the backends, but the class
of failure remains: **editing code in this folder can reach the factory floor
without anyone deciding to deploy.**

`start-app.bat` also begins with `taskkill /F /IM node.exe`, which kills every
Node process on the machine — including production, PM2, and anything else.

One layer down, the same problem exists for data: dev tests, migrations, and
scripts point at the **live database** (`fiservinventory`).

## Goals

1. Nothing edited in the dev folder can affect what the floor sees, ever.
2. Deploys are deliberate, one command, reversible, and backup-gated.
3. Dev work (including tests and migrations) cannot touch live data.
4. Production survives a PC reboot without manual steps.
5. Floor-facing URLs/ports do not change — no Pi, kiosk, or wallboard
   reconfiguration.

**Non-goals (out of scope):** Docker/containers (that is the later Path A
customer-provisioning shape; this deploy script becomes its template),
nginx/reverse proxy, HTTPS, CI-triggered auto-deploy, product rebrand.

## Decisions made

| Question | Decision |
|---|---|
| Overall shape | **Approach A** — dedicated prod git clone + PM2, native (no Docker) |
| Dev database | **Separate `fiservinventory_dev`** on the same Postgres server, refreshed on demand from prod backups |
| Deploy unit | **Latest `main` + auto-tag** (`deploy-YYYYMMDD-HHmm`); rollback = redeploy previous tag via `-Ref` |

## 1. Architecture & layout

```
C:\imms\prod             ← new full git clone (origin = GitHub); ONLY thing serving the floor
C:\imms\backups\         ← pg_dump output, outside both checkouts (keep last 30)
C:\Users\Fiser\fiservinventory_win   ← existing folder, becomes dev-only
```

Production = five PM2 apps in a new repo-root **`ecosystem.prod.config.js`**
(supersedes `maintenance_call_system/ecosystem.config.js` and the prod role of
`start-mcs.bat` / `start-app.bat`):

| PM2 app | Runs | Port | Notes |
|---|---|---|---|
| `imms-api` | `node index.js` in `backend/` | 4000 | `NODE_ENV=production`, `HOST=0.0.0.0` |
| `mcs-api` | `node index.js` in `maintenance_call_system/backend/` | 4001 | `NODE_ENV=production` |
| `mcs-web` | `next start` on a production build | 3003 | no dev server in prod |
| `imms-web-local` | PM2 built-in static serve, `--spa` | 3002 | CRA build baked with localhost API URL (camera/secure-context host) |
| `imms-web-network` | PM2 built-in static serve, `--spa` | 3001 | CRA build baked with `http://10.1.10.50:4000` API URL (Pi/network) |

- CRA bakes env at build time → two build variants, `build:localhost` and
  `build:network`, emitted to separate output dirs via `BUILD_PATH`, mirroring
  the env each existing `start:localhost-3002` / `start:network-pi` script sets.
- PM2 static serving uses its built-in `serve` (`PM2_SERVE_PATH`,
  `PM2_SERVE_PORT`, `PM2_SERVE_SPA`) — no new dependencies.
- Prod keeps its own `.env` files (created once at cutover from today's live
  values; deploys never modify them). `IMMS_API_URL` stays default
  (`http://localhost:4000/api/v1`) since both backends share the box.

## 2. Deploy & rollback — `scripts/deploy.ps1`

Run from `C:\imms\prod`, PowerShell 5.1-compatible, `$ErrorActionPreference =
'Stop'`; any failure halts with printed recovery steps.

1. **Preflight** — verify cwd is the prod clone; `git fetch origin`; list
   incoming commits (`git log HEAD..origin/main --oneline`); confirm prompt
   (`-Yes` to skip).
2. **Backup gate** — `pg_dump -Fc` of the live DB →
   `C:\imms\backups\pre-deploy-<timestamp>.dump`. Backup failure aborts the
   deploy. Prune to the newest 30 dumps.
3. **Checkout** — `git checkout --detach <ref>`; `<ref>` defaults to
   `origin/main`, overridable with `-Ref <tag|sha>` (this is also the
   rollback mechanism).
4. **Install** — `npm ci` per package root (`backend`, `frontend`,
   `maintenance_call_system/backend`, `maintenance_call_system/frontend`)
   **only if** that root's `package-lock.json` changed between the previous
   deploy tag and the new ref (first deploy: all four).
5. **Migrate** —
   - IMMS: `npm run migrate` (existing).
   - MCS: **new** `maintenance_call_system/backend/scripts/migrate.js` —
     applies `migrations/*.sql` in filename order, records each in a
     `mcs_schema_migrations` (filename PK, applied_at) table, each file in a
     transaction. Replaces the manual-`psql` process flagged in the
     integration audit.
6. **Build** — `next build` (MCS) + both CRA builds.
7. **Reload** — `pm2 startOrReload ecosystem.prod.config.js` then `pm2 save`.
8. **Health gate** — poll until 200: `:4000/health`, `:4001/health`, and one
   page each from `:3001`, `:3002`, `:3003` (timeout ~60s). On failure, print
   the exact rollback command (`deploy.ps1 -Ref <previous deploy tag>`).
9. **Tag** — create and push `deploy-YYYYMMDD-HHmm` on the deployed commit.

**Rollback:** `deploy.ps1 -Ref deploy-<previous>` restores code; the step-2
dump covers data if a migration misbehaved (restore documented in the runbook).

**Accepted tradeoff:** installs/builds mutate the prod folder while old
processes still run (~1–2 min window where a hard refresh could catch a
half-built static page). Deploys are manual and run at quiet moments; the
confirm prompt states this.

## 3. Dev-side changes (existing folder)

- **Database:** new `fiservinventory_dev` on the same Postgres server.
  **New `scripts/refresh-dev-db.ps1`**: locate newest dump in
  `C:\imms\backups` (optional `-Fresh` flag takes a new dump first), then
  `dropdb --if-exists` / `createdb` / `pg_restore --no-owner` into the dev DB.
  Every refresh doubles as a live restore drill.
- **Ports (dev):** IMMS API **4100**, MCS API **4101**, IMMS CRA dev **3100**,
  MCS Next dev **3103**. Dev and prod run simultaneously without collisions;
  floor devices know nothing about dev ports.
- **Dev env updates** (each app's dev `.env` / scripts):
  - IMMS backend: `PORT=4100`, DB → `fiservinventory_dev`, `CORS_ORIGIN`
    includes `http://localhost:3100`.
  - MCS backend: `PORT=4101`, DB → `fiservinventory_dev`, `CORS_ORIGIN`
    `http://localhost:3103`, `IMMS_API_URL=http://localhost:4100/api/v1`.
  - MCS frontend dev: `NEXT_PUBLIC_API_URL=http://localhost:4101/api/v1`,
    `NEXT_PUBLIC_SOCKET_URL=http://localhost:4101`,
    `NEXT_PUBLIC_IMMS_LOGIN_URL=http://localhost:3100/login`.
  - IMMS frontend dev: API URL → `http://localhost:4100`,
    `REACT_APP_RETURN_TO_ALLOWLIST` → `http://localhost:3103`.
  - **Distinct dev `JWT_SECRET`** (shared by both dev apps) so dev tokens can
    never authenticate against prod.
- **`start-app.bat` retired.** Replaced by **`start-dev.bat`**: starts only
  the dev-port processes (nodemon/dev servers welcome here), and **never
  kills processes it didn't start** (no `taskkill /F /IM node.exe`).
  `start-mcs.bat` is retired at cutover (its job moves to PM2/prod).

## 4. Boot persistence, cutover, acceptance

**Reboot survival:** `pm2 save` after every deploy + a Task Scheduler job
("IMMS Prod", run at system startup as the same user account that owns
`PM2_HOME`, whether or not logged on) executing `pm2 resurrect` via the
node-invokes-pm2-bin pattern already proven in `start-mcs.bat`. Postgres is
already a Windows service.

**One-time cutover (quiet window, ~30 min):**
1. Clone repo → `C:\imms\prod`; create prod `.env` files from live values.
2. `npm ci` ×4, builds ×3, create `C:\imms\backups`, take first dump.
3. Stop the five current processes **by PID** (targeted — not taskkill-all).
4. `pm2 startOrReload ecosystem.prod.config.js` → health checks → `pm2 save`
   → register the Task Scheduler job.
5. Convert the old folder to dev: create/refresh dev DB, apply dev envs,
   add `start-dev.bat`.
6. Cutover rollback: relaunch the old-style processes from the dev folder
   (commands preserved in the runbook).

**Acceptance tests:**
1. **The regression that started this:** edit any frontend file in the dev
   folder → live board/kiosk (`:3003`, `:3001`, `:3002`) provably unchanged.
2. Reboot the PC once → all five services return without manual action.
3. Deploy a trivial commit end-to-end, then roll back to the prior tag.
4. Run `refresh-dev-db.ps1` end-to-end (proves backup + restore both work).

## Risks / plan-level verifications

- `react-scripts` must support `BUILD_PATH` (v4+ does — verify installed
  version and mirror the exact envs used by the existing start scripts).
- Postgres CLI tools (`pg_dump`, `pg_restore`, `dropdb`, `createdb`) path on
  this machine — hardcode the Postgres `bin` dir in scripts if not on PATH.
- PM2-on-Windows quirks — always invoke via `node <pm2 bin>` (pattern already
  in `start-mcs.bat`); confirm `pm2 startOrReload` behavior with the static
  `serve` apps.
- `next start` requires `.next` from `next build` at the deployed commit —
  build step ordering already guarantees this.
- IMMS `npm run migrate` behavior/idempotency — verify what it actually runs
  before wiring it into the deploy script.
