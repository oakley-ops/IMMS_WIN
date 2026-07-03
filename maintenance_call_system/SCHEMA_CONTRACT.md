# MCS ↔ IMMS Contract

IMMS and MCS share one PostgreSQL database and one user identity. This file
records the interfaces between them so a change on either side that would
break the other gets caught at review time, not at runtime.

## Schema ownership

Each table has exactly one owner. The owner writes migrations; the other
side treats the columns it reads as a stable contract.

| Owner | Tables |
|---|---|
| **IMMS** | `users`, `machines`, `technicians`, `parts`, `pm_sessions`, `transactions`, `purchase_orders` (and related), `login_attempts` |
| **MCS**  | `maintenance_calls`, `badge_registrations`, `badge_readers`, `maintenance_call_parts`, `call_board_layouts`, `call_board_tiles` |

**Rule:** if you need to add a column to a non-owned table, add it in the
owning project's migrations and reference it (don't `ALTER` from the wrong
side). Past example: `machines.cost_per_hour` was originally added by an
MCS migration; it now lives in
`backend/migrations/20260520_add_machine_cost_fields.sql` because IMMS owns
the machines table.

## Columns MCS reads from IMMS-owned tables

If any of these change shape or get removed, MCS breaks. They are part of
the contract:

### `users` (read by MCS auth verification only)

| Column | Type | Used for |
|---|---|---|
| `user_id` | INTEGER PK | JWT `id` claim |
| `username` | VARCHAR | JWT `username` claim, display |
| `role` | VARCHAR | JWT `role` claim, MCS authz |
| `password_hash` | TEXT | **No longer read by MCS** — IMMS owns login (see Auth below) |

### `machines`

| Column | Type | Used for |
|---|---|---|
| `machine_id` | INTEGER PK | FK from `maintenance_calls`, `call_board_tiles` |
| `name` | VARCHAR | Display on board / call list |
| `location` | VARCHAR | Display on board |
| `cost_per_hour` | NUMERIC(10,2) | Enriched view downtime $ |
| `scheduled_hours_per_week` | NUMERIC(5,2) | Availability denominator |

### `technicians`

| Column | Type | Used for |
|---|---|---|
| `technician_id` | INTEGER PK | FK from `maintenance_calls` |
| `name` (or first/last) | VARCHAR | Display |

### `parts`

| Column | Type | Used for |
|---|---|---|
| `part_id` | INTEGER PK | FK from `maintenance_call_parts` |
| `name`, `manufacturer_part_number` | VARCHAR | Display in resolve dialog |

## Inventory contract (MCS → IMMS)

MCS never writes to `parts` or `transactions` directly — those are
IMMS-owned. Instead, when a technician logs parts used on a call, MCS's
`backend/src/services/callPartsService.js` calls IMMS's existing
unauthenticated endpoint:

```
POST /api/v1/parts/usage
Body: { part_id, quantity, reason?, work_order_number? }
```

(defined directly on the Express app in IMMS's `backend/index.js`, not
under a router — it predates MCS and is also used elsewhere in IMMS).
IMMS does the quantity check, decrement, and `transactions` insert
transactionally and returns the created transaction row, or a 400 with
`{ error, available, requested }` on insufficient stock.

MCS calls this once per logged part (`reason: 'Maintenance call
resolution'`, `work_order_number: 'MC-<call_id>'`), with a 3s timeout.
Because this is a second HTTP round trip with no shared transaction, a
decrement can fail (insufficient stock, IMMS down) independently of the
call-parts log succeeding — MCS treats that as a soft per-part failure and
surfaces it to the user (`inventory[]` on the `POST
/maintenance-calls/:id/parts` response), it does not roll back the log.

**Rule:** if you change `/api/v1/parts/usage`'s request or response shape,
update `callPartsService.js` in the same change. This is the only
backend-to-backend HTTP call between the two apps — everything else in
this document is either shared-DB or browser-mediated.

## Auth contract

IMMS is the **sole authority** for user login. MCS does not own a login
form, does not hash passwords, and does not read `users.password_hash`.

### Login flow

1. MCS frontend detects an unauthenticated user, calls
   `redirectToLogin()` from `AuthContext`, which navigates to
   `${NEXT_PUBLIC_IMMS_LOGIN_URL}?returnTo=<current-mcs-url>`.
2. IMMS validates `returnTo` against `REACT_APP_RETURN_TO_ALLOWLIST` (an
   open-redirect guardrail).
3. On successful credential check, IMMS appends a URL fragment to
   `returnTo`:
   ```
   <returnTo>#token=<jwt>&user=<base64-of-json>
   ```
4. MCS's `AuthContext` parses the fragment on mount, stores the token in
   `localStorage['mcs_token']`, scrubs the fragment from the URL, and
   continues.

### Why a fragment instead of a query string or cookie

- Fragments never get sent to the server, so the JWT does not appear in
  nginx access logs, IMMS logs, or proxies.
- Cookies are awkward across ports (`:3000` vs `:3003` on localhost) and
  across subdomains in production unless explicitly scoped.
- `postMessage` is overkill for a one-shot handoff.

### JWT shape

Both sides sign and verify with the same `JWT_SECRET` env var.

```json
{
  "id":       <users.user_id>,
  "username": "<users.username>",
  "role":     "<users.role>",
  "iat":      <unix timestamp>,
  "exp":      <iat + 24h>
}
```

If you add a claim (e.g. `permissions`), update both sides simultaneously
and bump this section. If you change the secret, rotate it on both apps in
lockstep or all in-flight sessions break.

### What's in MCS's `redirectToLogin()` URL

```
${NEXT_PUBLIC_IMMS_LOGIN_URL}?returnTo=<encoded current MCS URL>
```

`NEXT_PUBLIC_IMMS_LOGIN_URL` defaults to `http://localhost:3000/login` for
dev. Set it to the production IMMS login URL in `frontend/.env.local`.

### What's in IMMS's `REACT_APP_RETURN_TO_ALLOWLIST`

Comma-separated list of origins (scheme + host + port, no path) that IMMS
will accept as `returnTo` targets. Default in dev:
`http://localhost:3003`. In production list every host MCS runs at.

## How to break things

These are the changes that silently break the other side. Don't do them
without coordinating:

- Renaming or removing any column listed under "Columns MCS reads".
- Changing the JWT payload field names or types.
- Rotating `JWT_SECRET` on only one app.
- Changing IMMS's password hashing scheme **and** somehow re-introducing
  password reads on the MCS side (today MCS does not read `password_hash`,
  so an IMMS-internal bcrypt upgrade — e.g. Phase 2 of the security plan
  — is now safe).
- Dropping `REACT_APP_RETURN_TO_ALLOWLIST` from the IMMS deploy without
  also pointing MCS at a different login URL — MCS users won't be able to
  log in.
- Letting the two apps drift to incompatible `jsonwebtoken` major versions.
