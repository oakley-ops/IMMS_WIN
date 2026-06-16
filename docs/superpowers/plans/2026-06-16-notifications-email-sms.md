# Notifications (Email + SMS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send inventory and purchase-order notifications over email (existing nodemailer) and SMS (Twilio), routed to admin+purchasing recipients, with instant inventory alerts via a reconciler plus a daily digest.

**Architecture:** A thin notification layer (`backend/src/services/notifications/`) with a single `NotificationService.notify(eventType, payload)` entry point, two pluggable channel adapters (`EmailChannel`, `SmsChannel`), per-event templates, a state-diff `InventoryReconciler`, and a `node-cron` daily digest. PO triggers are inline at the two status-change sites. Spec: `docs/superpowers/specs/2026-06-16-notifications-email-sms-design.md`.

**Tech Stack:** Node/Express, PostgreSQL (`pg`), `nodemailer` (installed), `node-cron` (installed), `twilio` (added in Task 1), Jest unit tests.

---

## File Structure

```
backend/src/services/notifications/
  config.js              # EVENTS, CHANNEL_MATRIX, RECIPIENT_ROLES
  templates.js           # renderEmail(eventType,payload) / renderSms(eventType,payload)
  alerts.js              # pure: statusFor(part), computeAlerts(parts, prevMap)
  channels/EmailChannel.js
  channels/SmsChannel.js # + createSmsChannel() factory from env
  NotificationService.js # resolveRecipients + notify + log
  InventoryReconciler.js # reconcile()/seedIfEmpty() using alerts.js
  digest.js              # buildDigest(pool) / sendDigest(pool, service)
  index.js               # createNotifications(pool) -> { service, reconciler, startSchedulers }
backend/migrations/
  20260616_add_phone_to_users.sql
  20260616_create_part_alert_state.sql
  20260616_create_notification_log.sql
  apply-one.js           # helper to apply a single .sql file (npm run migrate doesn't run dated files)
backend/__tests__/unit/notifications/
  alerts.test.js
  channels.test.js
  templates.test.js
  notificationService.test.js
  digest.test.js
backend/index.js         # MODIFY: boot schedulers after global.io
backend/src/controllers/PurchaseOrderController.js  # MODIFY: notify in updatePurchaseOrderStatus
backend/src/services/emailTrackingService.js        # MODIFY: notify on email-driven approve/hold
backend/.env.example     # MODIFY: Twilio + notification vars
```

Run a single test file with: `npx jest <path> -v` (run from `backend/`).
Commit after every task. Use this trailer on each commit:
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

### Task 1: Dependencies + config surface

**Files:**
- Modify: `backend/package.json` (adds `twilio` dependency via npm)
- Modify: `backend/.env.example`

- [ ] **Step 1: Install Twilio**

Run (from `backend/`): `npm install twilio`
Expected: `twilio` appears under `dependencies` in `backend/package.json`.

- [ ] **Step 2: Document env vars** — append to `backend/.env.example`:

