# MCS — Next.js + Nginx Production Roadmap
**Status:** Phase 3 Planning (do not implement until Phase 1 is stable)  
**Date:** 2026-05-09  

---

## Why This Combination

| Problem Today | How Next.js + Nginx Solves It |
|---------------|-------------------------------|
| Four ports to manage (4000, 4001, 3002, 3003) | One IP, port 80, Nginx routes internally |
| `react-scripts start` is dev-only, not production-grade | Next.js `next start` + Nginx static serving |
| Kiosk URLs contain IPs and port numbers (fragile) | Clean URLs: `http://mcs/board`, `http://mcs/station?reader=press-1` |
| Call board and kiosk are full React bundles (slow first load) | Next.js server-renders public pages — faster initial paint |
| No SSL / HTTPS | Nginx handles TLS termination in one place |
| Backend and frontend are separate servers operators must know about | Nginx unifies everything behind one address |

---

## Target Architecture

```
Internet / LAN
      │
      ▼
┌─────────────┐
│    Nginx    │  port 80 (443 with SSL)
│  Reverse    │
│   Proxy     │
└──────┬──────┘
       │
       ├──── /api/v1/maintenance-calls/*  ──▶  MCS Backend (Node :4001)
       │           (WebSocket upgrade for Socket.io)
       │
       ├──── /board                       ──▶  Next.js SSR (:3003)
       ├──── /station                     ──▶  Next.js SSR (:3003)
       ├──── /calls                       ──▶  Next.js SSR (:3003)
       ├──── /_next/static/*              ──▶  Static files (served by Nginx directly)
       │
       └──── /imms/*                      ──▶  IMMS App (existing, :3002/:4000)
```

### Process Map (Production Server)
```
systemd / PM2
  ├── mcs-backend    node index.js          (port 4001)
  └── mcs-frontend   next start             (port 3003)

Nginx
  └── serves static  .next/static/          (no Node in the path)
      proxies API    → :4001
      proxies SSR    → :3003 (non-static pages)
```

---

## Next.js Migration Plan

### Why Next.js Over CRA

| Feature | CRA (current) | Next.js |
|---------|--------------|---------|
| Call Board render | Client-side only — blank flash on load | Server-rendered HTML — instant paint on TV |
| Kiosk Station | Client-side | Server-rendered — no loading spinner on badge scan page |
| Admin pages (calls, badges) | Client-side | Client-side (same — no change needed) |
| API routes | Separate Express server required | Can co-locate simple endpoints in `app/api/` |
| Production serving | `react-scripts start` (dev server) | `next build` + `next start` (production-grade) |
| Static export | Not supported | `next export` for fully static builds |
| Font/image optimization | Manual | Built-in |

### Page Strategy

| Current Route | Next.js Equivalent | Rendering Strategy |
|---------------|-------------------|-------------------|
| `/board` | `app/board/page.tsx` | **SSR** — server renders initial call list, client hydrates Socket.io |
| `/station` | `app/station/page.tsx` | **SSR** — server renders machine info from `reader_key`, client handles badge capture |
| `/calls` | `app/calls/page.tsx` | **CSR** (client component) — auth-protected, data-heavy admin |
| `/login` | `app/login/page.tsx` | **CSR** — simple form |

### Socket.io with Next.js

Next.js does not have a persistent server process for WebSockets. The approach:

- Keep the **MCS Express backend** (`backend/index.js`) as a separate process — it owns Socket.io
- The Next.js frontend connects to the backend's Socket.io server (same as today)
- Do **not** try to embed Socket.io in Next.js API routes — stateless serverless functions cannot hold socket connections

```
Next.js frontend  ──socket.io-client──▶  MCS Express backend (:4001)
```

This is unchanged from the current architecture. Next.js replaces only the CRA frontend, not the backend.

### File Structure (Next.js)

```
mcs/
├── backend/                     ← unchanged Express + Socket.io
└── frontend/                    ← replace CRA with Next.js
    ├── next.config.js
    ├── package.json
    ├── app/
    │   ├── layout.tsx           ← root layout (MUI ThemeProvider, AuthProvider)
    │   ├── board/
    │   │   └── page.tsx         ← CallBoard (server component shell)
    │   ├── station/
    │   │   └── page.tsx         ← CallStation (server component shell)
    │   ├── calls/
    │   │   └── page.tsx         ← MaintenanceCalls (client component)
    │   └── login/
    │       └── page.tsx         ← Login
    ├── components/
    │   ├── CallBoard.tsx        ← 'use client' — Socket.io, timers
    │   ├── CallStation.tsx      ← 'use client' — HID capture, Socket.io
    │   └── ...
    └── services/
        └── maintenanceCallService.ts   ← unchanged
```

