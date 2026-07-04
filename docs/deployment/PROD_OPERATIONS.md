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
| Stop the dev stack | Close the four start-dev.bat windows (see Troubleshooting: nodemon residue) |

`<pm2>` = `C:\Users\Fiser\AppData\Roaming\npm\node_modules\pm2\bin\pm2`

## Post-cutover state (completed 2026-07-04)

Production is live at `C:\imms\prod` under PM2 (imms-api, mcs-api, mcs-web,
imms-web-local, imms-web-network — all online). The dev folder
(`C:\Users\Fiser\fiservinventory_win`) is isolated: dev ports
4100/4101/3100/3103, database `fiservinventory_dev`, its own JWT secret. The
`IMMS Prod Resurrect` scheduled task is registered (runs `pm2 resurrect` at
Fiser logon).

Known follow-ups (not blockers; deploys of non-frontend-dep changes work today):
- **Frontend `npm ci` fails on `@esbuild/*` platform packages** in the
  committed lockfile (see Troubleshooting). `deploy.ps1` skips the frontend
  install when `frontend/package-lock.json` is unchanged (the `.installed-ref`
  marker was seeded to the deployed commit at cutover), so normal deploys are
  fine. A deploy that changes frontend deps needs the lockfile fixed first.
- Reboot-recovery (resurrect) is configured but not yet validated by an
  actual reboot — confirm at the next planned restart.
- The full deploy→rollback acceptance test was deferred (causes a reload
  blip); run it at a convenient moment to exercise the pipeline end-to-end.
- `frontend/.env` is tracked (holds only default values); untrack later.

## One-time cutover (quiet window, ~30 min)

1. `git clone https://github.com/oakley-ops/IMMS_WIN.git C:\imms\prod` and
   `cd C:\imms\prod`, then `git checkout main` (after this branch merges).
2. Copy the four env files from the dev folder into the same relative paths in
   `C:\imms\prod`: `backend\.env`, `frontend\.env`, 
   `maintenance_call_system\backend\.env`,
   `maintenance_call_system\frontend\.env`.
   Re-save each as **UTF-8** (`frontend\.env` is UTF-16 today; PS 5.1's
   `Out-File` default is UTF-16 — use an editor or `-Encoding utf8`).
   Note: `frontend\.env` has been UTF-16 and therefore inert (CRA never
   parsed it); re-saving as UTF-8 makes its values live in prod builds —
   confirm they match intent first (today they equal the code defaults).
3. `npm ci` in all four package roots (backend, frontend,
   maintenance_call_system\backend, maintenance_call_system\frontend).
4. Builds: `npm run build` (mcs frontend), `npm run build:localhost` and
   `npm run build:network` (frontend).