```
# Notifications (Email reuses SMTP_* above; SMS uses Twilio)
NOTIFICATIONS_ENABLED=true
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM=+15555550123
DIGEST_CRON=0 7 * * *
RECONCILER_INTERVAL_MS=60000
```

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/.env.example
git commit -m "chore(notifications): add twilio dep and notification env vars"
```

---

### Task 2: Database migrations

**Files:**
- Create: `backend/migrations/20260616_add_phone_to_users.sql`
- Create: `backend/migrations/20260616_create_part_alert_state.sql`
- Create: `backend/migrations/20260616_create_notification_log.sql`
- Create: `backend/migrations/apply-one.js`

- [ ] **Step 1: Write `20260616_add_phone_to_users.sql`**

```sql
-- SMS target for admin/purchasing users
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(32);
```

- [ ] **Step 2: Write `20260616_create_part_alert_state.sql`**

```sql
-- Tracks the last-notified stock status per part (drives transition detection + dedupe)
CREATE TABLE IF NOT EXISTS part_alert_state (
  part_id     INTEGER PRIMARY KEY REFERENCES parts(part_id) ON DELETE CASCADE,
  last_status VARCHAR(16) NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 3: Write `20260616_create_notification_log.sql`**

```sql
-- Audit log of every notification send attempt
CREATE TABLE IF NOT EXISTS notification_log (
  id         BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(32) NOT NULL,
  channel    VARCHAR(16) NOT NULL,
  recipient  VARCHAR(255) NOT NULL,
  ref_id     VARCHAR(64),
  status     VARCHAR(16) NOT NULL,
  error      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notification_log_created_at ON notification_log (created_at DESC);
```

- [ ] **Step 4: Write `apply-one.js`** (dated migrations are not run by `npm run migrate`)

```js
// Usage: node migrations/apply-one.js <relative-or-absolute-sql-file>
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const file = process.argv[2];
if (!file) { console.error('Usage: node migrations/apply-one.js <file.sql>'); process.exit(1); }
const sql = fs.readFileSync(path.resolve(file), 'utf8');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(sql)
  .then(() => { console.log(`Applied ${file}`); return pool.end(); })
  .catch((e) => { console.error(`Failed ${file}:`, e.message); pool.end(); process.exit(1); });
```

- [ ] **Step 5: Apply all three migrations**

Run (from `backend/`):
```bash
node migrations/apply-one.js migrations/20260616_add_phone_to_users.sql
node migrations/apply-one.js migrations/20260616_create_part_alert_state.sql
node migrations/apply-one.js migrations/20260616_create_notification_log.sql
```
Expected: three `Applied ...` lines, no errors. Re-running is safe (idempotent).

- [ ] **Step 6: Commit**

```bash
git add backend/migrations/20260616_*.sql backend/migrations/apply-one.js
git commit -m "feat(notifications): migrations for users.phone, part_alert_state, notification_log"
```

---

### Task 3: Config constants

**Files:**
- Create: `backend/src/services/notifications/config.js`

- [ ] **Step 1: Write `config.js`**

```js
const EVENTS = {
  INVENTORY_LOW: 'inventory.low',
  INVENTORY_OUT: 'inventory.out',
  INVENTORY_DIGEST: 'inventory.digest',
  PO_SUBMITTED: 'po.submitted',
  PO_APPROVED: 'po.approved',
  PO_RECEIVED: 'po.received',
  PO_ON_HOLD: 'po.on_hold',
  PO_REJECTED: 'po.rejected',
};

// Which channels each event uses. Email carries everything; SMS only the urgent subset.
const CHANNEL_MATRIX = {
  'inventory.low': ['email'],
  'inventory.out': ['email', 'sms'],
  'inventory.digest': ['email'],
  'po.submitted': ['email'],
  'po.approved': ['email', 'sms'],
  'po.received': ['email'],
  'po.on_hold': ['email', 'sms'],
  'po.rejected': ['email', 'sms'],
};

const RECIPIENT_ROLES = ['admin', 'purchasing'];

module.exports = { EVENTS, CHANNEL_MATRIX, RECIPIENT_ROLES };
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/notifications/config.js
git commit -m "feat(notifications): event + channel-matrix config"
```

---

### Task 4: Pure alert logic (statusFor + computeAlerts)

**Files:**
- Create: `backend/src/services/notifications/alerts.js`
- Test: `backend/__tests__/unit/notifications/alerts.test.js`

- [ ] **Step 1: Write the failing test** (`alerts.test.js`)

```js
const { statusFor, computeAlerts } = require('../../../src/services/notifications/alerts');
const { EVENTS } = require('../../../src/services/notifications/config');

describe('statusFor', () => {
  test('out when qty 0', () => expect(statusFor({ quantity: 0, minimum_quantity: 5 })).toBe('out_of_stock'));
  test('low when qty <= min and > 0', () => expect(statusFor({ quantity: 2, minimum_quantity: 2 })).toBe('low_stock'));
  test('in_stock when qty > min', () => expect(statusFor({ quantity: 3, minimum_quantity: 2 })).toBe('in_stock'));
});

describe('computeAlerts', () => {
  const parts = [
    { part_id: 1, quantity: 2, minimum_quantity: 2 }, // in_stock -> low  => fire low
    { part_id: 2, quantity: 0, minimum_quantity: 5 }, // low -> out       => fire out
    { part_id: 3, quantity: 2, minimum_quantity: 2 }, // low -> low       => silent
    { part_id: 4, quantity: 9, minimum_quantity: 2 }, // out -> in_stock  => silent
    { part_id: 5, quantity: 1, minimum_quantity: 5 }, // out -> low       => silent (improving)
  ];
  const prev = new Map([[2, 'low_stock'], [3, 'low_stock'], [4, 'out_of_stock'], [5, 'out_of_stock']]);

  test('fires only on worsening transitions', () => {
    const { events } = computeAlerts(parts, prev);
    expect(events).toEqual([
      { part: parts[0], eventType: EVENTS.INVENTORY_LOW },
      { part: parts[1], eventType: EVENTS.INVENTORY_OUT },
    ]);
  });

  test('returns new state for every part', () => {
    const { newStates } = computeAlerts(parts, prev);
    expect(newStates).toEqual([
      { part_id: 1, status: 'low_stock' },
      { part_id: 2, status: 'out_of_stock' },
      { part_id: 3, status: 'low_stock' },
      { part_id: 4, status: 'in_stock' },
      { part_id: 5, status: 'low_stock' },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/notifications/alerts.test.js -v`
Expected: FAIL — "Cannot find module '.../alerts'".

- [ ] **Step 3: Write `alerts.js`**

```js
const { EVENTS } = require('./config');

const SEVERITY = { in_stock: 0, low_stock: 1, out_of_stock: 2 };

function statusFor(part) {
  if (Number(part.quantity) === 0) return 'out_of_stock';
  if (Number(part.quantity) <= Number(part.minimum_quantity)) return 'low_stock';
  return 'in_stock';
}

// parts: [{part_id, quantity, minimum_quantity, ...}], prevMap: Map<part_id, last_status>
function computeAlerts(parts, prevMap) {
  const events = [];
  const newStates = [];
  for (const part of parts) {
    const current = statusFor(part);
    const last = prevMap.get(part.part_id) || 'in_stock';
    if (SEVERITY[current] > SEVERITY[last]) {
      events.push({
        part,
        eventType: current === 'out_of_stock' ? EVENTS.INVENTORY_OUT : EVENTS.INVENTORY_LOW,
      });
    }
    newStates.push({ part_id: part.part_id, status: current });
  }
  return { events, newStates };
}

module.exports = { statusFor, computeAlerts };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/notifications/alerts.test.js -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/notifications/alerts.js backend/__tests__/unit/notifications/alerts.test.js
git commit -m "feat(notifications): pure stock-status + transition logic"
```

---

### Task 5: Channel adapters (Email + SMS)

**Files:**
- Create: `backend/src/services/notifications/channels/EmailChannel.js`
- Create: `backend/src/services/notifications/channels/SmsChannel.js`
- Test: `backend/__tests__/unit/notifications/channels.test.js`

- [ ] **Step 1: Write the failing test** (`channels.test.js`)

```js
const EmailChannel = require('../../../src/services/notifications/channels/EmailChannel');
const SmsChannel = require('../../../src/services/notifications/channels/SmsChannel');

describe('EmailChannel', () => {
  test('delegates to emailService.sendEmail(subject, body, to)', async () => {
    const emailService = { sendEmail: jest.fn().mockResolvedValue({ messageId: 'm1' }) };
    const ch = new EmailChannel(emailService);
    const res = await ch.send({ to: 'a@b.com', subject: 'Hi', body: '<b>x</b>' });
    expect(emailService.sendEmail).toHaveBeenCalledWith('Hi', '<b>x</b>', 'a@b.com');
    expect(res.ok).toBe(true);
    expect(ch.name).toBe('email');
  });
});

describe('SmsChannel', () => {
  test('sends via twilio client.messages.create', async () => {
    const client = { messages: { create: jest.fn().mockResolvedValue({ sid: 'SM1' }) } };
    const ch = new SmsChannel(client, '+15555550123');
    const res = await ch.send({ to: '+15555551234', body: 'hello' });
    expect(client.messages.create).toHaveBeenCalledWith({ to: '+15555551234', from: '+15555550123', body: 'hello' });
    expect(res).toEqual({ ok: true, id: 'SM1' });
    expect(ch.name).toBe('sms');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/notifications/channels.test.js -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `EmailChannel.js`**

```js
class EmailChannel {
  constructor(emailService) {
    this.emailService = emailService;
    this.name = 'email';
  }
  // content: { to, subject, body }
  async send({ to, subject, body }) {
    await this.emailService.sendEmail(subject, body, to);
    return { ok: true };
  }
}
module.exports = EmailChannel;
```

- [ ] **Step 4: Write `SmsChannel.js`**

```js
class SmsChannel {
  constructor(client, from) {
    this.client = client;
    this.from = from;
    this.name = 'sms';
  }
  // content: { to, body }
  async send({ to, body }) {
    const msg = await this.client.messages.create({ to, from: this.from, body });
    return { ok: true, id: msg.sid };
  }
}

// Returns a configured SmsChannel, or null if Twilio env is missing.
function createSmsChannel() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
    console.warn('[notifications] Twilio not configured — SMS disabled');
    return null;
  }
  const client = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  return new SmsChannel(client, TWILIO_FROM);
}

