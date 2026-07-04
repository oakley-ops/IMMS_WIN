# IMMS ↔ MCS Architecture Reference

How the Inventory Management System (IMMS) and the Maintenance Call System
(MCS) fit together: runtimes, shared resources, every integration seam, the
full endpoint map, and the known gaps. Companion to
`maintenance_call_system/SCHEMA_CONTRACT.md`, which is the authoritative
record of schema ownership and the auth contract — this doc covers the
runtime/endpoint view and current findings.

Last verified: 2026-07-03.

---

## 1. Two apps, one database, one identity

| | IMMS | MCS |
|---|---|---|
| Backend | Express 4 on **:4000** (`backend/`) | Express 4 on **:4001** (`maintenance_call_system/backend/`) |
| Frontend | React CRA on :3000 / :3001 (Pi) / :3002 (camera) | Next.js on **:3003** |
| Real-time | Socket.io on :4000 | Socket.io on :4001 |
| Style | Routes + controllers (some very large), inline SQL | Layered: routes → services → repositories, Zod validation, pino logging |
| Start | `.\start-app.bat` | `maintenance_call_system\start-mcs.bat` |

Both backends open independent `pg` pools against the **same PostgreSQL
database** (`fiservinventory` by default). Integration happens through:

1. the shared database (schema ownership contract),
2. a shared `JWT_SECRET` (both sides sign/verify the same tokens),
3. a browser-level SSO handoff (IMMS login → URL fragment → MCS),
4. one narrow backend-to-backend HTTP call — MCS → IMMS `POST
   /api/v1/parts/usage` to decrement inventory (added by the 4.2 fix,
   see §4.2). This is the only direct HTTP traffic between the two
   backends; everything else stays inside the seams above.

Multi-tenancy: every MCS domain table has `tenant_id` (default 1), but
queries do not filter by it yet. **Do not onboard a second tenant** until
Step 2b (query rewrite) is done. See `maintenance_call_system/README.md`.

---

## 2. Integration seams

### 2.1 Shared database / schema ownership

Ownership table lives in `SCHEMA_CONTRACT.md`. Summary:

- **IMMS owns:** `users`, `machines`, `technicians`, `parts`, `pm_sessions`,
  `transactions`, `purchase_orders`*, `login_attempts`
- **MCS owns:** `maintenance_calls`, `maintenance_call_parts`,
  `badge_registrations`, `badge_readers`, `call_board_layouts`,
  `call_board_tiles`, `mcs_user_permissions`, and the
  **`v_maintenance_calls_enriched` view**
  (`maintenance_call_system/backend/migrations/20260512_mcs_analytics_fields.sql`)

Rule: add columns only via the owning project's migrations.

MCS reads these IMMS-owned tables directly (read-only):

| Table | Read for |
|---|---|
| `machines` | board tiles, call display, `cost_per_hour` → downtime $, dropdowns |
| `technicians` | badge registry display |
| `parts` | kiosk parts autocomplete (`/maintenance-calls/parts/search`) |
| `pm_sessions` | board tile `pm` status (in-progress PM sessions) |
| `users` | JWT claims / MCS permissions join |

### 2.2 Auth / SSO

IMMS is the **sole login authority**. Flow (details + rationale in
`SCHEMA_CONTRACT.md`):

1. Unauthenticated MCS user → redirect to
   `NEXT_PUBLIC_IMMS_LOGIN_URL?returnTo=<mcs-url>`.
2. IMMS `Login.tsx` validates `returnTo` origin against
   `REACT_APP_RETURN_TO_ALLOWLIST` (open-redirect guard).
3. On success, IMMS redirects to `<returnTo>#token=<jwt>&user=<b64 json>` —
   a fragment, so the token never hits server logs.
4. MCS `AuthContext` parses the fragment, stores
   `localStorage['mcs_token']`, scrubs the URL.

Both backends verify with the same `JWT_SECRET`; payload is
`{ id, username, role, iat, exp(24h) }`. Rotate the secret on both apps in
lockstep. MCS layers its own per-user permissions on top
(`mcs_user_permissions`, checked by `requirePermission()` middleware).

### 2.3 Real-time (two separate Socket.io servers)

