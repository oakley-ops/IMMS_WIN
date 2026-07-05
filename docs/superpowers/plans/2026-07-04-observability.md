# Error Tracking + Uptime Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Both backends report errors to Sentry/GlitchTip (off unless `SENTRY_DSN` set), and a standalone PM2 process emails on up/down transitions of the five prod URLs (off unless `OPS_ALERT_RECIPIENTS` set).

**Architecture:** A small `initSentry()` module in each backend, called before `express` is required so `@sentry/node` (v10) can instrument it; `Sentry.setupExpressErrorHandler(app)` wired into each app's error path. A separate `uptimeMonitor.js` (its own PM2 app) polls the URLs and, via a pure transition function, emails only on state changes using the existing `emailService`.

**Tech Stack:** `@sentry/node@^10`, Node 22 global `fetch`, jest (IMMS) + vitest (MCS), the existing `emailService` singleton, PM2.

**Spec:** `docs/superpowers/specs/2026-07-04-observability-design.md`

## Global Constraints

- Branch: all commits on `feat/observability`.
- `@sentry/node` is a NEW dependency (justified — error tracking needs an SDK); latest is `10.63.0`, use `^10`. It's added to both backends.
- Error tracking is **fully no-op unless `SENTRY_DSN` is set**; uptime alerts are **fully no-op unless `OPS_ALERT_RECIPIENTS` is set**. Neither changes behavior until configured.
- Errors only — `Sentry.init({ ..., tracesSampleRate: 0 })`. No performance tracing.
- `initSentry()` must be called BEFORE `express` is required in the entry file (so the SDK instruments express/http/pg). `Sentry.setupExpressErrorHandler(app)` is called after routes, before the app's own error middleware, and ONLY when Sentry is enabled.
- The uptime monitor is a standalone process (survives a monitored service crashing); it emails via `require('../services/emailService')` (lazily, inside `main()`, so importing the module doesn't create a pg Pool). It never imports `db.js`.
- New env vars: `SENTRY_DSN` (both backends), `OPS_ALERT_RECIPIENTS`, `UPTIME_INTERVAL_MS` (default 120000), `UPTIME_URLS` (default the five). Documented in each `.env.example`.
- The 5 default URLs: `http://localhost:4000/health`, `http://localhost:4001/health`, `http://localhost:3001/`, `http://localhost:3002/`, `http://localhost:3003/board`. "Up" = HTTP 200 within a 5s timeout.
- No app-behavior changes to existing routes. Ships through the required CI gate (imms-backend `test:ci`, mcs-backend vitest). New IMMS tests live under `backend/__tests__/unit/observability/` (NOT `integration/`/`e2e/`, so they run in `test:ci`).

## File Structure

```
backend/package.json                                   MODIFY  add @sentry/node
backend/src/observability/sentry.js                    NEW     initSentry() + Sentry export
backend/index.js                                       MODIFY  init Sentry (top) + error handler
maintenance_call_system/backend/package.json           MODIFY  add @sentry/node
maintenance_call_system/backend/src/observability/sentry.js  NEW  same, for MCS
maintenance_call_system/backend/index.js               MODIFY  init Sentry (top) + error handler
backend/src/observability/uptimeCheck.js               NEW     computeTransitions() pure logic
backend/src/scripts/uptimeMonitor.js                   NEW     the runnable monitor
ecosystem.prod.config.js                               MODIFY  add uptime-monitor PM2 app
backend/.env.example                                   MODIFY  SENTRY_DSN + uptime vars
maintenance_call_system/backend/.env.example           MODIFY  SENTRY_DSN
backend/__tests__/unit/observability/*.test.js         NEW     (jest)
maintenance_call_system/backend/src/observability/sentry.test.js  NEW  (vitest)
```

---

### Task 1: Sentry error tracking — IMMS backend

**Files:**
- Modify: `backend/package.json` (add dep)
- Create: `backend/src/observability/sentry.js`
- Modify: `backend/index.js` (top + before the error handler at line ~473)
- Test: `backend/__tests__/unit/observability/sentry.test.js`

**Interfaces:**
- Produces: `{ Sentry, initSentry }` from `sentry.js`. `initSentry() -> boolean` (true iff it initialized). Consumed by `backend/index.js`.

- [ ] **Step 1: Add the dependency**

Run (from `backend/`): `npm install @sentry/node@^10 --save`
Expected: `@sentry/node` appears in `backend/package.json` `dependencies`; `package-lock.json` updated; exit 0.

- [ ] **Step 2: Write the failing test**

Create `backend/__tests__/unit/observability/sentry.test.js`:

The Sentry client is INJECTED (default = the real one) so on/off gating is
testable in both jest and vitest without module mocking — `vi.mock('@sentry/node')`
cannot intercept the SDK's dual CJS/ESM conditional exports.

```javascript
const { initSentry } = require('../../../src/observability/sentry');

describe('initSentry', () => {
  const OLD = process.env.SENTRY_DSN;
  afterEach(() => { if (OLD === undefined) delete process.env.SENTRY_DSN; else process.env.SENTRY_DSN = OLD; });

  test('no-op and returns false when SENTRY_DSN is unset', () => {
    delete process.env.SENTRY_DSN;
    const sentry = { init: jest.fn() };
    expect(initSentry(sentry)).toBe(false);
    expect(sentry.init).not.toHaveBeenCalled();
  });

  test('initializes errors-only and returns true when SENTRY_DSN is set', () => {
    process.env.SENTRY_DSN = 'https://k@o0.ingest.sentry.io/0';
    const sentry = { init: jest.fn() };
    expect(initSentry(sentry)).toBe(true);
    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.init.mock.calls[0][0]).toMatchObject({ tracesSampleRate: 0 });
  });

  test('returns false (does not throw) when init throws', () => {
    process.env.SENTRY_DSN = 'bad';
    const sentry = { init: jest.fn(() => { throw new Error('bad dsn'); }) };
    expect(initSentry(sentry)).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run (from `backend/`): `npx jest __tests__/unit/observability/sentry.test.js --silent`
Expected: FAIL — `Cannot find module '.../src/observability/sentry'`.

- [ ] **Step 4: Write the init module**

Create `backend/src/observability/sentry.js`:

```javascript
'use strict';

// Error tracking via @sentry/node. Fully no-op unless SENTRY_DSN is set.
// initSentry() MUST be called before `express` is required in the entry file
// so the SDK can instrument express/http/pg. Errors only (no perf tracing).
// The Sentry client is injectable (default = the real module) so the on/off
// gating is testable in both jest and vitest without module mocking — vitest
// cannot intercept @sentry/node's dual CJS/ESM conditional exports.
const defaultSentry = require('@sentry/node');

function initSentry(sentry = defaultSentry) {
  if (!process.env.SENTRY_DSN) return false;
  try {
    sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.SENTRY_RELEASE || undefined,
      tracesSampleRate: 0,
    });
    return true;
  } catch (err) {
    console.error('[sentry] init failed; error tracking disabled:', err.message);
    return false;
  }
}

