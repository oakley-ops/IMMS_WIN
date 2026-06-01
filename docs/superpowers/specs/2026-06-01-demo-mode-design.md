# IMMS Demo Mode — Design Spec
**Date:** 2026-06-01  
**Status:** Approved for implementation planning

---

## Overview

A hosted, standalone demo deployment of IMMS for on-site client presentations. A prospect lands on a branded landing page, clicks **Enter Demo**, and is immediately inside a fully interactive copy of the real application loaded with scripted, believable sample data. The client can click freely, switch roles, and explore — with nothing ever touching real data or real vendors.

### Decisions made

| Decision | Choice | Rationale |
|---|---|---|
| Hosting | Hosted demo URL | Accessible from any browser on-site; shareable for follow-up |
| Interaction | Resettable sandbox | Full interactivity; manual reset + nightly auto-reseed |
| Isolation | Standalone deploy, dedicated DB | Zero risk to real data; clean mental model |
| Entry | One-click + role switcher | No friction; RBAC is a selling point |
| Guidance | Scripted scenarios in seed data | Narrative is obvious through the data; no extra UI to build |
| Demo chrome | Slim banner + AppBar controls | Context always visible without disrupting the product view |
| Palette | `#FF6B35` orange + `#121212` black | Matches real app; matches client site colors; proven for tech demos |
| Animation | Framer Motion + Lucide | Subtle, professional; fits B2B ops audience; loads fast |
| Email | Capture & preview (no send) | Shows the "vendor receives this email" moment without sending |

---

## 1. Architecture — one codebase, one flag

Demo mode is **not a fork**. All demo behavior lives in the main codebase behind a single backend environment variable: `DEMO_MODE=true`.

The demo is a separate deployment of the existing app with:
- `DEMO_MODE=true`
- Its own `DATABASE_URL` pointing at a dedicated **demo PostgreSQL database**
- `CORS_ORIGIN` = the demo URL
- All other real secrets absent (no real `JWT_SECRET` shared, fresh demo-only secret)

The flag gates exactly four things:
1. Demo landing + passwordless login endpoints
2. Side-effect stubs (email transport, IMAP)
3. Reset endpoint
4. Demo UI chrome (banner, role switcher)

In any production deploy the flag is absent and none of this code path is reachable.

The frontend learns it is in demo mode from a `REACT_APP_DEMO_MODE=true` build-time env var (or a `/api/v1/demo/config` endpoint), which activates the landing page, role switcher, and banner.

---

## 2. Landing page

### Visual design
- Background: `#121212` (matches real AppBar/app background exactly)
- Surface: `#1E1E1E` / `#141414` (matches real sidebar/card surfaces)
- Accent: `#FF6B35` orange — wordmark, CTA button, feature icons, stat numbers, eyebrow text
- Typography: same MUI font stack as the app

### Why this palette
Orange signals energy, enthusiasm, and action — research shows it increases CTA click-through by up to 24%. Black signals authority, technical precision, and sophistication. Together they are the standard for technology product launches. The additional advantage: orange and black are already the client's site colors, so the demo feels native to their environment from the first second.

### Structure (top to bottom)
1. **Top bar** — `#121212` bar with Inventory2 icon + "IMMS" in orange (identical to real AppBar) + small `DEMO` badge (right)
2. **Hero section** — two-column:
   - Left: eyebrow label, headline ("Parts, machines & purchasing *in one place*"), one-line sub, **Enter Demo** CTA (orange button), role pills (Purchaser / Viewer), "↻ Switch roles anytime" note
   - Right: mini app preview screenshot (dark, showing real dashboard with orange active state)
3. **Stats strip** — `#0e0e0e` band: 847 Parts · 32 Machines · 18 Open POs · 9 Below Minimum (all in orange)
4. **Feature grid** — 3×2 grid on `#141414`: Parts Inventory, Machines, Purchase Orders, Work Orders, Die Management, Analytics — each with orange Lucide icon
5. **Footer** — `#0e0e0e`, "Live sample data · resets nightly · nothing here touches real systems"

### Animations (Framer Motion)
- Entrance: fade-up + stagger, once on load, `cubic-bezier(.22,1,.36,1)` easing
- CTA hover: `translateY(-2px)` + shadow intensify
- Feature card hover: subtle background lighten
- Stats strip items: staggered fade-up

### Entry flow
- **Enter Demo** button → logs in as `demo-admin`, lands on Dashboard
- **Purchaser pill** → logs in as `demo-purchaser`, lands on Purchase Orders
- **Viewer pill** → logs in as `demo-viewer`, lands on Dashboard (read-only)

All three call `POST /api/v1/demo/login?role=admin|purchaser|viewer` which mints a real JWT for that seeded user. The rest of the app (RBAC, permissions) is untouched — the client is genuinely logged in as that role.

