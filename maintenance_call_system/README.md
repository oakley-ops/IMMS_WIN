# Maintenance Call System (MCS)

A factory-floor maintenance call system. Operators tap a badge at a machine-side reader to summon a technician; technicians tap to acknowledge, suspend, or resolve the call. Live call board, real-time updates, and per-shift metrics.

## Multi-tenancy status (Step 2a complete)

Every domain table has a `tenant_id INT NOT NULL DEFAULT 1` column with a FK to `auth.tenants(tenant_id)` and an index on `tenant_id`. The seeded `fiserv` tenant has `tenant_id = 1`, so every existing row is correctly scoped.

**What works today:** schema is multi-tenant-ready; one tenant in operation.

**What is NOT yet done (Step 2b — deferred):** existing SQL queries do not filter by `tenant_id`. The `currentTenantId(req)` helper at `src/middleware/tenantScope.js` returns `1` for every call. Until query sites are rewritten, do not onboard a second tenant — cross-tenant data leakage would result.

See `docs/superpowers/specs/2026-05-21-mcs-imms-split-saas-foundations-design.md` and `docs/superpowers/plans/2026-05-22-tenant-id-schema-rollout.md`.

```
┌─────────────────┐    ┌──────────────────┐    ┌──────────────┐
│  Call Station   │    │   Call Board     │    │   Admin UI   │
│  (kiosk + HID   │    │  (live wallboard)│    │ (badge/reader│
│   badge reader) │    │                  │    │   registry)  │
└────────┬────────┘    └────────┬─────────┘    └──────┬───────┘
         │                      │                     │
         └──────────────────────┼─────────────────────┘
                                │ HTTP + Socket.io
                                ▼
                       ┌─────────────────┐
                       │  Express API    │
                       │  /api/v1/...    │
                       └────────┬────────┘
                                │ pg pool
                                ▼
                       ┌─────────────────┐
                       │   PostgreSQL    │
                       └─────────────────┘
```

---

## Quick start

### 1. Prerequisites
- Node.js ≥ 18
- PostgreSQL ≥ 13 with a database created for MCS
- (Optional) HID-style USB badge reader for production use

### 2. Backend

```bash
cd backend
cp .env.example .env          # then edit JWT_SECRET, DB_*
npm install
npm run dev                   # http://localhost:4001
```

Smoke-test: `curl http://localhost:4001/health` → `{ "status": "healthy" }`

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local    # adjust API/socket URLs if backend isn't on localhost:4001
npm install
npm run dev                   # http://localhost:3003
```

### 4. Database migrations

SQL files in `backend/migrations/` are applied in alphanumeric order. Apply manually with `psql` for now:

```bash
psql "$DATABASE_URL" -f backend/migrations/20260509_create_maintenance_calls.sql
```

(See parent project `backend/migrations/` for the maintenance-calls schema if migrating from the IMMS database.)

---

## Project layout

```
maintenance_call_system/
├── backend/
│   ├── src/
│   │   ├── config/           # shifts, database config
│   │   ├── database/         # pg pool
│   │   ├── lib/              # logger
│   │   ├── middleware/       # auth, validate, errors
│   │   ├── repositories/     # SQL (one file per resource)
│   │   ├── routes/           # thin HTTP handlers
│   │   ├── schemas/          # Zod request schemas
│   │   ├── services/         # business logic
│   │   └── test/             # vitest setup
│   ├── migrations/           # SQL migration files
│   ├── .env.example
│   ├── index.js              # app entry
│   └── vitest.config.js
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js routes
│   │   ├── components/
│   │   │   └── station/      # CallStation sub-components
│   │   ├── contexts/         # AuthContext
│   │   ├── hooks/            # useBadgeScanner, useStationCall
│   │   ├── services/         # API client
│   │   ├── test/             # vitest setup
│   │   └── theme.ts
│   ├── .env.example
│   └── vitest.config.ts
├── PROGRAMMING_PRINCIPLES.md  # team conventions
├── TESTING.md                 # Vitest playbook
└── README.md                  # this file
```

---

## Architecture

### Backend layers (top → bottom)

| Layer | Owns | Example |
|-------|------|---------|
| `routes/` | HTTP shape: parse, validate, format response | `router.post('/badge-swipe', validate(...), handler(...))` |
| `services/` | Business logic, orchestration | `badgeSwipeService.handleBadgeSwipe(db, body)` |
| `repositories/` | SQL queries, row mapping | `repo.findActiveBadge(db, badgeId)` |
| `database/` | pg connection pool | `db.query(text, params)` |

Routes are thin (avg ~5 lines). Services know nothing about HTTP. Repositories know nothing about business rules. See `PROGRAMMING_PRINCIPLES.md` §2 for the rationale.

### Frontend layers

| Layer | Owns |
|-------|------|
| `app/` | Routes (Next.js app router) |
| `components/` | Presentation |
| `hooks/` | Side effects, state |
| `contexts/` | Cross-tree state (auth) |
| `services/` | API client (axios) |

### Authentication

JWT with 24h expiry. Issued by `POST /api/v1/auth/login`, stored in `localStorage` (an open item — see `PROGRAMMING_PRINCIPLES.md` §10), sent as `Authorization: Bearer <token>` via an axios interceptor. Validated by `middleware/auth.js`.

Kiosk endpoints (`/badge-swipe`, `/reader/:key`, `/active`) are intentionally unauthenticated — they're called from a public terminal.

### Error envelope

Every non-2xx response follows:

```json
{ "error": "validation_error", "message": "Invalid request body", "details": [{ "path": "badge_id", "message": "Required" }] }
```

Codes: `validation_error`, `bad_request`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `server_error`.

Success responses are raw resources (no envelope).

### Logging

Structured logs via `pino`. Every request gets an `x-request-id` header (echoed to the client) and a child logger (`req.log`) so all downstream log lines correlate. Production: JSON one-line-per-event. Development: pretty-printed.

Sensitive fields (`authorization`, `password`, `token`) are auto-redacted.

---

## API surface

Base: `http://<host>:4001/api/v1`