module.exports = SmsChannel;
module.exports.createSmsChannel = createSmsChannel;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/unit/notifications/channels.test.js -v`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/notifications/channels backend/__tests__/unit/notifications/channels.test.js
git commit -m "feat(notifications): email + twilio sms channel adapters"
```

---

### Task 6: Templates

**Files:**
- Create: `backend/src/services/notifications/templates.js`
- Test: `backend/__tests__/unit/notifications/templates.test.js`

- [ ] **Step 1: Write the failing test** (`templates.test.js`)

```js
const { renderEmail, renderSms } = require('../../../src/services/notifications/templates');
const { EVENTS } = require('../../../src/services/notifications/config');

test('inventory.out email has subject + html with part name', () => {
  const { subject, html } = renderEmail(EVENTS.INVENTORY_OUT, { name: 'Pressure Spring', quantity: 0, minimum_quantity: 10 });
  expect(subject).toMatch(/Out of Stock/i);
  expect(html).toContain('Pressure Spring');
});

test('inventory.out sms is short and names the part', () => {
  const text = renderSms(EVENTS.INVENTORY_OUT, { name: 'Pressure Spring' });
  expect(text).toContain('Pressure Spring');
  expect(text.length).toBeLessThanOrEqual(160);
});

test('po.approved email + sms reference the PO number', () => {
  const { subject } = renderEmail(EVENTS.PO_APPROVED, { po_number: '014743' });
  expect(subject).toContain('014743');
  expect(renderSms(EVENTS.PO_APPROVED, { po_number: '014743' })).toContain('014743');
});

test('inventory.digest lists out and low parts', () => {
  const { html } = renderEmail(EVENTS.INVENTORY_DIGEST, {
    outParts: [{ name: 'A', quantity: 0, minimum_quantity: 2 }],
    lowParts: [{ name: 'B', quantity: 1, minimum_quantity: 2 }],
  });
  expect(html).toContain('A');
  expect(html).toContain('B');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/notifications/templates.test.js -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `templates.js`**

```js
const { EVENTS } = require('./config');

