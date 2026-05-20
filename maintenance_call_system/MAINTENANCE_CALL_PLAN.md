# Maintenance Call System (Andon) — Implementation Plan

## Context
Operators need a way to call for maintenance when a machine goes down. The existing concept uses badge readers (USB HID, keyboard-emulator style) where:
- Operator badges at a machine → creates a maintenance call
- Technician badges at the machine → acknowledges / starts work
- Call board shows live status of all active calls
- Goal: track wait time, repair time, total downtime, failure reason, and repair method

This is a new module. Phase 1 is MVP — simple and functional. Complexity (parts linking, analytics, escalation alerts) is added in later phases.

---

## Data Model (3 new tables)

### `badge_registrations`
| Column | Type | Notes |
|--------|------|-------|
| badge_id | VARCHAR(100) PK | Raw scanned value from reader |
| person_name | VARCHAR(255) | Display name |
| role | VARCHAR(20) | 'operator' or 'technician' |
| technician_id | INTEGER FK | → technicians.technician_id (nullable, only for techs) |
| active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMP | |

### `badge_readers`
| Column | Type | Notes |
|--------|------|-------|
| reader_id | SERIAL PK | |
| reader_key | VARCHAR(100) UNIQUE | Identifier used in station URL |
| machine_id | INTEGER FK | → machines.machine_id |
| location_label | VARCHAR(255) | e.g. "Press #3 — Bay 2" |
| active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMP | |

### `maintenance_calls`
| Column | Type | Notes |
|--------|------|-------|
| call_id | SERIAL PK | |
| machine_id | INTEGER FK | → machines.machine_id |
| reader_id | INTEGER FK | → badge_readers.reader_id |
| operator_badge_id | VARCHAR(100) FK | → badge_registrations.badge_id |
| operator_name | VARCHAR(255) | Denormalized for speed |
| status | VARCHAR(20) | 'open' → 'in_progress' → 'resolved' |
| priority | VARCHAR(20) | 'normal' or 'critical' |
| called_at | TIMESTAMP | Auto — when call created |
| technician_arrived_at | TIMESTAMP | Set when tech badges in |
| resolved_at | TIMESTAMP | Set when call closed |
| technician_badge_id | VARCHAR(100) FK | → badge_registrations.badge_id (nullable) |
| technician_id | INTEGER FK | → technicians.technician_id (nullable) |
| technician_name | VARCHAR(255) | Denormalized |
| reason_category | VARCHAR(50) | 'mechanical','electrical','tooling','material','operator_error','other' |
| problem_description | TEXT | Optional |
| resolution_notes | TEXT | Required on resolve |
| created_at, updated_at | TIMESTAMP | |

**Derived metrics (calculated on query):**
- **Response time** = `technician_arrived_at - called_at`
- **Repair time** = `resolved_at - technician_arrived_at`
- **Total downtime** = `resolved_at - called_at`

---

## Status Flow

```
[Operator badges] → OPEN
[Tech badges at machine] → IN_PROGRESS  (response time captured)
[Tech resolves via call board] → RESOLVED  (repair time + downtime captured)
```

---

## Backend

### Files
- `backend/migrations/20260509_create_maintenance_calls.sql` ✅ created
- `backend/src/routes/maintenanceCalls.js`

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/badge-swipe` | Core: process badge scan `{ badge_id, reader_key }` |
| GET | `/active` | Open + in_progress calls for call board |
| GET | `/` | All calls with filters |
| GET | `/:id` | Single call detail |
| PUT | `/:id/resolve` | Close call with reason + notes |
| GET | `/metrics` | Avg response/repair/downtime stats |
| GET/POST | `/readers` | List / register readers |
| PUT | `/readers/:id` | Update reader → machine mapping |
| GET/POST | `/badges` | List / register badges |
| PUT | `/badges/:id` | Update badge registration |

### Badge Swipe Logic
1. Look up `badge_id` → get role (operator / technician)
2. Look up `reader_key` → get `machine_id`
3. **Operator**: if no active call → create `open` call; if call exists → return current status
4. **Technician**: if call `open` → move to `in_progress`, set arrival time; if already `in_progress` → return status
5. Emit socket event on every state change

---

## Frontend

### New Files
| File | Purpose |
|------|---------|
| `frontend/src/services/maintenanceCallService.ts` | API client |
| `frontend/src/components/CallBoard.tsx` | Live TV/monitor board |
| `frontend/src/components/CallStation.tsx` | Kiosk page at each machine |
| `frontend/src/pages/MaintenanceCalls.tsx` | Admin list + resolve |
| `frontend/src/components/BadgeAdmin.tsx` | Register badges + readers |

### Routes Added to App.tsx
| Path | Component | Auth |
|------|-----------|------|
| `/maintenance-board` | CallBoard | Public (TV display) |
| `/maintenance-call/station` | CallStation | Public (kiosk) |
| `/maintenance-calls` | MaintenanceCalls | CAN_VIEW_MACHINES |
| `/maintenance-calls/admin` | BadgeAdmin | CAN_MANAGE_USERS |

### Socket.io Events
| Event | When |
|-------|------|
| `maintenance_call_created` | New call opened |
| `maintenance_call_updated` | Status change |
| `maintenance_call_resolved` | Call closed |

---

## Phase 2 (Future)
- Parts used: link resolved calls to parts transactions
- Escalation alerts if call open > X minutes with no response
- Reason category selection on station screen (tap before/after badge)
- PDF downtime reports by machine/date range
- Auto-create Work Order on resolve

---

## Testing
1. Register test badge in BadgeAdmin (role: operator)
2. Register reader mapped to a machine with a `reader_key`
3. Open `/maintenance-call/station?reader=<reader_key>`
4. Scan badge → verify call created, CallBoard updates live
5. Register second badge as technician, scan → verify `in_progress`
6. Resolve from MaintenanceCalls page → verify timing metrics
