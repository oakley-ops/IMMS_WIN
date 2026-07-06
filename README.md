# IMMS

An in-house, full-stack **Inventory Management System (IMMS)** built for a manufacturing/maintenance environment. It tracks parts, machines, dies, purchase orders, work orders, preventive maintenance, technicians, projects, and analytics. The repo also contains a sibling **Maintenance Call System (MCS)** for factory-floor badge-driven call requests, and a substantial collection of operational scripts, Raspberry Pi kiosk setup, and data-matching tooling.

The project is organized as a multi-app monorepo:

```
fiservinventory_win/
├── backend/                    # IMMS API (Node/Express + PostgreSQL)
├── frontend/                   # IMMS web app (React + TypeScript + MUI)
├── maintenance_call_system/    # MCS — separate Next.js + Express service
├── migrations/                 # Root-level legacy SQL migrations
├── camera-setup/               # Raspberry Pi camera + HTTPS proxy scripts
├── nginx/                      # Reverse-proxy configs
├── scripts/                    # SSL / test-data helpers
├── docs/                       # Mobile + PO troubleshooting docs
├── images/                     # Static assets
└── *.py, *.xlsx                # Inventory-matching / reconciliation tooling
```

---

## What this system does

| Domain | Capabilities |
|--------|-------------|
| **Parts inventory** | CRUD, low-stock alerts, barcode/QR scanning, image uploads, CSV/PDF import, custom fields, multiple supplier mappings |
| **Machines** | Catalog with categories, documents, cost tracking, machine→part assignments, maintenance fields |
| **Dies** | Full die lifecycle: change history, sharpening records, documents, maintenance schedule, compatible machines |
| **Purchase Orders** | Request → approve → order → partial receipt → close; supplier matching; email tracking; AI-assisted PDF extraction; PDF export via Puppeteer |
| **Work Orders** | Creation, technician assignment, completion, PDF export |
| **Preventive Maintenance** | PM calendar, checklists, scheduling, status |
| **Project Management** | Projects → milestones → tasks (with drag-and-drop ordering) |
| **Analytics / KPIs** | Stock levels, usage trends, top-used parts, forecasting, machine cost reports |
| **Auth / RBAC** | JWT login, role-based permissions (`CAN_VIEW_ALL`, `CAN_EDIT_PARTS`, `CAN_MANAGE_POS`, `CAN_MANAGE_USERS`) |
| **Real-time** | Socket.io events for parts-usage updates and (separately) MCS call board |
| **Email integration** | IMAP monitoring of PO inboxes (optional, off by default) |
| **Maintenance calls (MCS)** | Badge-tap calls from kiosks, live call board, technician acknowledge/suspend/resolve, KPI metrics |

---

## Tech stack

### IMMS — `backend/`
- **Runtime**: Node.js ≥ 14, Express 4
- **Database**: PostgreSQL via `pg`
- **Auth**: JWT (`jsonwebtoken`), bcrypt
- **Realtime**: Socket.io 4
- **PDF**: Puppeteer 24 (dynamic), pdfkit (templates), `pdf-parse` / `pdf2pic` (ingest)
- **Email**: `imap` + `mailparser` for inbound PO monitoring, `nodemailer` for outbound
- **Security**: helmet, hpp, xss-clean, express-rate-limit, sanitize-html, express-validator
- **Logging**: morgan + winston
- **Docs**: swagger-jsdoc + swagger-ui-express
- **Image**: sharp
- **Tests**: Jest + supertest, selenium-webdriver for E2E

### IMMS — `frontend/`
- **Framework**: React 18 + TypeScript (Create React App)
- **UI**: Material-UI v5 (+ `@mui/x-data-grid`, `@mui/x-date-pickers`, `@mui/lab`), Bootstrap 5 / react-bootstrap (legacy)
- **State**: Redux Toolkit + react-redux
- **Routing**: react-router-dom v7
- **Charts**: Chart.js (`react-chartjs-2`) and Recharts
- **HTTP**: axios + axios-retry (interceptor injects Bearer token)
- **Realtime**: socket.io-client
- **Barcode/QR**: html5-qrcode, @zxing/browser, quagga
- **Calendars**: react-big-calendar, react-calendar
- **Drag-and-drop**: @dnd-kit
- **Excel/PDF**: exceljs, xlsx, html2pdf.js
- **Tests**: Jest + @testing-library/react

