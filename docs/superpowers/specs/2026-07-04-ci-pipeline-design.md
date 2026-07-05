# CI Pipeline — Design

**Date:** 2026-07-04
**Status:** Approved — ready for implementation planning
**Owner:** Isaac Rodriguez
**Branch:** `ci/github-actions`

## Why

Engineering-maturity roadmap §2.1: automated tests on every PR are the cheapest
defect net that exists, and nothing gates merges today. The monthly-analytics
Critical bug (a token that would 401 every month) is a live example of what an
automated gate plus review catches. This adds a GitHub Actions CI that runs the
reliable test suites on every pull request and blocks merge on red.

## Goals

1. Every PR to `main` runs the IMMS backend suite, the MCS backend suite, and
   both frontends' typechecks; a red result blocks merge.
2. CI is **green and trustworthy from day one** — no perpetually-failing checks
   that train people to ignore red.
3. Fast (~a few minutes) and cheap (hosted Linux runner).
4. You keep the ability to direct-push a floor-down hotfix (admin bypass).

**Non-goals (YAGNI):** frontend unit/component tests in CI (a later increment —
kept out now to keep CI fast and avoid flaky UI tests blocking merges);
un-quarantining the 5 legacy suites (tracked follow-up); CD / auto-deploy
(deploys stay the manual `deploy.ps1`); lint gating (not today).

## Decisions (confirmed with the user)

| Question | Decision |
|---|---|
| 5 failing legacy IMMS suites | **Quarantine all 5** from CI; track as follow-up |
| Merge gate strictness | **Required checks + admin bypass** (direct hotfix push still possible) |
| Runner OS | **`ubuntu-latest`** (tests are platform-agnostic Node; no PowerShell under test) |
| Node version | **22** (matches local `v22.14`) |
| Frontend scope | **Typechecks only** (`tsc --noEmit`), both frontends |

## The 5 quarantined suites (verified failing locally)

| Suite | Why it fails | Un-quarantine path (follow-up) |
|---|---|---|
| `backend/__tests__/db/purchaseOrderDocuments.test.js` | needs live Postgres | add a Postgres service container + seed/migrate |
| `backend/__tests__/integration/purchaseOrderDocuments.test.js` | needs live Postgres | same |
| `backend/__tests__/services/poDocumentService.test.js` | needs live Postgres | same |
| `backend/__tests__/integration/api.test.js` | broken import: `Cannot find module '../../src/config/db'` | fix or delete the stale test |
| `backend/__tests__/integration/search/parts-search.test.js` | DB-dependent — imports `db.js`, which `process.exit(1)`s when `DATABASE_URL` is unset (passed locally only because the dev `.env` set it; CI surfaced this) | add a Postgres service container + `DATABASE_URL` |
| `backend/__tests__/integration/search/search.test.js` | same (DB-dependent) | same |
| `backend/src/__tests__/e2e/inventory.test.js` | Selenium/WebDriver, needs a browser | move to a separate opt-in `e2e` workflow |

The `integration/` pattern quarantines the whole integration folder (all four
suites need the DB or are broken). The other **19** IMMS backend suites pass
reliably with no DB and are the CI gate.

## Architecture

Single workflow `.github/workflows/ci.yml`:

- **Triggers:** `pull_request` (branches: `main`) and `push` (branches: `main`).
  The push trigger registers the check on the base branch and gives a green
  history on `main`.
- **Runner:** `ubuntu-latest`. **Node:** 22 via `actions/setup-node` with
  `cache: 'npm'`.
- **Concurrency:** group by workflow + ref, `cancel-in-progress: true`, so a new
  push to a PR cancels the superseded run.
- **Three parallel jobs** (isolation — one failing area doesn't mask another):

| Job | Working dir | Install | Command |
|---|---|---|---|
| `imms-backend` | `backend` | `npm ci` | `npm run test:ci` |
| `mcs-backend` | `maintenance_call_system/backend` | `npm ci` | `npx vitest run` |
| `frontends` | (two steps) | see below | `npx tsc --noEmit` in each frontend |

- `frontends` job runs two typecheck steps; both frontends use `npm ci`.
  (Originally the IMMS frontend needed a lenient `npm install` because
  `netlify-cli` dragged in a nested `@esbuild/*` platform dep that broke
  `npm ci`; `netlify-cli` was removed 2026-07-04, so both are clean now.)

### Quarantine mechanism

A version-controlled npm script in `backend/package.json` — the ignore list
lives in one documented place, not buried in YAML:

```json
"test:ci": "jest --ci --testPathIgnorePatterns \"/node_modules/\" \"purchaseOrderDocuments\" \"poDocumentService\" \"integration/\" \"e2e/\""
```

The patterns match exactly the seven quarantined suites above (`purchaseOrderDocuments`
matches the two PO-document suites). `--ci` makes jest deterministic (no
snapshot writes, no interactive).

### Branch protection

After the workflow has run once on `main` (so the check names exist), configure
protection on `main` via `gh api`:
- Require the three status checks: `imms-backend`, `mcs-backend`, `frontends`.
- Require a PR before merging.
- **Leave "do not allow bypassing" OFF** so repo admins can still direct-push in
  an emergency.

If the `gh api` call is fiddly (token scopes), fall back to documenting the
exact GitHub Settings → Branches UI steps in the runbook and having the user
click through once.

## Error handling / edge cases

- If `npm ci` fails for a backend (e.g. lockfile drift), that job fails red —
  correct behavior; it means a dependency change needs attention.
- The `frontends` job's lenient IMMS-frontend install is the one deliberate
  non-`ci` install; documented, and it fails red if `tsc` finds a type error.
- Branch-protection admin bypass means a red CI can still be force-merged by the
  admin — intentional escape hatch, not a hole.

## Testing / acceptance

- The underlying commands are already confirmed locally: plain `jest` shows the
  same 19 pass / 7 fail split; MCS `vitest run` is green; both frontends `tsc
  --noEmit` exit 0. Implementation Task 1 verifies the new `test:ci` script
  excludes exactly the 7 and leaves 19 green.
- Acceptance: open a trivial PR against `main`; all three checks run and pass
  green; confirm a deliberately-broken PR (e.g. a type error) turns the
  `frontends` check red and blocks merge; then enable branch protection.

## Follow-ups (tracked, not in this work)

- Add a Postgres service container and un-quarantine the 3 DB suites.
- Fix or remove the broken `integration/api.test.js` import.
- Move the Selenium e2e suite to its own opt-in `e2e.yml` workflow.
- ~~Regenerate the IMMS frontend lockfile so it can use `npm ci`.~~ Done
  2026-07-04 by removing the unused `netlify-cli` (the actual cause); both CI
  and `deploy.ps1` frontend installs now use `npm ci`.
- Later increment: add frontend unit/component tests to CI.
