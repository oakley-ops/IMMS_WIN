# Error Tracking + Uptime Monitoring — Design

**Date:** 2026-07-04
**Status:** Approved — ready for implementation planning
**Owner:** Isaac Rodriguez
**Branch:** `feat/observability`
**Roadmap:** §2.2 of `docs/ENGINEERING_MATURITY_ROADMAP.md`

## Why

Today the first detector of a production error is a technician standing at a
kiosk. Two gaps close that: **error tracking** (unhandled exceptions and 500s
reach a dashboard with a stack trace, instead of vanishing into a console) and
**uptime monitoring** (a service that crashed and didn't come back triggers an
alert). Goal: *you* find out about prod breakage before the floor does.

## Goals

1. Both backends report uncaught exceptions, unhandled promise rejections, and
   500-level route errors to an error-tracking backend, with stack traces and
   request context.
2. A standalone monitor emails an alert when any of the five prod URLs goes
   down or comes back — transition-only, no alert spam.
3. Both features are **off by default** and turn on purely via env vars (no
   behavior change until configured), matching the monthly-email pattern.
4. Ships through the required CI gate.

**Non-goals (YAGNI):** frontend (React) error tracking — a later increment;
performance/tracing (`tracesSampleRate: 0`); an external uptime SaaS (the prod
URLs are LAN-only — see Constraints); a status page; PagerDuty/SMS paging;
log aggregation.

## Decisions (confirmed with the user)

| Question | Decision |
|---|---|
| Error-tracking surfaces | **Both backends only** (imms-api, mcs-api); frontends deferred |
| Error vs performance | **Errors only** (`tracesSampleRate: 0`) |
| SaaS vs self-hosted | **Not a code decision** — `@sentry/node` is DSN-agnostic; the DSN targets Sentry.io *or* self-hosted GlitchTip, chosen at config time |
| Uptime approach | **Internal checker** (external SaaS can't reach LAN URLs) |
| Where the checker runs | **Its own PM2 process** on the plant PC (survives a monitored service crashing) |
| Both features' activation | **Off by default**, enabled via env vars |

## Constraints

- The five prod URLs are LAN-only (`localhost`, `10.1.10.50`), so no external
  uptime service can reach them — the checker must run inside the LAN.
- A checker on the plant PC detects "a service died but the PC is up," not "the
  whole PC died" (that failure is visible physically / via the Pi kiosk going
  dark). Accepted for this increment.
- `@sentry/node` is a **new npm dependency** (the first added to the backends) —
  justified, since error tracking cannot be done without an SDK.

## Architecture

Two independent units.

### Unit A — Error tracking (`@sentry/node`, both backends)

- Add `@sentry/node` to `backend` and `maintenance_call_system/backend`.
- A tiny init module per backend (e.g. `src/observability/sentry.js`) that calls
  `Sentry.init({ dsn: process.env.SENTRY_DSN, environment: NODE_ENV, release,
  tracesSampleRate: 0 })` **only when `SENTRY_DSN` is set**, and exports the
  configured `Sentry` (or a no-op shim when unset). Required as early as
  possible in each `index.js` (before route requires) so instrumentation and the
  process-level `uncaughtException` / `unhandledRejection` capture are in place.
- Wire Sentry's Express error handler:
  - IMMS: before the existing global error middleware (`backend/index.js:473`).
  - MCS: alongside the `handler(fn)` catch path / the `errors.serverError` route
    in `maintenance_call_system/backend`.
- Net effect when `SENTRY_DSN` is set: 500s, uncaught exceptions, and unhandled
  rejections show up in the dashboard with stack + request context, tagged by
  environment and release. When unset: nothing changes anywhere.

> Implementation note: use the current `@sentry/node` major version and its
> documented Express setup (v8 uses an instrument-first import + a
> `setupExpressErrorHandler`; verify the installed version in the plan and
> follow its exact pattern). The design is version-agnostic; the plan pins it.

### Unit B — Uptime monitor (standalone PM2 process)

