# Demo Reconciliation (Deploy From Main + Polish) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `main` the source of the sales demo — consistent IMMS branding, actual security headers, and a codified/documented deploy — so the demo can be repointed off the 134-commit-stale `feature/demo-mode` fork with no code merge (main is already a superset).

**Architecture:** Three small, independent changes plus a local verification: (1) brand strings → IMMS; (2) a `securityHeaders` helmet middleware applied at the top of the shared `app.js`; (3) a `render.yaml` blueprint + a `DEMO_OPERATIONS.md` runbook. Then verify main runs as the demo against a throwaway DB.

**Tech Stack:** React (CRA), Express, `helmet@^8` (already a dep), supertest (devDep), the repo `Dockerfile`.

**Spec:** `docs/superpowers/specs/2026-07-05-demo-deploy-from-main-design.md`

## Global Constraints

- Branch: all commits on `feat/demo-deploy-from-main`.
- Standardize the product name to **IMMS** ("IMMS — Inventory Management System").
- helmet config: HSTS (default), `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, a `Referrer-Policy`, `hidePoweredBy`, and **`contentSecurityPolicy: false`** (matches MCS; a tuned CSP is a deferred follow-up). Must not break the SPA / static serving / any route.
- No code merged from `feature/demo-mode` (main is a superset). No demo-feature changes. No CSP tuning.
- New backend test lives under `backend/__tests__/unit/` (outside the CI quarantine) and needs NO database (mount the middleware on a throwaway express app — do NOT require `src/app.js`, which loads `db.js`).
- `render.yaml` is a best-effort blueprint; `DEMO_OPERATIONS.md` is the authoritative runbook.
- Verification (after the tasks) is controller-run and MUST use a throwaway demo database — never `fiservinventory` (prod) or `fiservinventory_dev`.

## File Structure

```
frontend/public/index.html                              MODIFY  title + description -> IMMS
frontend/public/manifest.json                           MODIFY  name/short_name -> IMMS
backend/src/middleware/securityHeaders.js               NEW     configured helmet middleware
backend/src/app.js                                      MODIFY  apply securityHeaders (top)
backend/index.js                                        MODIFY  remove dead `require('helmet')`
backend/__tests__/unit/middleware/securityHeaders.test.js  NEW  (jest + supertest, no DB)
render.yaml                                             NEW     demo deploy blueprint
docs/deployment/DEMO_OPERATIONS.md                      NEW     repoint + retire runbook
```

---

### Task 1: Brand → IMMS

**Files:**
- Modify: `frontend/public/index.html`
- Modify: `frontend/public/manifest.json`

- [ ] **Step 1: Fix the title**

In `frontend/public/index.html`, change line 28:

```html
    <title>FTE Inventory</title>
```

to:

```html
    <title>IMMS — Inventory Management System</title>
```

The description meta (lines 8-11) already reads `content="IMMS Inventory Management System"`; update it to match the em-dash form for consistency:

```html
    <meta
      name="description"
      content="IMMS — Inventory Management System"
    />
```

- [ ] **Step 2: Fix the PWA manifest**

In `frontend/public/manifest.json`, change the boilerplate:

```json
  "short_name": "React App",
  "name": "Create React App Sample",
```

to:

```json
  "short_name": "IMMS",
  "name": "IMMS — Inventory Management System",
```

- [ ] **Step 3: Verify**

Run (repo root): `grep -R "FTE Inventory\|Create React App\|React App" frontend/public/index.html frontend/public/manifest.json || echo "no stale brand strings"`
Expected: `no stale brand strings`.
Then: `node -e "JSON.parse(require('fs').readFileSync('frontend/public/manifest.json','utf8')); console.log('manifest valid JSON')"` → `manifest valid JSON`.

- [ ] **Step 4: Commit**

```bash
git add frontend/public/index.html frontend/public/manifest.json
git commit -m "chore(brand): standardize on IMMS across title, meta, and manifest"
```

---

### Task 2: Security headers (apply helmet)

**Files:**
- Create: `backend/src/middleware/securityHeaders.js`
- Modify: `backend/src/app.js` (apply at the top, after `const app = express();`)
- Modify: `backend/index.js` (remove the now-dead `const helmet = require('helmet');`)
- Test: `backend/__tests__/unit/middleware/securityHeaders.test.js`

**Interfaces:**
- Produces: `backend/src/middleware/securityHeaders.js` exporting a configured Express middleware (helmet). Consumed by `app.js`.

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/unit/middleware/securityHeaders.test.js`:

