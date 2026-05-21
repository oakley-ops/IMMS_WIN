# MCS / IMMS Split + SaaS Foundations — Design

**Date:** 2026-05-21
**Status:** Draft for review
**Author:** Isaac Rodriguez (with Claude)

## Background

Today MCS (Maintenance Call System) lives as a sibling directory under `fiservinventory_win`. It is already a separate Node app — own backend on `:4001`, own frontend on `:3003`, own PM2 ecosystem, own `package.json` files. **However**, copies of the MCS feature also exist *inside* IMMS:

- `frontend/src/pages/MaintenanceCalls.tsx`
- `frontend/src/components/CallStation.tsx`
- `frontend/src/components/CallBoard.tsx`
- `frontend/src/components/BadgeAdmin.tsx`
- `frontend/src/services/maintenanceCallService.ts`
- `MAINTENANCE CALLS` entry in `Navigation.tsx` pointing to `/maintenance-calls`

The two apps also share the `fiservinventory` Postgres database (MCS reads the `parts` table for parts autocomplete on a call).

The user wants MCS to stand on its own as a real product with its own UI for calls / analytics / admin, and to remove MCS from the IMMS sidebar. The user is also "still in building/developing stages" but may want to take this to SaaS later.

## Goals

1. Make MCS a complete standalone product (Board, Calls, Analytics, Admin) reachable independently of IMMS.
2. Remove all MCS UI and routing from IMMS.
3. Replace the two separate JWT auth systems (IMMS + MCS) with a single auth service.
4. Lay the *minimum* multi-tenancy foundation that keeps the SaaS door open without doing wasted work today (no signup flow, no billing, no marketing site, no per-tenant subdomain provisioning).
5. Keep MCS operational even if IMMS is down (it already is; preserve that).

## Non-goals (deferred until a real second customer)

- Self-service tenant signup
- Billing / Stripe integration
- Per-tenant subdomain provisioning automation
- Cross-tenant users (one user belonging to multiple tenants)
- Third-party identity vendor (Auth0/Clerk/WorkOS) — JWT contract will be ours so swapping later is contained
- Marketing site
- Multi-region

## Architecture

```
                       ┌──────────────────────┐
                       │   Portal page        │
                       │   Tiles: IMMS | MCS  │
                       └──────────┬───────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                ▼                 ▼                 ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │ Auth service │  │   IMMS app   │  │   MCS app    │
        │  /auth/*     │  │ :4000 / :3001│  │ :4001 / :3003│
        │  users,      │  │ validates JWT│  │ validates JWT│
        │  tenants,    │  │ filters by   │  │ filters by   │
        │  roles       │  │ tenant_id    │  │ tenant_id    │
        └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
               │                 │                 │
               └────────┬────────┴────────┬────────┘
                        ▼                 ▼
                 ┌────────────────────────────┐
                 │   PostgreSQL               │
                 │   schemas:                 │
                 │     auth  (tenants, users) │
                 │     public (IMMS tables)   │
                 │     mcs   (MCS tables)     │
                 │   every domain table has   │
                 │   a tenant_id column       │
                 └────────────────────────────┘
```

### Components

**Auth service (new)** — small Express service. Owns users, tenants, roles. Endpoints:
- `POST /auth/login` — email + password → sets httpOnly cookie, returns user shape
- `POST /auth/logout` — clears cookie
- `GET /auth/me` — returns current user (id, tenant_id, roles, display_name)
- `POST /auth/refresh` — refreshes the JWT
- `GET /admin/users`, `POST /admin/users`, etc. — user CRUD (gated by `*.admin` roles)

Signs JWTs with **RS256** (asymmetric). Private key in auth service, public key distributed to IMMS and MCS. If either app is compromised, the attacker can verify but cannot mint tokens.

**Portal (new)** — minimal Next.js app. Single page: tile grid filtered by user roles. Tile click is a plain `<a>` to the app's subdomain — no token handoff needed because the cookie is scoped to the parent domain.