const li = (label, val) => `<li><strong>${label}:</strong> ${val == null ? 'N/A' : val}</li>`;
const partRows = (parts) => parts.map(p =>
  `<tr><td>${p.name}</td><td>${p.quantity}</td><td>${p.minimum_quantity}</td></tr>`).join('');

const EMAIL = {
  [EVENTS.INVENTORY_LOW]: (p) => ({
    subject: `Low Stock Alert: ${p.name}`,
    html: `<h2>Low Stock Alert</h2><ul>${li('Part', p.name)}${li('On hand', p.quantity)}${li('Minimum', p.minimum_quantity)}</ul>`,
  }),
  [EVENTS.INVENTORY_OUT]: (p) => ({
    subject: `Out of Stock Alert: ${p.name}`,
    html: `<h2>Out of Stock Alert</h2><ul>${li('Part', p.name)}${li('Minimum', p.minimum_quantity)}</ul><p>Please reorder.</p>`,
  }),
  [EVENTS.INVENTORY_DIGEST]: (d) => ({
    subject: `Daily Inventory Alert Digest (${d.outParts.length} out, ${d.lowParts.length} low)`,
    html: `<h2>Inventory Status Digest</h2>
      <h3>Out of Stock (${d.outParts.length})</h3>
      <table><tr><th>Part</th><th>Qty</th><th>Min</th></tr>${partRows(d.outParts)}</table>
      <h3>Low Stock (${d.lowParts.length})</h3>
      <table><tr><th>Part</th><th>Qty</th><th>Min</th></tr>${partRows(d.lowParts)}</table>`,
  }),
  [EVENTS.PO_SUBMITTED]: (po) => ({ subject: `PO ${po.po_number} submitted`, html: `<p>Purchase order <strong>${po.po_number}</strong> was submitted for approval.</p>` }),
  [EVENTS.PO_APPROVED]: (po) => ({ subject: `PO ${po.po_number} approved`, html: `<p>Purchase order <strong>${po.po_number}</strong> was approved.</p>` }),
  [EVENTS.PO_RECEIVED]: (po) => ({ subject: `PO ${po.po_number} received`, html: `<p>Purchase order <strong>${po.po_number}</strong> was marked received.</p>` }),
  [EVENTS.PO_ON_HOLD]: (po) => ({ subject: `PO ${po.po_number} on hold`, html: `<p>Purchase order <strong>${po.po_number}</strong> was put on hold.</p>` }),
  [EVENTS.PO_REJECTED]: (po) => ({ subject: `PO ${po.po_number} rejected`, html: `<p>Purchase order <strong>${po.po_number}</strong> was rejected.</p>` }),
};

const SMS = {
  [EVENTS.INVENTORY_OUT]: (p) => `IMMS: OUT OF STOCK — ${p.name}. Please reorder.`,
  [EVENTS.PO_APPROVED]: (po) => `IMMS: PO ${po.po_number} APPROVED.`,
  [EVENTS.PO_ON_HOLD]: (po) => `IMMS: PO ${po.po_number} ON HOLD.`,
  [EVENTS.PO_REJECTED]: (po) => `IMMS: PO ${po.po_number} REJECTED.`,
};

function renderEmail(eventType, payload) {
  const fn = EMAIL[eventType];
  if (!fn) throw new Error(`No email template for ${eventType}`);
  return fn(payload);
}
function renderSms(eventType, payload) {
  const fn = SMS[eventType];
  if (!fn) throw new Error(`No SMS template for ${eventType}`);
  return fn(payload);
}

module.exports = { renderEmail, renderSms };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/notifications/templates.test.js -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/notifications/templates.js backend/__tests__/unit/notifications/templates.test.js
git commit -m "feat(notifications): email + sms templates per event"
```

---

### Task 7: NotificationService (resolve recipients, route, send, log)

**Files:**
- Create: `backend/src/services/notifications/NotificationService.js`
- Test: `backend/__tests__/unit/notifications/notificationService.test.js`

- [ ] **Step 1: Write the failing test** (`notificationService.test.js`)

```js
const NotificationService = require('../../../src/services/notifications/NotificationService');
const { EVENTS } = require('../../../src/services/notifications/config');

function makeService(channels) {
  const queries = [];
  const pool = {
    query: jest.fn(async (text, params) => {
      queries.push({ text, params });
      if (/FROM users/i.test(text)) {
        return { rows: [
          { email: 'admin@x.com', phone: '+15555550001' },
          { email: 'buyer@x.com', phone: null },
        ] };
      }
      return { rows: [] }; // notification_log inserts
    }),
  };
  return { service: new NotificationService({ pool, channels }), pool, queries };
}

test('inventory.out → email to both, sms only to those with a phone', async () => {
  const email = { name: 'email', send: jest.fn().mockResolvedValue({ ok: true }) };
  const sms = { name: 'sms', send: jest.fn().mockResolvedValue({ ok: true }) };
  const { service } = makeService({ email, sms });

  await service.notify(EVENTS.INVENTORY_OUT, { part_id: 7, name: 'Spring', quantity: 0, minimum_quantity: 3 });

  expect(email.send).toHaveBeenCalledTimes(2);                 // both recipients
  expect(sms.send).toHaveBeenCalledTimes(1);                   // only the one with a phone
  expect(sms.send.mock.calls[0][0].to).toBe('+15555550001');
});