```javascript
const express = require('express');
const request = require('supertest');
const securityHeaders = require('../../../src/middleware/securityHeaders');

const makeApp = () => {
  const app = express();
  app.use(securityHeaders);
  app.get('/t', (req, res) => res.send('ok'));
  return app;
};

describe('securityHeaders middleware', () => {
  test('sets X-Frame-Options SAMEORIGIN and nosniff, and a referrer policy', async () => {
    const res = await request(makeApp()).get('/t');
    expect(res.status).toBe(200);
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBeDefined();
  });

  test('removes x-powered-by', async () => {
    const res = await request(makeApp()).get('/t');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('does NOT set a Content-Security-Policy (intentionally disabled)', async () => {
    const res = await request(makeApp()).get('/t');
    expect(res.headers['content-security-policy']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx jest __tests__/unit/middleware/securityHeaders.test.js --silent`
Expected: FAIL — cannot find `../../../src/middleware/securityHeaders`.

- [ ] **Step 3: Write the middleware**

Create `backend/src/middleware/securityHeaders.js`:

```javascript
'use strict';

// Configured helmet middleware for the IMMS backend. Sets the standard security
// headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) and
// removes X-Powered-By. Content-Security-Policy is intentionally DISABLED for now
// (matching the MCS backend) to avoid breaking the SPA and its jsdelivr Bootstrap;
// a tuned CSP is a tracked follow-up.
const helmet = require('helmet');

module.exports = helmet({
  contentSecurityPolicy: false,
  frameguard: { action: 'sameorigin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `npx jest __tests__/unit/middleware/securityHeaders.test.js --silent`
Expected: PASS (3 tests).

- [ ] **Step 5: Apply it in `app.js`**

In `backend/src/app.js`, the top currently reads:

```javascript
const app = express();

// Report any 5xx response to Sentry (no-op unless SENTRY_DSN is set). Registered
// before all routes so it covers every route in app.js and index.js.
const capture5xx = require('./observability/capture5xx');
app.use(capture5xx);
```

Insert the security headers immediately after `const app = express();`, before `capture5xx` (security headers should be first in the chain):

```javascript
const app = express();

// Security headers (helmet) — applied before all routes so every response carries
// them. See src/middleware/securityHeaders.js (CSP intentionally disabled for now).
app.use(require('./middleware/securityHeaders'));

// Report any 5xx response to Sentry (no-op unless SENTRY_DSN is set). Registered
// before all routes so it covers every route in app.js and index.js.
const capture5xx = require('./observability/capture5xx');
app.use(capture5xx);
```

- [ ] **Step 6: Remove the dead helmet import from `index.js`**

In `backend/index.js`, delete the now-unused line (currently line 37):

```javascript
const helmet = require('helmet');
```

(Confirm `helmet` is not referenced elsewhere in `index.js` first: `grep -n helmet backend/index.js` should show only that import line.)

- [ ] **Step 7: Verify the app still loads and the suite passes**

Run (from `backend/`): `node -e "process.env.SENTRY_DSN=''; require('./src/middleware/securityHeaders'); console.log('mw loads')"` → `mw loads`.
Then: `npm run test:ci` → all green (adds the securityHeaders suite; existing suites incl. `demo.test.js` still pass).

- [ ] **Step 8: Commit**

```bash
git add backend/src/middleware/securityHeaders.js backend/src/app.js backend/index.js backend/__tests__/unit/middleware/securityHeaders.test.js
git commit -m "feat(security): apply helmet security headers to the IMMS backend"
```

---

### Task 3: Codify the demo deploy

**Files:**
- Create: `render.yaml`
- Create: `docs/deployment/DEMO_OPERATIONS.md`

- [ ] **Step 1: Add the render.yaml blueprint**

Create `render.yaml`:

```yaml
# Render Blueprint for the IMMS sales demo (demo.immsystem.com).
#
# The demo is the SAME app as production, built from this repo's Dockerfile — which
# bakes REACT_APP_DEMO_MODE=true and an empty REACT_APP_API_URL (same-origin API),
# copies the React build into backend/public, and runs `node index.js`. Setting
# DEMO_MODE=true at runtime turns on the /api/v1/demo router, the /demo landing page
# with one-click "Enter Demo" login, the noindex header, and the nightly reseed cron.
#
# BEST-EFFORT blueprint — reconcile with the live Render service. The authoritative
# procedure is docs/deployment/DEMO_OPERATIONS.md.
services:
  - type: web
    name: imms-demo
    runtime: docker
    dockerfilePath: ./Dockerfile
    branch: main
    autoDeploy: true
    envVars:
      - key: DEMO_MODE
        value: "true"
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "8000"
      - key: DATABASE_URL
        sync: false   # set in the dashboard — the demo (throwaway) database
      - key: JWT_SECRET
        sync: false
      - key: SESSION_SECRET
        sync: false
