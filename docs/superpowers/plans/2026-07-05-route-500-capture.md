# Route-500 Sentry Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Caught route-level 500s reach Sentry in both backends — MCS with real stack traces (at its `handler()` catches), IMMS via a 5xx-response middleware (contextual, covers all 234 sites) — all no-op unless `SENTRY_DSN` is set.

**Architecture:** Add a guarded `captureException(err)` to the existing `sentry.js` (both backends, kept byte-identical); MCS routers call it in their 500 branches; IMMS registers a `res.on('finish')` middleware at the top of `app.js` that reports 5xx responses.

**Tech Stack:** `@sentry/node@^10` (already a dep), jest (IMMS) + vitest (MCS), Express.

**Spec:** `docs/superpowers/specs/2026-07-05-route-500-capture-design.md`

## Global Constraints

- Branch: all commits on `feat/sentry-route-capture`.
- No new env vars. Everything gated by the existing `SENTRY_DSN` via a module `enabled` flag set in `initSentry()`. Fully no-op when unset.
- `backend/src/observability/sentry.js` and `maintenance_call_system/backend/src/observability/sentry.js` must remain **byte-identical** after this work.
- `captureException(err, sentry = defaultSentry)` — injectable client (default = real module) so it's testable in both jest and vitest without module mocking; never throws into its caller; a no-op unless `enabled`.
- MCS: capture only the **500 branch** — do NOT capture `DomainError` (deliberate 4xx) or the `err.code === '23505'` conflict (409). Insert `captureException(err)` immediately before each `return errors.serverError(res)`.
- IMMS: the middleware never touches the response; it only reads `res.statusCode` on `finish` and reports `status >= 500`. Registered at the TOP of `backend/src/app.js` (after `const app = express()`, before any routes) — verified single shared app (`index.js:36` does `const app = require('./src/app')`).
- No changes to any response body/status the client sees. No refactoring of the duplicated MCS `handler()` wrappers.
- New IMMS tests under `backend/__tests__/unit/observability/` (runs in `test:ci`). Ships through the required CI gate.

## File Structure

```
backend/src/observability/sentry.js                              MODIFY  + enabled flag + captureException
maintenance_call_system/backend/src/observability/sentry.js      MODIFY  identical change
backend/__tests__/unit/observability/captureException.test.js    NEW     (jest)
maintenance_call_system/backend/src/observability/captureException.test.js  NEW  (vitest)
maintenance_call_system/backend/src/routes/maintenanceCalls.js   MODIFY  2 sites (handler + inline catch)
maintenance_call_system/backend/src/routes/callBoardLayouts.js   MODIFY  1 site (handler)
maintenance_call_system/backend/src/routes/permissions.js        MODIFY  1 site (handler)
backend/src/observability/capture5xx.js                          NEW     the middleware
backend/src/app.js                                               MODIFY  register capture5xx at top
backend/__tests__/unit/observability/capture5xx.test.js          NEW     (jest)
docs/ENGINEERING_MATURITY_ROADMAP.md                             MODIFY  mark §2.2 done
```

---

### Task 1: `captureException` helper (both backends)

**Files:**
- Modify: `backend/src/observability/sentry.js`
- Modify: `maintenance_call_system/backend/src/observability/sentry.js` (identical)
- Test: `backend/__tests__/unit/observability/captureException.test.js` (jest)
- Test: `maintenance_call_system/backend/src/observability/captureException.test.js` (vitest)

**Interfaces:**
- Produces: `captureException(err, sentry = defaultSentry) -> void` from `sentry.js`; a module `enabled` flag set true inside `initSentry()` on success. Exports become `{ Sentry, initSentry, captureException }`. Consumed by Tasks 2 and 3.

- [ ] **Step 1: Write the failing jest test**

Create `backend/__tests__/unit/observability/captureException.test.js`:

```javascript
const { initSentry, captureException } = require('../../../src/observability/sentry');

describe('captureException', () => {
  const OLD = process.env.SENTRY_DSN;
  afterEach(() => { if (OLD === undefined) delete process.env.SENTRY_DSN; else process.env.SENTRY_DSN = OLD; });

  // Runs first, before any initSentry() call flips the module `enabled` flag.
  test('no-op when Sentry is not enabled', () => {
    const sentry = { captureException: jest.fn() };
    captureException(new Error('x'), sentry);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  test('forwards the error once Sentry is enabled', () => {
    process.env.SENTRY_DSN = 'https://k@o0.ingest.sentry.io/0';
    initSentry({ init: jest.fn() }); // flips module `enabled` true
    const sentry = { captureException: jest.fn() };
    const err = new Error('boom');
    captureException(err, sentry);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(err);
  });

  test('does not throw when the client capture throws', () => {
    process.env.SENTRY_DSN = 'https://k@o0.ingest.sentry.io/0';
    initSentry({ init: jest.fn() });
    const sentry = { captureException: jest.fn(() => { throw new Error('sentry down'); }) };
    expect(() => captureException(new Error('x'), sentry)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx jest __tests__/unit/observability/captureException.test.js --silent`