test('inventory.low → email only (no sms channel use)', async () => {
  const email = { name: 'email', send: jest.fn().mockResolvedValue({ ok: true }) };
  const sms = { name: 'sms', send: jest.fn().mockResolvedValue({ ok: true }) };
  const { service } = makeService({ email, sms });
  await service.notify(EVENTS.INVENTORY_LOW, { part_id: 7, name: 'Spring', quantity: 1, minimum_quantity: 3 });
  expect(email.send).toHaveBeenCalledTimes(2);
  expect(sms.send).not.toHaveBeenCalled();
});

test('a channel failure is logged and does not throw', async () => {
  const email = { name: 'email', send: jest.fn().mockRejectedValue(new Error('smtp down')) };
  const { service, queries } = makeService({ email, sms: null });
  await expect(service.notify(EVENTS.INVENTORY_LOW, { part_id: 9, name: 'X', quantity: 0, minimum_quantity: 1 })).resolves.toBeUndefined();
  const logInserts = queries.filter(q => /INSERT INTO notification_log/i.test(q.text));
  expect(logInserts.length).toBe(2);
  expect(logInserts[0].params).toContain('failed');
});

test('NOTIFICATIONS_ENABLED=false short-circuits', async () => {
  process.env.NOTIFICATIONS_ENABLED = 'false';
  const email = { name: 'email', send: jest.fn() };
  const { service } = makeService({ email, sms: null });
  await service.notify(EVENTS.INVENTORY_LOW, { part_id: 1, name: 'X', quantity: 0, minimum_quantity: 1 });
  expect(email.send).not.toHaveBeenCalled();
  delete process.env.NOTIFICATIONS_ENABLED;
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/notifications/notificationService.test.js -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `NotificationService.js`**

```js
const { CHANNEL_MATRIX, RECIPIENT_ROLES } = require('./config');
const { renderEmail, renderSms } = require('./templates');

function refIdFor(payload) {
  if (payload == null) return null;
  if (payload.part_id != null) return String(payload.part_id);
  if (payload.po_id != null) return String(payload.po_id);
  if (payload.po_number != null) return String(payload.po_number);
  return null;
}

class NotificationService {
  constructor({ pool, channels }) {
    this.pool = pool;
    this.channels = channels; // { email: EmailChannel, sms: SmsChannel|null }
  }

  async resolveRecipients() {
    const { rows } = await this.pool.query(
      `SELECT email, phone FROM users WHERE role = ANY($1) AND email IS NOT NULL`,
      [RECIPIENT_ROLES]
    );
    return rows;
  }

  async log(eventType, channel, recipient, refId, status, error) {
    try {
      await this.pool.query(
        `INSERT INTO notification_log (event_type, channel, recipient, ref_id, status, error)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [eventType, channel, recipient, refId, status, error]
      );
    } catch (e) {
      console.error('[notifications] failed to write notification_log:', e.message);
    }
  }

  async notify(eventType, payload) {
    if (process.env.NOTIFICATIONS_ENABLED === 'false') return;
    const channelNames = CHANNEL_MATRIX[eventType] || [];
    if (channelNames.length === 0) return;

    const recipients = await this.resolveRecipients();
    const refId = refIdFor(payload);

    for (const channelName of channelNames) {
      const channel = this.channels[channelName];
      if (!channel) continue; // e.g. SMS not configured
      for (const r of recipients) {
        const to = channelName === 'sms' ? r.phone : r.email;
        if (!to) continue;
        const content = channelName === 'sms'
          ? { to, body: renderSms(eventType, payload) }
          : { to, ...renderEmail(eventType, payload) };
        try {
          await channel.send(content);
          await this.log(eventType, channelName, to, refId, 'sent', null);
        } catch (err) {
          console.error(`[notifications] ${channelName} send failed for ${eventType}:`, err.message);
          await this.log(eventType, channelName, to, refId, 'failed', err.message);
        }
      }
    }
  }
}

module.exports = NotificationService;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/notifications/notificationService.test.js -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/notifications/NotificationService.js backend/__tests__/unit/notifications/notificationService.test.js
git commit -m "feat(notifications): NotificationService routing, recipients, logging"
```

---

### Task 8: Daily digest builder

**Files:**
- Create: `backend/src/services/notifications/digest.js`
- Test: `backend/__tests__/unit/notifications/digest.test.js`

- [ ] **Step 1: Write the failing test** (`digest.test.js`)

```js
const { buildDigest, sendDigest } = require('../../../src/services/notifications/digest');
const { EVENTS } = require('../../../src/services/notifications/config');

const rows = [
  { part_id: 1, name: 'A', quantity: 0, minimum_quantity: 2, kind: 'out' },
  { part_id: 2, name: 'B', quantity: 1, minimum_quantity: 2, kind: 'low' },
];
const pool = { query: jest.fn().mockResolvedValue({ rows }) };

test('buildDigest splits out vs low', async () => {
  const d = await buildDigest(pool);
  expect(d.outParts).toHaveLength(1);
  expect(d.lowParts).toHaveLength(1);
});

