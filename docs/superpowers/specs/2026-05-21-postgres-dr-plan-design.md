# Postgres Disaster Recovery Plan — Design Notes (Deferred)

**Status:** Draft / deferred. Brainstorming paused on 2026-05-21 before finalizing a standby strategy. Pick this up later by resuming Question 1 (Pi storage) below.

**Owner:** Isaac Rodriguez
**Scope:** IMMS Postgres database (`fiservinventory`) running on the Windows PC. Goal is to keep the application available if the database fails, not just recoverable from a backup.

---

## 1. Problem Statement

Backups exist and are healthy, but if Postgres fails the application is fully down until someone manually restores from a `pg_dump`. That means:

- **RTO** today: hours (humans must notice, stop the app, drop the DB, run `pg_restore`, restart).
- **RPO** today: up to 24 h (nightly dump). A day of transactions, work orders, and PO state can be lost.
- **SPOF**: the Windows PC is the only Postgres host. Disk, power supply, or OS failure takes the whole system down.

We want a DR plan that reduces RTO and RPO without requiring cloud spend or new hardware purchases (initially).

---

## 2. Current State (verified 2026-05-21)

### Database
- Single Postgres instance at `localhost:5432`, database `fiservinventory`, user `postgres`.
- Hosted on the Windows PC that also runs the Node backend and serves the frontend.
- Pi (`10.1.10.50`) is on the same LAN as a client only — it does not run Postgres today.

### Backend DB layer
- Single `pg` Pool in `backend/db.js` with `max=20`, `idleTimeoutMillis=30000`, `connectionTimeoutMillis=2000`.
- `executeWithRetry` retries transient connection errors (SQLSTATE `08*` / `57*`) with exponential backoff.
- Exports: `pool`, `query`, `getClient`, `getClientWithTimeout`, `executeWithRetry`, `executeTransaction`, `checkDatabaseHealth`.
- ~20 consumers across `backend/src/`, `backend/scripts/`, `backend/utils/`, `backend/config/`, and `backend/migrations/` all resolve to this one module.
- **Resolved 2026-05-21 (commit `a19e0073`):** previously three independent db modules existed (`backend/db.js`, `backend/db/index.js`, `backend/src/database/db.js`), each opening its own pool. Consolidated to a single pool so there is one place to repoint at the standby during failover.

### Backup tooling (already in place — do not rebuild)
- `backend/scripts/backup-database.ps1` — nightly `pg_dump` (custom + plain SQL), gzip, integrity verify via `pg_restore --list`, 30-day retention, USB sync, logs to `C:\DatabaseBackups\backup.log`.
- `backend/scripts/backup-health-check.ps1`, `backup-alert-system.ps1`, `cloud-sync-backup.ps1`, `usb-backup-sync.ps1` — health, alerting, off-site copy.
- `backend/scripts/disaster-recovery.ps1` — 5 scenarios (`DatabaseCorruption`, `SystemFailure`, `DataLoss`, `PointInTimeRecovery`, `FullSystemRestore`).
  - **Caveat:** the "PITR" scenario does not do real point-in-time recovery — it just selects the dump closest to a target timestamp. There is no WAL archiving today, so true PITR is not possible.
- `backend/scripts/backup-control-panel.bat` — interactive menu wrapping all of the above.

---

## 3. Direction Chosen (so far)

**Raspberry Pi as a warm standby on the LAN.** Cheap, already powered on, fine for read-only failover or last-resort write failover. Does not protect against a site-wide outage (no off-site copy of live state), but that is acceptable for v1.

### What this approach gives us (target)
- **RPO:** seconds to a minute (streaming replication or frequent WAL ship).
- **RTO:** minutes (promote standby + repoint app), eventually automatable.
- **No new hardware** if the Pi has suitable storage.

### What it does not give us
- Off-site protection (still rely on existing cloud-sync of dumps for that).
- Survival of the Windows PC dying entirely — the Node app itself also runs there. Either the Pi must also be able to run the backend, or this DR plan is scoped to "DB failure with app host intact" (corruption, Postgres crash, DB disk failure). Decide this before implementation.

---

## 4. Open Questions (pick up here)

These were the next questions in the brainstorming flow. Answer them before designing the implementation.

1. **Pi storage** *(blocking — most important)*
   SD cards wear out under Postgres WAL/checkpoint writes and can corrupt silently. Need to know what the Pi boots/stores on:
   - SD card only → must add a USB SSD before this is safe.
   - USB SSD / external drive already attached → good.
   - NVMe hat / M.2 SSD (Pi 5) → ideal.

2. **Pi model and RAM** (Pi 3 / 4 / 5; 2 / 4 / 8 GB). Determines whether it can keep up with streaming replication for current write volume.