### MCS — `maintenance_call_system/`
- **Backend**: Express + `pg`, `pino` structured logging, Zod validation, layered (routes → services → repositories), Vitest
- **Frontend**: Next.js (App Router) + TypeScript, Vitest
- **Realtime**: Socket.io on port 4001
- **See** `maintenance_call_system/README.md` for the full breakdown.

### Infrastructure
- **Process manager**: PM2 — all five production services (IMMS API, MCS API, MCS web, two IMMS web builds) are defined in the repo-root `ecosystem.prod.config.js` and run from the dedicated production clone `C:\imms\prod` (see `docs/deployment/PROD_OPERATIONS.md`)
- **Reverse proxy**: nginx (`nginx/`, `camera-setup/`)
- **Containers**: Dockerfiles in both `backend/` and `frontend/`
- **Hosting hints**: `netlify.toml`, `deploy.sh`
- **Monitoring config**: `prometheus.yml`, `alerts.yml`

---

## Architecture at a glance

```
                  ┌────────────────────────────────────────┐
                  │ React + TS frontend (CRA)              │
                  │  Pages / Components / Redux / Sockets  │
                  └──────────────┬─────────────────────────┘
                                 │ HTTPS + WSS
                                 ▼
                  ┌────────────────────────────────────────┐
                  │ Express API  /api/v1/*                 │
                  │  Routes → Controllers → Services       │
                  │  JWT auth · RBAC · validation · helmet │
                  └──────────────┬─────────────────────────┘
                                 │  pg pool                   ┌─────────────┐
                                 ▼                            │ IMAP / SMTP │
                          ┌────────────┐                      │   inbox     │
                          │ PostgreSQL │                      └──────┬──────┘
                          └────────────┘                             │
                                                                     │
                                                          (PO email monitor — optional)

   ┌────────────── Maintenance Call System (separate Next.js + Express) ──────────────┐
   │  Kiosk (CallStation) ─ Wallboard (CallBoard) ─ Admin (badge/reader registry)      │
   │            └─ Socket.io @ :4001 ─ /api/v1/maintenance-calls/* ─ PostgreSQL        │
   └────────────────────────────────────────────────────────────────────────────────────┘
```

### IMMS backend (`backend/src/`)

- `app.js` — Express app: CORS allow-list (localhost + Pi IPs), 50 MB body limit (for PDFs), route mounting, error middleware
- `routes/` — 25+ route modules, all under `/api/v1/*`:
  `parts`, `machines`, `purchaseOrderRoutes`, `workOrders`, `dies`, `dieDocuments`, `dieSharpening`, `equipment`, `projects`, `milestones`, `tasks`, `pm` (preventive maintenance), `technicians`, `transactions`, `analytics`, `dashboard`, `reports`, `supplierRoutes`, `vendorRoutes`, `contacts`, `emailRoutes`, `maintenanceCalls`, `users`, `auth`, `health`, `test`
- `controllers/` — Business logic. Largest is `PurchaseOrderController.js` (~109 KB) covering the full PO lifecycle. Others: `Auth`, `Machine`, `Part`, `PartsUsage`, `PM`, `Supplier`, `Technicians`, `Transaction`, `User`, `Vendor`.
- `services/` — Cross-cutting services:
  - `AiDocumentExtractor.js` — AI-assisted parsing of supplier PDFs
  - `PODocumentService.js`, `DieDocumentService.js`, `MachineDocumentService.js`, `PartImageService.js`
  - `emailService.js`, `emailTrackingService.js` — IMAP/SMTP integration
  - `forecastingService.js`
  - `SimplePartMatcher.js`, `SupplierMatcher.js`, `partService.js`