**IMMS & MCS** — unchanged in structure. Drop their own login screens and password storage; replace `middleware/auth.js` with a "verify auth-service JWT from cookie" middleware (~20 lines). Token validation is local (uses the public key) — no per-request call to the auth service.

### JWT shape

```json
{
  "sub": 42,
  "tenant_id": 1,
  "roles": ["imms.admin", "mcs.admin"],
  "iat": 1716300000,
  "exp": 1716386400
}
```

- 24h expiry, signed RS256.
- Lives in an **httpOnly cookie** scoped to the parent domain (`.fiserv.local` in dev, real domain in prod).
- Fixes the XSS exposure that MCS's README already flagged with `localStorage` storage.

## Data model

### Auth schema (new `auth` Postgres schema)

```sql
CREATE TABLE auth.tenants (
  tenant_id     SERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'suspended'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE auth.users (
  user_id       SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL REFERENCES auth.tenants(tenant_id),
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,                    -- bcrypt
  display_name  TEXT,
  status        TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'disabled'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE auth.roles (
  role_id     SERIAL PRIMARY KEY,
  key         TEXT UNIQUE NOT NULL,               -- 'mcs.admin', 'imms.user', ...
  app         TEXT NOT NULL,                      -- 'imms' | 'mcs' | 'portal'
  description TEXT
);

CREATE TABLE auth.user_roles (
  user_id INT REFERENCES auth.users(user_id) ON DELETE CASCADE,
  role_id INT REFERENCES auth.roles(role_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);
```

Seed:
- One row in `tenants`: `(1, 'fiserv', 'Fiserv')`.
- Backfill every current IMMS user into `auth.users` with `tenant_id = 1`. Preserve password hashes if compatible; otherwise force a password reset on first login.
- Seed `roles` with the matrix below.

### Role matrix

| Role key | App | Implies |
|---|---|---|
| `mcs.viewer` | MCS | Read board, calls history, analytics |
| `mcs.tech` | MCS | mcs.viewer + resolve/suspend/log parts on calls |
| `mcs.admin` | MCS | mcs.tech + admin pages (badges, readers, users, layouts) |
| `imms.viewer` | IMMS | Read-only access |
| `imms.user` | IMMS | imms.viewer + standard write operations |
| `imms.admin` | IMMS | imms.user + admin features |

Roles are additive. A user holds the explicit set they were granted; UI/middleware checks the highest required role.

### Tenant_id rollout

Add `tenant_id INT NOT NULL DEFAULT 1` to every domain table in both apps:

- **IMMS:** `parts`, `machines`, `transactions`, `purchase_orders`, `purchase_order_items`, `work_orders`, `dies`, `projects`, `milestones`, `tasks`, `technicians`, `part_assignments`, and every other domain table. (Comprehensive list to be enumerated in the implementation plan by reading `backend/migrations/`.)
- **MCS:** `maintenance_calls`, `maintenance_call_parts`, `badges`, `readers`, `call_board_layouts`, and any other domain tables.

Then:
1. Update every repository function to take `tenantId` (sourced from `req.user.tenant_id`) and include `AND tenant_id = $tenantId` in WHERE clauses and explicit `tenant_id` in INSERTs.
2. Add a small `tenantScope(req)` helper to make this consistent.
3. Add a CI grep guard (~10 lines) that fails the build if any new SQL on a tenant-scoped table doesn't reference `tenant_id`.
4. Once code is migrated, drop the `DEFAULT 1` — every INSERT must explicitly carry tenant_id.

### Schema reorg

Move MCS tables from `public` into a new `mcs` schema. This is cosmetic but makes the IMMS/MCS boundary visible at the database level. Done last, after the rest is stable.

Final layout:
```
fiservinventory
├── public  — IMMS tables
├── mcs     — MCS tables
└── auth    — auth service tables
```

The auth service has its own connection pool and only `SET search_path = auth`. If extracted to its own DB host later, it's a `pg_dump` of one schema.

## Frontend: MCS standalone UI