### MUI with Next.js (Important)

MUI requires emotion for SSR. Add to `app/layout.tsx`:

```tsx
// Required for MUI + Next.js SSR compatibility
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            {children}
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
```

Required packages:
```bash
npm install @mui/material-nextjs @emotion/cache
```

### next.config.js

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy API calls to MCS backend during development
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4001/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
```

---

## Nginx Configuration

### Install (Ubuntu/Debian server or WSL)

```bash
sudo apt update && sudo apt install nginx
```

### Config File: `/etc/nginx/sites-available/mcs`

```nginx
# ── MCS — Maintenance Call System ─────────────────────────────────────────────

upstream mcs_backend {
    server 127.0.0.1:4001;
    keepalive 32;
}

upstream mcs_frontend {
    server 127.0.0.1:3003;
    keepalive 16;
}

server {
    listen 80;
    server_name mcs.local mcs;   # adjust to your hostname or IP

    # ── Static Next.js assets — served directly by Nginx (fast) ──────────────
    location /_next/static/ {
        alias /var/www/mcs/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # ── Socket.io WebSocket upgrade ───────────────────────────────────────────
    location /socket.io/ {
        proxy_pass         http://mcs_backend;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_read_timeout 86400s;    # keep socket alive
    }

    # ── MCS API ───────────────────────────────────────────────────────────────
    location /api/ {
        proxy_pass         http://mcs_backend;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 30s;
    }

    # ── Next.js SSR pages ─────────────────────────────────────────────────────
    location / {
        proxy_pass         http://mcs_frontend;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "keep-alive";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Enable and Test

```bash
sudo ln -s /etc/nginx/sites-available/mcs /etc/nginx/sites-enabled/
sudo nginx -t          # test config — must say "ok"
sudo systemctl reload nginx
```

### Optional: Add SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d mcs.yourdomain.com
# Certbot auto-updates the nginx config and sets up renewal
```

---

## PM2 Process Management

PM2 keeps both Node processes alive across reboots and restarts them on crash.

### Install

```bash
npm install -g pm2
```

### `ecosystem.config.js` (place in `maintenance_call_system/`)

```js
module.exports = {
  apps: [
    {
      name: 'mcs-backend',
      cwd: './backend',
      script: 'index.js',
      env: { NODE_ENV: 'production', PORT: 4001 },
      watch: false,
      max_memory_restart: '200M',
    },
    {
      name: 'mcs-frontend',
      cwd: './frontend',
      script: 'node_modules/.bin/next',
      args: 'start',
      env: { NODE_ENV: 'production', PORT: 3003 },
      watch: false,
    },
  ],
};
```

### Start and Auto-restart on Boot

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup    # follow the printed command to enable on boot
```

### Useful PM2 Commands

```bash
pm2 status                 # see all processes
pm2 logs mcs-backend       # tail backend logs
pm2 logs mcs-frontend      # tail frontend logs
pm2 restart mcs-backend    # restart after config change
pm2 reload mcs-frontend    # zero-downtime reload
```

---

## Deployment Workflow (Once Stable)

```bash
# 1. Pull latest code
git pull

# 2. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 3. Build Next.js
cd frontend && npm run build

# 4. Copy static files to Nginx's direct-serve path
cp -r .next/static /var/www/mcs/.next/static

# 5. Reload app (zero downtime)
pm2 reload all

# 6. Reload Nginx if config changed
sudo nginx -s reload
```

---

## Kiosk & Call Board URLs (Clean, Production)

| Device | URL |
|--------|-----|
| Call Board (wall TV) | `http://mcs/board` |
| Machine Kiosk — Press 1 | `http://mcs/station?reader=press-1` |
| Machine Kiosk — Press 2 | `http://mcs/station?reader=press-2` |
| Admin / Management | `http://mcs/calls` |
| Health Check | `http://mcs/api/v1/health` |

Set each kiosk browser's homepage to its station URL. Set the TV browser's homepage to `/board`. Browsers auto-launch on boot — no manual navigation needed.

---

## Implementation Order (When Ready)

1. **Phase 1 stable** — badge readers working, data flowing, team using it daily
2. **Set up server** — dedicated machine or existing server with Ubuntu/WSL
3. **Install Nginx + PM2** — follow this doc
4. **Migrate frontend to Next.js** — follow page strategy table above
5. **Build + deploy** — run deployment workflow
6. **Update kiosk bookmarks** — point to clean URLs
7. **Optional: Add SSL** — Let's Encrypt, free, auto-renewing