- `middleware/` — `auth.js`/`authMiddleware.js` (JWT), `roleMiddleware.js` (RBAC), `validation.js` (express-validator), `security.js` (helmet/hpp/rate-limit)
- `migrations/` — 70+ SQL/JS migration files. The big ongoing item is the **`internal_part_number` ↔ `crc_part_number` rename** (multiple migrations: `internal_to_imms_migration.sql`, `rename_internal_to_crc_column.sql`, `20260317_drop_crc_part_number.sql`, `safe_column_rename.sql`). Code may reference *either* column.
- `db.js` / `database/` — `pg` pool
- `swagger.js` — API docs at `/api-docs`
- Maintenance one-off scripts at the backend root (`check-*.js`, `fix-*.js`, `force-approve*.js`, etc.) — useful for ops; not part of the runtime path.

### IMMS frontend (`frontend/src/`)

- `App.tsx` / `index.tsx` — Mounts router, Redux store, Material-UI theme, auth context
- `pages/` — Route-level screens: `Dashboard`, `Parts`, `Machines`, `PurchaseOrders`, `WorkOrders`, `WorkOrderDetail`, `WorkOrderForm`, `DieTracker`, `DieDetail`, `DieReports`, `Transactions`, `Scanner`, `Import`, `KPIDashboard`, `MaintenanceCalls`, `Login`, `UserManagement`, `Unauthorized`
- `components/` — Reusable widgets organized by domain:
  - Top-level: `PartList`, `PartForm`, `AddPart`, `EditPartForm`, `MachineList`, `MachineForm`, `Navigation`, `ProtectedRoute`, `BarcodeScanner`, `ImportParts`, `RestockComponent`, `ReturnPartButton`, `NotificationCenter`
  - Subfolders: `analytics/`, `dieInteractive/`, `dies/`, `projects/`, `PurchaseOrder/`, `purchaseOrders/`, `suppliers/`, `vendors/`
  - Charts: `PartQuantityChart`, `StockLevelChart`, `UsageTrendChart`, `TopUsedPartsChart`, `PartForecast`
  - Workflows: `PMCalendar`, `PMChecklistDialog`, `PMChecklistManagement`, `TechnicianManagement`, `MachineCostReport`, `LowStockReport`, `BadgeAdmin`, `CallBoard`, `CallStation`
- `services/` — `api.ts`/`api.js` (axios w/ JWT interceptor), `socket.ts`, plus per-domain clients (`analyticsService`, `forecastingService`, `documentApi`, `machineDocumentsApi`, `maintenanceCallService`, `projectService`, `workOrderService`)
- `store/` — Redux Toolkit slices (`partsSlice`, `machinesSlice`) + root `store.ts`
- `contexts/`, `theme/`, `types/`, `utils/`, `config.ts`

### Maintenance Call System (`maintenance_call_system/`)

A separate, smaller, cleaner-architecture service. Two apps:

- **Backend** (`backend/`, port `4001`) — Express in layers (`routes/` → `services/` → `repositories/`), `pg` pool, Zod schemas, JWT auth (kiosk endpoints intentionally public), `pino` logging with request-id correlation, structured error envelope.
- **Frontend** (`frontend/`, port `3003`) — Next.js App Router with a `CallStation` kiosk, live `CallBoard`, and admin pages for badge/reader registry.
- **Realtime events**: `maintenance_call_created`, `maintenance_call_updated`, `maintenance_call_resolved`.

See `maintenance_call_system/README.md`, `PROGRAMMING_PRINCIPLES.md`, and `TESTING.md` for the in-depth design contract — this is the part of the repo that follows the strictest layering and is the reference for new work.

### Authentication & RBAC

- JWT issued by `/api/v1/auth/login`, stored in `localStorage`, attached by an axios interceptor as `Authorization: Bearer <token>`.
- Permissions enforced by `roleMiddleware.js`: `CAN_VIEW_ALL`, `CAN_EDIT_PARTS`, `CAN_MANAGE_POS`, `CAN_MANAGE_USERS`.
- MCS recently moved to **delegated auth via IMMS** (commits `feat(auth): delegate MCS login to IMMS (Option B)` and `fix(auth): auto-forward already-authenticated users from IMMS login`).

### Database

PostgreSQL. Core tables: `users`, `parts`, `machines`, `part_assignments`, `transactions`, `parts_usage`, `purchase_orders`, `part_suppliers`, `suppliers`, `vendors`, `work_orders`, `dies`, `die_change_history`, `die_sharpening_records`, `die_documents`, `die_maintenance_schedule`, `projects`, `milestones`, `tasks`, `technicians`, `pm_*`, `maintenance_logs`, `maintenance_calls`, `maintenance_call_parts`, `contacts`, `po_email_tracking`, `sessions`.

