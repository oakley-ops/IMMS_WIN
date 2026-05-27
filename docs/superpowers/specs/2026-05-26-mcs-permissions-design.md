# MCS User Permissions Design

**Date:** 2026-05-26  
**Status:** Approved

---

## Problem

MCS currently has no per-user access control inside the app. Any authenticated IMMS user can reach every MCS feature — badge management, reader configuration, analytics, everything. There is no way to give a 2nd-shift supervisor permission to register new operator badges without also giving them permission to edit or deactivate existing ones. Senior techs can't be promoted incrementally. The admin has no controls short of giving full admin access.

---

## Goals

1. Admin can grant specific MCS capabilities to individual IMMS users via a checkbox UI.
2. Certain powerful actions (edit/deactivate badges, manage permissions) remain locked to IMMS `admin` role and cannot be delegated.
3. IMMS role determines the default set of permissions; the checkbox system adds on top.
4. The UI makes it fast to configure a user — preset buttons for common profiles, checkboxes for custom cases.
5. Permission checks enforced on the MCS backend (client-side is UI convenience only).

---

## Permission Set

### Always allowed (role-based, no checkbox)

| Capability | Who |
|---|---|
| View call board | All authenticated MCS users |
| View maintenance calls list | All authenticated MCS users |
| Create / resolve / suspend calls | `tech`, `admin` IMMS roles |
| View analytics page | `tech`, `admin` IMMS roles |

### Checkable by admin (delegatable)

These are stored per-user in `mcs_user_permissions`. Admin can check them for any IMMS user.

| Permission key | Label | Description |
|---|---|---|
| `badges_add` | Add new badges | Register new badge/operator pairs. 2nd-shift supervisors, senior techs. |
| `readers_manage` | Manage readers | Add, edit, delete badge readers. For trusted leads. |
| `calls_manage` | Manage calls | Create/resolve/suspend calls. Useful for supervisors who aren't `tech` role. |
| `analytics_view` | View analytics | Access analytics page. Useful for supervisors/coordinators who aren't `tech` role. |
| `skilled_operator` | Skilled operator | Badge-login operators may log calls at the station (not just clock in). |

### Admin-only (locked, never delegatable)

These are enforced by role check; no checkbox is shown for them.

| Capability | Why locked |
|---|---|
| Edit / deactivate badges | High-impact — wrong deactivation locks someone out. Admin only. |
| Manage permissions | Self-referential escalation risk. Admin only always. |

---

## Data Model

### `mcs_user_permissions` table

```sql
CREATE TABLE mcs_user_permissions (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  badges_add     BOOLEAN NOT NULL DEFAULT FALSE,
  readers_manage BOOLEAN NOT NULL DEFAULT FALSE,
  calls_manage   BOOLEAN NOT NULL DEFAULT FALSE,
  analytics_view BOOLEAN NOT NULL DEFAULT FALSE,
  skilled_operator BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by     INTEGER REFERENCES users(id),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- Row exists only when the admin has explicitly configured a user.
- Missing row = all `FALSE` for delegatable permissions (role defaults still apply).
- `updated_by` = IMMS user_id of the admin who last saved changes (audit trail).

### Effective permission resolution (backend)

```
hasPermission(user, key):
  if user.role === 'admin' → TRUE (full access)
  if key is role-default for user.role → TRUE
  if mcs_user_permissions row exists AND key column is TRUE → TRUE
  else → FALSE
