# Demo Reconciliation — Deploy From Main + Polish

**Date:** 2026-07-05
**Status:** Approved — ready for implementation planning
**Branch:** `feat/demo-deploy-from-main`

## Why

The public sales demo at `demo.immsystem.com` deploys from a long-lived branch
`feature/demo-mode` (last commit 2026-06-01) that is **134 commits behind main**.
Exploration showed the premise "the demo code needs merging into main" is FALSE:
**main already contains the entire demo experience, flag-gated, and is *ahead* of
the fork.** On main today, gated by `DEMO_MODE` (backend) / `REACT_APP_DEMO_MODE`
(frontend): `DemoLandingPage` routed at `/demo` with a one-click "Enter Demo"
role-based login (`POST /api/v1/demo/login`), `DemoBanner`/`DemoRoleSwitcher`/
`DemoResetButton` in Navigation, the `/api/v1/demo` router, the `noindex` header,
the nightly reseed cron, `seedDemo.js`, `framer-motion`+`lucide-react`, and a
`Dockerfile` that builds with `REACT_APP_DEMO_MODE=true` + same-origin API.

So there is **no code merge to do**. The problem is a stale deployment plus a few
un-shipped hardening items. This work proves main runs as the demo, makes small
fixes surfaced by a live analysis of the demo, codifies the deploy, and hands over
the runbook to repoint the demo at main and retire the fork.

## Goals

1. Confirm main runs correctly as the demo (build with the flag, seed, click through).
2. Fix the three live-analysis findings: inconsistent branding, missing security
   headers, and (already-existing but deploy-broken) self-serve demo access.
3. Codify the demo deploy so it is reproducible and always tracks main.
4. Provide the runbook to repoint Render at main and delete `feature/demo-mode`.