### Top nav

A persistent header on all non-kiosk routes:

```
┌──────────────────────────────────────────────────────────────┐
│ MCS  [Board] [Calls] [Analytics] [Admin ▾]   Maria ▾   ⎋    │
└──────────────────────────────────────────────────────────────┘
```

- `/board`, `/calls`, `/analytics`, `/station` already exist.
- `/station` shows **no nav** — it's a kiosk URL opened full-screen.
- Nav items are role-gated (viewer/tech see no Admin dropdown).

### Admin section (new)

Four pages under `/admin/*`, all gated by `mcs.admin`:

| Route | Purpose |
|---|---|
| `/admin/badges` | List/add/edit/deactivate badges. (Port from IMMS `BadgeAdmin.tsx`.) |
| `/admin/readers` | List/add/edit readers. Bind reader to machine. (API exists; UI new.) |
| `/admin/users` | List/invite/deactivate MCS users; assign roles. (Calls auth service.) |
| `/admin/layouts` | Call-board layout editor. (API exists; UI new.) |

All four follow the same pattern: list page with search + "Add" button → drawer/modal form.

### File-level changes

```
maintenance_call_system/frontend/src/app/
├── layout.tsx              [MODIFY] add <TopNav /> for non-kiosk routes
├── page.tsx                [MODIFY] redirect '/' → '/board'
├── login/page.tsx          [DELETE] handled by auth service
├── board/page.tsx          [keep]
├── calls/page.tsx          [keep]
├── analytics/page.tsx      [keep]
├── station/page.tsx        [keep, no nav]
└── admin/
    ├── layout.tsx          [NEW] role-gate: mcs.admin
    ├── badges/page.tsx     [NEW]
    ├── readers/page.tsx    [NEW]
    ├── users/page.tsx      [NEW]
    └── layouts/page.tsx    [NEW]

src/components/
├── nav/
│   ├── TopNav.tsx          [NEW]
│   └── UserMenu.tsx        [NEW] logout, "switch app" → portal
└── admin/
    ├── BadgesTable.tsx     [NEW]
    ├── BadgeForm.tsx       [NEW]
    ├── ReadersTable.tsx    [NEW]
    ├── ReaderForm.tsx      [NEW]
    ├── UsersTable.tsx      [NEW]
    ├── UserInviteForm.tsx  [NEW]
    └── LayoutEditor.tsx    [NEW]
```

### Auth integration

- No login page in MCS. If `/auth/me` returns 401, redirect to `auth.fiserv.local/login?next=mcs.fiserv.local`.
- A `useCurrentUser()` hook calls `/auth/me` once on mount, caches in context, drives role-gating.

### Kiosk (`/station`)

Remains unauthenticated. Authentication is per-action via badge swipe, not per-user via JWT. Already correct.

## IMMS cleanup

Hard delete of MCS pages and routes — no transitional period, no feature flag (standalone MCS replaces them 1:1):

```
frontend/src/
├── pages/MaintenanceCalls.tsx           [DELETE]
├── components/CallStation.tsx           [DELETE]
├── components/CallBoard.tsx             [DELETE]
├── components/BadgeAdmin.tsx            [DELETE — after porting to MCS]
├── services/maintenanceCallService.ts   [DELETE]
├── components/Navigation.tsx            [MODIFY — remove MAINTENANCE CALLS]
└── App.tsx                              [MODIFY — remove /maintenance-calls route]
```

Also grep `backend/src/` for any MCS routes that may have leaked in; delete if found.

IMMS also loses its own login page, password hashing, and JWT issuance — replaced by the same "verify auth-service JWT" middleware that MCS uses.

## Portal page

Minimal Next.js app:

```
portal/
├── src/app/
│   ├── layout.tsx
│   └── page.tsx           — tile grid
└── package.json
```

UX:

