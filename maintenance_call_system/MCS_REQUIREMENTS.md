# Maintenance Call System (MCS) — Requirements & Standards
**Version:** 1.0  
**Date:** 2026-05-09  
**Status:** Pre-Implementation  

---

## 1. Business Requirements

### 1.1 Problem Statement
When a machine goes down, there is no standardized, trackable process for calling maintenance. Response times are inconsistent, downtime goes unmeasured, and root causes are not recorded. Management has no data to drive decisions around staffing, machine reliability, or recurring failures.

### 1.2 Goals
- Give operators a fast, friction-free way to call for help (badge swipe — no typing, no login)
- Give technicians a clear, real-time view of where they are needed
- Automatically capture response time, repair time, and total downtime on every call
- Build a historical record of why machines fail and what it takes to fix them
- Give management and supervisors visibility across shifts and machines

### 1.3 Stakeholders
| Role | Interaction with MCS |
|------|----------------------|
| Machine Operator | Badges in to open a call; sees current machine status on the kiosk |
| Maintenance Technician | Badges in to acknowledge call; resolves via web interface with notes |
| Maintenance Supervisor | Views call board, monitors response times, reviews shift summary |
| Production Manager | Reviews downtime reports by machine and shift |
| Upper Management | Accesses aggregate KPIs — total downtime, MTTR, top failure reasons |

### 1.4 MVP Scope (Phase 1 — Build Now)

#### Must Have
- [ ] Operator badge-swipe creates a maintenance call for the assigned machine
- [ ] Technician badge-swipe acknowledges and starts the call (captures response time)
- [ ] Live call board showing all open and in-progress calls with elapsed timers
- [ ] Kiosk page per machine showing current machine status and scan prompt
- [ ] Tech resolves call via web UI with required: resolution notes + reason category
- [ ] Automatic time tracking: response time, repair time, total downtime
- [ ] Badge and reader registration admin (register badges, map readers to machines)
- [ ] Basic metrics page: average response time, average downtime, calls by reason

#### Nice to Have (Phase 1 if time allows)
- [ ] Priority flag (normal / critical) — operator can hold badge for 3 seconds to escalate
- [ ] Shift label on calls (auto-assigned based on time of day)
- [ ] Recently resolved section on call board (last 2 hours, green)

#### Out of Scope for Phase 1
- SMS / email escalation alerts
- Parts used on repair (link to inventory transactions)
- Auto-create work order on resolve
- PDF shift reports
- OEE (Overall Equipment Effectiveness) calculations
- PLC / machine integration
- Mobile app

### 1.5 SLA Targets
| Metric | Target |
|--------|--------|
| Tech response time | ≤ 10 minutes (alert at 15 min) |
| Call board refresh | Real-time (Socket.io, < 1 second) |
| Kiosk badge scan → feedback | < 500ms |
| System availability | 99% during production hours |

### 1.6 Operating Conditions
- **Shifts:** Multi-shift (2–3 shifts). Shift context must be captured on each call.
- **Concurrent users:** Up to 50 badge readers active, 10–20 dashboard viewers
- **Network:** Local LAN. Internet not required for core badge-swipe function.
- **Devices:** Call board on wall-mounted TV/monitor. Kiosk on tablet or small PC per machine. Admin UI on desktop browser.

### 1.7 Failure Reason Categories
| Code | Label |
|------|-------|
| `mechanical` | Mechanical Failure (broken parts, wear, jam) |
| `electrical` | Electrical / Controls (faults, sensors, PLC) |
| `tooling` | Tooling / Die Issue (die change, broken tooling, setup) |
| `material` | Material / Feed Issue (jam, bad stock, loading) |
| `operator_error` | Operator Error (incorrect setup, mistake) |
| `other` | Other |

---

## 2. Technical Details

### 2.1 Architecture
The MCS is a **separate application** from the Inventory Management System (IMMS) but shares the **same PostgreSQL database**.

```
PostgreSQL (shared)
    ├── IMMS  (backend :4000 / frontend :3002)   — inventory, POs, work orders
    └── MCS   (backend :4001 / frontend :3003)   — maintenance calls, badges, board
```

