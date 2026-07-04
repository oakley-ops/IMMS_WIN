# Monthly Analytics Email — Design

**Date:** 2026-07-04
**Status:** Approved — ready for implementation planning
**Owner:** Isaac Rodriguez
**Branch:** `feat/monthly-analytics-email`

## Why

The commercialization playbook (§8) names the automated monthly downtime
report as the single best retention weapon: on the first business day of each
month, every plant manager gets a branded PDF — downtime hours and dollars,
MTTR trend, repeat-offender machines, parts consumed — with a skimmable,
forwardable summary in the email body. It turns the product from a line item
into part of how the plant reports to its owner. All the pieces already exist
(MCS generates the analytics PDF; IMMS schedules and sends email); this feature
wires them together.

## Goals

1. A branded monthly analytics email lands automatically, once, on the first
   business day of each month, covering the previous full calendar month.
2. The email body carries the headline numbers inline (forwardable without
   opening the attachment); the PDF carries the full breakdown.
3. Reuse existing infrastructure — no new npm dependencies, no duplicated
   email/PDF code, each app keeps owning what it owns.
4. On-demand trigger for dev testing and manual resends.

**Non-goals (YAGNI):** per-machine or per-recipient customization, an in-app
config UI, HTML email templating frameworks, retry queues, multi-tenant
recipient routing. Single plant, one recipient list.

## Decisions (all confirmed with the user)

| Question | Decision |
|---|---|
| Recipients | New dedicated env var `ANALYTICS_RECIPIENTS` (comma-separated) |
| Email body | HTML summary (headline numbers) **and** PDF attachment |
| Schedule | First business day of month, ~7am; weekend-skip guard; env-configurable |
| Reporting period | Previous full calendar month |
| Architecture | **Approach A** — IMMS schedules + emails, fetches PDF/metrics from MCS |
| Service token role | `role: admin` (short-lived, shared `JWT_SECRET`) |
| On MCS/generation failure | Log **and** email a plain "report did not generate" notice to recipients |

## Architecture (Approach A)

One new monthly job in IMMS's existing `notifications` scheduler. Per run:

1. Compute the previous calendar month `[from, to]` (ISO datetimes; handles the
   January → December-of-previous-year boundary).
2. Mint a short-lived service JWT with the shared `JWT_SECRET`:
   `{ id: -1, username: 'imms-scheduler', role: 'admin' }` (id must be truthy —
   MCS rejects falsy id before the admin bypass), `expiresIn: '5m'`.
   `role: admin` passes MCS's `requirePermission('analytics_view')` admin
   bypass without needing a `mcs_user_permissions` row.
3. With that token, call two **existing, unmodified** MCS endpoints:
   - `GET {MCS_BASE_URL}/maintenance-calls/stats/metrics?from&to` → metrics JSON
     (for the email summary).
   - `GET {MCS_BASE_URL}/mcs/analytics/pdf?from&to` → PDF (binary).
4. Build the HTML summary from the metrics; send **one email to all
   recipients** via IMMS's existing `emailService.sendEmailWithAttachment`,
   PDF attached.

No new MCS code, no new npm dependencies. Same trust model (shared-secret JWT
over LAN HTTP) as the existing MCS→IMMS `parts/usage` call, reversed.

### Endpoint mount paths (verified)

- Metrics: `/api/v1/maintenance-calls/stats/metrics` (auth required).
- PDF: `/api/v1/mcs/analytics/pdf` (auth + `analytics_view`).
- Both accept `from`/`to` as ISO date or datetime (`S.metricsQuery` in MCS).

## Components

All new files under `backend/src/services/notifications/`, following the
existing `digest.js` sibling pattern. Each unit has one job and injected
dependencies so it is testable without real I/O.

| File | Responsibility | Key exports |
|---|---|---|
| `monthlyAnalytics/period.js` | Pure date math | `previousMonthRange(now) -> { from, to, label }`; `isFirstBusinessDay(now) -> bool` |
| `monthlyAnalytics/summaryHtml.js` | Build the email body | `buildSummaryHtml(metrics, label) -> string` |
| `monthlyAnalytics/mcsAnalyticsClient.js` | Cross-app HTTP | `fetchMetrics(from, to) -> Promise<metrics>`; `fetchPdf(from, to) -> Promise<Buffer>`; mints the token, `AbortController` timeout |
| `monthlyAnalytics/index.js` | Orchestrator | `sendMonthlyAnalyticsReport({ mcsClient, emailService, recipients, now }) -> Promise<{ sent, reason }>` |
| `notifications/index.js` (modify) | Register the cron | one `cron.schedule` block in `startSchedulers()` |
| `backend/package.json` (modify) | On-demand trigger | `report:monthly` script runs the job once |

- `report:monthly` runs a tiny entry (`src/scripts/sendMonthlyReport.js`) that
  wires the real `mcsAnalyticsClient` + real `emailService` and calls
  `sendMonthlyAnalyticsReport` once, then exits — for dev testing and manual
  resends.