```

Role defaults (non-admin):
- `tech` role: `calls_manage = TRUE`, `analytics_view = TRUE`
- All other roles: all `FALSE` unless explicitly granted

---

## Backend Architecture

### New files

**`maintenance_call_system/backend/src/repositories/permissionsRepo.js`**  
- `getPermissions(db, userId)` — returns the row or a zeroed default object  
- `upsertPermissions(db, userId, permissions, updatedBy)` — INSERT … ON CONFLICT DO UPDATE  
- `listUsersWithPermissions(db)` — JOIN with IMMS `users` table; returns all users + their permission row (or defaults)

**`maintenance_call_system/backend/src/schemas/permissions.js`**  
- Zod schema for the PUT body: object with 5 boolean keys, all optional (merge with existing)

**`maintenance_call_system/backend/src/middleware/requirePermission.js`**  
- Factory: `requirePermission(key)` → Express middleware  
- Checks `req.user` role for admin shortcut, then queries `mcs_user_permissions`  
- Returns 403 if check fails

**`maintenance_call_system/backend/src/routes/permissions.js`**  
Routes:
```
GET  /api/v1/mcs/permissions          → list all IMMS users + their MCS permissions
GET  /api/v1/mcs/permissions/:userId  → single user's permissions
PUT  /api/v1/mcs/permissions/:userId  → save permissions (admin only)
```
All three routes: `auth` + admin role check (not delegatable).

### Modified files

**`maintenance_call_system/backend/src/routes/maintenanceCalls.js`**  
Apply `requirePermission` to protected endpoints:
- `POST /` (create call) → `requirePermission('calls_manage')` (tech role auto-passes)
- `PATCH /:id/resolve` → `requirePermission('calls_manage')`
- `PATCH /:id/suspend` → `requirePermission('calls_manage')`

**`maintenance_call_system/backend/src/routes/maintenanceCalls.js`** (existing badge/reader routes live here)  
- `POST /admin/badges` → `requirePermission('badges_add')` (instead of open auth)  
- `PUT /admin/badges/:badge_id` → admin role check (locked, not delegatable)  
- `POST /admin/readers` → `requirePermission('readers_manage')`  
- `PUT /admin/readers/:id`, `DELETE /admin/readers/:id` → `requirePermission('readers_manage')`

**`maintenance_call_system/backend/app.js`** (or wherever routes are mounted)  
- Mount `routes/permissions.js` at `/api/v1/mcs/permissions`

### Migration

**`maintenance_call_system/backend/migrations/YYYYMMDD_mcs_user_permissions.sql`**  
Creates `mcs_user_permissions` table.

---

## Frontend Architecture

### New files

**`maintenance_call_system/frontend/src/components/admin/PermissionsPanel.tsx`**  
Main component rendered in the Admin page alongside BadgeAdmin.  
- Left panel: searchable list of IMMS users (name + role badge + avatar initials)  
- Right panel: selected user's header + preset buttons + permission grid  
- Permission grid: one row per delegatable permission, checkbox + label + description  
- Locked permissions shown as greyed rows with 🔒 "Admin only" tag (no checkbox)  
- Partial-check indicator on parent rows when sub-items are mixed (badges row)  
- Preset buttons: `Supervisor`, `Senior Tech`, `Analyst`, `Clear All`  
- Save button: calls PUT, shows success/error inline  

**`maintenance_call_system/frontend/src/components/admin/PermissionsPanel.test.tsx`**  
Tests: renders user list, checkbox toggling, save calls API, locked items not checkable, preset applies correct set.

**`maintenance_call_system/frontend/src/services/permissionsService.ts`**  
- `getUsers(): Promise<UserWithPermissions[]>`  
- `getUserPermissions(userId): Promise<UserPermissions>`  
- `savePermissions(userId, permissions): Promise<UserPermissions>`

### Modified files

**`maintenance_call_system/frontend/src/app/admin/page.tsx`**  
Add a MUI `Tabs` component with two tabs: **Badge Admin** and **Permissions**. Renders `<BadgeAdmin />` or `<PermissionsPanel />` based on selected tab. Only renders Permissions tab if `user.role === 'admin'` (redundant safety — backend enforces it too).

**`maintenance_call_system/frontend/src/contexts/AuthContext.tsx`**  
No changes needed — role is already on the user object.

---

## UI Design

### User list (left panel)

- Search box filters by name or username
- Each row: avatar with initials, name, IMMS role badge (color-coded), indicator dot if any permissions are customized
- Clicking a row loads that user's permissions in the right panel

### Permission grid (right panel)

```
[ Avatar ] Maria Santos                    [ Supervisor ▾ ] preset
           2nd Shift Supervisor — tech role