---

## 3. In-app demo chrome

The real app UI is untouched. Two additions only, both gated by `DEMO_MODE`:

### Slim banner (below AppBar)
- Blue gradient strip: `rgba(30,58,138,.9)` → `rgba(37,99,235,.7)`
- Pulsing blue dot + "**Demo environment** — fully interactive · resets nightly · nothing here touches real systems"
- 36px tall, never obscures content

### AppBar additions (right side, before username)
- **Role switcher** — "Demo role:" label + `Admin` / `Purchaser` / `Viewer` chips
  - Active: `rgba(255,107,53,.18)` bg, orange border + text
  - Inactive: `#333` border, `#666` text, hover to `#555`/`#aaa`
  - Clicking a chip calls `POST /api/v1/demo/login?role=…`, swaps JWT, reloads current page
- **Reset Demo** button — red-tinted (`rgba(239,68,68,.12)` bg, `rgba(239,68,68,.3)` border, `#fca5a5` text)
  - Visible to `demo-admin` role only
  - Click → `POST /api/v1/demo/reset` → confirm dialog → wipe + reseed → redirect to Dashboard

---

## 4. Seed data & scripted scenarios

A single idempotent seed script: `npm run seed:demo` (backend).  
Populates every module with believable, industrially-realistic data built around **two connected storylines**.

### Scenario A — Low-stock part lifecycle (PO flow)
A hydraulic seal (`HYD-SEAL-04`) is below its minimum quantity → a Purchase Order has been drafted → approved by the purchaser → partially received → the received units were consumed by a work order on Press #3. The full lifecycle is walkable by clicking through Parts → POs → Work Orders.

### Scenario B — Machine with an open work order
Press #7 has an open work order assigned to a technician ("J. Martinez"), with a PM checklist partially completed. A die currently mounted on Press #7 is due for sharpening. Visible in Machines → Work Orders → Die Management.

### Supporting data (all modules populated)
- **Parts**: ~50 parts across categories, realistic part numbers (`BRG-6205-2RS`, `FILT-OIL-12`, `MTR-BELT-08`), ~9 below minimum to make the dashboard look live
- **Machines**: ~10 machines with assigned parts, installation dates, locations
- **Purchase Orders**: mix of Draft / Pending Approval / Approved / Partially Received / Closed
- **Work Orders**: mix of Open / In Progress / Completed, with technician assignments
- **Dies**: several dies with usage history, one in sharpening queue
- **Projects**: one mid-milestones project with tasks in various states
- **Analytics/KPI**: populated so charts render meaningfully
- **Technicians, Contacts, Suppliers**: seeded so dropdowns and lookups aren't empty

### Date handling
All dates are **relative to seed time** (e.g. "PO created 3 days ago", "work order opened 1 week ago") so the demo never looks stale and time-based charts always render with current-looking data.

---

## 5. Reset mechanism

Both paths call the **same seed routine** — one source of truth.

### Manual reset
- **Who**: `demo-admin` role only (role-checked in the reset endpoint)
- **Where**: Reset Demo button in the AppBar, visible at all times
- **Flow**: click → confirmation dialog ("This will wipe all demo data and restore the sample scenarios. Continue?") → `POST /api/v1/demo/reset` → truncate demo tables → run seed → redirect to Dashboard
- **Duration**: target < 10 seconds

### Automatic nightly reseed
- `node-cron` job inside the backend process, only registered when `DEMO_MODE=true`
- Schedule: `0 3 * * *` (3 AM) — low-traffic window
- Same seed routine as manual reset, no confirmation needed
- Logs to backend stdout for observability

---

## 6. Side effects & guardrails

### Outbound email — capture & preview
When a PO is "sent" in demo mode, the email transport is swapped for a **demo transport** that:
- Does NOT send anything
- Stores the generated email (subject, body, PDF attachment) in a `demo_sent_emails` table
- Opens an in-app **"Sent (demo)" modal** showing: "Here's the email the vendor would receive" → full preview of the generated PO email/PDF

This preserves the compelling demo moment ("and here's what the vendor receives") without any real transmission.

### IMAP monitoring
Off — it defaults off already; stays off in demo.

### Other guardrails
- Persistent `DEMO` badge in top bar — no one mistakes it for production
- `X-Robots-Tag: noindex` header — demo URL won't be crawled or indexed
- `noindex` meta tag on the landing page
- Demo DB uses a fresh `JWT_SECRET` (not shared with any real deploy)
- No real vendor, supplier, or user emails in seed data (all `@demo.invalid`)

---

## 7. Backend implementation surface

