# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IMMS (Inventory Management System) - A full-stack application for tracking parts inventory, machines, equipment installations, work orders, dies, and project management. React/TypeScript frontend with Node.js/Express backend, backed by PostgreSQL.

## Development Commands

### Quick Start (Windows)
```bash
.\start-app.bat    # Starts backend:4000, frontend-localhost:3002, frontend-network:3001
```

### Backend (from /backend)
```bash
npm run dev              # Development with nodemon
npm start                # Production (port 4000)
npm run migrate          # Run database migrations
npm test                 # Run tests with coverage
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
```

### Frontend (from /frontend)
```bash
npm start                        # Dev server on :3000
npm run start:localhost-3002     # Camera-enabled dev server
npm run start:network-pi         # Network accessible on :3001
npm run build                    # Production build
npm test                         # Jest tests
npm run test:coverage            # Test coverage report
```

### Root Commands
```bash
npm run install:all    # Install all dependencies
npm run test:all       # Run all tests
npm run lint           # Lint frontend and backend
```

## Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript, Material-UI, Redux Toolkit, Socket.io-client
- **Backend**: Express 4, PostgreSQL (pg), JWT auth, Socket.io
- **PDF Processing**: puppeteer, pdfkit, pdf-parse
- **Barcode/QR**: html5-qrcode, @zxing/browser

### Communication Flow
```
React Frontend → HTTP/WebSocket → Express Backend → PostgreSQL
```

### Backend Structure
- `backend/src/routes/` - API endpoints (all prefixed with `/api/v1/`)
- `backend/src/controllers/` - Business logic (PurchaseOrderController.js is the largest at 109KB)
- `backend/src/services/` - Database and external integrations
- `backend/src/middleware/` - Auth (JWT), RBAC, validation, security
- `backend/migrations/` - SQL migration files (50+)

### Frontend Structure
- `frontend/src/pages/` - Route-level components
- `frontend/src/components/` - Reusable UI components (organized by domain)
- `frontend/src/services/` - API clients (api.ts has Axios interceptors)
- `frontend/src/store/` - Redux slices (partsSlice.ts, machinesSlice.ts)
- `frontend/src/types/` - TypeScript interfaces

### Key API Routes
- `/api/v1/parts` - Parts inventory CRUD
- `/api/v1/machines` - Machine management
- `/api/v1/purchase-orders` - PO lifecycle
- `/api/v1/work-orders` - Work order system
- `/api/v1/dies` - Die tracking
- `/api/v1/projects`, `/api/v1/milestones`, `/api/v1/tasks` - Project management
- `/api/v1/analytics` - KPI dashboards

### Database
Core tables: `users`, `parts`, `machines`, `part_assignments`, `transactions`, `purchase_orders`, `work_orders`, `dies`, `projects`, `technicians`

Key fields: `internal_part_number`/`crc_part_number` (migration in progress), `manufacturer_part_number`, `quantity`, `minimum_quantity`

## Authentication

JWT-based authentication with role-based access control (RBAC). Token stored in localStorage, Axios interceptor adds `Authorization: Bearer` header. Key permissions: `CAN_VIEW_ALL`, `CAN_EDIT_PARTS`, `CAN_MANAGE_POS`, `CAN_MANAGE_USERS`.

## Important Patterns

1. **Column naming migration**: Code may reference both `internal_part_number` and `crc_part_number` - check queries for both
2. **API versioning**: All endpoints use `/api/v1/` prefix, with fallback routes for backwards compatibility
3. **Real-time updates**: Socket.io used for parts usage tracking events
4. **PDF generation**: puppeteer for dynamic PDFs (resource intensive), pdfkit for templates
5. **Email integration**: IMAP monitoring disabled by default - configure via env vars to enable

## Environment Variables

Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET`, `SESSION_SECRET` - Security keys
- `PORT` - Server port (default 4000)
- `CORS_ORIGIN` - Frontend URL for CORS

Optional:
- `IMAP_USER`, `IMAP_PASSWORD`, `IMAP_HOST` - Email monitoring
- `DB_SSL` - Enable SSL for database

## Network Configuration

Multi-device setup:
- `localhost:3002` - PC with camera
- `10.1.10.50:3001` - Raspberry Pi ethernet
- Backend binds to `0.0.0.0:4000`

## Maintenance Call System (MCS)

`maintenance_call_system/` is a **separate app** in this repo (Express `:4001`, Next.js `:3003`, own node_modules, started via `maintenance_call_system\start-mcs.bat`). It shares the IMMS PostgreSQL database and `JWT_SECRET`; the only backend-to-backend HTTP call is MCS → IMMS `POST /api/v1/parts/usage` (inventory decrement when parts are logged on a call — see `docs/IMMS_MCS_ARCHITECTURE.md` §4.2).

Rules when working across the seam:
1. **Schema ownership**: each table has one owner (`maintenance_call_system/SCHEMA_CONTRACT.md`). IMMS owns `users`/`machines`/`technicians`/`parts`/`pm_sessions`; MCS owns `maintenance_calls*`, `badge_*`, `call_board_*`, and the `v_maintenance_calls_enriched` view. Add columns only via the owning project's migrations.
2. **Auth**: IMMS is the sole login authority. MCS redirects to the IMMS login page with `?returnTo=` and receives the JWT back in a URL fragment. JWT payload/secret changes must land on both apps in lockstep.
3. **Never write to an IMMS-owned table from MCS directly** (or vice versa) — go through an IMMS-owned endpoint instead, as MCS's `callPartsService.js` does for `parts/usage`. There is no legacy duplicate maintenance-calls route in IMMS anymore; `maintenance_call_system/backend/src/routes/maintenanceCalls.js` is the only maintenance-calls API.
4. Full architecture, endpoint map, and audit findings: `docs/IMMS_MCS_ARCHITECTURE.md`.

## References

- `maintenance_call_system/PROGRAMMING_PRINCIPLES.md` — SOLID, layered architecture, naming, error handling, security, testing pyramid, anti-patterns, pre-merge checklist. Consult before designing new features, adding abstractions, or reviewing code.
- `maintenance_call_system/TESTING.md` — Vitest testing plan and proper-unit-testing guide for backend and frontend. Consult before writing tests or setting up a test suite.
- `docs/IMMS_MCS_ARCHITECTURE.md` — IMMS↔MCS runtime architecture, integration seams, endpoint map, audit findings, and pre-merge change checklist. Consult before touching anything both apps share (schema, auth, sockets, maintenance-calls endpoints).
- `maintenance_call_system/SCHEMA_CONTRACT.md` — authoritative schema-ownership and auth contract between IMMS and MCS.