Key fields: `internal_part_number` / `crc_part_number` (column rename in progress — queries may use either), `manufacturer_part_number`, `quantity`, `minimum_quantity`.

Schema bootstraps: `backend/schema.sql`, `backend/init.sql`, `backend/init_imms.sql`, `backend/project_schema.sql`, plus `backend/sample_data*.sql` for seed data. Migrations are tracked across `backend/migrations/` and a legacy root `migrations/` folder.

---

## Getting started

### Prerequisites
- Node.js ≥ 14 (≥ 18 recommended; required for MCS)
- PostgreSQL ≥ 13
- npm
- Optional: Puppeteer-compatible Chromium, HID badge reader (MCS kiosks), Raspberry Pi for kiosk display

### Install everything
```bash
npm run install:all
```
(Installs root, frontend, and backend dependencies. MCS apps install separately.)

### Environment

Backend `.env` (in `backend/`):
```
DATABASE_URL=postgres://user:pass@host:5432/fiservinventory
JWT_SECRET=<long random>
SESSION_SECRET=<long random>
PORT=4000
CORS_ORIGINS=http://localhost:3000,http://localhost:3002,http://10.1.10.50:3001
# Optional
IMAP_USER=...
IMAP_PASSWORD=...
IMAP_HOST=...
DB_SSL=true
```

Frontend uses Create React App env (`REACT_APP_API_URL`, etc.); see scripts in `frontend/package.json` for per-network presets.

### Database setup
```bash
# Create the database, then:
npm run migrate                          # runs backend/migrations/run-migrations.js
# or apply backend/schema.sql / init.sql manually
```

### Run — quickstart on Windows (dev stack)
```bat
.\start-dev.bat
```
Starts the DEV stack only (never touches production):
- IMMS backend on `http://localhost:4100`
- MCS backend on `http://localhost:4101`
- IMMS frontend on `http://localhost:3100`
- MCS frontend on `http://localhost:3103`

Production (ports 4000/4001/3001/3002/3003) runs from the dedicated clone `C:\imms\prod` under PM2 (`ecosystem.prod.config.js`); deploy with `scripts\deploy.ps1` — see `docs/deployment/PROD_OPERATIONS.md`.

### Run — manual
```bash
# Backend
cd backend && npm run dev       # nodemon, :4000

# Frontend
cd frontend && npm start                       # :3000 (default)
# or
cd frontend && npm run start:localhost-3002    # camera-enabled
cd frontend && npm run start:network-pi        # bound to 0.0.0.0:3001, API → 10.1.10.50:4000
```

### Maintenance Call System
```bash
cd maintenance_call_system/backend  && npm install && npm run dev   # :4001
cd maintenance_call_system/frontend && npm install && npm run dev   # :3003
# Windows helpers:
.\start-dev.bat                     # from repo root — full dev stack incl. MCS on :4101/:3103
```

To stop the dev stack: close the four start-dev.bat windows (see
docs/deployment/PROD_OPERATIONS.md troubleshooting for nodemon residue).
Production is managed only via PM2 per the runbook.

---

## Common commands

| Scope | Command | What it does |
|-------|---------|--------------|
| Root | `npm run install:all` | Install every workspace |
| Root | `npm run build` | Build the IMMS frontend |
| Root | `npm run start:prod` | Run backend with `NODE_ENV=production` |
| Root | `npm run migrate` | Run backend migrations |
| Root | `npm run lint` | Lint frontend + backend |
| Root | `npm run test:all` | Root + frontend + backend tests |
| Backend | `npm run dev` / `start` | Dev (nodemon) / prod |
| Backend | `npm run start:email-monitor` | Run the IMAP PO monitor process |
| Backend | `npm run start:all` | Both concurrently |
| Backend | `npm test` / `:unit` / `:integration` / `:e2e` | Jest with coverage, by tier |
| Frontend | `npm start` / `start:localhost-3002` / `start:network-pi` / `start:hotspot` | Dev presets |
| Frontend | `npm run build` | CRA production build |
| Frontend | `npm test` / `test:coverage` | Jest |
| MCS BE  | `npm run dev` / `test` / `test:coverage` | Vitest-based |
| MCS FE  | `npm run dev` / `build` / `start` / `test` | Next.js + Vitest |