```

- [ ] **Step 2: Add the DEMO_OPERATIONS runbook**

Create `docs/deployment/DEMO_OPERATIONS.md`:

```markdown
# Demo Operations (demo.immsystem.com)

The public sales demo is the **same app as production**, deployed from **`main`**
with demo mode turned on. There is no separate demo codebase — the demo experience
lives in `main` behind flags:

- **Build flag** `REACT_APP_DEMO_MODE=true` (baked by the `Dockerfile`) → routes the
  `/demo` landing page and shows the demo chrome (banner, role switcher, reset).
- **Runtime flag** `DEMO_MODE=true` → mounts `/api/v1/demo` (one-click role login),
  sets the `noindex` header, and runs the nightly reseed cron.

## Repoint the demo at main (one-time — off the retired `feature/demo-mode` fork)

1. In the Render dashboard, open the demo web service.
2. Point it at this repo, branch **`main`** (Docker runtime, `./Dockerfile`).
3. Ensure runtime env has **`DEMO_MODE=true`**, a **demo `DATABASE_URL`** (a
   throwaway database — never a customer/prod DB), `JWT_SECRET`, `SESSION_SECRET`.
4. Trigger a deploy. On first boot with an empty demo DB, seed it once:
   `node src/scripts/seedDemo.js` (or `npm run seed:demo`) from the backend. The
   nightly reseed cron keeps it fresh thereafter.

## Verify after repoint

- `https://demo.immsystem.com/demo` shows the landing page (not a login redirect).
- "Enter Demo" logs straight into the dashboard (no credentials).
- Response headers include `X-Frame-Options`, `X-Content-Type-Options: nosniff`,
  and no `X-Powered-By`; `X-Robots-Tag: noindex` is present.
- The browser tab reads "IMMS — Inventory Management System".

## Retire the old fork

Once the main-based demo is confirmed live:

```
git push origin --delete feature/demo-mode
```

The demo now tracks `main` automatically (autoDeploy), so every merge keeps the
demo current — no more drift.
```

- [ ] **Step 3: Verify the render.yaml parses**

Run (repo root): `node -e "const s=require('fs').readFileSync('render.yaml','utf8'); if(!/name: imms-demo/.test(s)||!/DEMO_MODE/.test(s)) throw new Error('bad'); console.log('render.yaml present')"`
Expected: `render.yaml present`.

- [ ] **Step 4: Commit**

```bash
git add render.yaml docs/deployment/DEMO_OPERATIONS.md
git commit -m "docs(demo): render.yaml blueprint + DEMO_OPERATIONS runbook (deploy from main)"
```

---

### Controller verification (after all tasks — NOT a subagent task)

Prove main runs as the demo. Uses a **throwaway** demo database only.

- [ ] Create a throwaway DB (e.g. `imms_demo_local`) and point a temporary `DATABASE_URL` at it. Build the frontend with the flag: from `frontend/`, `REACT_APP_DEMO_MODE=true npm run build` (or via the Dockerfile). Run the backend with `DEMO_MODE=true` + the throwaway `DATABASE_URL`, then `npm run seed:demo`.
- [ ] Load the app: confirm `/demo` shows the landing page, "Enter Demo" logs in one-click to the dashboard, the demo banner/role-switcher/reset render, and the tab title reads "IMMS — Inventory Management System".
- [ ] Confirm response headers: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, no `X-Powered-By`.
- [ ] Tear down the throwaway DB. Then hand the user `DEMO_OPERATIONS.md` for the Render repoint + `feature/demo-mode` deletion.

---

## Self-Review (completed at write time)

- **Spec coverage:** brand → IMMS across title/meta/manifest (T1); apply helmet via a testable module, CSP disabled, dead import removed (T2); render.yaml + DEMO_OPERATIONS runbook, deploy-from-main + retire (T3); controller verification against a throwaway DB. Non-goals (code merge, CSP tuning, Render dashboard change, demo-feature edits) excluded.
- **Placeholder scan:** every code/command/doc step is complete. render.yaml is explicitly labelled best-effort; the runbook is authoritative.
- **CI-safety:** the helmet test mounts the middleware on a throwaway express app (never requires `src/app.js`/`db.js`), so it needs no DB and runs in `test:ci`; path is under `__tests__/unit/`, outside the quarantine.
- **Type/name consistency:** `securityHeaders` module name is identical in the module, the `app.js` `app.use(require('./middleware/securityHeaders'))`, and the test; helmet options (frameguard sameorigin, CSP false, referrerPolicy) match the test assertions (`x-frame-options: SAMEORIGIN`, no CSP, referrer-policy defined).