3. **Postgres version on PC.** Standby must run the *same major version*. Confirm what is installed (`psql --version`) so we install a matching build on the Pi.

4. **Failure modes in scope.** Just DB failures, or PC-dies-entirely?
   - DB-only: simpler — app on PC repoints to Pi's Postgres after promotion.
   - PC-dies: need backend deployable on the Pi too, plus a way for clients to find the new host (DNS, static IP swap, or a small reverse proxy).

5. **Acceptable RTO / RPO** in concrete numbers. Drives whether we need automatic failover (e.g., Patroni / pg_auto_failover) or a documented manual runbook is sufficient.

6. **Failover trigger.** Manual (someone runs a script) vs. automatic (a watcher promotes the standby). Manual is dramatically simpler and is probably the right v1.

---

## 5. Likely Architecture (sketch — not finalized)

Subject to the open questions above.

```
                 ┌────────────────────────┐         streaming replication
                 │  Windows PC (primary)  │ ───────────────────────────────►  ┌───────────────────────┐
                 │  - Node backend        │       (WAL over TCP, port 5432)    │  Raspberry Pi (warm)  │
                 │  - Postgres primary    │                                    │  - Postgres standby   │
                 └───────────┬────────────┘                                    │    (hot_standby=on)   │
                             │                                                 └──────────┬────────────┘
                             │                                                            │
                             │       failover (manual v1):                                │
                             │       1. confirm primary is really down                    │
                             │       2. promote standby (`pg_ctl promote`)                │
                             │       3. flip app DATABASE_URL to Pi                       │
                             │       4. restart backend                                   │
                             ▼                                                            ▼
                   App connects to                                            App connects to
                   primary normally                                           promoted Pi after failover
```

Backups (`pg_dump`, USB, cloud sync) continue to run on the primary unchanged — they are independent of replication and remain our last line of defense.

---

## 6. Implementation Phases (proposed order)

Each phase is independently shippable. Do not start a phase until its prerequisites are confirmed.

**Phase 0 — Prep (no DB changes)**
- Confirm Pi hardware (Question 1 + 2).
- Confirm Postgres version on PC; install same major version on Pi.
- ~~Consolidate the three duplicate `db.js` modules in the backend into one.~~ **Done 2026-05-21 (commit `a19e0073`).**
- Make `DATABASE_URL` the single source of truth for connection target (so failover is one env var change). *(Partly done: the consolidated `backend/db.js` already reads `process.env.DATABASE_URL`. Still need to audit `backend/config/database.js` and `.env` files to ensure no code path constructs a connection string from separate `DB_HOST`/`DB_USER`/etc. vars.)*

**Phase 1 — WAL archiving on primary (improves RPO immediately, no standby needed yet)**
- Enable `archive_mode=on` + `archive_command` writing WALs to `C:\DatabaseBackups\wal\` (and into USB / cloud sync).
- Replace the fake "PITR" branch in `disaster-recovery.ps1` with a real PITR using `recovery_target_time` + archived WALs.
- This alone takes RPO from ~24 h to ~minutes even before the Pi exists.

**Phase 2 — Streaming replication to Pi**
- Configure primary: `wal_level=replica`, `max_wal_senders`, replication user, `pg_hba.conf` entry for the Pi.
- `pg_basebackup` to seed the Pi.
- Pi runs with `primary_conninfo` + `hot_standby=on` (read-only queryable standby, optional but useful).
- Monitor replication lag with a check in `backup-health-check.ps1`.

**Phase 3 — Documented manual failover runbook**
- One markdown page: "Postgres is down — here is what to do." Steps for confirm-it-is-actually-down, promote, repoint app, verify, communicate.
- Script the promote + env-var swap + backend restart into a single `failover-to-pi.ps1`.
- Drill it quarterly.

**Phase 4 (optional, later) — Automated failover**
- Only if RTO requirements demand it. Adds significant operational complexity (split-brain risk, witness/quorum).
- Tools: `pg_auto_failover` or Patroni. Probably not worth it for this system.

---

## 7. References

- Existing scripts: `backend/scripts/backup-database.ps1`, `backend/scripts/disaster-recovery.ps1`, `backend/scripts/backup-control-panel.bat`.
- Single consolidated backend DB module: `backend/db.js`.
- Postgres docs (when implementing): "Continuous Archiving and Point-in-Time Recovery", "Streaming Replication", "Hot Standby".

---

## 8. Resume Instructions

When picking this up:

1. Re-read this file.
2. Answer the open questions in section 4 (especially #1 — Pi storage).
3. Resume brainstorming or jump straight to `superpowers:writing-plans` to convert section 6 into an executable plan.
4. Do **not** start implementation before confirming the Pi's storage situation — installing Postgres on a bare SD card is the most likely way this plan silently fails.