- New script `backend/src/scripts/uptimeMonitor.js`, run as its own PM2 app
  `uptime-monitor` (added to `ecosystem.prod.config.js`), separate from every
  monitored service so it survives any one of them crashing.
- Loop on `UPTIME_INTERVAL_MS` (default 120000): GET each URL in `UPTIME_URLS`
  (default the five: `:4000/health`, `:4001/health`, `:3001/`, `:3002/`,
  `:3003/board`) with a short per-request timeout; a URL is "up" iff it returns
  HTTP 200 within the timeout.
- Keep an in-memory up/down state per URL. On a **transition** (up→down or
  down→up) email `OPS_ALERT_RECIPIENTS` via the existing
  `require('../services/emailService')` singleton — a down alert names the URL(s)
  and status; a recovery alert says it's back. Steady state sends nothing.
- **Off by default:** if `OPS_ALERT_RECIPIENTS` is empty, the monitor still runs
  and logs but sends no email (so it can be added to PM2 harmlessly before it's
  configured).

The pure decision logic (given previous states + this round's results → which
transitions to alert on) is a testable function separate from the timer, the
HTTP, and the email.

## Config (new env vars)

| Var | Default | Purpose |
|---|---|---|
| `SENTRY_DSN` | (empty → error tracking off) | Both backends; Sentry.io or GlitchTip DSN |
| `OPS_ALERT_RECIPIENTS` | (empty → uptime alerts off) | Comma-separated alert recipients |
| `UPTIME_INTERVAL_MS` | `120000` | Uptime poll interval |
| `UPTIME_URLS` | the five prod URLs | Comma-separated URLs to check |

Documented in each `.env.example`. Prod values set in `C:\imms\prod\...\.env`;
error tracking + uptime activate on the next `deploy.ps1` + `pm2 restart`.

## Error handling / edge cases

- Sentry init failure (bad DSN) must not crash the app — wrap init so a bad DSN
  logs a warning and the app continues (error tracking simply stays off).
- The uptime monitor must never crash on a fetch error/timeout — those ARE the
  "down" signal; catch and treat as down.
- If sending an alert email fails, log it; don't let the monitor loop die.
- The monitor pinging `:3001/`/`:3002/`/`:3003/board` confirms the static
  servers/Next are serving; note it can't detect a broken SPA the way the
  static-serve 403 bug showed — but a crashed process (connection refused) is
  exactly what it catches.

## Testing (Jest — IMMS backend; the uptime logic lives there)

- **Uptime transition logic** (pure): steady-up → no alert; up→down → down
  alert naming the URL; down→up → recovery alert; mixed (one down, others up) →
  alert only for the changed one; empty recipients → returns "would-alert" but
  the caller sends nothing. Mocked results in, decisions out.
- **Uptime checker with mocked `fetch` + mocked emailService**: a 200 marks up,
  a non-200/throw marks down, and `sendEmail` is called only on transitions
  with the right recipients.
- **Sentry init module**: `SENTRY_DSN` unset → `init` not called / no-op shim
  returned (no throw); set → `init` called once with `tracesSampleRate: 0`.
  (Mock `@sentry/node`.)
- No test asserts against a live Sentry or live URLs. Manual dev acceptance:
  set `OPS_ALERT_RECIPIENTS` to a test inbox, stop a dev service, confirm one
  down email + one recovery email; set a test `SENTRY_DSN`, throw a test 500,
  confirm it lands in the dashboard.

## Risks / plan-level checks

- Pin the `@sentry/node` major version and follow its exact Express + init
  pattern (v8 differs from v7); confirm it installs cleanly (adds to the
  CI `npm ci`).
- Confirm the standalone `uptimeMonitor.js` can `require` `emailService` without
  side effects at import (it's a singleton that reads SMTP env lazily — verify).
- Add `uptime-monitor` to `ecosystem.prod.config.js` following the existing app
  shape; ensure it does not set `NODE_ENV=production` in a way that trips the
  IMMS SSL rule if it pulls `backend/db.js` transitively (it should not import
  db.js — only emailService; verify emailService doesn't require db.js).
- Node 22 has global `fetch`; no HTTP dependency needed for the checker.
