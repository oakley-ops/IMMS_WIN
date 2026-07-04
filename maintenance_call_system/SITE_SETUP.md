# MCS — New Site Setup Guide

Use this guide to spin up MCS at a new facility. Each site is a completely independent deployment with its own database tables, badge readers, and machines (all shared from the IMMS PostgreSQL database).

---

## Prerequisites (per server)

- Ubuntu 22.04 LTS (or Windows with WSL2)
- Node.js 20 LTS
- PostgreSQL access (connection string to the IMMS database)
- Nginx
- PM2 (`npm install -g pm2`)

---

## Step 1 — Clone the repo

```bash
git clone <your-repo-url> /opt/mcs-<site>
cd /opt/mcs-<site>
```

---

## Step 2 — Configure backend

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Set:
```env
DATABASE_URL=postgresql://user:password@db-host:5432/fiservinventory
JWT_SECRET=<generate a random 64-char string>
SESSION_SECRET=<generate a random 64-char string>
PORT=4001
CORS_ORIGIN=http://<this-server-ip>
SITE_NAME=Plant 1         # shows in logs
```

Install backend:
```bash
cd backend && npm ci --omit=dev && cd ..
```

---

## Step 3 — Configure frontend

```bash
cp frontend/.env.example frontend/.env.local
nano frontend/.env.local
```

Set:
```env
NEXT_PUBLIC_API_URL=http://<this-server-ip>/api/v1
NEXT_PUBLIC_SOCKET_URL=http://<this-server-ip>
NEXT_PUBLIC_SITE_NAME=Plant 1
BACKEND_URL=http://localhost:4001
```

Install and build:
```bash
cd frontend && npm ci && npm run build && cd ..
```

---

## Step 4 — Configure Nginx

```bash
sudo cp nginx.conf /etc/nginx/sites-available/mcs-<site>
sudo nano /etc/nginx/sites-available/mcs-<site>
```

Change `server_name` to match this server's IP or hostname.

For multiple sites on one Nginx server, change the upstream ports in each config file to match that site's backend/frontend ports.

```bash
sudo ln -s /etc/nginx/sites-available/mcs-<site> /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## Step 5 — Start with PM2

The repo no longer ships an MCS-local PM2 ecosystem file — the two MCS apps are defined as `mcs-api`/`mcs-web` in `ecosystem.prod.config.js` at the monorepo root (single-site, alongside the IMMS services; see `docs/deployment/PROD_OPERATIONS.md`). For an independent MCS-only site, create a site-local PM2 config by adapting those two app entries, then:

```bash
pm2 start ecosystem.<site>.config.js
pm2 save
pm2 startup   # follow the printed command to enable on boot
```

---

## Step 6 — Register badge readers via SQL

Connect to PostgreSQL and insert a reader for each machine kiosk:

```sql
INSERT INTO badge_readers (reader_key, machine_id, location_label)
VALUES ('press-1', <machine_id>, 'Die Press 1 — Bay A');
```

Then open the kiosk URL: `http://<server>/station?reader=press-1`

---

## Step 7 — Set kiosk browser homepages

| Device | URL |
|--------|-----|
| Wall TV / Call Board | `http://<server>/board` |
| Machine kiosk — Press 1 | `http://<server>/station?reader=press-1` |
| Admin page | `http://<server>/calls` |

Set each device's browser to launch in kiosk mode at its URL on boot.

---

## Updating (all sites)

```bash
cd /opt/mcs-<site>
./deploy.sh
```

---

## Running multiple sites on ONE server

Assign different ports per site and use Nginx server blocks:

| Site | Backend Port | Frontend Port | Nginx server_name |
|------|-------------|--------------|-------------------|
| Plant 1 | 4001 | 3003 | mcs-plant1 |
| Plant 2 | 4002 | 3004 | mcs-plant2 |
| Plant 3 | 4003 | 3005 | mcs-plant3 |

Update each site's local PM2 config (see Step 5) and `nginx.conf` with the appropriate ports.