### Auth
| Method | Path | Body | Auth |
|--------|------|------|------|
| POST | `/auth/login` | `{ username, password }` | — |

### Kiosk (public)
| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/maintenance-calls/badge-swipe` | `{ badge_id, reader_key }` | Drives the operator/technician state machine |
| GET | `/maintenance-calls/active` | — | Live call board feed |
| GET | `/maintenance-calls/reader/:reader_key` | — | Reader/machine metadata |
| GET | `/maintenance-calls/parts/search?q=` | — | Parts autocomplete |
| PUT | `/maintenance-calls/:id/resolve` | `{ resolution_notes, reason_category? }` | |
| PUT | `/maintenance-calls/:id/suspend` | `{ suspension_notes? }` | |
| POST | `/maintenance-calls/:id/parts` | `{ parts: [...] }` | Log parts used |

### Authenticated (Bearer JWT)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/maintenance-calls` | Call history with filters |
| GET | `/maintenance-calls/:id` | Single call |
| GET | `/maintenance-calls/stats/metrics` | KPI metrics |
| GET / POST / PUT | `/maintenance-calls/admin/badges[/:id]` | Badge registry |
| GET / POST / PUT | `/maintenance-calls/admin/readers[/:id]` | Reader registry |
| GET | `/maintenance-calls/machines/list` | Machine dropdown |

### Real-time (Socket.io @ port 4001)

| Event | Payload | Emitted when |
|-------|---------|--------------|
| `maintenance_call_created` | full call object | Operator creates a call |
| `maintenance_call_updated` | full call object | Technician acknowledges / suspends / resumes |
| `maintenance_call_resolved` | full call object | Call is resolved |

---

## Development

### Scripts

**Backend** (`cd backend`):
- `npm run dev` — nodemon, pretty logs
- `npm start` — production mode
- `npm test` — vitest, single run
- `npm run test:watch` — watch mode
- `npm run test:coverage` — v8 coverage report

**Frontend** (`cd frontend`):
- `npm run dev` — Next.js dev server on :3003
- `npm run build` — production build
- `npm run start` — production server
- `npm test` — vitest

### Testing

49 unit tests cover the auth path, shift logic, every route, the auth context, the service layer, and the major UI components. See `TESTING.md` for the full playbook.

```bash
cd backend && npm test     # 30 tests
cd frontend && npm test    # 19 tests
```

### Code style

The team conventions live in `PROGRAMMING_PRINCIPLES.md`. Highlights:
- Routes ≤ 10 lines; push logic into a service.
- Validate at boundaries (Zod schemas in `src/schemas/`).
- Never log secrets — the pino logger redacts authorization headers and password fields, but think before adding new fields to log context.
- Error handling: throw `DomainError` in services; let `handler(fn)` translate it to HTTP.
- Tests are pyramid: many unit, fewer integration.

---

## Deployment

Both apps are stateless and run under PM2 in production as `mcs-api` and `mcs-web`, defined in `ecosystem.prod.config.js` at the **monorepo root** alongside the IMMS services. Production runs from the dedicated clone `C:\imms\prod`, and deploys go through `scripts\deploy.ps1` — see `docs/deployment/PROD_OPERATIONS.md` at the monorepo root.

Production env vars (set in the system or PM2 ecosystem file):
- `NODE_ENV=production`
- `JWT_SECRET=<long random>` — REQUIRED
- `DATABASE_URL=postgres://...`
- `CORS_ORIGIN=https://your.frontend.host`
- `LOG_LEVEL=info` (default)

---

## Open items

Tracked in PR comments and `PROGRAMMING_PRINCIPLES.md` audit. Highest-priority remaining:

- JWT is stored in `localStorage` (XSS-exposed). Migrate to httpOnly cookies.
- `/badge-swipe` is unauthenticated by design (kiosk) but should be per-reader rate-limited.
- No pagination on `/active` yet (acceptable while active call count is small).