Expected: FAIL — `captureException is not a function`.

- [ ] **Step 3: Update `backend/src/observability/sentry.js`**

Replace the whole file with (adds `enabled` + `captureException`; the injectable/init parts are unchanged):

```javascript
'use strict';

// Error tracking via @sentry/node. Fully no-op unless SENTRY_DSN is set.
// initSentry() MUST be called before `express` is required in the entry file
// so the SDK can instrument express/http/pg. Errors only (no perf tracing).
// The Sentry client is injectable (default = the real module) so the on/off
// gating is testable in both jest and vitest without module mocking — vitest
// cannot intercept @sentry/node's dual CJS/ESM conditional exports.
const defaultSentry = require('@sentry/node');

let enabled = false;

function initSentry(sentry = defaultSentry) {
  if (!process.env.SENTRY_DSN) return false;
  try {
    sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.SENTRY_RELEASE || undefined,
      tracesSampleRate: 0,
    });
    enabled = true;
    return true;
  } catch (err) {
    console.error('[sentry] init failed; error tracking disabled:', err.message);
    return false;
  }
}

// Report an error to Sentry, but only when tracking is enabled. Safe to call
// from any route/middleware — a no-op (and never throws) when SENTRY_DSN is
// unset or the capture itself fails. Client is injectable for testing.
function captureException(err, sentry = defaultSentry) {
  if (!enabled) return;
  try {
    sentry.captureException(err);
  } catch (e) {
    console.error('[sentry] captureException failed:', e.message);
  }
}

module.exports = { Sentry: defaultSentry, initSentry, captureException };
```

- [ ] **Step 4: Run the jest test to verify it passes**

Run (from `backend/`): `npx jest __tests__/unit/observability/captureException.test.js --silent`
Expected: PASS (3 tests).

- [ ] **Step 5: Copy the identical file to MCS**

Overwrite `maintenance_call_system/backend/src/observability/sentry.js` with the EXACT same content from Step 3. Verify identical:

Run (repo root): `diff backend/src/observability/sentry.js maintenance_call_system/backend/src/observability/sentry.js && echo IDENTICAL`
Expected: `IDENTICAL` (no diff output).

- [ ] **Step 6: Write the MCS vitest test**

Create `maintenance_call_system/backend/src/observability/captureException.test.js`:

```javascript
import { describe, it, expect, vi, afterEach } from 'vitest';
const { initSentry, captureException } = require('./sentry');

describe('captureException (MCS)', () => {
  const OLD = process.env.SENTRY_DSN;
  afterEach(() => { if (OLD === undefined) delete process.env.SENTRY_DSN; else process.env.SENTRY_DSN = OLD; });

  it('no-ops when Sentry is not enabled', () => {
    const sentry = { captureException: vi.fn() };
    captureException(new Error('x'), sentry);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('forwards the error once Sentry is enabled', () => {
    process.env.SENTRY_DSN = 'https://k@o0.ingest.sentry.io/0';
    initSentry({ init: vi.fn() });
    const sentry = { captureException: vi.fn() };
    const err = new Error('boom');
    captureException(err, sentry);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(err);
  });
});
```

- [ ] **Step 7: Run both suites**

Run (from `backend/`): `npm run test:ci` → all green (adds the captureException suite).
Run (from `maintenance_call_system/backend/`): `npx vitest run src/observability/captureException.test.js` → 2 pass. Then `npx vitest run` → fully green.

- [ ] **Step 8: Commit**

```bash
git add backend/src/observability/sentry.js maintenance_call_system/backend/src/observability/sentry.js backend/__tests__/unit/observability/captureException.test.js maintenance_call_system/backend/src/observability/captureException.test.js
git commit -m "feat(observability): guarded captureException helper (both backends)"
```

---

### Task 2: MCS route-500 capture

**Files:**
- Modify: `maintenance_call_system/backend/src/routes/maintenanceCalls.js` (2 sites)
- Modify: `maintenance_call_system/backend/src/routes/callBoardLayouts.js` (1 site)
- Modify: `maintenance_call_system/backend/src/routes/permissions.js` (1 site)

**Interfaces:**
- Consumes: `captureException` from `../observability/sentry` (Task 1).

