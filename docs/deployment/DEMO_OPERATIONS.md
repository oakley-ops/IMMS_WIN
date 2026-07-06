# Demo Operations (demo.immsystem.com)

The public sales demo is the **same app as production**, deployed from **`main`**
with demo mode turned on. There is no separate demo codebase — the demo experience
lives in `main` behind flags:

- **Build flag** `REACT_APP_DEMO_MODE=true` (baked by the `Dockerfile`) → routes the
  `/demo` landing page and shows the demo chrome (banner, role switcher, reset).
- **Runtime flag** `DEMO_MODE=true` → mounts `/api/v1/demo` (one-click role login),
  sets the `noindex` header, and runs the nightly reseed cron.

## Repoint the demo at main (one-time — off the retired `feature/demo-mode` fork)

1. In the Render dashboard, open the demo web service.
2. Point it at this repo, branch **`main`** (Docker runtime, `./Dockerfile`).
3. Ensure runtime env has **`DEMO_MODE=true`**, a **demo `DATABASE_URL`** (a
   throwaway database — never a customer/prod DB), `JWT_SECRET`, `SESSION_SECRET`.
4. Trigger a deploy. On first boot with an empty demo DB, seed it once:
   `node src/scripts/seedDemo.js` (or `npm run seed:demo`) from the backend. The
   nightly reseed cron keeps it fresh thereafter.

## Verify after repoint

- `https://demo.immsystem.com/demo` shows the landing page (not a login redirect).
- "Enter Demo" logs straight into the dashboard (no credentials).
- Response headers include `X-Frame-Options`, `X-Content-Type-Options: nosniff`,
  and no `X-Powered-By`; `X-Robots-Tag: noindex` is present.
- The browser tab reads "IMMS — Inventory Management System".

## Retire the old fork

Once the main-based demo is confirmed live:

```
git push origin --delete feature/demo-mode
```

The demo now tracks `main` automatically (autoDeploy), so every merge keeps the
demo current — no more drift.