---

## API surface (IMMS)

All routes are versioned under `/api/v1/`:

- `/auth` — login, token refresh
- `/users` — user CRUD (admin)
- `/parts` — parts inventory + barcode lookup + bulk import
- `/machines`, `/equipment` — machine catalog and equipment installations
- `/dies`, `/dieDocuments`, `/dieSharpening` — die lifecycle
- `/purchase-orders`, `/suppliers`, `/vendors` — procurement
- `/work-orders` — work orders + PDF export
- `/projects`, `/milestones`, `/tasks` — project management
- `/pm`, `/technicians` — preventive maintenance + technician registry
- `/transactions`, `/dashboard`, `/analytics`, `/reports` — reporting & KPIs
- `/contacts`, `/email` — email/contact integration
- `/maintenance-calls` — bridge to the MCS schema
- `/health` — liveness probe

Interactive docs (when enabled): `GET /api-docs` (swagger-ui-express).

Real-time: Socket.io shares the HTTP server; events fire on parts usage and stock changes.

---

## Networking & deployment

- **Backend binds** to `0.0.0.0:4000` so the Pi and other devices on the LAN can reach it.
- **CORS allow-list** is hard-coded for `localhost:3000/3001/3002` and the Pi IPs (`10.1.10.50`, `10.1.10.171`); override with `CORS_ORIGINS`.
- **Raspberry Pi kiosk** — `camera-setup/`, plus dozens of `RASPBERRY_PI_*.md` guides cover DHCP, kiosk mode, HTTPS proxy for camera access, and WebSocket fixes.
- **Reverse proxy** — `nginx/imms-inventory.conf` for production; `imms-inventory-local.conf` for dev.
- **PM2** — all five production services are defined in the repo-root `ecosystem.prod.config.js` and run from the dedicated clone `C:\imms\prod`; deploys/rollbacks go through `scripts\deploy.ps1` (see `docs/deployment/PROD_OPERATIONS.md`).
- **Cloud targets** — Netlify (`netlify.toml`), generic SSH (`deploy.sh`).
- **Monitoring** — `prometheus.yml` + `alerts.yml` (Prometheus scrape and alerting rules).

---

## Tooling & operational scripts

- **Inventory matching / reconciliation** (Python): `analyze_matches.py`, `comprehensive_inventory_matcher.py`, `db_parts_matcher.py`, `inventory_matcher_unmatched.py`, `manufacturer_part_matching.py`, `final_analysis_report.py`, plus several `*Matched*.xlsx`/`*Unmatched*.xlsx` outputs. These were used to reconcile spreadsheet inventories against the DB during data migration.
- **Backend ops scripts**: `check-*.js`, `fix-*.js`, `force-approve*.js`, `update-*.js`, `init-production-db.js`, `migrate-production.js`, `run-*-migrations.js`.
- **Email monitor**: `email-monitor.js` (root) and `backend/email-monitor.js` — IMAP loop driven by `emailService` + `emailTrackingService`.
- **Test data**: `scripts/populate_test_data.js`, `backend/sample_data*.sql`.
- **SSL/dev certs**: `scripts/generate-local-ssl.sh`, `camera-setup/generate-local-ssl.sh`.

---

## Testing

- **Backend** — Jest, with `__tests__/{unit,integration,e2e}` tiers and `npm test`/`test:unit`/`test:integration`/`test:e2e`. Coverage enabled by default.
- **Frontend** — Jest + React Testing Library; tests under `frontend/src/__tests__/` and `pages/__tests__/`, `components/__tests__/`.
- **MCS** — Vitest, ~49 unit tests across backend + frontend; see `maintenance_call_system/TESTING.md`.
- **E2E** — `selenium-webdriver` is wired up in backend devDependencies.

---

## Conventions & guardrails