**Note on testing:** the `handler()` wrappers are file-local and not exported, and the spec forbids refactoring them, so these insertions are covered by Task 1's `captureException` unit tests + the full MCS suite staying green + review confirming each insertion is in the 500 branch (not the `DomainError`/`23505` branches). No new dedicated test file.

- [ ] **Step 1: `maintenanceCalls.js` — add the import**

At the top of `maintenance_call_system/backend/src/routes/maintenanceCalls.js`, near the other requires, add:

```javascript
const { captureException } = require('../observability/sentry');
```

- [ ] **Step 2: `maintenanceCalls.js` — capture in the `handler()` 500 branch**

Find (around lines 21-30):

```javascript
const handler = (fn) => (req, res) => fn(req, res).catch((err) => {
  if (err instanceof DomainError) {
    if (err.status === 404) return errors.notFound(res, err.message);
    if (err.status === 409) return errors.conflict(res, err.message);
    return errors.badRequest(res, err.message);
  }
  log(req).error({ err }, 'Route error');
  return errors.serverError(res);
});
```

Add `captureException(err);` immediately before `return errors.serverError(res);` (after the `log(...)` line), so it only runs for non-`DomainError` errors:

```javascript
  log(req).error({ err }, 'Route error');
  captureException(err);
  return errors.serverError(res);
});
```

- [ ] **Step 3: `maintenanceCalls.js` — capture in the inline reader `.catch` 500 branch**

Find the inline reader-create catch (around lines 226-233):

```javascript
    .catch((err) => {
      if (err.code === '23505') return errors.conflict(res, 'reader_key already exists');
      log(req).error({ err }, 'Reader create error');
      return errors.serverError(res);
    })
```

Add `captureException(err);` before `return errors.serverError(res);` (so the `23505` 409 early-return is not captured):

```javascript
      log(req).error({ err }, 'Reader create error');
      captureException(err);
      return errors.serverError(res);
    })
```

- [ ] **Step 4: `callBoardLayouts.js` — import + capture**

Add the import near the top:

```javascript
const { captureException } = require('../observability/sentry');
```

Find the handler (lines 17-20):

```javascript
const handler = (fn) => (req, res) => fn(req, res).catch((err) => {
  log(req).error({ err }, 'Layouts route error');
  return errors.serverError(res);
});
```

Add capture before `return errors.serverError(res);`:

```javascript
  log(req).error({ err }, 'Layouts route error');
  captureException(err);
  return errors.serverError(res);
});
```

- [ ] **Step 5: `permissions.js` — import + capture**

Add the import near the top:

```javascript
const { captureException } = require('../observability/sentry');
```

Find the handler (lines 10-14):

```javascript
const handler = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    (req.log || console).error(err);
    return errors.serverError(res);
  });
```

Add capture before `return errors.serverError(res);`:

```javascript
    (req.log || console).error(err);
    captureException(err);
    return errors.serverError(res);
  });
```

- [ ] **Step 6: Verify no regression**

Run (from `maintenance_call_system/backend/`): `npx vitest run`
Expected: all pass (same count as before — these are additive 1-line calls, no behavior change to responses).

- [ ] **Step 7: Commit**

```bash
git add maintenance_call_system/backend/src/routes/maintenanceCalls.js maintenance_call_system/backend/src/routes/callBoardLayouts.js maintenance_call_system/backend/src/routes/permissions.js
git commit -m "feat(observability): capture MCS route-500s to Sentry (real stack traces)"
```

---

### Task 3: IMMS 5xx-response middleware

**Files:**
- Create: `backend/src/observability/capture5xx.js`
- Modify: `backend/src/app.js` (register at top)
- Test: `backend/__tests__/unit/observability/capture5xx.test.js` (jest)

**Interfaces:**
- Consumes: `captureException` from `./sentry` (Task 1).
- Produces: an Express middleware `capture5xx(req, res, next)` (default export via `module.exports`).

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/unit/observability/capture5xx.test.js`:

```javascript
const EventEmitter = require('events');
const sentry = require('../../../src/observability/sentry');
const capture5xx = require('../../../src/observability/capture5xx');

function fakeRes() { const r = new EventEmitter(); r.statusCode = 200; return r; }