MCS clients connect **only** to :4001. Events: `maintenance_call_created`,
`maintenance_call_updated`, `maintenance_call_resolved`,
`call_board_layout_updated`. Payload = full call object; clients respond by
refetching (`/board-status` or the station's call), with polling fallback
(30s board, 10s station/history list).

Anything written through IMMS's :4000 socket is invisible to MCS clients
until the next poll — this was one reason the legacy duplicate route
(§4.1, now removed) was a liability: it emitted events nobody was
listening for.

PM sessions have no socket event: starting/ending a PM in IMMS shows on the
MCS board only via the 30s poll. Acceptable today; an event would tighten it.

---

## 3. Endpoint map

### 3.1 MCS API (`http://<host>:4001/api/v1`)

**Kiosk / public (unauthenticated by design — factory-floor terminals):**

| Method | Path | Notes |
|---|---|---|
| POST | `/maintenance-calls/badge-swipe` | Operator/technician state machine (`badgeSwipeService`) |
| GET | `/maintenance-calls/active` | Raw active-call list (station + history fallback) |
| GET | `/maintenance-calls/board-status` | One-query-per-refresh derived board (pm > suspend > te_present > wait > running, wait-queue positions) |
| GET | `/maintenance-calls/reader/:reader_key` | Reader + machine metadata for station page |
| GET | `/maintenance-calls/parts/search?q=` | ILIKE autocomplete against IMMS `parts` |
| PUT | `/maintenance-calls/:id/resolve` | `resolution_notes` required |
| PUT | `/maintenance-calls/:id/suspend` / `:id/resume` | Suspension flow |
| POST / GET | `/maintenance-calls/:id/parts` | Log / list parts used on a call. POST also calls IMMS `parts/usage` per part (best-effort inventory decrement, §4.2) and returns `inventory[]` alongside `parts[]` |

**Authenticated (Bearer JWT; some also gated by `requirePermission`):**

| Method | Path | Permission |
|---|---|---|
| GET | `/maintenance-calls` | — (call history, filterable, LIMIT/OFFSET) |
| GET | `/maintenance-calls/:id` | — |
| GET | `/maintenance-calls/stats/metrics` | — (8 parallel aggregate queries on the enriched view) |
| GET | `/maintenance-calls/stats/parts-metrics` | — |
| GET/POST/PUT | `/maintenance-calls/admin/badges[/:badge_id]` | POST: `badges_add`; PUT: admin role |
| GET/POST/PUT | `/maintenance-calls/admin/readers[/:id]` | `readers_manage` |
| GET | `/maintenance-calls/machines/list` | — (active machines dropdown) |
| GET | `/analytics/pdf` | `analytics_view` (pdfmake report from the same metrics) |
| * | `/call-board-layouts...` | Board layout designer CRUD |
| * | `/permissions...` | Per-user MCS permission admin |

Error envelope: `{ error, message, details? }` with stable codes; success
responses are raw resources. Zod schemas in `backend/src/schemas/`.

### 3.2 IMMS API (`http://<host>:4000/api/v1`)

Mounted in `backend/index.js`: `auth`, `parts`, `machines`, `dashboard`,
`vendors`, `purchase-orders`, `email`, `projects`, `equipment`,
`technicians`, `contacts`, `transactions`, `analytics`, `milestones`,
`tasks`, `work-orders`, `dies`, `die-sharpening`, `die-documents`, `demo`,
plus `search` (smart search) and `pm`. (The legacy duplicate
`maintenance-calls` mount from §4.1 has been removed.)

One unauthenticated, unversioned-router route lives directly on `app` in
`backend/index.js` rather than under a router file:

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/v1/parts/usage` | `{ part_id, quantity, reason?, work_order_number? }` | Transactional decrement + `transactions` insert. Public by design (no `machine_id`). **Now also called by MCS** — see §4.2 — so treat its request/response shape as a cross-app contract, not an internal implementation detail. |

Historically MCS never called the IMMS API — the only surface it depended
on was the **login page** (`/login?returnTo=`) and the shared DB tables
above. As of the 4.2 fix, MCS also makes one narrow, best-effort HTTP call
into IMMS: `POST /api/v1/parts/usage` (unauthenticated, pre-existing) to
decrement inventory when parts are logged on a resolved call. See §4.2.

---

## 4. Findings (from the 2026-07 endpoint audit)

Ordered by impact. 4.1–4.3 were fixed on `fix/mcs-imms-integration-audit`
(2026-07-03); 4.4–4.5 remain open.

### 4.1 ✅ FIXED — Legacy duplicate maintenance-calls API inside IMMS

`backend/src/routes/maintenanceCalls.js` was an **older copy** of the MCS
API, mounted at `:4000/api/v1/maintenance-calls`. Nothing in the IMMS
frontend called it, but it was live and unauthenticated, and its logic had
diverged from MCS (didn't know about `suspended` status → duplicate calls
on a badge swipe; emitted socket events on :4000 that no MCS client
listens to; no Zod validation, no suspend/resume/parts endpoints, no MCS
permission checks; read the MCS-owned enriched view — a reversed
dependency).

**Fix applied:** deleted the route and its unmount in `backend/index.js`,
and deleted `backend/src/config/shifts.js` (only that route used it). MCS's
own `maintenance_call_system/backend/src/routes/maintenanceCalls.js` is now
the only maintenance-calls API in the system.

### 4.2 ✅ FIXED — Parts logged on calls never touched inventory

`insertCallParts` (MCS repo) used to write `maintenance_call_parts` only —
no `parts.quantity` decrement, no `transactions` row.

**Fix applied (real inventory transaction, per product decision):** MCS
never writes to IMMS-owned tables directly. Instead,
`maintenance_call_system/backend/src/services/callPartsService.js` logs
the call parts (via the now-transactional `repo.insertCallParts`, §4.3)
and then, per part, calls IMMS's existing unauthenticated
`POST /api/v1/parts/usage` (`backend/index.js`, already public — the same
custom pre-controller route IMMS used for other quantity-less usage
recording) with `{ part_id, quantity, reason: 'Maintenance call
resolution', work_order_number: 'MC-<call_id>' }`. That endpoint is the
IMMS-owned code path: it does the `SELECT ... FOR quantity check → BEGIN →
UPDATE parts → INSERT transactions → COMMIT` sequence, so decrement logic
and validation stay owned by IMMS.

Because MCS and IMMS never share a DB transaction, each part's decrement
succeeds or fails independently of the call-parts log (3s timeout via
`AbortController`, insufficient-stock and unreachable-IMMS both treated as
a soft per-part failure, not a request failure). `POST /:id/parts` now
returns `{ parts: [...], inventory: [{ part_id, decremented, error? }] }`.
The MCS UI surfaces failures: the kiosk (`CallStation.tsx`) shows a new
`parts_low_stock` feedback overlay ("RESOLVED — PART NOT DEDUCTED, TELL A
LEAD") instead of silently succeeding, and the admin call history
(`MaintenanceCalls.tsx`) shows a dismissible warning `Alert` naming the
parts that didn't decrement. New env var: `IMMS_API_URL` (MCS backend
`.env`, defaults to `http://localhost:4000/api/v1`).

Tests: `services/callPartsService.test.js`, plus new `POST /:id/parts`
cases in `routes/maintenanceCalls.test.js`.

### 4.3 ✅ FIXED — `insertCallParts` was not transactional

It used to fire N independent INSERTs via `Promise.all`; a mid-batch
failure left partial rows.

**Fix applied:** `repo.insertCallParts` now uses `db.getClient()` and wraps
all inserts in a single `BEGIN`/`COMMIT`, with `ROLLBACK` + `client.release()`
on any failure. Covered by `repositories/maintenanceCallsRepo.test.js`.

### 4.4 Known accepted risks (documented in MCS README)

- Kiosk endpoints (badge-swipe, resolve, suspend, resume, parts) are
  unauthenticated by design; badge-swipe should get per-reader rate
  limiting.
- JWT in `localStorage` (both apps) — httpOnly-cookie migration is an open
  item.
- No pagination on `/active` (fine while active-call counts are small).

### 4.5 Minor

- MCS `searchParts` aliases `NULL AS fiserv_part_number` — dead legacy
  column name; drop it (also: no Fiserv branding in this codebase).
- MCS parts autocomplete is plain ILIKE; IMMS smart search
  (`/api/v1/search`) is much better. Fine for a kiosk, but if autocomplete
  quality becomes a complaint, reuse the ranked-search SQL rather than
  calling across apps.

---

## 5. What is already efficient (don't "fix")

- **`/board-status` is a single SQL round trip** (CTEs for active calls,
  active PMs, wait queue) that computes the entire TV board — this is the
  pattern to keep, not N queries per tile.
- **Metrics endpoints batch their aggregates with `Promise.all`** (8
  queries for call metrics, 3 for parts metrics) against the enriched
  view — one HTTP request per dashboard load.
- **Real-time strategy**: socket event → refetch, with slow-poll fallback
  (30s board / 10s station). Simple and self-healing; no client-side state
  reconciliation to get wrong.
- **MCS layering** (thin routes, service for the badge state machine,
  repository for all SQL, Zod at boundaries, pino with request IDs) is the
  reference style for new IMMS work — see
  `maintenance_call_system/PROGRAMMING_PRINCIPLES.md`.

---

## 6. Change checklist

Before merging anything that touches the seam, check:

- [ ] Renaming/removing a column MCS reads from `users`, `machines`,
      `technicians`, `parts`, or `pm_sessions`? → update MCS in the same PR
      (`SCHEMA_CONTRACT.md` §"Columns MCS reads").
- [ ] Changing JWT payload/secret? → both apps in lockstep.
- [ ] Adding a column to a table you don't own? → move the migration to the
      owning project.
- [ ] New MCS write to an IMMS-owned table? → never write directly; add or
      reuse an IMMS-owned HTTP endpoint (as §4.2 did with
      `POST /api/v1/parts/usage`), then record the new coupling here and in
      `SCHEMA_CONTRACT.md`.
- [ ] Changing `POST /api/v1/parts/usage`'s request/response shape? → MCS's
      `callPartsService.js` depends on it now; update both sides together.
- [ ] Changing `v_maintenance_calls_enriched`? → it's MCS-owned; nothing in
      IMMS reads it (confirmed after the §4.1 cleanup).
- [ ] Adding a second tenant? → blocked until tenant_id query filtering
      (Step 2b) lands.