**Why separate apps, shared DB:**
- MCS needs independent uptime — a deploy or crash in IMMS must not kill the call board
- Badge swipe latency must not compete with heavy inventory queries
- MCS reads `machines`, `technicians`, `parts` tables directly — no inter-service API needed
- Parts used on repairs (Phase 2) will write to `transactions` just like IMMS does

### 2.2 Tech Stack
| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express 4 |
| Database | PostgreSQL (shared with IMMS) |
| Real-time | Socket.io |
| Frontend | React 18 + TypeScript |
| UI Library | Material UI (MUI) v5 |
| State | React hooks (useState, useEffect, useCallback) — no Redux for MVP |
| HTTP client | Axios |
| Auth | JWT (Bearer token) — admin routes only. Kiosk and call board are public. |

### 2.3 Database Tables (MCS-owned)
- `badge_registrations` — maps badge IDs to people and roles
- `badge_readers` — maps physical readers to machines
- `maintenance_calls` — the core call records with all timing fields

Tables shared (read-only from MCS):
- `machines` — machine names, locations
- `technicians` — tech names for display
- `parts` / `transactions` — Phase 2 (parts used on repair)

### 2.4 API Structure
Base URL: `http://<host>:4001/api/v1/maintenance-calls`

**Public endpoints (no auth — kiosk and board):**
- `POST /badge-swipe` — process badge scan
- `GET /active` — active calls for call board
- `GET /reader/:key` — reader + machine info for kiosk

**Protected endpoints (JWT required):**
- `GET /` — call history with filters
- `GET /:id` — single call
- `PUT /:id/resolve` — resolve with notes
- `GET /stats/metrics` — aggregate KPIs
- `GET|POST /admin/badges` — badge registry
- `PUT /admin/badges/:id`
- `GET|POST /admin/readers` — reader registry
- `PUT /admin/readers/:id`

### 2.5 Socket.io Events
| Event | Direction | Payload |
|-------|-----------|---------|
| `maintenance_call_created` | Server → all clients | Full call object |
| `maintenance_call_updated` | Server → all clients | Full call object |
| `maintenance_call_resolved` | Server → all clients | Full call object |

### 2.6 Badge Reader Integration
- **Type:** USB HID (keyboard emulator) — reader types badge ID as keystrokes
- **Detection:** Keystrokes arriving < 50ms apart = badge reader (not manual typing). Buffer resets on gap > 500ms or on Enter.
- **Minimum badge length:** 4 characters (prevents accidental triggers)
- **One reader per machine:** Each reader has a unique `reader_key` mapped in DB. Station URL includes `?reader=<reader_key>`.

### 2.7 Shift Detection
Shifts are auto-assigned on call creation based on time of call. Define in config:

```js
// mcs/config/shifts.js
const SHIFTS = [
  { name: '1st Shift', start: '06:00', end: '14:00' },
  { name: '2nd Shift', start: '14:00', end: '22:00' },
  { name: '3rd Shift', start: '22:00', end: '06:00' },
];
```

`shift_name` is stored as a VARCHAR on `maintenance_calls` at creation time.

### 2.8 Project Structure (MCS App)
```
mcs/
├── backend/
│   ├── index.js               # Express + Socket.io server (port 4001)
│   ├── src/
│   │   ├── routes/
│   │   │   └── maintenanceCalls.js
│   │   ├── config/
│   │   │   └── shifts.js
│   │   └── database/
│   │       └── db.js          # Same DB connection config as IMMS
│   └── migrations/
│       └── 20260509_create_maintenance_calls.sql
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   └── MaintenanceCalls.tsx   # Admin list + resolve
    │   ├── components/
    │   │   ├── CallBoard.tsx          # TV display
    │   │   ├── CallStation.tsx        # Kiosk
    │   │   └── BadgeAdmin.tsx         # Badge + reader management
    │   └── services/
    │       └── maintenanceCallService.ts
    └── public/
```

---

## 3. Color Scheme

The MCS has its own visual identity — bold, high-contrast, and industrial. It must be readable at a distance on a shop floor monitor and convey urgency clearly.

### 3.1 Core Palette