describe('capture5xx middleware', () => {
  let spy;
  beforeEach(() => { spy = jest.spyOn(sentry, 'captureException').mockImplementation(() => {}); });
  afterEach(() => { spy.mockRestore(); });

  test('calls next and reports a 5xx response with method/path/status', () => {
    const req = { method: 'POST', originalUrl: '/api/v1/parts' };
    const res = fakeRes();
    const next = jest.fn();
    capture5xx(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    res.statusCode = 500;
    res.emit('finish');
    expect(spy).toHaveBeenCalledTimes(1);
    const err = spy.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('500');
    expect(err.message).toContain('POST /api/v1/parts');
  });

  test('does not report a 2xx response', () => {
    const res = fakeRes();
    capture5xx({ method: 'GET', originalUrl: '/x' }, res, jest.fn());
    res.statusCode = 200;
    res.emit('finish');
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx jest __tests__/unit/observability/capture5xx.test.js --silent`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the middleware**

Create `backend/src/observability/capture5xx.js`:

```javascript
'use strict';

// Express middleware: when a response finishes with a 5xx status, report it to
// Sentry (no-op when Sentry is disabled — captureException guards internally).
// IMMS routes swallow their errors and respond directly, so the original stack
// is gone; we capture the request context (method/path/status) instead. This
// never touches the response — it only listens for 'finish'.
const sentry = require('./sentry');

function capture5xx(req, res, next) {
  res.on('finish', () => {
    if (res.statusCode >= 500) {
      sentry.captureException(new Error(`HTTP ${res.statusCode} on ${req.method} ${req.originalUrl}`));
    }
  });
  next();
}

module.exports = capture5xx;
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `npx jest __tests__/unit/observability/capture5xx.test.js --silent`
Expected: PASS (2 tests).

- [ ] **Step 5: Register the middleware at the top of `backend/src/app.js`**

In `backend/src/app.js`, immediately after `const app = express();` (line 7), add:

```javascript
const app = express();

// Report any 5xx response to Sentry (no-op unless SENTRY_DSN is set). Registered
// before all routes so it covers every route in app.js and index.js.
const capture5xx = require('./observability/capture5xx');
app.use(capture5xx);
```

- [ ] **Step 6: Verify the app loads and the full suite passes**

Run (from `backend/`): `node -e "require('./src/app'); console.log('app loads OK')"` → prints `app loads OK`.
Then: `npm run test:ci` → all green (adds capture5xx suite).

- [ ] **Step 7: Commit**

```bash
git add backend/src/observability/capture5xx.js backend/src/app.js backend/__tests__/unit/observability/capture5xx.test.js
git commit -m "feat(observability): capture IMMS 5xx responses to Sentry (covers all routes)"
```

---

### Task 4: Mark roadmap §2.2 done

**Files:**
- Modify: `docs/ENGINEERING_MATURITY_ROADMAP.md`

- [ ] **Step 1: Update §2.2**

In `docs/ENGINEERING_MATURITY_ROADMAP.md`, find the `### 2.2 Error tracking + uptime monitoring` section and replace its `- **Trigger:**` line (the line beginning `- **Trigger:** Fire at cutover`) with:

```markdown
- **Status:** ✅ Done 2026-07-05 — Sentry (`@sentry/node`) in both backends,
  off unless `SENTRY_DSN` set; a standalone `uptime-monitor` PM2 app emails on
  up/down transitions of the 5 LAN URLs (off unless `OPS_ALERT_RECIPIENTS` set);
  and caught route-500s are captured (MCS with stacks at its `handler()` catches,
  IMMS via a 5xx-response middleware). Manual acceptance (live SMTP + a Sentry/
  GlitchTip project) is the remaining user step. Follow-up: frontend (React)
  error capture; performance tracing.
```

- [ ] **Step 2: Commit**

```bash
git add docs/ENGINEERING_MATURITY_ROADMAP.md
git commit -m "docs: mark roadmap §2.2 (error tracking + uptime) done"
```

---

## Self-Review (completed at write time)

- **Spec coverage:** `captureException` guarded helper both backends, byte-identical, injectable (T1); MCS capture at the handler + inline-catch 500 branches, DomainError/23505 excluded (T2); IMMS `res.on('finish')` 5xx middleware registered at app.js top (T3); no new env vars (reuses SENTRY_DSN via `enabled`); §2.2 marked done (T4). Non-goals (234-site refactor, handler DRY, frontend capture) excluded.
- **Placeholder scan:** all code/test/command steps complete; no TBD/TODO. MCS test-coverage rationale stated explicitly (T2 note) rather than left implicit.
- **Type consistency:** `captureException(err, sentry = defaultSentry)` defined in T1, consumed in T2 (`captureException(err)`) and T3 (`sentry.captureException(new Error(...))`); exports `{ Sentry, initSentry, captureException }` consistent; `enabled` flag set in `initSentry` and read in `captureException`; middleware name `capture5xx` consistent across T3 file, registration, and test.
- **Test note:** T3 test spies on `sentry.captureException` (property access in capture5xx is at call time, so the spy intercepts). T1 disabled-case test runs first so the module `enabled` flag is still false. Both are deliberate and correct.
```
