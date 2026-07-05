# Engineering Maturity Roadmap

Where this project stands relative to industry-standard practice, and the
ordered, trigger-based path to close the gap. Companion to
`docs/deployment/PROD_OPERATIONS.md` (how prod runs today) and
`docs/IMMS_MCS_ARCHITECTURE.md` (how the two apps fit together).

The guiding rule: **add machinery when its trigger fires, not before.**
Every practice below has a real cost (setup, upkeep, complexity); each pays
off only past a certain blast radius. Premature adoption is how solo
projects drown.

Last updated: 2026-07-04 (post PR #17 + #18 merge, pre-cutover).

---

## 1. Where we are today

Already at industry standard (built 2026-07-03/04):

| Practice | Our implementation |
|---|---|
| Environment separation | Prod clone `C:\imms\prod` (PM2, built frontends, ports 4000/4001/3001/3002/3003) vs dev folder (hot reload, 4100/4101/3100/3103) |
| Deliberate releases + rollback | `scripts/deploy.ps1`, `deploy-*` tags, `-Ref <tag>` rollback, `.installed-ref` marker |
| Backup-gated changes | pg_dump gate before every deploy; per-prefix 30-dump retention in `C:\imms\backups` |
| Tracked migrations (MCS) | `maintenance_call_system/backend/src/database/migrate.js` + `--baseline` |
| Data isolation | `fiservinventory_dev` refreshed from prod dumps via `scripts/refresh-dev-db.ps1` (doubles as restore drill) |
| Process supervision | PM2 + Task Scheduler resurrect on boot |
| Release health gate | Five-URL health check before a deploy is tagged |
| Test suites | MCS: 91 vitest (clean). IMMS: 78/84 jest (5 suites fail from missing DB/Selenium infra — see §2.1) |

**Outstanding before anything below matters: run the cutover**
(`docs/deployment/PROD_OPERATIONS.md`, One-time cutover). Until then prod
still serves from the dev folder and none of the isolation above is active.

---

## 2. The ladder to industry practice

Ordered by (value ÷ effort) for THIS project. Each rung: what, why, the
trigger that says "do it now," and the first concrete step in this repo.

### 2.1 Continuous Integration (CI) on every PR
- **What:** GitHub Actions workflow running both backend suites (and
  `tsc --noEmit` for both frontends) on every push/PR. Merge blocked on red.
- **Why:** Today tests run only when someone remembers. Every professional
  team gates merges on automated tests; it's the single cheapest defect net
  that exists.
- **Status:** ✅ Done 2026-07-04 — `.github/workflows/ci.yml` runs `imms-backend`
  (jest, 7 legacy suites quarantined via the `backend` `test:ci` script), `mcs-backend`
  (vitest), and `frontends` (tsc ×2) on every PR to `main`; the three checks are
  required (admin bypass on). **Follow-ups:** add a Postgres service and
  un-quarantine the 3 DB suites; fix/remove the broken `integration/api.test.js`
  import; move the Selenium e2e suite to its own opt-in workflow. (The IMMS
  frontend lockfile is fixed — `netlify-cli` removed 2026-07-04 — so both CI
  frontend steps and `deploy.ps1` use `npm ci`.)
- **How it was done:** quarantined the 5 red suites via a `backend` `test:ci`
  script (rather than a Postgres service up front) to get a green gate fast;
  three jobs (`imms-backend`, `mcs-backend`, `frontends`) on `ubuntu-latest` +
  Node 22 with npm caching on the backend jobs; branch protection on `main`
  requires the three checks with admin bypass left on. Design/plan:
  `docs/superpowers/specs/2026-07-04-ci-pipeline-design.md`. The un-quarantine
  work (Postgres service, e2e workflow, broken-import fix) is
  the follow-up list above.

### 2.2 Error tracking + uptime monitoring
- **What:** Sentry (or GlitchTip, self-hosted) in both backends and both
  frontends; an uptime monitor (UptimeRobot/Better Stack free tier) probing
  the five prod URLs; a public status page when customers exist.
- **Why:** Right now the first detector of a production error is a
  technician at a kiosk. Industry practice is that *you* know before they
  do. This also feeds the commercialization plan's support-SLA story.
- **Trigger:** Fire at cutover (the new prod URLs are stable targets), and
  before any paying customer.
- **First steps:** Sentry SDK in `backend/index.js` + MCS `index.js` error
  middleware; DSNs via env; uptime monitor pointed at `:4000/health`,
  `:4001/health`, `:3003/board`.

### 2.3 IMMS per-file tracked migration runner
- **What:** Extend the MCS pattern (`migrate.js`, tracking table, baseline)
  to the IMMS backend. Today `npm run migrate` only applies the initial
  schema once — the 50+ numbered files in `backend/migrations/` are applied
  by hand, which the deploy pipeline can't see.
- **Why:** The deploy script's migrate step is currently a no-op for real
  IMMS schema changes; hand-psql against prod is exactly the class of
  unaudited change this whole effort eliminates.
- **Trigger:** The first IMMS schema change after cutover. Do NOT wait for
  the second.
- **First steps:** Copy the MCS runner + tests, point at
  `backend/migrations/`, add a baseline step to the runbook mirroring the
  existing MCS/IMMS baseline entries. One session of work; the pattern is
  proven.

### 2.4 Dedicated production hardware
- **What:** Prod on its own machine — for the plant, a small dedicated box
  or VM; for customers, one cloud VM each (the commercialization plan's
  Path A).
- **Why:** Sharing one PC means dev CPU/RAM spikes, reboots for Windows
  updates, and physical accidents all hit prod. Industry standard is prod
  on hardware nobody develops on.
- **Trigger:** First paying customer (their instance is born on its own VM
  — never colocated), OR the first time dev activity visibly degrades the
  floor.
- **First steps:** The deploy script and runbook are already
  location-parameterized in spirit; extract `C:\imms\prod`, PG path, and
  PM2 path into a small config block at the top of `deploy.ps1` so the same
  script provisions any Windows box. For cloud VMs, that config block is
  the seed of the provisioning script.

### 2.5 Containerization (immutable artifacts)
- **What:** Docker images per service, built once in CI, deployed as-is
  (`compose up`) everywhere. Eliminates in-place builds — and with them the
  documented "half-built page during deploy" window — and makes
  per-customer provisioning a file, not a checklist.
- **Why:** "Build once, run the same artifact everywhere" is the industry's
  answer to works-on-my-machine. It is also the natural shape of Path A
  provisioning at more than ~2 customers.
- **Trigger:** Customer #2, or when the cutover checklist has been executed
  manually three times (per-plant, per-VM). Not before — Docker on the
  plant PC (Win10 + WSL2) adds fragility for zero current gain.
- **First steps:** Dockerfiles for the two backends first (pure Node, easy
  wins); frontends as static builds behind nginx or `serve` images; one
  `docker-compose.yml` mirroring `ecosystem.prod.config.js` app-for-app.

### 2.6 Secrets management
- **What:** Secrets out of plaintext `.env` files into a managed store —
  per-VM cloud secret manager (AWS/GCP/Azure) for customer instances;
  at minimum Windows Credential Manager / DPAPI-protected files locally.
- **Why:** `.env` files get copied, backed up, and committed by accident
  (GitGuardian already guards the repo, but files on disk have no guard).
  Every security questionnaire asks about this.
- **Trigger:** First customer instance, or the pre-sale hardening sprint
  from the commercialization plan — whichever comes first.

### 2.7 Staging environment
- **What:** A third environment — prod-shaped, disposable data — where
  merged changes soak before the real deploy.
- **Why:** Standard at team scale: it catches integration/config drift that
  unit tests can't.
- **Trigger:** A second developer, or the first customer-facing regression
  that dev testing missed. Until then, dev + `refresh-dev-db.ps1` (real
  data shape) + the deploy health gate covers most of staging's value at
  zero extra cost.
- **Note:** When containerized (§2.5), staging becomes `compose up` with a
  restored dump — build §2.5 first and staging is nearly free.

### 2.8 Continuous Delivery, zero-downtime deploys, IaC
- **What:** Auto-deploy on merge (CD); blue-green or rolling deploys (two
  prod copies, atomic switch — kills the half-built-page window without
  Docker); Terraform/scripted infra for fleets of customer VMs.
- **Why/Trigger:** These are multi-customer SaaS practices. Auto-deploy is
  deliberately NOT wanted for a factory floor today — a human choosing the
  deploy moment is a safety feature. Revisit at: >5 customer instances
  (IaC), >1 deploy/week (blue-green), pooled multi-tenant SaaS (CD).

---

## 3. Small debt register (from the 2026-07-04 final review, deferred)

Cheap items, batch them into any nearby session:

- Stale `start-app.bat` references in `docs/raspberry-pi/*` and
  `docs/setup/*` (the Pi guides are what an operator reads when a kiosk
  breaks).
- `maintenance_call_system/deploy.sh:33` references the deleted MCS
  ecosystem file — delete the script or point it at the root config.
- `scripts/lib/db-common.ps1`: delete the partial `.dump` before throwing
  on pg_dump failure.
- `deploy.ps1`: seconds in the tag stamp (same-minute collision) and a
  non-fatal warning around the tag push; note that `pm2 save` before the
  health gate can resurrect a bad build after a reboot mid-incident.
- Runbook: one line on backward-compatible-migration discipline (new schema
  serves old code for the minutes between migrate and reload).

---

## 4. Sequence summary

```
NOW ──► Cutover (runbook) ──► CI on PRs (§2.1) ──► Sentry + uptime (§2.2)
                                    │
        first IMMS schema change ──►│──► IMMS migration runner (§2.3)
        first paying customer ─────►│──► own VM (§2.4) + secrets (§2.6)
        customer #2 ───────────────►│──► Docker (§2.5) → staging (§2.7)
        SaaS scale ────────────────►│──► CD / blue-green / IaC (§2.8)
```

Everything left of the first arrow is done. The next two rungs (§2.1, §2.2)
are cheap enough to do in the same week as the cutover; everything after
waits for its trigger.
