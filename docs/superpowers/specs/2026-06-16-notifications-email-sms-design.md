# Notifications (Email + SMS) — Design Spec

- **Date:** 2026-06-16
- **Status:** Approved (pending spec review)
- **Topic:** Reliable inventory + purchase-order notifications over email and SMS

## Goal

Deliver dependable notifications for **inventory** and **purchase-order** events over two
channels — **email** (reusing the existing `emailService`) and **SMS** (new, via Twilio) —
routed to recipients by **role**. Finish the half-built inventory email alerts (the
`sendLowStockNotification`/`sendOutOfStockNotification` methods exist but are only called
from a `/test` route), and add SMS as a first-class, provider-agnostic channel.

## Current state (baseline)

- **Email:** `backend/src/services/emailService.js` — nodemailer SMTP (Gmail primary +
  optional SendGrid fallback), 3× retry, offline queue/background resend, demo-mode capture.
  Actively used for the **PO approval workflow** (send PO PDF → IMAP-monitor replies for
  approve/hold via `emailTrackingService`). Low/out-of-stock notification methods exist but
  are **not wired to any real trigger**.
- **SMS:** none. No library, no code, no config (only referenced as "out of scope" in the
  separate Maintenance Call System requirements doc).

## Scope

**In scope**

- Inventory alerts: instant (on state-change) **and** a daily digest.
- Purchase-order lifecycle events: submitted, approved, received, on-hold, rejected.
- Two channels: email (all events) + SMS (urgent subset).
- Role-based recipients: **admin + purchasing**.
- Twilio as the SMS provider, behind a channel abstraction.

**Out of scope (YAGNI)**

- Per-user notification preference UI / individual opt-in-out (role-based only for now).
- Two-way SMS (replies/commands).
- Maintenance Call System escalation alerts.
- In-app/push notifications, localization/i18n.

## Events & channel matrix

Email carries everything; SMS is reserved for urgent, low-volume "know right now" moments.

| Event key | Trigger | Email | SMS |
|---|---|:---:|:---:|
| `inventory.low` | a part **newly** crosses into low stock (`0 < qty <= min`) | ✓ | — |
| `inventory.out` | a part **newly** hits out of stock (`qty = 0`) | ✓ | ✓ |
| `inventory.digest` | daily scheduled summary of all current low/out parts | ✓ | — |
| `po.submitted` | PO enters submitted/awaiting-approval | ✓ | — |
| `po.approved` | PO approved | ✓ | ✓ |
| `po.received` | PO marked received | ✓ | — |
| `po.on_hold` | PO put on hold | ✓ | ✓ |
| `po.rejected` | PO rejected | ✓ | ✓ |

"Newly" = a worsening transition only (`in_stock → low`, `in_stock/low → out`). Improving
transitions (restock) clear state silently so a future drop re-alerts.

## Recipients (role-based)

- Both inventory and PO events go to users with role **`admin`** or **`purchasing`**.
- **Email:** the user's `email`.
- **SMS:** the user's `phone` (new column) — users without a phone simply receive no SMS.
- No per-user toggles in this phase; channel selection is by the event matrix above.

## Architecture

A thin notification layer inside the existing Express/Postgres app — no new services.

```
 inventory/PO event
        |
        v
 NotificationService.notify(eventType, payload)
        |  - resolveRecipients(eventType) -> users WHERE role IN ('admin','purchasing')
        |  - channels = CHANNEL_MATRIX[eventType]      (email always; SMS for urgent subset)
        |  - render(eventType, payload, channel)       (email HTML + short SMS text)
        |  - send via each channel; record in notification_log
        v
 +--------------+----------------+
 | EmailChannel |   SmsChannel   |   interface: send({ to, subject, body }) -> {ok, id, error}
 | (emailService|    (Twilio)    |
 +--------------+----------------+
```

### Components

- **`NotificationService`** (`backend/src/services/notifications/NotificationService.js`)
  — single entry point `notify(eventType, payload)`. Owns recipient resolution, the channel
  matrix, template selection, dispatch, and logging. Knows nothing about *how* a channel sends.
- **Channel adapters** (`.../channels/EmailChannel.js`, `.../channels/SmsChannel.js`) — each
  exposes `send({ to, subject, body })`. `EmailChannel` delegates to the existing
  `emailService`; `SmsChannel` wraps the Twilio SDK. New providers slot in without touching
  `NotificationService`.
- **Templates** (`.../templates/`) — one module per event producing `{ subject, html }` for
  email and a short `text` for SMS. Email templates follow the existing HTML style.