The newer MCS code is the reference for layering and is documented in:
- `maintenance_call_system/PROGRAMMING_PRINCIPLES.md` — SOLID, layered architecture, naming, error handling, security, testing pyramid, anti-patterns, pre-merge checklist.
- `maintenance_call_system/TESTING.md` — Vitest playbook.
- `maintenance_call_system/SCHEMA_CONTRACT.md` — DB contract between IMMS and MCS.

Project-wide instructions for AI assistants live in `CLAUDE.md`.

Known patterns to be aware of when editing:
1. **Column rename in progress** — both `internal_part_number` and `crc_part_number` appear in queries; check both.
2. **API versioning** — everything is under `/api/v1/`, with some backwards-compat fallbacks.
3. **Real-time** — Socket.io is used for parts-usage events (IMMS) and call-state events (MCS).
4. **PDFs** — Puppeteer is resource-intensive; pdfkit handles simpler templates.
5. **Email monitoring** — disabled by default; enable via `IMAP_*` env vars.
6. **CORS** — allow-list is explicit; add new origins to `CORS_ORIGINS`.

---

## Repository document map

The repo carries a large amount of historical implementation notes. Useful entry points:

| Topic | File |
|-------|------|
| RBAC design | `role-based-access-control.md` |
| Security posture | `SECURITY_REMEDIATION_PLAN.md` |
| Production readiness | `PRODUCTION_CHECKLIST.md` |
| DB backup playbook | `DATABASE_BACKUP_GUIDE.md`, `BACKUP_SETUP_CHECKLIST.md`, `DATABASE_BACKUP_BEST_PRACTICES.md` |
| PO system | `PO_Implementation_Guide.md`, `PO_Approval_Rerouting_Implementation.md`, `PDF_IMPORT_IMPLEMENTATION.md`, `PUPPETEER_PDF_IMPLEMENTATION.md` |
| Work orders | `WORK_ORDER_SYSTEM_IMPLEMENTATION.md`, `WORK_ORDER_PDF_IMPLEMENTATION.md`, `WORK_ORDER_COMPLETE_SUMMARY.md` |
| Die tracker | `DIE_TRACKING_SYSTEM_PLAN.md`, `DIE_TRACKER_COMPLETE_ALL_PHASES.md`, `DIE_PRESS_INTERACTIVE_UI_PLAN.md` |
| Project mgmt redesign | `PROJECT_MANAGEMENT_REDESIGN.md`, `PROJECT_MANAGEMENT_SETUP.md`, `QUICK_START_PROJECTS.md` |
| Barcode scanner | `BARCODE_SCANNER_IMPLEMENTATION.md`, `BARCODE_SCANNER_INTEGRATION_PLAN.md` |
| Email monitor | `EMAIL_MONITORING_SETUP.md` |
| AI PDF extraction | `AI_EXTRACTION_SETUP.md` |
| Raspberry Pi | `RASPBERRY_PI_*.md` (network, kiosk, camera, DHCP, websocket fix) |
| Deployment | `DEPLOY_A2.md`, `MAC_SETUP_GUIDE.md`, `FIREWALL_SETUP.md` |
| Mobile | `docs/MOBILE_IMPLEMENTATION.md` |
| MCS | `maintenance_call_system/README.md`, `MCS_REQUIREMENTS.md`, `MAINTENANCE_CALL_PLAN.md`, `SCHEMA_CONTRACT.md`, `NEXTJS_NGINX_ROADMAP.md`, `ANALYTICS_PLAN.md`, `SITE_SETUP.md`, `REFACTOR_SUMMARY.md` |

---

## Recent activity (top of `main`)

```
1ff33c24 fix(mcs): use pm2 startOrRestart so start-mcs.bat handles empty-daemon state
c04e104a fix(mcs): use total_downtime_hours in metrics dashboard
12b94526 fix(auth): auto-forward already-authenticated users from IMMS login
7313cdf3 feat(auth): delegate MCS login to IMMS (Option B)
87484638 feat(mcs): add maintenance_call_parts table
```

Active focus areas, based on commit history and `*_PLAN.md` / `*_STATUS.md` files: MCS auth delegation to IMMS, MCS metrics dashboard polish, parts logging on maintenance calls, and the long-running `internal_part_number → crc_part_number` rename.