5. First backup: `powershell -File scripts\deploy.ps1 -BackupOnly` (from
   C:\imms\prod; uses the prod clone's backend\.env now).
6. MCS migration baseline (records already-applied SQL without executing):
   `npm run migrate:baseline` from `C:\imms\prod\maintenance_call_system\backend`.
   Also baseline IMMS migrations so the first deploy's migrate step is a
   no-op: with PG env set (see Restore section), run
   `psql -d fiservinventory -c "CREATE TABLE IF NOT EXISTS migrations (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"`
   then
   `psql -d fiservinventory -c "INSERT INTO migrations (name) SELECT 'initial_schema' WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE name = 'initial_schema');"`
7. Stop the five old processes BY PID (never `taskkill /IM node.exe`):
   `Get-NetTCPConnection -LocalPort 4000,4001,3001,3002,3003 -State Listen | Select LocalPort,OwningProcess`
   then `Stop-Process -Id <pid> -Force` for each.
8. Start production: from `C:\imms\prod`: first clean stale PM2 registrations from earlier testing: `node <pm2> delete all` (safe here — PM2 manages nothing legitimate before this moment; NEVER run this once the stack is live in Daily Operations — step 13's cutover rollback is the one sanctioned exception while still inside this cutover window). Then `node <pm2> startOrReload ecosystem.prod.config.js` and `node <pm2> save`. One-time check: `node <pm2> env 0` (or `node <pm2> env imms-api`) — confirm imms-api's environment does NOT contain `NODE_ENV=production` (see the SSL note in ecosystem.prod.config.js).
9. Health: 200s from :4000/health, :4001/health, :3001/, :3002/, :3003/board.
10. Boot persistence (run once, elevated):
    `schtasks /Create /TN "IMMS Prod Resurrect" /SC ONSTART /RU <windows-user> /RP /TR "\"C:\Program Files\nodejs\node.exe\" \"C:\Users\Fiser\AppData\Roaming\npm\node_modules\pm2\bin\pm2\" resurrect"`
    (must be the same user account that ran `pm2 save`).
11. Convert the dev folder:
    - `backend\.env`: `PORT=4100`, `DATABASE_URL=...\/fiservinventory_dev`,
      `CORS_ORIGINS` add `http://localhost:3100` (comma-separated; note IMMS
      uses the plural name — MCS uses singular `CORS_ORIGIN`), NEW dev-only
      `JWT_SECRET`.
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
   Set connection env vars first (values from the prod clone's `backend\.env` `DATABASE_URL`): in PowerShell, `$env:PGHOST='localhost'; $env:PGPORT='5432'; $env:PGUSER='<user>'; $env:PGPASSWORD='<password>'` — or dot-source `C:\imms\prod\scripts\lib\db-common.ps1` and call `Set-PgEnvFromUrl (Get-DatabaseUrl 'C:\imms\prod\backend\.env')`.
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
- **White screen on :3001/:3002 with 403 on `/static/*` assets** → was caused
  by PM2's built-in `serve` (Windows backslash-vs-`/` root check 403s nested
  paths). Fixed 2026-07-04 by serving the CRA builds with
  `scripts/static-serve.js` (see ecosystem.prod.config.js). If it recurs,
  confirm the two web apps point at `static-serve.js`, not `script: 'serve'`.
  NOTE: a static-serve health check must fetch a real hashed asset
  (`/static/js/main.<hash>.js`) — a plain `GET /` returns 200 via SPA
  fallback even when every asset is 403, which is why the cutover health gate
  (which only checks `/`) did not catch this. Consider strengthening the
  deploy.ps1 gate to fetch index.html and probe one referenced asset.
- **Stray idle `nodemon` processes after stopping the dev stack** → killing a dev backend's listening PID leaves nodemon's parent supervisor resident (idle, no port). Prefer closing the four `start-dev.bat` windows; if killing by port, also check for residual `node ... nodemon.js` processes (identify by command line, never `taskkill /IM`).
- **`npm ci` fails with EPERM/EBUSY on backend during a deploy** → a running API holds native modules (bcrypt/sharp) locked. deploy.ps1 stops the affected API before backend installs; if hit anyway: `node <pm2> stop imms-api`, re-run the same deploy command — the reload step restarts it. A failed deploy may leave the stopped API down — re-running the deploy restarts it via the reload step.
- **`npm ci` fails in `frontend` with `notsup ... @esbuild/*` platform error** → the committed `frontend/package-lock.json` records esbuild platform packages in a form `npm ci` won't skip. `deploy.ps1` avoids this by skipping the frontend install when the lockfile is unchanged (the `.installed-ref` marker). If a deploy legitimately changes frontend deps and hits this: in `C:\imms\prod\frontend` run `npm install --no-audit --no-fund` (lenient; reproduces the running tree), `git checkout -- package-lock.json` to keep the tree clean, then re-run the deploy (it will skip the now-satisfied frontend install). Permanent fix: regenerate a `ci`-clean lockfile and commit it (test the build + app afterward — deliberate change, not a mid-deploy one). `frontend/.npmrc` already sets `legacy-peer-deps=true` for the MUI peer conflict.