**Non-goals (YAGNI):** merging any code from `feature/demo-mode` (main is a
superset); a tuned Content-Security-Policy (deferred — needs per-app work and risks
breaking the SPA + its jsdelivr Bootstrap); changing the demo features themselves;
the Render dashboard change (the user does that); changing the Dockerfile's
`REACT_APP_DEMO_MODE=true` default (it is the demo's Dockerfile; prod builds on-prem).

## Decisions (confirmed with the user)

| Question | Decision |
|---|---|
| Merge the fork? | **No** — main is a superset; retire the fork instead |
| Scope | **Verify + all polish fixes** (branding, security headers, deploy codification) |
| Product name | **IMMS** ("IMMS — Inventory Management System") everywhere |
| Self-serve demo access | Already exists (`DemoLandingPage` "Enter Demo"); broken on the live demo only because the deployed build lacks `REACT_APP_DEMO_MODE=true` — fixed by deploying from main via the Dockerfile (which bakes it) |

## Architecture / units

### Unit 1 — Branding → IMMS

The tab title, meta, and PWA manifest disagree (`<title>FTE Inventory</title>`;
meta "IMMS Inventory Management System"; `manifest.json` still CRA boilerplate
"Create React App Sample" / "React App"). Standardize on **IMMS**:
- `frontend/public/index.html`: `<title>` → `IMMS — Inventory Management System`;
  ensure the description meta reads "IMMS — Inventory Management System".
- `frontend/public/manifest.json`: `name` → "IMMS — Inventory Management System",
  `short_name` → "IMMS".

The login heading already renders "IMMS", so after this all surfaces agree.

### Unit 2 — Security headers (apply helmet)

`helmet` is a dependency and imported at `backend/index.js:37` but **never
applied** (`app.use(helmet(...))` is absent), so the backend/demo currently sends
no security headers (confirmed live: no HSTS/CSP/X-Frame-Options, and
`x-powered-by: Express` is exposed). Apply helmet early in the middleware chain
(before routes) with:
- HSTS (default; browsers ignore it over the LAN's HTTP, honor it over the demo's
  HTTPS — safe for both),
- `X-Frame-Options: SAMEORIGIN` (frameguard),
- `X-Content-Type-Options: nosniff`,
- a `Referrer-Policy`,
- `hidePoweredBy` (removes `x-powered-by`),
- **`contentSecurityPolicy: false`** — matches the MCS backend's helmet config and
  avoids breaking the SPA/jsdelivr Bootstrap. A tuned CSP is a follow-up.

This improves prod as well (prod also lacks these headers). It must not alter any
route behavior or break the SPA/static serving.

### Unit 3 — Codify the demo deploy

The `Dockerfile` (in main) already builds the demo correctly (bakes
`REACT_APP_DEMO_MODE=true`, empty `REACT_APP_API_URL` for same-origin, copies the
build into `backend/public` which `index.js` serves). What is not codified is the
*runtime* configuration and the fact the demo must build from main. Add:
- **`render.yaml`** — a Render Blueprint for the demo web service, Docker runtime
  referencing the existing `Dockerfile`, on branch `main`, declaring the runtime
  env the demo needs (`DEMO_MODE=true`, plus `DATABASE_URL`, `JWT_SECRET`,
  `SESSION_SECRET` as dashboard-managed secrets). This is a **best-effort
  blueprint** the user reconciles with the working Render service.
- **`docs/deployment/DEMO_OPERATIONS.md`** — the authoritative runbook: the demo
  builds from `main` via the Dockerfile; the required runtime flags/secrets; how
  the initial `seed:demo` runs and the nightly reseed cron keeps it fresh; the
  **repoint steps** (point the Render service's branch/repo at `main`, set
  `DEMO_MODE=true`, redeploy); post-repoint verification; and **retiring
  `feature/demo-mode`** (`git push origin --delete feature/demo-mode` after
  confirming the new demo is live).

### Unit 4 — Verification (controller-run, not a subagent)

Prove main runs as the demo locally, since main has likely never been run as the
demo: build the IMMS frontend with `REACT_APP_DEMO_MODE=true`; run the backend with
`DEMO_MODE=true` against a **throwaway** demo database (never the dev or prod DB);
`npm run seed:demo`; confirm the `/demo` landing page renders, "Enter Demo" logs in
one-click into the dashboard, the demo chrome (banner/role-switcher/reset) shows,
and the new security headers are present on responses. This validates the branding
+ headers changes end-to-end and that main is deploy-ready as the demo.

### Ops (user, guided by Unit 3's runbook)

Repoint the Render demo service to build from `main` with `DEMO_MODE=true`; verify;
then delete the `feature/demo-mode` branch.

## Testing

- **helmet:** a unit/integration assertion that a response from the IMMS app now
  carries `X-Frame-Options`, `X-Content-Type-Options: nosniff`, and no
  `x-powered-by` (and does NOT carry a `content-security-policy`, confirming CSP is
  intentionally disabled). Keep it CI-safe (supertest against the app, no real DB
  needed for a static/health route, or assert on the middleware config).
- **Branding:** a trivial check that `index.html`/`manifest.json` contain "IMMS" and
  not "FTE Inventory" / "Create React App".
- Existing demo tests (`backend/src/__tests__/demo.test.js`) continue to pass.
- Ships through the required CI gate (imms-backend `test:ci`, frontends `tsc`).

## Risks / plan-level checks

- Applying helmet must not break the SPA or static serving — register it early but
  confirm `express.static`/SPA fallback (`index.js:485-489`) still serve; CSP stays
  off. Verify the app still loads in the verification step.
- HSTS over the LAN's HTTP prod: harmless (ignored by browsers over HTTP); do not
  add `includeSubDomains`/`preload` that could over-reach.
- `render.yaml` is a best-effort blueprint; the runbook (`DEMO_OPERATIONS.md`) is
  the authoritative source since only the user can see the live Render config.
- The verification must use a throwaway demo DB — `seed:demo` writes demo data and
  must never touch `fiservinventory` (prod) or `fiservinventory_dev`.