test('sendDigest notifies when there is something', async () => {
  const service = { notify: jest.fn().mockResolvedValue() };
  await sendDigest(pool, service);
  expect(service.notify).toHaveBeenCalledWith(EVENTS.INVENTORY_DIGEST, expect.objectContaining({ outParts: expect.any(Array), lowParts: expect.any(Array) }));
});

test('sendDigest is silent when nothing is low/out', async () => {
  const emptyPool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  const service = { notify: jest.fn() };
  await sendDigest(emptyPool, service);
  expect(service.notify).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/notifications/digest.test.js -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `digest.js`**

```js
const { EVENTS } = require('./config');

async function buildDigest(pool) {
  const { rows } = await pool.query(
    `SELECT part_id, name, quantity, minimum_quantity,
            CASE WHEN quantity = 0 THEN 'out' ELSE 'low' END AS kind
     FROM parts
     WHERE status = 'active' AND quantity <= minimum_quantity
     ORDER BY quantity ASC, name ASC`
  );
  return {
    outParts: rows.filter(r => r.kind === 'out'),
    lowParts: rows.filter(r => r.kind === 'low'),
  };
}

async function sendDigest(pool, notificationService) {
  const digest = await buildDigest(pool);
  if (digest.outParts.length === 0 && digest.lowParts.length === 0) return;
  await notificationService.notify(EVENTS.INVENTORY_DIGEST, digest);
}

module.exports = { buildDigest, sendDigest };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/notifications/digest.test.js -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/notifications/digest.js backend/__tests__/unit/notifications/digest.test.js
git commit -m "feat(notifications): daily inventory digest builder"
```

---

### Task 9: InventoryReconciler (DB glue over alerts.js)

**Files:**
- Create: `backend/src/services/notifications/InventoryReconciler.js`
- Test: extend `backend/__tests__/unit/notifications/alerts.test.js` (reconciler section)

- [ ] **Step 1: Add failing tests** — append to `alerts.test.js`:

```js
const InventoryReconciler = require('../../../src/services/notifications/InventoryReconciler');

function reconcilerPool({ parts, state }) {
  const upserts = [];
  const pool = {
    query: jest.fn(async (text, params) => {
      if (/FROM parts/i.test(text)) return { rows: parts };
      if (/FROM part_alert_state/i.test(text) && /SELECT/i.test(text)) return { rows: state };
      if (/COUNT\(\*\)/i.test(text)) return { rows: [{ count: String(state.length) }] };
      if (/INSERT INTO part_alert_state/i.test(text)) { upserts.push(params); return { rows: [] }; }
      return { rows: [] };
    }),
  };
  return { pool, upserts };
}

describe('InventoryReconciler', () => {
  test('reconcile fires notify on worsening transition and upserts state', async () => {
    const { pool, upserts } = reconcilerPool({
      parts: [{ part_id: 1, name: 'A', quantity: 0, minimum_quantity: 2 }],
      state: [{ part_id: 1, last_status: 'in_stock' }],
    });
    const notify = jest.fn().mockResolvedValue();
    const r = new InventoryReconciler({ pool, notificationService: { notify } });
    await r.reconcile();
    expect(notify).toHaveBeenCalledWith('inventory.out', expect.objectContaining({ part_id: 1 }));
    expect(upserts).toEqual([[1, 'out_of_stock']]);
  });

  test('seedIfEmpty seeds silently when table empty', async () => {
    const { pool, upserts } = reconcilerPool({
      parts: [{ part_id: 1, name: 'A', quantity: 0, minimum_quantity: 2 }],
      state: [],
    });
    const notify = jest.fn();
    const r = new InventoryReconciler({ pool, notificationService: { notify } });
    await r.seedIfEmpty();
    expect(notify).not.toHaveBeenCalled();      // seeding does not alert
    expect(upserts).toEqual([[1, 'out_of_stock']]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/notifications/alerts.test.js -v`
Expected: FAIL — "Cannot find module '.../InventoryReconciler'".

- [ ] **Step 3: Write `InventoryReconciler.js`**

```js
const { computeAlerts } = require('./alerts');

class InventoryReconciler {
  constructor({ pool, notificationService }) {
    this.pool = pool;
    this.notificationService = notificationService;
  }

  async _loadPrevMap() {
    const { rows } = await this.pool.query(`SELECT part_id, last_status FROM part_alert_state`);
    return new Map(rows.map(r => [r.part_id, r.last_status]));
  }

  async _upsert(part_id, status) {
    await this.pool.query(
      `INSERT INTO part_alert_state (part_id, last_status) VALUES ($1, $2)
       ON CONFLICT (part_id) DO UPDATE SET last_status = $2, updated_at = NOW()`,
      [part_id, status]
    );
  }

  // seedOnly: persist current statuses without sending any notification
  async reconcile({ seedOnly = false } = {}) {
    const parts = (await this.pool.query(
      `SELECT part_id, name, quantity, minimum_quantity FROM parts WHERE status = 'active'`
    )).rows;
    const prevMap = await this._loadPrevMap();
    const { events, newStates } = computeAlerts(parts, prevMap);

    if (!seedOnly) {
      for (const { eventType, part } of events) {
        try {
          await this.notificationService.notify(eventType, part);
        } catch (e) {
          console.error('[notifications] reconcile notify failed:', e.message);
        }
      }
    }
    for (const s of newStates) {
      await this._upsert(s.part_id, s.status);
    }
  }

  async seedIfEmpty() {
    const { rows } = await this.pool.query(`SELECT COUNT(*) FROM part_alert_state`);
    if (parseInt(rows[0].count, 10) === 0) {
      console.log('[notifications] seeding part_alert_state (no alerts on first run)');
      await this.reconcile({ seedOnly: true });
    }
  }
}

module.exports = InventoryReconciler;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/notifications/alerts.test.js -v`
Expected: PASS (all alerts + reconciler tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/notifications/InventoryReconciler.js backend/__tests__/unit/notifications/alerts.test.js
git commit -m "feat(notifications): inventory reconciler with silent first-run seeding"
```

---

### Task 10: Factory + scheduler wiring

**Files:**
- Create: `backend/src/services/notifications/index.js`
- Modify: `backend/index.js` (after `global.io = io;`, ~line 531)

- [ ] **Step 1: Write `notifications/index.js`**

```js
const cron = require('node-cron');
const EmailChannel = require('./channels/EmailChannel');
const { createSmsChannel } = require('./channels/SmsChannel');
const NotificationService = require('./NotificationService');
const InventoryReconciler = require('./InventoryReconciler');
const { sendDigest } = require('./digest');

// pool: the shared pg Pool from backend/db.js
function createNotifications(pool) {
  const emailService = require('../emailService');
  const channels = {
    email: new EmailChannel(emailService),
    sms: createSmsChannel(), // null if Twilio env missing
  };
  const service = new NotificationService({ pool, channels });
  const reconciler = new InventoryReconciler({ pool, notificationService: service });

  async function startSchedulers() {
    await reconciler.seedIfEmpty();

    const intervalMs = parseInt(process.env.RECONCILER_INTERVAL_MS, 10) || 60000;
    setInterval(() => {
      reconciler.reconcile().catch(e => console.error('[notifications] reconcile error:', e.message));
    }, intervalMs);

    const digestCron = process.env.DIGEST_CRON || '0 7 * * *';
    cron.schedule(digestCron, () => {
      sendDigest(pool, service).catch(e => console.error('[notifications] digest error:', e.message));
    });
    console.log(`[notifications] reconciler every ${intervalMs}ms, digest at "${digestCron}"`);
  }

  return { service, reconciler, startSchedulers };
}

module.exports = { createNotifications };
```

- [ ] **Step 2: Wire into `backend/index.js`** — insert immediately after `global.io = io;` (line 531):

```js
// Notification layer (inventory + PO email/SMS)
if (process.env.NOTIFICATIONS_ENABLED !== 'false') {
  try {
    const { createNotifications } = require('./src/services/notifications');
    const { pool } = require('./db');
    const notifications = createNotifications(pool);
    global.notifications = notifications.service; // used by PO status-change triggers
    notifications.startSchedulers();
    console.log('[notifications] layer initialized');
  } catch (e) {
    console.error('[notifications] failed to initialize:', e.message);
  }
}
```

- [ ] **Step 3: Smoke-test boot**

Run (from `backend/`): `NOTIFICATIONS_ENABLED=false node -e "require('./src/services/notifications')" && echo OK`
Expected: `OK` (module loads without throwing). Full boot is verified in Task 12.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/notifications/index.js backend/index.js
git commit -m "feat(notifications): factory + reconciler/digest scheduler wiring"
```

---

### Task 11: PO inline triggers

**Files:**
- Create: `backend/src/services/notifications/poEvents.js` (status→event map)
- Test: `backend/__tests__/unit/notifications/poEvents.test.js`
- Modify: `backend/src/controllers/PurchaseOrderController.js` (`updatePurchaseOrderStatus`, ~line 660 after the status UPDATE/commit)
- Modify: `backend/src/services/emailTrackingService.js` (~after line 461, the approval_status UPDATE)

- [ ] **Step 1: Write the failing test** (`poEvents.test.js`)

```js
const { poEventForStatus } = require('../../../src/services/notifications/poEvents');
const { EVENTS } = require('../../../src/services/notifications/config');

test('maps PO statuses to events', () => {
  expect(poEventForStatus('submitted')).toBe(EVENTS.PO_SUBMITTED);
  expect(poEventForStatus('approved')).toBe(EVENTS.PO_APPROVED);
  expect(poEventForStatus('received')).toBe(EVENTS.PO_RECEIVED);
  expect(poEventForStatus('on_hold')).toBe(EVENTS.PO_ON_HOLD);
  expect(poEventForStatus('rejected')).toBe(EVENTS.PO_REJECTED);
});

test('returns null for statuses with no notification', () => {
  expect(poEventForStatus('pending')).toBeNull();
  expect(poEventForStatus('on_order')).toBeNull();
  expect(poEventForStatus(undefined)).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/notifications/poEvents.test.js -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `poEvents.js`**

```js
const { EVENTS } = require('./config');

const STATUS_EVENT = {
  submitted: EVENTS.PO_SUBMITTED,
  approved: EVENTS.PO_APPROVED,
  received: EVENTS.PO_RECEIVED,
  on_hold: EVENTS.PO_ON_HOLD,
  rejected: EVENTS.PO_REJECTED,
};

function poEventForStatus(status) {
  return STATUS_EVENT[status] || null;
}

module.exports = { poEventForStatus };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/notifications/poEvents.test.js -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Trigger in `updatePurchaseOrderStatus`** — in `PurchaseOrderController.js`, after the status update transaction commits and before the success response (the method around line 632–700 ends by returning the updated PO; add this just before that `res.json(...)`), using the `status` variable already in scope and the PO number from the update result:

```js
// Fire notification for this status change (fire-and-forget)
try {
  const { poEventForStatus } = require('../services/notifications/poEvents');
  const evt = poEventForStatus(status);
  if (evt && global.notifications) {
    global.notifications.notify(evt, { po_id: id, po_number: updatedPo?.po_number || po_number })
      .catch(e => console.error('[notifications] PO notify failed:', e.message));
  }
} catch (e) {
  console.error('[notifications] PO trigger error:', e.message);
}
```

(Use whatever local variables hold the PO id and number in that method — confirm names while editing; `id` is the route param, and the updated row is returned by the `UPDATE ... RETURNING` query.)

- [ ] **Step 6: Trigger on email-driven approve/hold** — in `emailTrackingService.js`, immediately after the `UPDATE purchase_orders ... approval_status = $2 ...` succeeds (~line 461, where `poApprovalStatus` and `poId` are in scope):

```js
try {
  const { poEventForStatus } = require('./notifications/poEvents');
  const evt = poEventForStatus(poApprovalStatus);
  if (evt && global.notifications) {
    global.notifications.notify(evt, { po_id: poId, po_number: poNumber })
      .catch(e => console.error('[notifications] PO email-trigger failed:', e.message));
  }
} catch (e) {
  console.error('[notifications] PO email-trigger error:', e.message);
}
```

(Confirm the in-scope variable holding the PO number near that block; if only `poId` is available, fetch `po_number` in the same query that already reads the PO.)

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/notifications/poEvents.js backend/__tests__/unit/notifications/poEvents.test.js backend/src/controllers/PurchaseOrderController.js backend/src/services/emailTrackingService.js
git commit -m "feat(notifications): PO status-change triggers (UI + email reply)"
```

---

### Task 12: Full-suite run + live boot verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole notifications unit suite**

Run (from `backend/`): `npx jest __tests__/unit/notifications -v`
Expected: PASS — alerts(+reconciler), channels, templates, notificationService, digest, poEvents.

- [ ] **Step 2: Boot the backend and confirm the layer starts**

Restart the `:4000` backend (it is plain `node`, no hot reload):
```bash
# stop the process on :4000, then:
node index.js
```
Expected logs: `[notifications] seeding part_alert_state (no alerts on first run)` (first boot only) and `[notifications] reconciler every 60000ms, digest at "0 7 * * *"` and `[notifications] layer initialized`.

- [ ] **Step 3: Verify seeding (no flood) + a real transition**

With a valid admin token, set a part out of stock and wait one reconciler interval, then confirm a `notification_log` row was written:
```bash
node -e "const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\"SELECT event_type,channel,status,ref_id FROM notification_log ORDER BY id DESC LIMIT 5\").then(r=>{console.table(r.rows);return p.end();})"
```
Expected: after a part newly hits 0, an `inventory.out` row (email + sms) appears within ~60s; the ~150 already-low parts produce **no** rows (seeded silently). Restore any test data you changed.

- [ ] **Step 4: Commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "test(notifications): verify boot, seeding, and live transition logging"
```

---

## Self-Review

**1. Spec coverage**

- Both inventory + PO events → Tasks 4–11. ✓
- Channel matrix (email all; SMS for out / PO approved / on-hold / rejected) → Task 3 `config.js`, asserted in Tasks 7. ✓
- Instant inventory via reconciler + first-run seeding → Tasks 9–10. ✓
- Daily digest (email only) → Tasks 8, 10. ✓
- Role-based recipients (admin+purchasing), SMS only with phone → Task 7. ✓
- Twilio behind channel abstraction, disabled if unconfigured → Tasks 1, 5, 10. ✓
- Data model: `users.phone`, `part_alert_state`, `notification_log` → Task 2. ✓
- Error handling fire-and-forget + logging → Tasks 7, 9, 11. ✓
- Config/env → Tasks 1, 10. ✓
- Tests at each layer → every code task. ✓

**2. Placeholder scan:** PO trigger steps (11.5/11.6) intentionally say "confirm the in-scope variable name while editing" because the exact local name lives in a 109KB controller method; the code to insert is complete — only the variable binding is confirmed at edit time. All other steps contain full code/commands.

**3. Type consistency:** `notify(eventType, payload)`, `channel.send({to,subject,body}|{to,body})`, `statusFor`/`computeAlerts`, `poEventForStatus`, `createNotifications(pool).{service,reconciler,startSchedulers}`, `global.notifications` are used identically across tasks.

---

## Rollout notes
- Ship with `NOTIFICATIONS_ENABLED=false` until Twilio creds + `users.phone` are populated; then flip on (first boot seeds `part_alert_state` silently).
- Backfill `users.phone` (E.164) for admin/purchasing users who should receive SMS.