### Orchestrator flow (`sendMonthlyAnalyticsReport`)

```
recipients = parse ANALYTICS_RECIPIENTS
if recipients empty        -> log, return { sent:false, reason:'no_recipients' }
{ from, to, label } = previousMonthRange(now)
try:
  metrics = mcsClient.fetchMetrics(from, to)
  pdf     = mcsClient.fetchPdf(from, to)
  html    = buildSummaryHtml(metrics, label)
  emailService.sendEmailWithAttachment(
     `Maintenance Report — ${label}`, html, recipients.join(','),
     [{ filename: `maintenance-report-${label}.pdf`,
        content: pdf, contentType: 'application/pdf' }])
  return { sent:true }
catch err:
  log.error(err)
  emailService.sendEmail(
     `Maintenance Report — ${label} — generation failed`,
     'This month\'s maintenance analytics report could not be generated. ' +
     'The team has been notified; you can request a manual resend.',
     recipients.join(','))            // plain notice, no attachment
  return { sent:false, reason:'generation_failed' }
```

## Config (new env vars in `backend/.env` and documented in `.env.example`)

| Var | Default | Purpose |
|---|---|---|
| `ANALYTICS_RECIPIENTS` | (empty → job no-ops) | Comma-separated report recipients |
| `MCS_BASE_URL` | `http://localhost:4001/api/v1` | Where IMMS reaches the MCS API |
| `MONTHLY_ANALYTICS_CRON` | `0 7 1-5 * *` | Cron window: 7am on the first 5 days |

The cron fires each morning in that window; the handler sends **only if**
`isFirstBusinessDay(now)` is true, so exactly one send occurs regardless of
whether the 1st lands on a weekend (1st on Sat → Mon the 3rd; 1st on Sun → Mon
the 2nd — both inside the 1–5 window). Dev uses the same vars in the dev
`backend/.env` (already isolated); `MCS_BASE_URL` there points at the dev MCS
(`http://localhost:4101/api/v1`).

## Error handling

- The scheduler registration wraps the call in `.catch` (matching `digest.js`)
  so a failure logs and never crashes the process.
- Empty `ANALYTICS_RECIPIENTS` → log and no-op (feature effectively off until
  configured).
- MCS unreachable / non-200 / PDF error → caught; logs the error and sends the
  plain "report did not generate" notice to recipients (per decision). Next
  month runs normally; `report:monthly` covers an immediate manual retry.
- HTTP calls use an `AbortController` timeout (default 30s — PDF generation is
  the slow part) so a hung MCS can't wedge the job.
- The service token expires in 5 minutes — it never lives long enough to be a
  standing credential.

## Testing (Jest, matching IMMS's existing unit-test style)

Pure functions get direct tests:
- `previousMonthRange` — mid-year month, and the Jan→Dec-of-previous-year
  boundary; asserts `from`/`to` bound the correct full month and `label` reads
  e.g. `"June 2026"`.
- `isFirstBusinessDay` — 1st on a weekday (true only on the 1st), 1st on
  Saturday (true on the 3rd), 1st on Sunday (true on the 2nd), and false on a
  mid-month weekday. **"Business day" = weekday (Mon–Fri) only; public holidays
  are not considered** (a report arriving on a holiday Monday is harmless, and
  a holiday calendar is out of scope).
- `buildSummaryHtml` — output contains the headline figures (total downtime
  hours, downtime cost, avg MTTR, top repeat-offender machine) and the period
  label.

Orchestrator `sendMonthlyAnalyticsReport` with mocked `mcsClient` +
mocked `emailService`:
- Happy path: fetches with the computed period, calls
  `sendEmailWithAttachment` once with the recipients and a PDF attachment whose
  `content` is the fetched buffer.
- Empty recipients: returns `no_recipients`, sends nothing.
- MCS failure (client rejects): sends the plain failure notice via `sendEmail`
  (not `sendEmailWithAttachment`) and returns `generation_failed`.

No integration test (cross-app HTTP is mocked). Manual end-to-end verification
in dev via `npm run report:monthly` against the dev MCS and a test inbox is the
final acceptance step — actually observe the email + PDF arrive.

## Risks / plan-level checks

- Confirm `emailService.sendEmailWithAttachment(subject, html, recipient,
  attachments)` accepts a Node `Buffer` as `attachments[].content` (nodemailer
  supports `content` as Buffer/string/stream) — verify the exact attachment
  shape the existing method expects (it currently looks for
  `contentType === 'application/pdf'`).
- Confirm the MCS `/mcs/analytics/pdf` mount path in the MCS app entry
  (`maintenance_call_system/backend/index.js`) matches what the client calls.
- `node-cron` is already an IMMS dependency (used by `notifications/index.js`).
- The report reflects the previous month, so on a brand-new deployment the
  first send may cover a partial/sparse month — acceptable; no special-casing.
