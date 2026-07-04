# Monthly Analytics Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** IMMS emails a branded monthly maintenance-analytics report (HTML summary + PDF) to a recipient list on the first business day of each month, covering the previous calendar month.

**Architecture:** A new monthly job in IMMS's existing `notifications` cron scheduler mints a short-lived `admin` JWT (shared `JWT_SECRET`), fetches MCS's existing `/stats/metrics` (JSON) and `/mcs/analytics/pdf` (PDF) endpoints, builds an HTML summary, and sends via IMMS's existing `emailService.sendEmailWithAttachment`. No MCS changes, no new npm dependencies.

**Tech Stack:** Node 22 (global `fetch`), jest, `node-cron` (already a dep), `jsonwebtoken` (already a dep), the existing `emailService` singleton.

**Spec:** `docs/superpowers/specs/2026-07-04-monthly-analytics-email-design.md`

## Global Constraints

- Branch: all commits on `feat/monthly-analytics-email`.
- **IMMS backend only.** No changes to the MCS app or to MCS's endpoints.
- **No new npm dependencies.** Use global `fetch`, existing `node-cron`, `jsonwebtoken`, and the existing `emailService`.
- Service token: `jwt.sign({ id: 0, username: 'imms-scheduler', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '5m' })`. `role: admin` passes MCS's `analytics_view` check.
- MCS endpoint paths (mounted in `maintenance_call_system/backend/index.js`): metrics `/api/v1/maintenance-calls/stats/metrics`, PDF `/api/v1/mcs/analytics/pdf`. `MCS_BASE_URL` defaults to `http://localhost:4001/api/v1`, so client paths are `/maintenance-calls/stats/metrics` and `/mcs/analytics/pdf`.
- New env vars: `ANALYTICS_RECIPIENTS` (comma-separated, empty → no-op), `MCS_BASE_URL` (default `http://localhost:4001/api/v1`), `MONTHLY_ANALYTICS_CRON` (default `0 7 1-5 * *`).
- Reporting period: previous full calendar month. Schedule: cron fires in the window, handler sends only if `isFirstBusinessDay(now)`. "Business day" = weekday (Mon–Fri); holidays not considered.
- On generation/send failure: log the error AND send a plain "could not be generated" notice via `emailService.sendEmail` (no attachment).
- `emailService.sendEmailWithAttachment(subject, htmlContent, recipient, attachments)` — attachments are `[{ filename, content: <Buffer>, contentType: 'application/pdf' }]`. Recipient is a comma-joined string.
- Follow the `digest.js` style: plain functions, dependency injection, jest tests with `jest.fn()` mocks. Source in `backend/src/services/notifications/monthlyAnalytics/`; tests in `backend/__tests__/unit/notifications/`.
- Run tests from `backend/`: `npx jest <path> --silent`.

## File Structure

```
backend/src/services/notifications/monthlyAnalytics/
  period.js              NEW  previousMonthRange(now), isFirstBusinessDay(now)   [pure]
  summaryHtml.js         NEW  buildSummaryHtml(metrics, label)                   [pure]
  mcsAnalyticsClient.js  NEW  fetchMetrics(from,to), fetchPdf(from,to), mintToken()
  index.js               NEW  sendMonthlyAnalyticsReport({ mcsClient, emailService, recipients, now, log })
backend/src/services/notifications/index.js   MODIFY  register the monthly cron
backend/src/scripts/sendMonthlyReport.js      NEW     on-demand runner (report:monthly)
backend/package.json                          MODIFY  add "report:monthly" script
backend/.env.example                          MODIFY  document the 3 new env vars
backend/__tests__/unit/notifications/
  monthlyPeriod.test.js       NEW
  monthlySummaryHtml.test.js  NEW
  monthlyMcsClient.test.js    NEW
  monthlyReport.test.js       NEW
```

---

### Task 1: Period & business-day helpers

**Files:**
- Create: `backend/src/services/notifications/monthlyAnalytics/period.js`
- Test: `backend/__tests__/unit/notifications/monthlyPeriod.test.js`