### New endpoints (all gated by `DEMO_MODE=true` middleware — 404 otherwise)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/demo/config` | Returns `{ demoMode: true, roles: [...] }` for frontend |
| `POST` | `/api/v1/demo/login?role=admin\|purchaser\|viewer` | Mints JWT for seeded demo user, no password |
| `POST` | `/api/v1/demo/reset` | Admin-only: wipe + reseed demo DB |
| `GET` | `/api/v1/demo/sent-emails` | List of captured demo emails |
| `GET` | `/api/v1/demo/sent-emails/:id` | Preview a specific captured email |

### Seeded users

| Username | Role | Permissions |
|---|---|---|
| `demo-admin` | admin | All permissions |
| `demo-purchaser` | purchaser | `CAN_MANAGE_PURCHASE_ORDERS`, `CAN_VIEW_MACHINES` |
| `demo-viewer` | viewer | `CAN_VIEW_ALL` (read-only) |

---

## 8. Frontend implementation surface

### New components
- `DemoLandingPage` — standalone route `/demo` (only rendered when `REACT_APP_DEMO_MODE=true`)
- `DemoBanner` — slim strip, injected at top of `Navigation` layout when in demo mode
- `DemoRoleSwitcher` — AppBar chips + role swap logic
- `DemoResetButton` — AppBar reset button (admin only)
- `DemoEmailPreviewModal` — "Sent (demo)" modal for captured PO emails

### Routing
- `/demo` → `DemoLandingPage` (public, no auth required)
- All other routes unchanged

### Guard pattern
```tsx
// In Navigation.tsx
{isDemoMode && <DemoBanner />}
{isDemoMode && <DemoRoleSwitcher />}
{isDemoMode && isAdmin && <DemoResetButton />}
```

---

## 9. Testing

### Unit tests
- `POST /api/v1/demo/login` mints correct role JWT **only** when `DEMO_MODE=true`; returns 404 when flag is off
- `POST /api/v1/demo/reset` is rejected for non-admin demo roles
- Email transport sends nothing and writes to `demo_sent_emails` in demo mode
- Seed script is idempotent (run twice, row counts unchanged)

### Integration tests
- Enter demo as each role → verify RBAC restrictions match expectations
- Admin: reset → verify row counts restored to seed baseline
- Purchaser: send PO → verify `demo_sent_emails` row created, no real email sent

---

## 10. Deployment

### How clients reach the demo

1. **Register a domain** — e.g. `imms.app`, `immsystem.io`, or `tryimms.com` (~$12/yr via Namecheap or Cloudflare Registrar). No domain exists yet; this is a one-time prerequisite.
2. **Deploy to Koyeb** — free tier, always-on (no spin-down), includes a free PostgreSQL instance. Purpose-built for containerized Express backends — supports persistent connections, Socket.io, and background processes. Vercel was ruled out (serverless model incompatible with Express + Socket.io + node-cron; commercial use prohibited on free tier). Render free tier was ruled out (spins down after 15 min — bad for live demos).
3. **Point a subdomain** — add a `CNAME` record on your domain registrar pointing `demo.yourdomain.com` → the Koyeb service URL. TLS cert is provisioned automatically.
4. **Share the URL** — hand `demo.yourdomain.com` to a client on-site verbally, or drop it in a follow-up email.

### Estimated ongoing cost
| Item | Cost |
|---|---|
| Domain registration | ~$12/yr |
| Koyeb web service | **$0 (free tier, always-on)** |
| Koyeb PostgreSQL | **$0 (free tier)** |
| **Total** | **~$12/yr** |

### Environment variables

```env
DEMO_MODE=true
DATABASE_URL=postgres://...koyeb-demo-db...
JWT_SECRET=<demo-only secret, not shared with any real deploy>
REACT_APP_DEMO_MODE=true
CORS_ORIGIN=https://demo.yourdomain.com
PORT=8000
```

### One-time setup sequence
1. Register domain
2. Create Koyeb account, connect GitHub repo, create web service
3. Add Koyeb PostgreSQL instance, copy `DATABASE_URL` into service env vars
4. Run `npm run migrate` via Koyeb shell or one-off job
5. Run `npm run seed:demo` via Koyeb shell or one-off job
6. Add custom domain `demo.yourdomain.com` in Koyeb dashboard, update DNS CNAME

---

## 11. Out of scope (YAGNI)

- Interactive guided tour overlay
- Per-session data isolation
- Coupling to multi-tenant rollout
- Self-serve signup from demo
- Analytics on who visited the demo

---

## Library additions

| Library | Purpose | Where |
|---|---|---|
| `framer-motion` | Landing page entrance animations + hover micro-interactions | Frontend |
| `lucide-react` | Feature icons on landing page | Frontend |
| `node-cron` | Nightly auto-reseed scheduler | Backend |

`framer-motion` and `lucide-react` may already be in the project or easy to add. `node-cron` is a single small backend dependency.
