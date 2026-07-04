# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IMMS (Inventory Management System) - A full-stack application for tracking parts inventory, machines, equipment installations, work orders, dies, and project management. React/TypeScript frontend with Node.js/Express backend, backed by PostgreSQL.

## Development Commands

### Quick Start (Windows)
```bash
.\start-dev.bat    # DEV stack only: IMMS API :4100, MCS API :4101, IMMS UI :3100, MCS UI :3103
```

**Production** runs separately from `C:\imms\prod` under PM2 (ports 4000/4001/3001/3002/3003 — the floor-facing URLs). Never edit or run servers there directly; deploy with `powershell -File scripts\deploy.ps1` and see `docs/deployment/PROD_OPERATIONS.md` for cutover/rollback/restore. Dev uses the `fiservinventory_dev` database (refresh via `scripts/refresh-dev-db.ps1`).

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

Multi-device setup (production, served from C:\imms\prod):
- `localhost:3002` - PC with camera
- `10.1.10.50:3001` - Raspberry Pi ethernet
- Backend binds to `0.0.0.0:4000`
Dev ports (this folder): 4100/4101/3100/3103 — invisible to floor devices.

## References

- `maintenance_call_system/PROGRAMMING_PRINCIPLES.md` — SOLID, layered architecture, naming, error handling, security, testing pyramid, anti-patterns, pre-merge checklist. Consult before designing new features, adding abstractions, or reviewing code.
- `maintenance_call_system/TESTING.md` — Vitest testing plan and proper-unit-testing guide for backend and frontend. Consult before writing tests or setting up a test suite.
