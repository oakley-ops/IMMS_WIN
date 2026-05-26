# IMMS → MCS Integration Design Spec

**Date:** 2026-05-26
**Status:** Approved
**Scope:** Local LAN deployment only

---

## Problem

The IMMS frontend duplicates MCS functionality — it hosts its own `MaintenanceCalls`, `CallBoard`, `CallStation`, and `BadgeAdmin` pages that talk directly to the MCS backend. The MCS already has a complete, independent Next.js frontend (port 3003) with all of those pages. The goal is to remove the duplicates from IMMS, add a clean link from IMMS to MCS, move BadgeAdmin into MCS where it belongs, and update the startup script to launch everything together.

---

## Systems Involved

| System | Stack | Port |
|--------|-------|------|
| IMMS Frontend | React CRA | 3002 / 3001 |
| IMMS Backend | Express | 4000 |
| MCS Frontend | Next.js | 3003 |
| MCS Backend | Express | 4001 |

---

## Section 1 — IMMS Navigation

**File:** `frontend/src/components/Navigation.tsx`

### Remove
```
{ path: '/maintenance-calls', label: 'MAINTENANCE CALLS', icon: <Campaign />, requiredPermission: 'CAN_VIEW_MACHINES' }
```

### Add
A new external link entry rendered after the regular nav items, separated by a `<Divider>`. It uses `component="a"`, `href`, and `target="_blank"` instead of React Router's `<Link to>`.

```tsx
// Extend NavigationItem interface
interface NavigationItem {
  path?: string;
  href?: string;          // external URL
  external?: boolean;
  label: string;
  icon: React.ReactNode;
  requiredPermission?: string;
}
```

The MCS link item:
```ts
{
  href: buildMCSUrl(),
  external: true,
  label: 'MAINTENANCE SYSTEM',
  icon: <Campaign />,
  requiredPermission: 'CAN_VIEW_MACHINES',
}
```