**Interfaces:**
- Produces: `previousMonthRange(now: Date) -> { from: string(ISO), to: string(ISO), label: string }`; `isFirstBusinessDay(now: Date) -> boolean`. Consumed by Task 4 (orchestrator) and Task 5 (cron guard).

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/unit/notifications/monthlyPeriod.test.js`:

```javascript
const { previousMonthRange, isFirstBusinessDay } = require('../../../src/services/notifications/monthlyAnalytics/period');

describe('previousMonthRange', () => {
  test('mid-year: July now -> June range and label', () => {
    const { from, to, label } = previousMonthRange(new Date(2026, 6, 15)); // Jul 15 2026 (local)
    expect(label).toBe('June 2026');
    expect(from < to).toBe(true);
    // from is the June 1 local instant; its local month is June (5)
    expect(new Date(from).getMonth()).toBe(5);
    expect(new Date(from).getDate()).toBe(1);
  });

  test('January now -> December of previous year', () => {
    const { label } = previousMonthRange(new Date(2026, 0, 15)); // Jan 15 2026
    expect(label).toBe('December 2025');
  });
});

describe('isFirstBusinessDay', () => {
  // 2026 anchors (verified): Jan 1 = Thu; Mar 1 = Sun; Aug 1 = Sat.
  test('true when the 1st is a weekday and it is the 1st', () => {
    expect(isFirstBusinessDay(new Date(2026, 0, 1))).toBe(true);   // Thu Jan 1
  });
  test('false on the 2nd when the 1st was a weekday', () => {
    expect(isFirstBusinessDay(new Date(2026, 0, 2))).toBe(false);  // Fri Jan 2
  });
  test('false on a weekend first-of-month', () => {
    expect(isFirstBusinessDay(new Date(2026, 7, 1))).toBe(false);  // Sat Aug 1
    expect(isFirstBusinessDay(new Date(2026, 7, 2))).toBe(false);  // Sun Aug 2
  });
  test('true on the Monday after a weekend first-of-month', () => {
    expect(isFirstBusinessDay(new Date(2026, 7, 3))).toBe(true);   // Mon Aug 3
    expect(isFirstBusinessDay(new Date(2026, 2, 2))).toBe(true);   // Mon Mar 2 (Mar 1 = Sun)
  });
  test('false on a mid-month weekday', () => {
    expect(isFirstBusinessDay(new Date(2026, 0, 15))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx jest __tests__/unit/notifications/monthlyPeriod.test.js --silent`
Expected: FAIL — `Cannot find module '.../monthlyAnalytics/period'`.

- [ ] **Step 3: Write the implementation**

Create `backend/src/services/notifications/monthlyAnalytics/period.js`:

```javascript
'use strict';

// Previous full calendar month as ISO datetime bounds + a display label.
// Computed in the server's local timezone (the plant's timezone); on a
// negative-UTC-offset host the ISO conversion keeps the correct calendar date.
function previousMonthRange(now) {
  const y = now.getFullYear();
  const m = now.getMonth();                       // 0-11, current month
  const from = new Date(y, m - 1, 1, 0, 0, 0, 0); // first instant of last month
  const to = new Date(y, m, 0, 23, 59, 59, 999);  // day 0 of this month = last day of last month
  const label = from.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  return { from: from.toISOString(), to: to.toISOString(), label };
}

// True iff `now` is the first weekday (Mon-Fri) of its calendar month.
// Holidays are not considered.
function isFirstBusinessDay(now) {
  const dow = now.getDay();               // 0=Sun .. 6=Sat
  if (dow === 0 || dow === 6) return false;
  const day = now.getDate();
  for (let d = 1; d < day; d++) {
    const earlier = new Date(now.getFullYear(), now.getMonth(), d).getDay();
    if (earlier !== 0 && earlier !== 6) return false; // an earlier weekday existed
  }
  return true;
}

module.exports = { previousMonthRange, isFirstBusinessDay };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/notifications/monthlyPeriod.test.js --silent`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/notifications/monthlyAnalytics/period.js backend/__tests__/unit/notifications/monthlyPeriod.test.js
git commit -m "feat(notifications): month-range and first-business-day helpers"
```

---

### Task 2: Summary HTML builder

**Files:**
- Create: `backend/src/services/notifications/monthlyAnalytics/summaryHtml.js`
- Test: `backend/__tests__/unit/notifications/monthlySummaryHtml.test.js`

**Interfaces:**
- Consumes: the metrics JSON shape from MCS `/stats/metrics` — `{ overall: { total_calls, total_downtime_hours, total_downtime_cost, avg_repair_minutes }, repeat_failures: [{ machine_name, reason_category, occurrences }] }` (all values are strings or null).
- Produces: `buildSummaryHtml(metrics, label: string) -> string`. Consumed by Task 4.

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/unit/notifications/monthlySummaryHtml.test.js`:

```javascript
const { buildSummaryHtml } = require('../../../src/services/notifications/monthlyAnalytics/summaryHtml');

const metrics = {
  overall: { total_calls: '42', total_downtime_hours: '18.5', total_downtime_cost: '2400.00', avg_repair_minutes: '31.2' },
  repeat_failures: [{ machine_name: 'Press 701', reason_category: 'mechanical', occurrences: '5' }],
};

test('includes the label and headline figures', () => {
  const html = buildSummaryHtml(metrics, 'June 2026');
  expect(html).toContain('June 2026');
  expect(html).toContain('42');
  expect(html).toContain('18.5');
  expect(html).toContain('2400.00');
  expect(html).toContain('31.2');
  expect(html).toContain('Press 701');
});

test('is null-safe: empty metrics render dashes without throwing', () => {
  const html = buildSummaryHtml({}, 'June 2026');
  expect(html).toContain('June 2026');
  expect(html).toContain('—');
  expect(html).toContain('None');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/notifications/monthlySummaryHtml.test.js --silent`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `backend/src/services/notifications/monthlyAnalytics/summaryHtml.js`:

```javascript
'use strict';

const dash = (v) => (v === null || v === undefined || v === '' ? '—' : v);

function buildSummaryHtml(metrics, label) {
  const o = (metrics && metrics.overall) || {};
  const top = metrics && Array.isArray(metrics.repeat_failures) ? metrics.repeat_failures[0] : null;
  const topLine = top
    ? `${top.machine_name} — ${top.reason_category || 'unspecified'} (${top.occurrences}×)`
    : 'None';
  const cost = o.total_downtime_cost != null && o.total_downtime_cost !== '' ? `$${o.total_downtime_cost}` : '—';

  return `<div style="font-family:Segoe UI,Arial,sans-serif;color:#23293a;max-width:560px;">
  <h2 style="color:#1a2744;margin:0 0 4px;">Maintenance Report — ${label}</h2>
  <p style="color:#6b7486;margin:0 0 12px;">Summary for ${label}. Full breakdown attached as PDF.</p>
  <table style="border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:4px 12px 4px 0;color:#6b7486;">Calls resolved</td><td style="padding:4px 0;font-weight:600;">${dash(o.total_calls)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7486;">Total downtime</td><td style="padding:4px 0;font-weight:600;">${dash(o.total_downtime_hours)} hrs</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7486;">Downtime cost</td><td style="padding:4px 0;font-weight:600;">${cost}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7486;">Avg repair time (MTTR)</td><td style="padding:4px 0;font-weight:600;">${dash(o.avg_repair_minutes)} min</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7486;">Top repeat offender</td><td style="padding:4px 0;font-weight:600;">${topLine}</td></tr>
  </table>
</div>`;
}

module.exports = { buildSummaryHtml };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/notifications/monthlySummaryHtml.test.js --silent`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/notifications/monthlyAnalytics/summaryHtml.js backend/__tests__/unit/notifications/monthlySummaryHtml.test.js
git commit -m "feat(notifications): monthly report email summary HTML builder"
```

---

### Task 3: MCS analytics client

**Files:**
- Create: `backend/src/services/notifications/monthlyAnalytics/mcsAnalyticsClient.js`
- Test: `backend/__tests__/unit/notifications/monthlyMcsClient.test.js`

**Interfaces:**
- Produces: `fetchMetrics(from, to) -> Promise<object>`; `fetchPdf(from, to) -> Promise<Buffer>`; `mintToken() -> string`. Consumed by Task 4/5. Reads `process.env.MCS_BASE_URL` and `process.env.JWT_SECRET` at call time.

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/unit/notifications/monthlyMcsClient.test.js`:

```javascript
const jwt = require('jsonwebtoken');
const client = require('../../../src/services/notifications/monthlyAnalytics/mcsAnalyticsClient');

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.MCS_BASE_URL = 'http://mcs.test/api/v1';
});
afterEach(() => { delete global.fetch; });

test('mintToken signs an admin token verifiable with the shared secret', () => {
  const decoded = jwt.verify(client.mintToken(), 'test-secret');
  expect(decoded.role).toBe('admin');
  expect(decoded.username).toBe('imms-scheduler');
});

test('fetchMetrics calls the metrics endpoint with a bearer token and returns JSON', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ overall: { total_calls: '5' } }) });
  const m = await client.fetchMetrics('2026-06-01T00:00:00.000Z', '2026-06-30T23:59:59.999Z');
  expect(m.overall.total_calls).toBe('5');
  const [url, opts] = global.fetch.mock.calls[0];
  expect(url).toContain('http://mcs.test/api/v1/maintenance-calls/stats/metrics');
  expect(url).toContain('from=');
  expect(url).toContain('to=');
  expect(opts.headers.Authorization).toMatch(/^Bearer .+/);
});

