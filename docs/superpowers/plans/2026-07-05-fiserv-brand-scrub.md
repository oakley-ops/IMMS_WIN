# Fiserv Brand Scrub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove visible **Fiserv brand text** from the repo (replace with IMMS) — chiefly the Fiserv logo stamped on generated PDFs — while leaving structural identifiers (the `fiservinventory` database, folder paths, and the `fiserv_part_number` DB column) untouched.

**Architecture:** A categorized find-and-replace: brand text → IMMS across the PDF templates, docs, backup scripts, and the auth-service defaults; delete dead Fiserv-branded deploy configs; a final grep sweep proves only the (excluded) structural identifiers remain.

**Tech Stack:** React/TS (pdfTemplates), PowerShell/batch (backup scripts), Node (auth-service), Markdown docs.

**Scope agreed with the user (this plan is the design):** branding + safe identifiers only. The `fiservinventory` DB rename is an **excluded, separate project**.

## Global Constraints

- Branch: all commits on `feat/fiserv-brand-scrub`.
- Replacement brand: **IMMS**.
- **GOVERNING RULE — the three structural strings are OFF-LIMITS; never change them:**
  - `fiservinventory` / `fiservinventory_dev` — the **database name** (renaming is a separate risky prod project).
  - `fiservinventory_win` — the local **folder path**.
  - `fiserv_part_number` — a real **DB column name** (renaming needs a migration).
  Every task scrubs only *brand* occurrences of "Fiserv"/"fiserv" and must leave those three substrings byte-for-byte intact.
- Ships through the required CI gate (imms-backend `test:ci`, mcs-backend vitest, frontends `tsc`). The `auth-service` is NOT in the CI gate — its own vitest suite must be kept green by the task that touches it.
- No behavior change beyond the intended branding (PDFs show IMMS; auth defaults rename; dead configs removed).

## File Structure

```
frontend/src/utils/pdfTemplates.js                 MODIFY  logo -> always IMMS (all instances)
frontend/public/assets/fiserv_logo_orange_rgb.png  DELETE
fiserv_logo_orange_rgb.png (repo root)             DELETE
backend/scripts/*.ps1, *.bat                        MODIFY  "Fiserv Inventory" display text -> IMMS
auth-service/... (defaults + tests + .env.example)  MODIFY  fiserv -> imms brand defaults
README.md, docs/README.md, docs/**                  MODIFY  Fiserv brand text -> IMMS; drop dead-config refs
frontend/fly.toml, backend/fly.toml, deploy-fly.sh, Jenkinsfile, jenkins/  DELETE  dead Fiserv deploy cruft
```

---

### Task 1: PDF logo → IMMS (crown jewel) + delete logo assets

**Files:**
- Modify: `frontend/src/utils/pdfTemplates.js`
- Delete: `frontend/public/assets/fiserv_logo_orange_rgb.png`, `fiserv_logo_orange_rgb.png` (repo root)

- [ ] **Step 1: Find every Fiserv logo instance**

Run (repo root): `grep -n "fiserv_logo_orange_rgb.png" frontend/src/utils/pdfTemplates.js`
Note each line — the file generates several PDF types (PO, work order, etc.), each with the same logo block.

- [ ] **Step 2: Replace each logo block with the IMMS text logo**

Each instance currently looks like (line ~260):