module.exports = { Sentry: defaultSentry, initSentry };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/unit/observability/sentry.test.js --silent`
Expected: PASS (3 tests).

- [ ] **Step 6: Wire into `backend/index.js`**

At the very top, change the first two lines:

```javascript
require('dotenv').config();
const express = require('express');
```

to:

```javascript
require('dotenv').config();
const { Sentry, initSentry } = require('./src/observability/sentry');
const sentryEnabled = initSentry(); // before express so the SDK can instrument it
const express = require('express');
```

Then, immediately before the existing error-handling middleware (currently at `backend/index.js:472-473`):

```javascript
// Error handling middleware
app.use((err, req, res, next) => {
```

insert:

```javascript
if (sentryEnabled) Sentry.setupExpressErrorHandler(app);

// Error handling middleware
app.use((err, req, res, next) => {
```

- [ ] **Step 7: Verify the app still loads and the suite passes**

Run (from `backend/`): `node -e "process.env.SENTRY_DSN=''; require('./src/observability/sentry').initSentry(); console.log('loads OK')"` → prints `loads OK`.
Then: `npm run test:ci` → 20 suites pass (19 prior + the new observability suite). (If the count differs, the new test file added 1 suite — expect 20.)

- [ ] **Step 8: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/observability/sentry.js backend/index.js backend/__tests__/unit/observability/sentry.test.js
git commit -m "feat(observability): Sentry error tracking in IMMS backend (off unless SENTRY_DSN)"
```

---

### Task 2: Sentry error tracking — MCS backend

**Files:**
- Modify: `maintenance_call_system/backend/package.json` (add dep)
- Create: `maintenance_call_system/backend/src/observability/sentry.js`
- Modify: `maintenance_call_system/backend/index.js` (top + before the error handler at line ~94)
- Test: `maintenance_call_system/backend/src/observability/sentry.test.js`

**Interfaces:**
- Produces: `{ Sentry, initSentry }` from the MCS `sentry.js`, identical shape to Task 1.

- [ ] **Step 1: Add the dependency**

Run (from `maintenance_call_system/backend/`): `npm install @sentry/node@^10 --save`
Expected: added to `dependencies`; lockfile updated; exit 0.

- [ ] **Step 2: Write the failing test**

Create `maintenance_call_system/backend/src/observability/sentry.test.js`:

The injected Sentry client (Task 1's DI form) makes this testable WITHOUT
`vi.mock` — which cannot intercept `@sentry/node`'s conditional exports.

```javascript
import { describe, it, expect, vi, afterEach } from 'vitest';

const { initSentry } = require('./sentry');

describe('initSentry (MCS)', () => {
  const OLD = process.env.SENTRY_DSN;
  afterEach(() => { if (OLD === undefined) delete process.env.SENTRY_DSN; else process.env.SENTRY_DSN = OLD; });

  it('no-ops and returns false without SENTRY_DSN', () => {
    delete process.env.SENTRY_DSN;
    const sentry = { init: vi.fn() };
    expect(initSentry(sentry)).toBe(false);
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('initializes errors-only with SENTRY_DSN', () => {
    process.env.SENTRY_DSN = 'https://k@o0.ingest.sentry.io/0';
    const sentry = { init: vi.fn() };
    expect(initSentry(sentry)).toBe(true);
    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.init.mock.calls[0][0].tracesSampleRate).toBe(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run (from `maintenance_call_system/backend/`): `npx vitest run src/observability/sentry.test.js`
Expected: FAIL — cannot find `./sentry`.

- [ ] **Step 4: Write the init module**

Create `maintenance_call_system/backend/src/observability/sentry.js` — identical content to Task 1 Step 4 (the `backend/src/observability/sentry.js` file), verbatim:

```javascript
'use strict';

// Error tracking via @sentry/node. Fully no-op unless SENTRY_DSN is set.
// initSentry() MUST be called before `express` is required in the entry file
// so the SDK can instrument express/http/pg. Errors only (no perf tracing).
// The Sentry client is injectable (default = the real module) so the on/off
// gating is testable in both jest and vitest without module mocking — vitest
// cannot intercept @sentry/node's dual CJS/ESM conditional exports.
const defaultSentry = require('@sentry/node');

function initSentry(sentry = defaultSentry) {
  if (!process.env.SENTRY_DSN) return false;
  try {
    sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.SENTRY_RELEASE || undefined,
      tracesSampleRate: 0,
    });
    return true;
  } catch (err) {
    console.error('[sentry] init failed; error tracking disabled:', err.message);
    return false;
  }
}

module.exports = { Sentry: defaultSentry, initSentry };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/observability/sentry.test.js`
Expected: PASS (2 tests). NOTE: if `vi.mock('@sentry/node', ...)` does not intercept in this vitest setup (the project's vitest has known relative-CJS mock quirks — but `@sentry/node` is a package, not a relative path, so it should intercept), and the test fails to mock, report BLOCKED with the error rather than changing the module — do not install a real DSN in tests.

- [ ] **Step 6: Wire into `maintenance_call_system/backend/index.js`**

Change the first line:

```javascript
require('dotenv').config();
```

to:

```javascript
require('dotenv').config();
const { Sentry, initSentry } = require('./src/observability/sentry');
const sentryEnabled = initSentry(); // before express so the SDK can instrument it
```

Then, immediately before the existing error handler (currently at `maintenance_call_system/backend/index.js:94`):

```javascript
app.use((err, req, res, next) => {
```

insert:

```javascript
if (sentryEnabled) Sentry.setupExpressErrorHandler(app);

app.use((err, req, res, next) => {
```

- [ ] **Step 7: Verify the module loads and the full MCS suite passes**

Run (from `maintenance_call_system/backend/`): `node -e "require('./src/observability/sentry').initSentry(); console.log('loads OK')"` → `loads OK`.
Then: `npx vitest run` → all pass (prior count + 2 new).

- [ ] **Step 8: Commit**

```bash
git add maintenance_call_system/backend/package.json maintenance_call_system/backend/package-lock.json maintenance_call_system/backend/src/observability/sentry.js maintenance_call_system/backend/index.js maintenance_call_system/backend/src/observability/sentry.test.js
git commit -m "feat(observability): Sentry error tracking in MCS backend (off unless SENTRY_DSN)"
```

---

### Task 3: Uptime transition logic (pure)

**Files:**
- Create: `backend/src/observability/uptimeCheck.js`
- Test: `backend/__tests__/unit/observability/uptimeCheck.test.js`

**Interfaces:**
- Produces: `computeTransitions(prevStates, results) -> { transitions: [{ url, up }], states: { [url]: boolean } }`. `prevStates` is `{ [url]: boolean }`; `results` is `[{ url, up: boolean }]`. Consumed by Task 4.

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/unit/observability/uptimeCheck.test.js`:

```javascript
const { computeTransitions } = require('../../../src/observability/uptimeCheck');

test('first observation: all up -> no transitions, states recorded', () => {
  const { transitions, states } = computeTransitions({}, [{ url: 'a', up: true }, { url: 'b', up: true }]);
  expect(transitions).toEqual([]);
  expect(states).toEqual({ a: true, b: true });
});

test('first observation: a down URL alerts immediately', () => {
  const { transitions, states } = computeTransitions({}, [{ url: 'a', up: false }]);
  expect(transitions).toEqual([{ url: 'a', up: false }]);
  expect(states).toEqual({ a: false });
});

test('steady up -> no transition', () => {
  const { transitions } = computeTransitions({ a: true }, [{ url: 'a', up: true }]);
  expect(transitions).toEqual([]);
});

test('up -> down transition', () => {
  const { transitions, states } = computeTransitions({ a: true }, [{ url: 'a', up: false }]);
  expect(transitions).toEqual([{ url: 'a', up: false }]);
  expect(states.a).toBe(false);
});

test('down -> up recovery transition', () => {
  const { transitions } = computeTransitions({ a: false }, [{ url: 'a', up: true }]);
  expect(transitions).toEqual([{ url: 'a', up: true }]);
});

test('mixed: only the changed URL transitions', () => {
  const { transitions } = computeTransitions({ a: true, b: true }, [{ url: 'a', up: true }, { url: 'b', up: false }]);
  expect(transitions).toEqual([{ url: 'b', up: false }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx jest __tests__/unit/observability/uptimeCheck.test.js --silent`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `backend/src/observability/uptimeCheck.js`:

```javascript
'use strict';

// Pure: given previous up/down states and this round's results, return the
// transitions worth alerting on plus the updated states. No I/O.
//   prevStates: { [url]: boolean }
//   results:    [{ url, up: boolean }]
//   returns:    { transitions: [{ url, up }], states: { [url]: boolean } }
// First observation of a URL alerts only if it is DOWN (so a service already
// down when the monitor starts is surfaced); an already-up URL is recorded
// silently.
function computeTransitions(prevStates, results) {
  const states = { ...prevStates };
  const transitions = [];
  for (const { url, up } of results) {
    const prev = prevStates[url];
    if (prev === undefined) {
      states[url] = up;
      if (!up) transitions.push({ url, up: false });
    } else if (prev !== up) {
      states[url] = up;
      transitions.push({ url, up });
    }
  }
  return { transitions, states };
}

module.exports = { computeTransitions };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/observability/uptimeCheck.test.js --silent`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/observability/uptimeCheck.js backend/__tests__/unit/observability/uptimeCheck.test.js
git commit -m "feat(observability): uptime transition logic (alert only on state change)"
```

---

### Task 4: Uptime monitor script

**Files:**
- Create: `backend/src/scripts/uptimeMonitor.js`
- Test: `backend/__tests__/unit/observability/uptimeMonitor.test.js`

**Interfaces:**
- Consumes: `computeTransitions` (Task 3); the existing `emailService.sendEmail(subject, html, recipient)` (required lazily inside `main()`).
- Produces: `runOnce(prevStates, { urls, recipients, emailService, fetchImpl, now }) -> Promise<states>` and `checkUrl(url, fetchImpl) -> Promise<{ url, up }>`. `main()` is the runnable entry (not exported behavior; guarded by `require.main === module`).

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/unit/observability/uptimeMonitor.test.js`:

```javascript
const { runOnce, checkUrl } = require('../../../src/scripts/uptimeMonitor');

const okEmail = () => ({ sendEmail: jest.fn().mockResolvedValue({}) });

test('checkUrl: 200 is up, non-200 is down, throw is down', async () => {
  expect(await checkUrl('u', async () => ({ status: 200 }))).toEqual({ url: 'u', up: true });
  expect(await checkUrl('u', async () => ({ status: 500 }))).toEqual({ url: 'u', up: false });
  expect(await checkUrl('u', async () => { throw new Error('refused'); })).toEqual({ url: 'u', up: false });
});

test('emails on up->down transition, to the recipients', async () => {
  const email = okEmail();
  const states = await runOnce(
    { 'http://x/health': true },
    { urls: ['http://x/health'], recipients: ['a@b.com'], emailService: email,
      fetchImpl: async () => ({ status: 500 }), now: () => new Date('2026-06-01T00:00:00Z') }
  );
  expect(states['http://x/health']).toBe(false);
  expect(email.sendEmail).toHaveBeenCalledTimes(1);
  const [subject, html, recipient] = email.sendEmail.mock.calls[0];
  expect(subject).toContain('DOWN');
  expect(html).toContain('http://x/health');
  expect(recipient).toBe('a@b.com');
});

test('no email when there is no transition', async () => {
  const email = okEmail();
  await runOnce({ 'http://x/health': true },
    { urls: ['http://x/health'], recipients: ['a@b.com'], emailService: email,
      fetchImpl: async () => ({ status: 200 }) });
  expect(email.sendEmail).not.toHaveBeenCalled();
});

test('no email when recipients is empty (feature off)', async () => {
  const email = okEmail();
  await runOnce({ 'http://x/health': true },
    { urls: ['http://x/health'], recipients: [], emailService: email,
      fetchImpl: async () => ({ status: 500 }) });
  expect(email.sendEmail).not.toHaveBeenCalled();
});

test('a failed alert email does not throw out of runOnce', async () => {
  const email = { sendEmail: jest.fn().mockRejectedValue(new Error('smtp down')) };
  const states = await runOnce({ 'http://x/health': true },
    { urls: ['http://x/health'], recipients: ['a@b.com'], emailService: email,
      fetchImpl: async () => ({ status: 500 }) });
  expect(states['http://x/health']).toBe(false); // still returns updated states
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx jest __tests__/unit/observability/uptimeMonitor.test.js --silent`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `backend/src/scripts/uptimeMonitor.js`:

```javascript
'use strict';

// Standalone uptime monitor (its own PM2 process). Polls the prod URLs and
// emails OPS_ALERT_RECIPIENTS only on up/down transitions. No-op (no email)
// when OPS_ALERT_RECIPIENTS is empty. Requires emailService lazily inside
// main() so importing this module for tests does not create a pg Pool.
require('dotenv').config();
const { computeTransitions } = require('../observability/uptimeCheck');

const DEFAULT_URLS = [
  'http://localhost:4000/health',
  'http://localhost:4001/health',
  'http://localhost:3001/',
  'http://localhost:3002/',
  'http://localhost:3003/board',
];
const REQ_TIMEOUT_MS = 5000;

const parseList = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);

async function checkUrl(url, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQ_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    return { url, up: res.status === 200 };
  } catch {
    return { url, up: false };
  } finally {
    clearTimeout(timer);
  }
}

async function runOnce(prevStates, { urls, recipients, emailService, fetchImpl = fetch, now = () => new Date() }) {
  const results = await Promise.all(urls.map((u) => checkUrl(u, fetchImpl)));
  const { transitions, states } = computeTransitions(prevStates, results);
  if (transitions.length && recipients.length) {
    const down = transitions.filter((t) => !t.up).map((t) => t.url);
    const up = transitions.filter((t) => t.up).map((t) => t.url);
    const parts = [];
    if (down.length) parts.push(`DOWN: ${down.join(', ')}`);
    if (up.length) parts.push(`RECOVERED: ${up.join(', ')}`);
    const subject = `[IMMS uptime] ${parts.join(' | ')}`;
    const html =
      `<p>Uptime status change at ${now().toISOString()}:</p><ul>` +
      transitions.map((t) => `<li>${t.url} &rarr; ${t.up ? 'UP' : 'DOWN'}</li>`).join('') +
      '</ul>';
    try {
      await emailService.sendEmail(subject, html, recipients.join(', '));
    } catch (err) {
      console.error('[uptime] alert email failed:', err.message);
    }
  }
  return states;
}

function main() {
  const emailService = require('../services/emailService');
  const urls = parseList(process.env.UPTIME_URLS).length ? parseList(process.env.UPTIME_URLS) : DEFAULT_URLS;
  const recipients = parseList(process.env.OPS_ALERT_RECIPIENTS);
  const interval = parseInt(process.env.UPTIME_INTERVAL_MS, 10) || 120000;
  console.log(`[uptime] watching ${urls.length} URLs every ${interval}ms; alerts: ${recipients.length ? recipients.join(',') : 'OFF (no OPS_ALERT_RECIPIENTS)'}`);

  let states = {};
  const tick = () => runOnce(states, { urls, recipients, emailService })
    .then((s) => { states = s; })
    .catch((e) => console.error('[uptime] round error:', e.message));
  tick();
  setInterval(tick, interval);
}

if (require.main === module) main();

module.exports = { runOnce, checkUrl };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/observability/uptimeMonitor.test.js --silent`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full CI test set (no regressions)**

Run (from `backend/`): `npm run test:ci`
Expected: all pass (prior 19 + the 3 new observability suites = 22 suites).

- [ ] **Step 6: Commit**

```bash
git add backend/src/scripts/uptimeMonitor.js backend/__tests__/unit/observability/uptimeMonitor.test.js
git commit -m "feat(observability): standalone uptime monitor (transition-only email alerts)"
```

---

### Task 5: PM2 app + env documentation

**Files:**
- Modify: `ecosystem.prod.config.js` (add `uptime-monitor`)
- Modify: `backend/.env.example`
- Modify: `maintenance_call_system/backend/.env.example`

**Interfaces:**
- Consumes: `backend/src/scripts/uptimeMonitor.js` (Task 4).
- Produces: the `uptime-monitor` PM2 app; documented env vars.

- [ ] **Step 1: Add the PM2 app**

In `ecosystem.prod.config.js`, inside the `apps` array, after the `imms-web-network` app object (the last one), add:

```javascript
    {
      ...common,
      // Standalone uptime monitor — separate process so it survives any single
      // service crashing. No NODE_ENV override (mirrors imms-api; it requires
      // emailService whose pg Pool must not get the production-SSL treatment).
      // No-op (no email) until OPS_ALERT_RECIPIENTS is set in backend/.env.
      name: 'uptime-monitor',
      cwd: path.join(__dirname, 'backend'),
      script: 'src/scripts/uptimeMonitor.js',
      max_memory_restart: '100M',
    },
```

- [ ] **Step 2: Verify the ecosystem still parses and lists 6 apps**

Run (repo root): `node -e "const c=require('./ecosystem.prod.config.js'); console.log(c.apps.map(a=>a.name).join(' '))"`
Expected: `imms-api mcs-api mcs-web imms-web-local imms-web-network uptime-monitor`.

- [ ] **Step 3: Document env vars — IMMS backend**

In `backend/.env.example`, append:

```
# ─── Observability ──────────────────────────────────────────────────────────
# Error tracking DSN (Sentry.io or a self-hosted GlitchTip project). Empty = off.
SENTRY_DSN=
# Optional release tag reported with errors.
SENTRY_RELEASE=
# Uptime alerts: comma-separated recipients. Empty = uptime alerts off.
OPS_ALERT_RECIPIENTS=
# Uptime poll interval (ms) and the URLs to check (comma-separated; defaults to
# the five prod URLs).
UPTIME_INTERVAL_MS=120000
UPTIME_URLS=
```

- [ ] **Step 4: Document env vars — MCS backend**

In `maintenance_call_system/backend/.env.example`, append:

```
# ─── Observability ──────────────────────────────────────────────────────────
# Error tracking DSN (Sentry.io or a self-hosted GlitchTip project). Empty = off.
SENTRY_DSN=
SENTRY_RELEASE=
```

- [ ] **Step 5: Commit**

```bash
git add ecosystem.prod.config.js backend/.env.example maintenance_call_system/backend/.env.example
git commit -m "feat(observability): uptime-monitor PM2 app + env docs"
```

- [ ] **Step 6: Manual dev acceptance (final — do with the user, not a subagent)**

In dev, set `OPS_ALERT_RECIPIENTS` to a test inbox in `backend/.env`, `node src/scripts/uptimeMonitor.js`, stop a dev service, confirm one DOWN email; restart it, confirm one RECOVERED email. Separately, set a test `SENTRY_DSN`, trigger a 500, confirm it appears in the dashboard. Requires live SMTP + a Sentry/GlitchTip project — deferred to a session with the user.

---

## Self-Review (completed at write time)

- **Spec coverage:** Sentry both backends off-by-default errors-only (T1, T2); wired to each Express error path (T1 S6, T2 S6); uptime transition logic (T3); standalone monitor, transition-only, off-by-default, reuses emailService lazily (T4); PM2 app + env docs both backends (T5); manual acceptance (T5 S6). Non-goals (frontends, perf, external SaaS, status page) correctly excluded.
- **Placeholder scan:** every code/test/command step is complete; the one manual step (T5 S6) genuinely needs live SMTP + a Sentry project, labelled as such.
- **Type consistency:** `initSentry() -> boolean` and `{ Sentry, initSentry }` identical across T1/T2; `computeTransitions(prevStates, results) -> { transitions, states }` defined in T3 and consumed in T4; `runOnce(prevStates, { urls, recipients, emailService, fetchImpl, now })` / `checkUrl(url, fetchImpl)` consistent between T4 impl and test; PM2 app name `uptime-monitor` consistent T5/spec.
- **CI:** new IMMS tests are under `__tests__/unit/observability/` (not `integration/`/`e2e/`), so `test:ci` runs them; `@sentry/node` is pure-JS and installs under CI `npm ci`. Suite count grows to 22 IMMS suites.
```