test('fetchPdf returns a Buffer from the analytics/pdf endpoint', async () => {
  const bytes = new TextEncoder().encode('%PDF-1.4 fake');
  global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => bytes.buffer });
  const buf = await client.fetchPdf('2026-06-01T00:00:00.000Z', '2026-06-30T23:59:59.999Z');
  expect(Buffer.isBuffer(buf)).toBe(true);
  expect(buf.toString('utf8')).toContain('%PDF-1.4');
  expect(global.fetch.mock.calls[0][0]).toContain('/mcs/analytics/pdf');
});

test('throws on a non-200 response', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
  await expect(client.fetchMetrics('a', 'b')).rejects.toThrow(/503/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/notifications/monthlyMcsClient.test.js --silent`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `backend/src/services/notifications/monthlyAnalytics/mcsAnalyticsClient.js`:

```javascript
'use strict';

const jwt = require('jsonwebtoken');

const TIMEOUT_MS = 30000; // PDF generation is the slow part

const baseUrl = () => process.env.MCS_BASE_URL || 'http://localhost:4001/api/v1';

// Short-lived admin service token, signed with the shared JWT_SECRET.
// role:admin passes MCS's requirePermission('analytics_view') admin bypass.
function mintToken() {
  return jwt.sign(
    { id: 0, username: 'imms-scheduler', role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );
}

async function request(path, from, to, asBuffer) {
  const url = `${baseUrl()}${path}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${mintToken()}` },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`MCS ${path} returned ${res.status}`);
    return asBuffer ? Buffer.from(await res.arrayBuffer()) : await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const fetchMetrics = (from, to) => request('/maintenance-calls/stats/metrics', from, to, false);
const fetchPdf = (from, to) => request('/mcs/analytics/pdf', from, to, true);

module.exports = { fetchMetrics, fetchPdf, mintToken };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/notifications/monthlyMcsClient.test.js --silent`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/notifications/monthlyAnalytics/mcsAnalyticsClient.js backend/__tests__/unit/notifications/monthlyMcsClient.test.js
git commit -m "feat(notifications): MCS analytics client (token mint + metrics/pdf fetch)"
```

---

### Task 4: Orchestrator

**Files:**
- Create: `backend/src/services/notifications/monthlyAnalytics/index.js`
- Test: `backend/__tests__/unit/notifications/monthlyReport.test.js`

**Interfaces:**
- Consumes: `previousMonthRange` (Task 1), `buildSummaryHtml` (Task 2); an injected `mcsClient` with `fetchMetrics(from,to)`/`fetchPdf(from,to)` (Task 3 shape); an injected `emailService` with `sendEmailWithAttachment(subject, html, recipient, attachments)` and `sendEmail(subject, html, recipient)`.
- Produces: `sendMonthlyAnalyticsReport({ mcsClient, emailService, recipients, now, log }) -> Promise<{ sent: boolean, reason: string }>`. Consumed by Task 5.

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/unit/notifications/monthlyReport.test.js`:

```javascript
const { sendMonthlyAnalyticsReport } = require('../../../src/services/notifications/monthlyAnalytics');

const metrics = { overall: { total_calls: '10', total_downtime_hours: '5', total_downtime_cost: '600', avg_repair_minutes: '20' }, repeat_failures: [] };
const pdf = Buffer.from('%PDF-1.4 fake');
const now = new Date(2026, 6, 1); // July 1 -> reports June
const silentLog = { warn: () => {}, error: () => {} };

function makeEmail() {
  return { sendEmailWithAttachment: jest.fn().mockResolvedValue({}), sendEmail: jest.fn().mockResolvedValue({}) };
}

test('happy path: fetches June, emails summary + PDF attachment', async () => {
  const mcsClient = { fetchMetrics: jest.fn().mockResolvedValue(metrics), fetchPdf: jest.fn().mockResolvedValue(pdf) };
  const emailService = makeEmail();
  const res = await sendMonthlyAnalyticsReport({ mcsClient, emailService, recipients: ['a@x.com', 'b@x.com'], now, log: silentLog });

  expect(res).toEqual({ sent: true, reason: 'ok' });
  // both endpoints called with the same period
  const [mFrom, mTo] = mcsClient.fetchMetrics.mock.calls[0];
  expect(mcsClient.fetchPdf).toHaveBeenCalledWith(mFrom, mTo);
  // one email with the joined recipients and the PDF buffer attached
  expect(emailService.sendEmailWithAttachment).toHaveBeenCalledTimes(1);
  const [subject, html, recipient, attachments] = emailService.sendEmailWithAttachment.mock.calls[0];
  expect(subject).toContain('June 2026');
  expect(html).toContain('June 2026');
  expect(recipient).toBe('a@x.com, b@x.com');
  expect(attachments[0].content).toBe(pdf);
  expect(attachments[0].contentType).toBe('application/pdf');
  expect(emailService.sendEmail).not.toHaveBeenCalled();
});

test('no recipients: returns no_recipients and sends nothing', async () => {
  const mcsClient = { fetchMetrics: jest.fn(), fetchPdf: jest.fn() };
  const emailService = makeEmail();
  const res = await sendMonthlyAnalyticsReport({ mcsClient, emailService, recipients: [], now, log: silentLog });
  expect(res).toEqual({ sent: false, reason: 'no_recipients' });
  expect(mcsClient.fetchMetrics).not.toHaveBeenCalled();
  expect(emailService.sendEmailWithAttachment).not.toHaveBeenCalled();
});

test('MCS failure: sends the plain failure notice and returns generation_failed', async () => {
  const mcsClient = { fetchMetrics: jest.fn().mockRejectedValue(new Error('MCS down')), fetchPdf: jest.fn() };
  const emailService = makeEmail();
  const res = await sendMonthlyAnalyticsReport({ mcsClient, emailService, recipients: ['a@x.com'], now, log: silentLog });
  expect(res).toEqual({ sent: false, reason: 'generation_failed' });
  expect(emailService.sendEmailWithAttachment).not.toHaveBeenCalled();
  expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
  const [subject, , recipient] = emailService.sendEmail.mock.calls[0];
  expect(subject).toContain('could not be generated');
  expect(recipient).toBe('a@x.com');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/notifications/monthlyReport.test.js --silent`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `backend/src/services/notifications/monthlyAnalytics/index.js`:

```javascript
'use strict';

const { previousMonthRange } = require('./period');
const { buildSummaryHtml } = require('./summaryHtml');

// Orchestrates the monthly report. All I/O is injected so this is unit-testable.
// recipients: string[]  emailService: { sendEmailWithAttachment, sendEmail }
async function sendMonthlyAnalyticsReport({ mcsClient, emailService, recipients, now, log = console }) {
  if (!recipients || recipients.length === 0) {
    (log.warn || console.warn)('[monthly-analytics] no recipients configured; skipping');
    return { sent: false, reason: 'no_recipients' };
  }

  const { from, to, label } = previousMonthRange(now);
  const recipient = recipients.join(', ');

  try {
    const metrics = await mcsClient.fetchMetrics(from, to);
    const pdf = await mcsClient.fetchPdf(from, to);
    const html = buildSummaryHtml(metrics, label);
    await emailService.sendEmailWithAttachment(
      `Maintenance Report — ${label}`,
      html,
      recipient,
      [{ filename: `maintenance-report-${label.replace(/\s+/g, '-')}.pdf`, content: pdf, contentType: 'application/pdf' }]
    );
    return { sent: true, reason: 'ok' };
  } catch (err) {
    (log.error || console.error)(`[monthly-analytics] generation failed: ${err.message}`);
    try {
      await emailService.sendEmail(
        `Maintenance Report — ${label} — could not be generated`,
        `<p>This month's maintenance analytics report (covering ${label}) could not be generated. ` +
        `The team has been notified; you can request a manual resend.</p>`,
        recipient
      );
    } catch (notifyErr) {
      (log.error || console.error)(`[monthly-analytics] failure notice also failed: ${notifyErr.message}`);
    }
    return { sent: false, reason: 'generation_failed' };
  }
}

module.exports = { sendMonthlyAnalyticsReport };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/notifications/monthlyReport.test.js --silent`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the whole notifications test group (no regressions)**

Run: `npx jest __tests__/unit/notifications --silent`
Expected: all pass (the existing digest/alerts/etc. tests plus the 4 new files).

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/notifications/monthlyAnalytics/index.js backend/__tests__/unit/notifications/monthlyReport.test.js
git commit -m "feat(notifications): monthly analytics report orchestrator"
```

---

### Task 5: Scheduler wiring, on-demand script, env docs

**Files:**
- Modify: `backend/src/services/notifications/index.js` (add the monthly cron to `startSchedulers`)
- Create: `backend/src/scripts/sendMonthlyReport.js`
- Modify: `backend/package.json` (add `report:monthly` script)
- Modify: `backend/.env.example` (document the 3 new env vars)

**Interfaces:**
- Consumes: `sendMonthlyAnalyticsReport` (Task 4), `mcsAnalyticsClient` (Task 3), `isFirstBusinessDay` (Task 1), the existing `emailService` singleton and `cron` already imported in `notifications/index.js`.
- Produces: a registered monthly cron job; `npm run report:monthly` on-demand runner. Terminal deliverable — verified by parse checks + a manual dev run.

- [ ] **Step 1: Add the monthly cron to the scheduler**

In `backend/src/services/notifications/index.js`, add these requires near the top (after the existing requires, before `createNotifications`):

```javascript
const { sendMonthlyAnalyticsReport } = require('./monthlyAnalytics');
const mcsAnalyticsClient = require('./monthlyAnalytics/mcsAnalyticsClient');
const { isFirstBusinessDay } = require('./monthlyAnalytics/period');
```

Then, inside `startSchedulers()`, immediately after the existing `cron.schedule(digestCron, ...)` block and before its `console.log`, add:

```javascript
    const monthlyCron = process.env.MONTHLY_ANALYTICS_CRON || '0 7 1-5 * *';
    cron.schedule(monthlyCron, () => {
      const now = new Date();
      if (!isFirstBusinessDay(now)) return; // only the first business day of the month
      const recipients = (process.env.ANALYTICS_RECIPIENTS || '')
        .split(',').map(s => s.trim()).filter(Boolean);
      sendMonthlyAnalyticsReport({ mcsClient: mcsAnalyticsClient, emailService, recipients, now })
        .catch(e => console.error('[notifications] monthly analytics error:', e.message));
    });
```

And extend the existing final `console.log` line in `startSchedulers` to mention it, changing:

```javascript
    console.log(`[notifications] reconciler every ${intervalMs}ms, digest at "${digestCron}"`);
```

to:

```javascript
    console.log(`[notifications] reconciler every ${intervalMs}ms, digest at "${digestCron}", monthly analytics at "${monthlyCron}" (first business day only)`);
```

(`emailService` is already in scope — it is required at the top of `createNotifications`.)

- [ ] **Step 2: Verify the module still loads**

Run (from `backend/`): `node -e "require('./src/services/notifications'); console.log('notifications module OK')"`
Expected: prints `notifications module OK` (no throw).

- [ ] **Step 3: Create the on-demand runner**

Create `backend/src/scripts/sendMonthlyReport.js`:

```javascript
'use strict';

// On-demand monthly report: `npm run report:monthly`.
// Dev testing and manual resends. Uses the real MCS client + email service.
require('dotenv').config();

const emailService = require('../services/emailService');
const mcsAnalyticsClient = require('../services/notifications/monthlyAnalytics/mcsAnalyticsClient');
const { sendMonthlyAnalyticsReport } = require('../services/notifications/monthlyAnalytics');

const recipients = (process.env.ANALYTICS_RECIPIENTS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

sendMonthlyAnalyticsReport({ mcsClient: mcsAnalyticsClient, emailService, recipients, now: new Date() })
  .then((r) => { console.log('[report:monthly]', r); process.exit(r.sent ? 0 : 1); })
  .catch((e) => { console.error('[report:monthly] error:', e); process.exit(1); });
```

- [ ] **Step 4: Add the npm script**

In `backend/package.json`, in `scripts`, add after the existing `"migrate"` line:

```json
    "report:monthly": "node src/scripts/sendMonthlyReport.js",
```

- [ ] **Step 5: Verify the script parses**

Run (from `backend/`): `node --check src/scripts/sendMonthlyReport.js && echo "script OK"`
Expected: prints `script OK`.

- [ ] **Step 6: Document the env vars**

In `backend/.env.example`, add (near the other notification vars such as `NOTIFICATION_RECIPIENTS` / `DIGEST_CRON`):

```
# ─── Monthly analytics email ────────────────────────────────────────────────
# Recipients of the monthly maintenance-analytics report (comma-separated).
# Empty = feature off.
ANALYTICS_RECIPIENTS=
# Base URL IMMS uses to reach the MCS API (must include /api/v1).
MCS_BASE_URL=http://localhost:4001/api/v1
# Cron window for the monthly send. The handler still only sends on the first
# business day of the month. Default: 7am on the first five days.
MONTHLY_ANALYTICS_CRON=0 7 1-5 * *
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/notifications/index.js backend/src/scripts/sendMonthlyReport.js backend/package.json backend/.env.example
git commit -m "feat(notifications): register monthly report cron + on-demand report:monthly script"
```

- [ ] **Step 8: Manual dev acceptance (final step — do with the user)**

Prerequisite: dev stack running (`start-dev.bat`), and in the dev `backend/.env` set `ANALYTICS_RECIPIENTS=<your test inbox>`, `MCS_BASE_URL=http://localhost:4101/api/v1` (dev MCS), and valid SMTP vars. From `backend/` run: `npm run report:monthly`.
Expected: `[report:monthly] { sent: true, reason: 'ok' }`, and the test inbox receives an email titled "Maintenance Report — <Month Year>" with the HTML summary and a PDF attached. If MCS is down, expect a "could not be generated" email and `{ sent: false, reason: 'generation_failed' }`.

---

## Self-Review (completed at write time)

- **Spec coverage:** schedule/first-business-day (T1 + T5 guard), previous-month period (T1), HTML summary + attachment (T2, T4), cross-app fetch with admin token (T3), orchestration + failure notice (T4), cron wiring + env + on-demand script (T5). Recipients via `ANALYTICS_RECIPIENTS` (T5 parse + T4 empty-guard). All spec decisions mapped.
- **Placeholder scan:** every code step contains complete code; no TBDs; the one manual step (T5 S8) is genuinely manual (needs live SMTP + MCS) and is labelled as the acceptance step, consistent with the spec.
- **Type consistency:** `previousMonthRange -> {from,to,label}`, `isFirstBusinessDay -> bool`, `buildSummaryHtml(metrics,label)`, `fetchMetrics/fetchPdf(from,to)`, `sendMonthlyAnalyticsReport({mcsClient,emailService,recipients,now,log})` are used identically across tasks. Attachment shape `{filename,content:Buffer,contentType:'application/pdf'}` matches `emailService.sendEmailWithAttachment` (verified in source). MCS paths match `maintenance_call_system/backend/index.js` mounts.
```