```javascript
${isDemo ? '<div class="logo-text">IMMS</div>' : `<img src="/assets/fiserv_logo_orange_rgb.png" alt="Fiserv Logo" class="logo" onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSIzMCI+PHRleHQgeD0iMCIgeT0iMjAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiNGRjYyMDAiPmZpc2VydjwvdGV4dD48L3N2Zz4=';">`}
```

Replace the **entire `${isDemo ? ... : ...}` expression** with the unconditional IMMS logo (demo and non-demo now both show IMMS):

```javascript
<div class="logo-text">IMMS</div>
```

Do this for **every** instance found in Step 1. Leave the `isDemo` variable and any *other* `isDemo` usage in the file unchanged — only the logo becomes unconditional.

- [ ] **Step 3: Delete the logo assets**

```bash
git rm frontend/public/assets/fiserv_logo_orange_rgb.png fiserv_logo_orange_rgb.png
```
(The `frontend/build*/assets/*.png` copies are regenerated build artifacts — ignore them; do not hand-edit build output.)

- [ ] **Step 4: Verify no Fiserv logo/text remains + tsc passes**

Run (repo root): `grep -c "fiserv" frontend/src/utils/pdfTemplates.js` → expect `0` (the comment "instead of the Fiserv logo" at line ~15 should also be updated to "IMMS logo" — confirm 0 total).
Then (from `frontend/`): `npx tsc --noEmit` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/pdfTemplates.js
git commit -m "brand: IMMS logo on all generated PDFs (drop the Fiserv logo)"
```

---

### Task 2: Backup-script display text → IMMS

**Files:**
- Modify: `backend/scripts/*.ps1`, `backend/scripts/*.bat`

- [ ] **Step 1: List the brand occurrences**

Run (repo root): `git grep -inE "Fiserv" -- 'backend/scripts/*.ps1' 'backend/scripts/*.bat' | grep -iv fiservinventory`
These are titles ("Fiserv Inventory Backup Control Panel"), toast messages ("Fiserv Inventory Backup"), task descriptions ("...Fiserv Inventory database"), and one AWS bucket default (`fiserv-inventory-backups`).

- [ ] **Step 2: Replace the brand text**

In each matched file, replace:
- `Fiserv Inventory` → `IMMS Inventory`
- `fiserv-inventory-backups` (AWS bucket default in `cloud-sync-backup.ps1`) → `imms-inventory-backups`

Do NOT touch any `fiservinventory` (DB name) occurrences in these scripts.

- [ ] **Step 3: Verify**

Run (repo root): `git grep -iE "Fiserv" -- 'backend/scripts/*.ps1' 'backend/scripts/*.bat' | grep -iv fiservinventory || echo "no brand text left in backup scripts"`
Expected: `no brand text left in backup scripts`.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts
git commit -m "brand: IMMS in backup-script messages and titles"
```

---

### Task 3: auth-service brand defaults → IMMS (keep its tests green)

**Files:**
- Modify: `auth-service/src/services/authService.js`, `auth-service/scripts/seed.js`, `auth-service/src/test/helpers.js`, `auth-service/src/middleware/auth.js`, `auth-service/src/lib/cookieOpts.js`, `auth-service/.env.example`, `auth-service/README.md`
- Modify (fixtures): `auth-service/src/services/authService.test.js`, `auth-service/src/routes/auth.integration.test.js`

**Note:** the `auth-service` is a separate SaaS-foundation service, not in the IMMS/MCS CI gate. Its own vitest suite asserts on the `fiserv` defaults, so the code and test changes must land together to keep it green. **Leave `DB_NAME=fiservinventory` in `.env.example` (structural).**

- [ ] **Step 1: Rename the tenant + cookie brand defaults (source)**

- `auth-service/src/services/authService.js`: `const DEFAULT_TENANT_SLUG = 'fiserv';` → `= 'imms';`
- `auth-service/scripts/seed.js`: `TENANT_SLUG = 'fiserv'` → `'imms'`; `TENANT_NAME = 'Fiserv'` → `'IMMS'`; `ADMIN_EMAIL ... 'admin@fiserv'` → `'admin@imms'`.
- `auth-service/src/test/helpers.js`: `ensureTenant = async (slug = 'fiserv', display_name = 'Fiserv')` → `(slug = 'imms', display_name = 'IMMS')`.
- `auth-service/src/middleware/auth.js`: `COOKIE_NAME = process.env.COOKIE_NAME || 'fiserv_auth'` → `|| 'imms_auth'`.
- `auth-service/src/lib/cookieOpts.js`: comment `// ...the fiserv_auth JWT cookie.` → `// ...the imms_auth JWT cookie.`
- `auth-service/.env.example`: `COOKIE_NAME=fiserv_auth` → `imms_auth`; the two comment lines `.fiserv.local` → `.imms.local`. **Do NOT change `DB_NAME=fiservinventory`.**
- `auth-service/README.md`: `create Fiserv tenant + admin@fiserv user` → `create IMMS tenant + admin@imms user`.

- [ ] **Step 2: Update the test fixtures to match**

In `auth-service/src/services/authService.test.js` and `auth-service/src/routes/auth.integration.test.js`, replace the fixture strings: `'fiserv'` slug → `'imms'`; `'Fiserv'` name → `'IMMS'`; every `@fiserv` / `@fiserv.test` email → `@imms` / `@imms.test`; the cookie assertion `/fiserv_auth=/` → `/imms_auth=/` (and `fiserv_auth=;` → `imms_auth=;`).

- [ ] **Step 3: Run the auth-service suite**

Run (from `auth-service/`): `npx vitest run`
Expected: all pass (the renamed defaults + fixtures are internally consistent). If the cookie-name or tenant-slug assertions fail, a source/fixture pair is out of sync — reconcile before committing.

- [ ] **Step 4: Verify no brand text left (db name intact)**

Run (repo root): `git grep -iE "fiserv" -- auth-service | grep -ivE "fiservinventory"` → expect **no output** (only `DB_NAME=fiservinventory` remains, filtered out).

- [ ] **Step 5: Commit**

```bash
git add auth-service
git commit -m "brand: IMMS tenant/cookie defaults in auth-service (db name unchanged)"
```

---

### Task 4: Docs/README brand text + delete dead Fiserv deploy configs

**Files:**
- Modify: `README.md`, `docs/README.md`, and other docs with Fiserv **brand** text
- Delete: `frontend/fly.toml`, `backend/fly.toml`, `deploy-fly.sh`, `Jenkinsfile`, `jenkins/` (dir)

- [ ] **Step 1: Delete the dead deploy configs**

These reference `fiserv-inventory-api` and are not the current deploy path (prod = PM2 on-prem, demo = Render):

```bash
git rm frontend/fly.toml backend/fly.toml deploy-fly.sh Jenkinsfile
git rm -r jenkins
```

- [ ] **Step 2: Scrub README + docs brand text**

- `README.md`: `# Fiserv Inventory / IMMS` → `# IMMS`; remove the `Fiservlogo/` entry from the static-assets tree line; remove any references to the now-deleted Fly/Jenkins deploy configs.
- `docs/README.md` and any other doc: replace Fiserv **brand** phrases ("Fiserv Inventory", "Fiserv logo", the `fiserv-inventory-api` app name) with IMMS equivalents / remove.
- **Leave** every `fiservinventory` (DB) and folder-path reference untouched. Superpowers plan/spec docs that mention `fiservinventory` as the DB are correct as-is.

Find the doc brand occurrences with: `git grep -inE "Fiserv" -- '*.md' | grep -ivE "fiservinventory"` and address each (skip ones that are only the DB name or a path).

- [ ] **Step 3: Verify**

Run (repo root): `git grep -inE "Fiserv" -- '*.md' | grep -ivE "fiservinventory|fiserv_part_number"` — review the output; every remaining line must be a DB-name/path mention (acceptable) — no brand text.

- [ ] **Step 4: Commit**

```bash
git add -A README.md docs
git commit -m "brand: scrub Fiserv from docs; delete dead Fiserv deploy configs (fly/jenkins)"
```

---

### Task 5: Final sweep + verification

**Files:** none new — a whole-repo verification and a follow-up note.

- [ ] **Step 1: Whole-repo brand sweep**

Run (repo root): `git grep -inE "fiserv" -- ':!node_modules' | grep -ivE "fiservinventory|fiservinventory_win|fiserv_part_number"`
Review EVERY remaining line. Each must be one of the three allowed structural strings (already filtered) OR a build artifact under `frontend/build*/` (regenerated — ignore). If any real **brand** text remains (a stray "Fiserv" in a component, script, or doc), scrub it now (brand → IMMS), following the governing rule, and commit as part of this task.

- [ ] **Step 2: Confirm the frontends still typecheck + backends unaffected**

Run (from `frontend/`): `npx tsc --noEmit` → exit 0.
Run (from `backend/`): `npm run test:ci` → green. (Backends shouldn't be affected — this confirms the scrub touched no backend logic.)

- [ ] **Step 3: Record the excluded follow-up**

Append a note to `docs/ENGINEERING_MATURITY_ROADMAP.md` (near the roadmap follow-ups, or a short "Deferred" note) that the `fiservinventory` **database rename** (and the `fiserv_part_number` **column rename**) remain deliberately deferred — structural renames requiring a migration + prod-coordinated downtime, out of scope for the branding scrub.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "brand: final Fiserv sweep + note the deferred db/column rename"
```

---

## Self-Review (completed at write time)

- **Scope coverage:** PDF logo → IMMS + asset deletion (T1); backup scripts (T2); auth-service defaults + tests (T3); docs/README + dead deploy-config deletion (T4); whole-repo sweep + verification + deferred-rename note (T5). The excluded structural renames (`fiservinventory` db, folder path, `fiserv_part_number` column) are explicitly protected by the Global Constraints governing rule and recorded as a deferred follow-up (T5 S3).
- **Placeholder scan:** every step has concrete files, exact strings, and verify commands. The one "find each with grep" step (T4 S2) is a doc-sweep with the governing rule to disambiguate brand vs structural — appropriate for scattered doc text.
- **Governing-rule consistency:** every task's verify step filters out `fiservinventory`/path/`fiserv_part_number`, so the protected strings are checked in each task, not just at the end.
- **CI-safety:** T1 verified by frontend `tsc`; T3 by the auth-service's own vitest (not the CI gate — flagged); T5 confirms `test:ci` + `tsc` still green so no backend/frontend logic broke. The PDF change is template-string only (no type surface).