```
┌──────────────────────────────────────────────────────┐
│ Fiserv Apps                         Maria ▾    ⎋    │
├──────────────────────────────────────────────────────┤
│                                                      │
│   ┌──────────────────┐    ┌──────────────────┐      │
│   │  Inventory       │    │  Maintenance     │      │
│   │  Management      │    │  Calls           │      │
│   │  Parts, POs,     │    │  Live board,     │      │
│   │  work orders     │    │  analytics       │      │
│   └──────────────────┘    └──────────────────┘      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

Tiles are role-gated. Tile click is a plain `<a>` — cookie is shared across the parent domain.

## Deployment

nginx routes by Host header:

```
auth.fiserv.local       →  localhost:4002   (NEW auth service)
app.fiserv.local        →  localhost:3000   (NEW portal)
imms.fiserv.local       →  localhost:3001   (existing IMMS frontend)
imms.fiserv.local/api   →  localhost:4000   (existing IMMS backend)
mcs.fiserv.local        →  localhost:3003   (existing MCS frontend)
mcs.fiserv.local/api    →  localhost:4001   (existing MCS backend)
```

Cookie scoped to `.fiserv.local`. When going to prod under a real domain (`yourcompany.com`), swap the suffix and tenant subdomains (`acme.yourcompany.com`) drop in cleanly later.

PM2 ecosystem grows by two processes (`auth-service`, `portal`). Existing ecosystem files stay as they are.

## Order of work

Each step ships independently and the system keeps working between steps.

1. **Auth service standalone.** Schema, login, /me, JWT signing with RS256. Seed Fiserv tenant + one admin user. No callers yet.
2. **Tenant_id migrations.** Add column to every domain table in IMMS and MCS, default `1`. Update repos to filter. Add CI grep guard.
3. **Cookie + verify middleware in IMMS and MCS.** Both apps accept the new JWT alongside their existing one (transitional).
4. **MCS admin section + top nav.** Port BadgeAdmin, build Readers/Users/Layouts pages.
5. **Portal page.**
6. **Cutover.** Delete IMMS's MCS pages, delete both apps' own login flows, drop old JWT support, force everyone through the auth service.
7. **Schema reorg.** Move MCS tables → `mcs` schema. Auth tables already in `auth`.

## Resilience

The IMMS-down scenario the user originally raised is preserved:

- **IMMS app down:** MCS unaffected (separate process, separate frontend, separate ports). Auth service unaffected. Operators can still place calls.
- **MCS app down:** IMMS unaffected. Auth service unaffected.
- **Auth service down:** Logins fail, but in-flight tokens keep working for up to 24h (token validation is local in each app). New logins blocked. **Trade-off accepted** — auth service is small and stable.
- **Postgres down:** Everything down. (No change from today. Out of scope; the user's separately-tracked DR plan covers this.)
- **Host down:** Everything on that host down. (No change from today.)

## Testing

- Auth service: unit tests for login, password hashing, JWT signing/verifying, role checks. Integration test against a real Postgres.
- IMMS / MCS auth middleware: unit tests for the verify-JWT path; tenant-scope helper has unit tests.
- Tenant isolation test (one per app): seed two tenants, log in as tenant A, attempt to read/write tenant B's rows, expect 404/403.
- Existing IMMS and MCS test suites must continue to pass after their auth middleware is replaced.

## Open items / explicit deferrals

- **Cross-tenant users** — one user belonging to multiple tenants. Deferred. Add `auth.tenant_memberships` later when a real customer needs it.
- **Third-party identity vendor** — JWT contract is ours so swapping to Auth0/Clerk/WorkOS later is a contained change.
- **Refresh token rotation** — current design uses a single 24h JWT. Refresh-token rotation can be layered in later without changing the contract with IMMS/MCS.
- **Audit log** — login attempts, role changes, admin actions. Out of scope for this design; can be added to the auth service later.
- **Password reset / forgot-password flow** — assumed manual (admin resets via `/admin/users`) for now. Self-serve email flow deferred until a real customer needs it.
- **Rate limiting on `/badge-swipe`** — already flagged in MCS README; out of scope here but worth picking up next.