### SSO URL builder (inside Navigation component)
```ts
const MCS_BASE = process.env.REACT_APP_MCS_URL || 'http://localhost:3003';

const buildMCSUrl = (): string => {
  const token = localStorage.getItem('token') || '';
  const userEncoded = btoa(JSON.stringify({
    id: user?.id,
    username: user?.username,
    role: user?.role,
  }));
  return `${MCS_BASE}#token=${token}&user=${userEncoded}`;
};
```

### Rendering
External items render as:
```tsx
<ListItem
  button
  component="a"
  href={item.href}
  target="_blank"
  rel="noopener noreferrer"
  onClick={() => setDrawerOpen(false)}
  sx={{ py: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
>
  <ListItemIcon sx={{ color: 'white', minWidth: 40 }}>{item.icon}</ListItemIcon>
  <ListItemText primary={item.label} ... />
  <OpenInNew sx={{ fontSize: 14, opacity: 0.6 }} />
</ListItem>
```

Add `OpenInNew` to the MUI icons import.

---

## Section 2 — IMMS Cleanup

### Routes removed from `frontend/src/App.tsx`
| Route | Component |
|-------|-----------|
| `/maintenance-calls` | `<MaintenanceCalls />` |
| `/maintenance-board` | `<CallBoard />` |
| `/maintenance-call/station` | `<CallStation />` |
| `/maintenance-calls/admin` | `<BadgeAdmin />` |

Remove all four imports from the top of `App.tsx`.

### Files deleted from IMMS frontend
| File | Reason |
|------|--------|
| `frontend/src/pages/MaintenanceCalls.tsx` | Replaced by MCS `/calls` |
| `frontend/src/components/CallBoard.tsx` | Replaced by MCS `/board` |
| `frontend/src/components/CallStation.tsx` | Replaced by MCS `/station` |
| `frontend/src/components/BadgeAdmin.tsx` | Moving to MCS `/admin` |
| `frontend/src/services/maintenanceCallService.ts` | Only used by the above |

---

## Section 3 — MCS: BadgeAdmin Page

### New file: `maintenance_call_system/frontend/src/components/BadgeAdmin.tsx`

Ported from the IMMS version with three adaptations:

1. **Machine list** — use `maintenanceCallService.getMachines()` instead of calling the IMMS API directly. MCS service already has this method.

2. **Station URL display** — update the Readers table "Station URL" column from:
   ```
   /maintenance-call/station?reader={reader_key}
   ```
   to:
   ```
   {process.env.NEXT_PUBLIC_MCS_URL || 'http://localhost:3003'}/station?reader={reader_key}
   ```

3. **Auth** — no changes needed. MCS Axios interceptor already attaches `mcs_token` from localStorage on every request.

### New file: `maintenance_call_system/frontend/src/app/admin/page.tsx`

Same auth-guard pattern as `src/app/calls/page.tsx`:
- If loading → spinner
- If not authenticated → `redirectToLogin()` (sends to IMMS login with `returnTo`)
- If authenticated → `<NavLayout><BadgeAdmin /></NavLayout>`

---

## Section 4 — MCS NavLayout Changes

**File:** `maintenance_call_system/frontend/src/components/NavLayout.tsx`

### 1. Live Board opens a new tab
```ts
// Before
{ label: 'Live Board', href: '/board', icon: <Dashboard /> }

// After
{ label: 'Live Board', href: '/board', icon: <Dashboard />, newTab: true }
```
Render with `target="_blank" rel="noopener noreferrer"` when `newTab: true`.

### 2. Remove "Open Board in New Tab" footer link
Delete the `<ListItem>` at the bottom of the drawer that links to `/board` in a new tab — now redundant.

### 3. Add Admin nav item (admin role only)
```ts
// Add to navItems, conditionally
...(user?.role === 'admin'
  ? [{ label: 'Admin', href: '/admin', icon: <Settings /> }]
  : [])
```
Add `Settings` to the MUI icons import.

---

## Section 5 — Environment Config

### IMMS: add to `frontend/.env`
```
REACT_APP_MCS_URL=http://localhost:3003
```

No changes needed to MCS `.env` — it already has `NEXT_PUBLIC_IMMS_LOGIN_URL` pointing back to IMMS.

---

## Section 6 — start-app.bat

Add MCS backend and frontend to the startup sequence, after the IMMS backend and before opening the browser:

```bat
:: Start MCS Backend
echo Starting MCS Backend (http://0.0.0.0:4001)...
start /min cmd /k "cd maintenance_call_system\backend && npm start"

timeout /t 3

:: Start MCS Frontend
echo Starting MCS Frontend (http://localhost:3003)...
start /min cmd /k "cd maintenance_call_system\frontend && npm run dev"

timeout /t 3
```

Update the startup summary echo block to include:
```bat
echo MCS ACCESS: http://localhost:3003 (Maintenance Call System)
```

---

## File Change Summary

| File | Change |
|------|--------|
| `frontend/src/components/Navigation.tsx` | Replace maintenance nav item with external MCS link + SSO builder |
| `frontend/src/App.tsx` | Remove 4 maintenance routes + imports |
| `frontend/src/pages/MaintenanceCalls.tsx` | **Delete** |
| `frontend/src/components/CallBoard.tsx` | **Delete** |
| `frontend/src/components/CallStation.tsx` | **Delete** |
| `frontend/src/components/BadgeAdmin.tsx` | **Delete** |
| `frontend/src/services/maintenanceCallService.ts` | **Delete** |
| `frontend/.env` | Add `REACT_APP_MCS_URL` |
| `maintenance_call_system/frontend/src/components/BadgeAdmin.tsx` | **New** — ported from IMMS |
| `maintenance_call_system/frontend/src/app/admin/page.tsx` | **New** — auth-guarded page |
| `maintenance_call_system/frontend/src/components/NavLayout.tsx` | Live Board → new tab; remove footer link; add Admin item |
| `start-app.bat` | Add MCS backend + frontend startup |

---

## Auth / SSO Flow

```
User clicks "MAINTENANCE SYSTEM ↗" in IMMS sidebar
  → IMMS reads token from localStorage + user from AuthContext
  → Builds: http://localhost:3003#token=<jwt>&user=<btoa(user)>
  → Opens in new tab
  → MCS AuthContext.consumeAuthFragment() reads fragment
  → Stores mcs_token + mcs_user in localStorage
  → Clears fragment from browser history
  → User lands on /calls, fully authenticated
```

If user is already authenticated in MCS (token in localStorage), clicking the link again refreshes the token with the latest IMMS JWT — harmless.

---

## Out of Scope

- No changes to MCS backend
- No changes to IMMS backend
- No TLS/HTTPS setup
- No changes to Raspberry Pi kiosk configuration (Pi accesses MCS station at its own URL)
