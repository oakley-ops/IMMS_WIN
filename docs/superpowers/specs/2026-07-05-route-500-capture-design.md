# Route-500 Sentry Capture — Design

**Date:** 2026-07-05
**Status:** Approved — ready for implementation planning
**Owner:** Isaac Rodriguez
**Branch:** `feat/sentry-route-capture`
**Follows:** the observability feature (§2.2, PR #21). Closes its known limitation.

## Why

The observability feature wired `Sentry.setupExpressErrorHandler(app)` into both
backends, but it only fires on errors passed to `next(err)`. Neither backend does
that: IMMS routes `res.status(500)` directly (234 sites, 0 `next(err)`) and MCS
routes respond via `errors.serverError(res)` inside `handler()` catches. So
caught route-level 500s reach Sentry in **neither** backend — only the automatic
global crash handlers (uncaught exceptions / unhandled rejections) do. This closes
that gap so a 500ing endpoint is visible in the dashboard, not just in console
logs. Spec Goal #1 of §2.2 ("500-level route errors reach a dashboard") becomes
literally true.

## Goals

1. Caught route-level 500s reach Sentry in both backends when `SENTRY_DSN` is set.
2. MCS captures the **real error with its stack trace** (it has the error object).
3. IMMS captures **which endpoint 500'd + how often + request context** (no
   original stack — the route already swallowed it) with **zero per-route edits**.
4. Stays **fully no-op when `SENTRY_DSN` is unset** — reuses the existing gating,
   no new env vars.

**Non-goals (YAGNI):** refactoring IMMS's 234 catch blocks to `next(err)` (a huge,
risky change); recovering the original stack for IMMS route-500s (impossible once
swallowed); frontend error capture; changing any response body or status the
client sees; extracting/DRYing MCS's duplicated `handler()` wrappers (separate
cleanup).

## Decisions (confirmed with the user)

| Question | Decision |
|---|---|
| IMMS route-500 approach | **A 5xx-response middleware** — one unit covers all 234 sites; stackless but contextual |
| MCS route-500 approach | **Capture the real error at the `handler()` choke points** — real stack traces |
| Gating | **Reuse `SENTRY_DSN`** via a module `enabled` flag; no new env vars |
| Two different mechanisms | **Accepted** — use each backend's best available signal (MCS has the error object; IMMS doesn't) |

## Architecture

Three small units. All capture flows through one guarded helper so nothing fires
when Sentry is off.

### Unit 1 — `captureException` helper (both backends' `sentry.js`)

Extend the existing `src/observability/sentry.js` (identical in both backends):

- A module-level `enabled` flag, set `true` inside `initSentry()` when
  `Sentry.init` succeeds (and stays `false` otherwise / on throw).
- Export `captureException(err)` that calls `defaultSentry.captureException(err)`
  **only when `enabled`** — a safe no-op otherwise, callable from anywhere without
  guarding at the call site.
- The two files remain **byte-identical** (the property established in §2.2).

Signature: `captureException(err) -> void`. Exports become
`{ Sentry, initSentry, captureException }`.

### Unit 2 — MCS: capture at the `handler()` choke points

Each MCS router (`maintenanceCalls.js`, `callBoardLayouts.js`, `permissions.js`)
defines a local `handler(fn)` whose `.catch((err) => …)` already does
`log(req).error({ err }, 'Route error')` before `errors.serverError(res)`. Add
`captureException(err)` right beside that logging (for non-`DomainError` errors —
`DomainError`s are expected 4xx, not 500s, and must NOT be captured). Also cover
the one inline `.catch` in `maintenanceCalls.js` (~line 228) that calls
`errors.serverError`. Result: every MCS route-500 reaches Sentry **with its stack**.

### Unit 3 — IMMS: 5xx-response-capture middleware

New `backend/src/observability/capture5xx.js` exporting an Express middleware.
Registered at the **top of `backend/src/app.js`** (right after `const app =
express()`, before any routes) so it covers every route in both `app.js` and
`index.js` — verified: `index.js:36` does `const app = require('./src/app')`, so
there is a single shared app instance.

Mechanism: the middleware attaches `res.on('finish', …)`; when the response has
finished with `res.statusCode >= 500`, it builds an `Error` describing the request
(`HTTP <status> on <method> <originalUrl>`) and passes it to `captureException`.
Because the original stack was swallowed, the event carries the route/method/status
and Sentry's request context, not the throw site. Fully no-op when Sentry is off
(`captureException` guards internally). The `finish` listener never touches the
response, so client behavior is unchanged.

## Config / gating

No new env vars. Everything is gated by the existing `SENTRY_DSN` through the
`enabled` flag in `sentry.js`. When unset: `initSentry()` returns false, `enabled`
stays false, `captureException` is a no-op, the MCS additions do nothing, and the
IMMS middleware's `finish` handler calls a no-op.

## Error handling / edge cases

- `captureException` must never throw into the caller (route/finish handler) —
  wrap the Sentry call so a capture failure is swallowed/logged, not propagated.
- MCS: do NOT capture `DomainError` (those are deliberate 4xx). Only the
  server-error branch captures.
- IMMS middleware fires once per response via `finish`; it must not double-count.
  Since IMMS routes never call `next(err)`, `setupExpressErrorHandler` won't also
  fire for the same request, so no duplicate. (A future route that does call
  `next(err)` could double-report; acceptable and rare.)
- The middleware reads `res.statusCode` at `finish`, so it captures 500s no matter
  which layer produced them.

## Testing

- **`captureException`** (both runners, DI style — no module mocking): disabled →
  no-op (injected `{ captureException: fn }` not called / returns without throw);
  enabled → forwards the error once. Also: a throw inside Sentry's capture doesn't
  propagate.
- **MCS `handler`**: a thrown non-`DomainError` inside a wrapped handler triggers
  `captureException(err)`; a `DomainError` does NOT. (Unit-test the `handler`
  wrapper with an injected capture + a fake res.)
- **IMMS `capture5xx` middleware**: simulate a response finishing with status 500
  → `captureException` called with an error naming method/path/status; status 200
  → not called; Sentry disabled → not called. Use a fake `req`/`res` with an
  `on('finish')` emitter.
- No test hits a live Sentry. Manual acceptance (with the §2.2 manual step): set
  `SENTRY_DSN`, trigger a 500 in each backend, confirm both a stack-ful MCS event
  and a contextual IMMS event appear.

## Risks / plan-level checks

- Keep the two `sentry.js` files byte-identical after adding `captureException`.
- Confirm the middleware registration at `app.js` top runs before all routes
  (it does — single shared app) and that `res.on('finish')` sees the final status.
- Enumerate the exact MCS capture sites in the plan (3 `handler()` catches + the
  inline `.catch`), capturing only the non-`DomainError` 500 branch.
- After merge, mark roadmap §2.2 done (its "route-500" follow-up is now closed).
- Ships through the required CI gate (imms-backend `test:ci`, mcs-backend vitest).
