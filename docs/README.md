# IMMS Documentation

Project documentation organized by topic. Root-level docs are limited to `README.md` and `CLAUDE.md`; everything else lives here.

## Layout

- **`setup/`** — One-time installation, network, firewall, email/IMAP, and PM setup guides.
- **`raspberry-pi/`** — Pi-specific setup (camera, kiosk, DHCP, network, troubleshooting, adding a new Pi).
- **`backup/`** — Database backup configuration, best practices, setup checklist. See also `backend/scripts/` for the PowerShell tooling.
- **`deployment/`** — Production checklists and deploy targets.
- **`features/`** — Implementation docs for shipped features (PDF export/import, barcode scanner, work orders, PO approval flow, RBAC).
- **`plans/`** — Design / planning docs for in-progress or future work (die tracker, security remediation, etc.).
- **`superpowers/specs/`** — Brainstorming/spec output from the superpowers skill (e.g. Postgres DR plan).
- **`archive/`** — Historical "phase complete" / "fix applied" snapshots. Kept for reference; nothing here should be relied on as current.

## Other doc locations

- `backend/docs/api.md` — API reference.
- `backend/DEPLOYMENT.md` — Backend-specific deployment notes.
- `maintenance_call_system/` — MCS subproject has its own docs at its root (`PROGRAMMING_PRINCIPLES.md`, `TESTING.md`, `SCHEMA_CONTRACT.md`, etc.).
- `frontend/README.md`, `jenkins/README.md` — subproject READMEs.