BADGE MANAGEMENT                           [—] (partial)
  ├─ Add new badges                        [✓]
  └─ Edit / deactivate badges              [🔒 Admin only]

READER MANAGEMENT                          [ ]
  Manage badge readers                     [ ]

CALL MANAGEMENT                            [✓] (from tech role)
  Create / resolve / suspend calls         [✓] (role default, greyed checkbox)

ANALYTICS                                  [✓] (from tech role)
  View analytics page                      [✓] (role default, greyed checkbox)

OPERATOR SETTINGS                          [ ]
  Skilled operator (log calls at station)  [ ]

PERMISSIONS                                [🔒 Admin only forever]

                                     [ Save Changes ]
```

Role-default permissions show as checked but greyed (can't uncheck — they're from the role, not this table). Delegated permissions show as normal checked boxes.

### Preset definitions

| Preset | Sets |
|---|---|
| Supervisor | `badges_add: true`, `calls_manage: true`, `analytics_view: true` |
| Senior Tech | `calls_manage: true`, `analytics_view: true`, `readers_manage: true` |
| Analyst | `analytics_view: true` |
| Clear All | all `false` |

---

## API Contract

### `GET /api/v1/mcs/permissions`

Returns all IMMS users with their resolved MCS permissions (role defaults merged with explicit grants).

```json
[
  {
    "user_id": 5,
    "username": "maria.santos",
    "role": "tech",
    "permissions": {
      "badges_add": true,
      "readers_manage": false,
      "calls_manage": true,
      "analytics_view": true,
      "skilled_operator": false
    },
    "updated_at": "2026-05-26T14:00:00Z",
    "updated_by_username": "admin"
  }
]
```

### `PUT /api/v1/mcs/permissions/:userId`

Request body (partial update — omitted keys unchanged):
```json
{
  "badges_add": true,
  "readers_manage": false
}
```

Response: updated full permission object (same shape as GET item).

Errors:
- `400` — invalid body (Zod)
- `401` — not authenticated
- `403` — caller is not admin
- `404` — userId not found in IMMS users table

---

## Security

1. All permission routes require `auth` middleware (valid IMMS JWT).
2. PUT route additionally checks `req.user.role === 'admin'` — returns 403 otherwise.
3. `requirePermission(key)` middleware is applied at the route level on protected endpoints — not left to controllers.
4. Admin role shortcut in `requirePermission` is based on the JWT claim, not a DB lookup (no added latency for the common case).
5. The `permissions_manage` capability is never stored in the DB and never checkable in the UI — it is always a hard role check.

---

## Out of Scope (this spec)

- MCS-native / fallback login when IMMS is down — separate spec
- Tenant-scoping of permissions (single-tenant for now)
- Audit log / history of permission changes (only `updated_by` + `updated_at` for now)
- Per-machine or per-call-type restrictions

---

## Testing Plan

### Backend unit tests (`routes/permissions.test.js`)
- GET list returns merged role defaults + explicit grants
- PUT saves correctly, returns updated object
- PUT returns 403 for non-admin caller
- PUT returns 400 for invalid body
- `requirePermission('badges_add')` passes for admin
- `requirePermission('badges_add')` passes when row has `badges_add: true`
- `requirePermission('badges_add')` returns 403 when row missing / `badges_add: false`
- `requirePermission('calls_manage')` passes for `tech` role (role default)

### Frontend unit tests (`PermissionsPanel.test.tsx`)
- Renders user list from API response
- Clicking a user loads their permission checkboxes
- Toggling a checkbox updates local state
- Locked items render without a usable checkbox
- Preset "Supervisor" checks correct boxes
- Save button calls `savePermissions` with correct payload
- Success message shown after save
- Error message shown on API failure