- **Reconciler** (`.../InventoryReconciler.js`) — the inventory trigger (see below).
- **Schedulers** — `node-cron` for the daily digest; an interval timer for the reconciler.
  Started from `index.js` after boot, guarded by `NOTIFICATIONS_ENABLED`.

## Triggers

### PO events — inline (precise)

PO status changes occur in a few known places (`PurchaseOrderController` status updates and
`emailTrackingService` when an approval reply is parsed). At each transition, call
`NotificationService.notify('po.<status>', po)`. Few call sites, exact timing, no polling.

### Inventory state-change — reconciler (chosen approach)

Rather than instrument every stock-mutation path (usage, edit, restock, return, bulk, PO
receipt, future ones), a lightweight job runs on an interval (`RECONCILER_INTERVAL_MS`,
default 60s):

1. Compute each active part's current status (`out_of_stock` if `qty = 0`; `low_stock` if
   `qty <= minimum_quantity`; else `in_stock`) — same rule the dashboard now uses.
2. Compare against `part_alert_state.last_status`.
3. On a **worsening** transition, fire `inventory.out` or `inventory.low`. Improving
   transitions clear silently.
4. Upsert `part_alert_state.last_status` to the current value.

**First-run seeding:** on initial startup the table is seeded with current statuses
**without** sending — this prevents the ~150 already-low parts from flooding on first run.
Trade-off accepted: "instant" means within ~one interval (≤60s).

### Daily digest — scheduled

A `node-cron` job at `DIGEST_CRON` (default `0 7 * * *`, 7:00 AM) queries all active parts
currently low/out, renders one grouped email (Out of Stock, then Low Stock), and sends to
admin+purchasing. Email only.

## Data model (migrations)

- **`users.phone`** — `VARCHAR(32) NULL`. SMS target for admin/purchasing users.
- **`part_alert_state`** — `part_id INT PK REFERENCES parts(part_id)`,
  `last_status VARCHAR(16) NOT NULL`, `updated_at TIMESTAMPTZ DEFAULT now()`. Drives
  transition detection + dedupe.
- **`notification_log`** — `id BIGSERIAL PK`, `event_type VARCHAR(32)`, `channel VARCHAR(16)`,
  `recipient VARCHAR(255)`, `ref_id VARCHAR(64)` (part_id or po_id), `status VARCHAR(16)`
  (`sent`/`failed`), `error TEXT NULL`, `created_at TIMESTAMPTZ DEFAULT now()`. Audit + troubleshooting.

## Configuration (env)

| Var | Purpose | Default |
|---|---|---|
| `NOTIFICATIONS_ENABLED` | master on/off for the whole layer | `true` |
| `TWILIO_ACCOUNT_SID` | Twilio auth | — |
| `TWILIO_AUTH_TOKEN` | Twilio auth | — |
| `TWILIO_FROM` | Twilio sending number (E.164) | — |
| `DIGEST_CRON` | daily digest schedule | `0 7 * * *` |
| `RECONCILER_INTERVAL_MS` | inventory reconciler cadence | `60000` |

Existing SMTP/`NOTIFICATION_RECIPIENTS` config is reused for email. If Twilio vars are
absent, `SmsChannel` is disabled (logged) and email still works.

## Error handling

- Notifications are **fire-and-forget** relative to the user action — sending never blocks a
  stock edit or a PO update.
- **Email** reuses the existing retry + offline queue in `emailService`.
- **SMS** retries twice on transient Twilio errors; every attempt (success or final failure)
  is recorded in `notification_log`.
- A failure on one channel never blocks the other. The reconciler/digest jobs catch and log
  their own errors so a bad run can't crash the process.

## Testing

- **Unit (mocked channels):**
  - Reconciler transitions: `in_stock→low` fires `inventory.low`; `low→low` stays silent;
    `low→out` fires `inventory.out`; `out→in_stock` clears silently; first-run seeding sends nothing.
  - `NotificationService` routing: each event resolves the correct channels (matrix) and the
    correct recipients (admin+purchasing; SMS only to users with a phone).
  - Template rendering: subject/body present and well-formed for each event.
- **Integration:** nodemailer mock + Twilio test credentials; assert `notification_log` rows.

## Rollout notes

- Ship with `NOTIFICATIONS_ENABLED=false` (or SMS disabled) until Twilio creds and phone
  numbers are populated; flip on after seeding `part_alert_state` and verifying recipients.
- Backfill `users.phone` for admin/purchasing users who should receive SMS.

## Open items (deferred, not blocking)

- Exact digest send time (default 7:00 AM) — tune after first use.
- Whether `po.submitted` should notify the *approver* specifically vs. the role list (today's
  PO flow already emails the approver at send-time; this layer adds the role-list notice).