| Name | Hex | Usage |
|------|-----|-------|
| **Background Dark** | `#121212` | Call board, kiosk backgrounds |
| **Surface Dark** | `#1E1E1E` | Cards on dark backgrounds |
| **Background Light** | `#F5F5F5` | Admin / management pages |
| **Surface Light** | `#FFFFFF` | Cards on light backgrounds |
| **MCS Accent** | `#FF6B35` | Primary brand color — buttons, headers, logo |
| **Status: Open** | `#EF5350` | Waiting for tech — red |
| **Status: In Progress** | `#FFA726` | Tech on site — amber |
| **Status: Resolved** | `#66BB6A` | Machine back up — green |
| **Status: Critical** | `#D32F2F` | Critical priority override — deep red |
| **Text Primary (dark bg)** | `#E8E8E8` | Body text on dark screens |
| **Text Secondary (dark bg)** | `#9E9E9E` | Labels, timestamps on dark screens |
| **Text Primary (light bg)** | `#212121` | Body text on admin pages |

### 3.2 Usage Rules
- **Call board and kiosk:** Always dark background (`#121212`). Status colors are the dominant visual element. No decorative elements — every pixel communicates state.
- **Admin/management pages:** Light background (`#F5F5F5`) with MCS Accent (`#FF6B35`) for primary actions and headers. Status colors used in chips and badges only.
- **Status colors are reserved:** Do not use red, amber, or green for anything other than call status. Never use green for a "success" button on the call board — it will be mistaken for "machine resolved."
- **Typography on dark screens:** Minimum 18px for status labels on the call board. Machine names should be 24px+. Timers should be 32px+ and bold.
- **Elapsed time color escalation:**
  - 0–5 min: `#FFA726` (amber)
  - 5–15 min: `#EF5350` (red)  
  - 15+ min: `#D32F2F` (deep red, pulsing animation)

### 3.3 Font
- **Display (call board / kiosk):** Roboto Mono or system monospace for timers. Roboto Bold for machine names.
- **Admin UI:** Roboto (MUI default).

---

## 4. Strategy

### 4.1 Phased Delivery

**Phase 1 — MVP (Current)**
Prove the core loop: badge → call → board → acknowledge → resolve → metrics.
Goal: Replace the current manual/verbal process with a tracked digital record.
Success metric: Every machine downtime event is captured with a start and end time.

**Phase 2 — Depth**
- Parts used on repair (linked to inventory transactions)
- Escalation: if no tech acknowledges within SLA window, alert supervisor (in-app + optional SMS)
- Shift handoff report — summary of open/resolved calls at shift change
- Reason category required before resolve (enforce data quality)

**Phase 3 — Analytics**
- MTTR (Mean Time To Repair) by machine, by tech, by reason
- MTBF (Mean Time Between Failures) per machine
- Downtime cost calculation (if cost-per-hour is configured per machine)
- OEE contribution (downtime as % of scheduled production time)
- Top 5 repeat failures with trend detection

**Phase 4 — Integration**
- Auto-create IMMS Work Order on call resolve
- Machine status sync: machine marked "down" in IMMS when call is open
- PLC / machine signal integration (auto-trigger calls without operator badge)
- Mobile-friendly tech interface

### 4.2 Deployment Strategy
- MCS runs as a separate Node process on the same server as IMMS (initially)
- Call board URL bookmarked on the wall monitor browser — `http://<host>:3003/maintenance-board`
- Kiosk URL set as the browser homepage on each machine tablet — `http://<host>:3003/maintenance-call/station?reader=<key>`
- Admin UI accessed from any browser on the network — `http://<host>:3003`
- Both apps connect to the same PostgreSQL instance via `DATABASE_URL` env var

### 4.3 Data Integrity Rules
- A machine can only have one `open` or `in_progress` call at a time
- `resolved_at` must be after `called_at`
- `technician_arrived_at` must be after `called_at`
- `resolution_notes` is required to resolve (enforced at API and UI level)
- Badge IDs are stored as-scanned (raw string). No normalization — what the reader sends is the key.
- Call records are never deleted — only resolved. Historical data is permanent.

### 4.4 Availability Considerations
- Kiosk and call board must function even if the admin UI is slow — they use separate lightweight endpoints
- Socket.io reconnects automatically — clients should display a "reconnecting" state, not a blank screen
- If the backend is unreachable, the kiosk should show "OFFLINE — Contact Maintenance Directly"
- Badge swipe endpoint is kept deliberately simple and fast — no joins, no heavy logic

---

## 5. Coding Standards

### 5.1 General
- **Language:** JavaScript (Node.js backend), TypeScript (React frontend). No mixing.
- **No comments explaining what code does.** Names must be self-documenting. Comments only for non-obvious *why* (hardware quirks, timing constraints, SQL edge cases).
- **No unused code.** No commented-out blocks, no `_unused` variables, no dead imports.
- **No premature abstraction.** Build for what is needed now, not hypothetical future requirements.
- **Error handling only at boundaries** — user input, database queries, HTTP requests, badge swipe parsing. Do not wrap internal function calls in try/catch unnecessarily.

### 5.2 Backend (Node/Express)
- One route file per domain: `maintenanceCalls.js`. Do not split into sub-routers until clearly needed.
- All routes use `async/await`. No callbacks or `.then()` chains in route handlers.
- Parameterized queries only. Never string-interpolate values into SQL.
- `global.io.emit()` for socket events — consistent with the IMMS pattern already in place.
- Public routes (badge-swipe, active calls, reader info) have no auth middleware.
- Admin and history routes require the `auth` middleware.
- HTTP status codes must be meaningful: 200 OK, 201 Created, 400 Bad Request, 404 Not Found, 409 Conflict, 500 Internal Server Error.
- Return consistent JSON shapes: `{ error: 'message' }` for errors, data object/array for success.

### 5.3 Frontend (React/TypeScript)
- **Functional components only.** No class components.
- **Local state first.** Use `useState` + `useEffect` + `useCallback`. No Redux unless a clear cross-component state problem emerges.
- **Types in the service file.** Define TypeScript interfaces alongside the API calls that use them (`maintenanceCallService.ts`). Do not duplicate types across files.
- **No inline styles.** Use MUI `sx` prop or `styled()`. One or the other per component, not both.
- **Service layer for all API calls.** Components never call `axios` or `fetch` directly.
- **Pages vs Components:**
  - `pages/` — route-level components. Manage state, fetch data, pass to components.
  - `components/` — presentational or feature components. Receive props, emit callbacks.
- **Real-time:** Use a single Socket.io connection per page. Connect in `useEffect`, disconnect in cleanup.
- **Loading states:** Always show a loading indicator. Never render an empty table silently.
- **Error states:** Surface errors to the user. Never `console.error` and move on.

### 5.4 Naming
| Thing | Convention | Example |
|-------|-----------|---------|
| React components | PascalCase | `CallBoard`, `CallStation` |
| Files (components) | PascalCase | `CallBoard.tsx` |
| Files (services, config) | camelCase | `maintenanceCallService.ts` |
| DB tables | snake_case | `maintenance_calls` |
| DB columns | snake_case | `called_at`, `reader_key` |
| API routes | kebab-case | `/badge-swipe`, `/admin/readers` |
| JS/TS variables | camelCase | `activeCall`, `readerKey` |
| Constants | UPPER_SNAKE | `HID_TIMEOUT_MS`, `SOCKET_URL` |

### 5.5 Git
- Branch naming: `mcs/<short-description>` (e.g., `mcs/escalation-alerts`)
- Commit messages: imperative, present tense ("Add badge capture to CallStation", not "Added" or "Adding")
- One logical change per commit. Do not bundle unrelated changes.
- Do not commit `.env` files, `node_modules/`, or migration files that have already run in production.

### 5.6 Environment Variables (MCS)
```
# MCS Backend .env
DATABASE_URL=          # Same as IMMS — shared PostgreSQL
JWT_SECRET=            # Same as IMMS — shared auth
PORT=4001
CORS_ORIGIN=http://<host>:3003
```
```
# MCS Frontend .env
REACT_APP_API_URL=http://<host>:4001/api/v1
REACT_APP_SOCKET_URL=http://<host>:4001
```

---

## 6. Open Questions (Resolve Before Phase 2)
- [ ] Who can register/deactivate badges? (Admin only, or also maintenance supervisor?)
- [ ] What triggers "critical" priority? Operator holds badge, taps a button, or auto-detected by machine?
- [ ] Should resolved calls be visible on the call board for a cooldown period (e.g., 30 min green card)?
- [ ] Is there a backup plan if the badge reader fails? (Manual call entry via tablet screen?)
- [ ] Who receives escalation notifications in Phase 2, and via what channel?
- [ ] Cost-per-hour of downtime per machine — is this data available for Phase 3?
