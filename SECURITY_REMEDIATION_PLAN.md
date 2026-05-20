# Security Remediation Plan

**Date:** 2026-02-11
**Total Vulnerabilities:** 140 (30 backend, 110 frontend)

---

## Phase 1: Safe Dependency Fixes (Zero Risk) --- COMPLETED 2026-02-13

**Results:**
- Backend: 30 → 13 vulnerabilities (17 fixed)
- Frontend: 110 → 103 vulnerabilities (7 fixed)
- Remaining frontend fixes are all locked inside `netlify-cli` (Phase 3)

### 1A: Backend `npm audit fix`

Fixes ~17 vulnerabilities with no breaking changes.

```bash
cd backend && npm audit fix
```

| Package | Severity | Issue |
|---|---|---|
| `axios` | High | DoS via missing size check, `__proto__` key in mergeConfig |
| `validator` / `express-validator` | High | URL validation bypass in `isURL` |
| `jws` | High | Improper HMAC signature verification |
| `qs` / `body-parser` / `express` | High | arrayLimit bypass allows DoS via memory exhaustion |
| `lodash` | Moderate | Prototype pollution in `_.unset` / `_.omit` |
| `nodemailer` / `mailparser` | Moderate | Email domain confusion + addressparser DoS |
| `on-headers` / `morgan` / `express-session` | Low | HTTP response header manipulation |
| `js-yaml` | Moderate | Prototype pollution in merge (`<<`) |
| `formidable` | Low | Predictable filenames via hexoid |
| `brace-expansion` | Low | Regular Expression DoS |
| `tmp` | Low | Symlink dir parameter write |
| `@babel/helpers`, `@babel/runtime` | Moderate | ReDoS in transpiled named capturing groups |

### 1B: Frontend `npm audit fix --legacy-peer-deps`

Fixes ~40+ vulnerabilities. Requires `--legacy-peer-deps` due to `@mui/lab@7.0.0-beta.11` expecting `@mui/material@^7` while project uses `@mui/material@^5`.

```bash
cd frontend && npm audit fix --legacy-peer-deps
```

Fixes the same categories as backend (axios, webpack, body-parser/express/qs, validator, yaml, word-wrap, `@babel/*`) plus frontend-specific packages.

**Post-fix verification:**
```bash
cd backend && npm audit
cd frontend && npm audit
```

---

## Phase 2: Breaking Changes (Backend)

### 2A: Upgrade `bcrypt` 5.x to 6.0

Fixes the `bcrypt` -> `@mapbox/node-pre-gyp` -> `tar` vulnerability chain (High severity: arbitrary file overwrite via hardlinks).

```bash
cd backend && npm install bcrypt@6
```

**Risk:** bcrypt 6 drops `node-pre-gyp` in favor of prebuilt binaries. Test that password hashing/verification still works:
- [ ] User login works
- [ ] User registration works
- [ ] Password change works

### 2B: Upgrade `nodemailer` to 8.x

Fixes email domain interpretation conflict and addressparser DoS (Moderate).

```bash
cd backend && npm install nodemailer@8
```

**Risk:** API changes in nodemailer 8. Review:
- [ ] Email sending in `backend/src/routes/emailRoutes.js`
- [ ] Any SMTP transport configuration
- [ ] Mailparser compatibility (`mailparser` may also need update)

### 2C: Replace `quagga` with `@ericblade/quagga2`

Fixes the `quagga` -> `get-pixels` -> `request` -> `form-data` (Critical: unsafe random) and `tough-cookie` (Moderate: prototype pollution) chain. The `request` package is fully deprecated.

```bash
cd backend && npm uninstall quagga && npm install @ericblade/quagga2
```

**Risk:** API is mostly compatible but needs testing:
- [ ] Barcode scanning functionality works
- [ ] Import paths updated throughout codebase

### 2D: Address `imap` -> `utf7` -> `semver` chain

Fixes semver ReDoS (High). The `imap` package is unmaintained.

**Option A:** Pin `semver` override (quick fix)
```json
// backend/package.json
"overrides": {
  "imap": {
    "utf7": {
      "semver": "^7.6.0"
    }
  }
}
```

**Option B:** Switch to `imapflow` (long-term fix)
```bash
cd backend && npm uninstall imap && npm install imapflow
```

**Risk:** IMAP monitoring code in backend needs rewrite if switching libraries:
- [ ] Check `backend/src/` for imap usage
- [ ] IMAP monitoring is disabled by default (per CLAUDE.md), so lower priority

---

## Phase 3: Frontend Breaking Changes

### 3A: Fix `@mui/lab` peer dependency conflict

The root cause blocking clean `npm audit fix`. `@mui/lab@7.0.0-beta.11` requires `@mui/material@^7` but project uses `@mui/material@^5`.

**Option A (Recommended):** Downgrade `@mui/lab` to v5-compatible version
```bash
cd frontend && npm install @mui/lab@5.0.0-alpha.170
```

**Option B:** Upgrade entire MUI stack to v7 (large effort)
```bash
cd frontend && npm install @mui/material@7 @mui/icons-material@7 @mui/lab@7 @mui/x-data-grid@7 @mui/x-date-pickers@7
```

### 3B: Upgrade `netlify-cli`

~50+ vulnerabilities originate from `netlify-cli` and its deep dependency tree (tar, semver, fastify, tough-cookie, octokit, etc.).

```bash
cd frontend && npm install netlify-cli@latest
```

**Risk:** CLI interface changes, deployment scripts may need updates:
- [ ] Test `netlify deploy` commands
- [ ] Verify build hooks still work

### 3C: Replace `xlsx` (No Fix Available)

`xlsx` (SheetJS) has prototype pollution and ReDoS vulnerabilities with **no fix available and none planned**.

**Option A (Recommended):** Switch to `xlsx-populate` or `exceljs`
```bash
cd frontend && npm uninstall xlsx && npm install exceljs
```

**Option B:** Switch to SheetJS Community Edition
```bash
cd frontend && npm uninstall xlsx && npm install xlsx-js-style
```

**Risk:** API differences require code changes:
- [ ] Find all `xlsx` imports in frontend
- [ ] Rewrite read/write operations to new library API
- [ ] Test all Excel export/import features

### 3D: Address `webpack-dev-server` (Dev Only)

Source code theft vulnerability when accessing malicious sites (Moderate). Only affects development, not production builds.

Blocked by `react-scripts` — fix requires either:
- Ejecting from CRA and managing webpack directly
- Migrating to Vite (recommended long-term)
- Accepting the risk since it's dev-only

---

## Phase 4: Verify and Clean Up

```bash
# Run full audit on both
cd backend && npm audit
cd frontend && npm audit

# Run tests to confirm nothing broke
cd backend && npm test
cd frontend && npm test

# Start the app and smoke test
.\start-app.bat
```

### Final checklist:
- [ ] All Phase 1 fixes applied and verified
- [ ] Phase 2 breaking changes tested individually
- [ ] Phase 3 frontend fixes applied
- [ ] Full test suite passes
- [ ] Application starts and core features work
- [ ] Remaining vulnerabilities documented as accepted risk

---

## Summary

| Phase | Effort | Vulns Fixed | Risk |
|---|---|---|---|
| 1A: Backend safe fix | 5 min | ~17 | None |
| 1B: Frontend safe fix | 5 min | ~40 | None |
| 2A: bcrypt 6 | 30 min | 3 | Low — test auth |
| 2B: nodemailer 8 | 1 hr | 2 | Medium — test email |
| 2C: Replace quagga | 1 hr | 3 | Medium — test barcode scanning |
| 2D: Fix imap/semver | 30 min | 2 | Low — IMAP disabled by default |
| 3A: Fix MUI lab | 30 min | 0 (unblocks fixes) | Low |
| 3B: Upgrade netlify-cli | 1 hr | ~50 | Medium — test deploys |
| 3C: Replace xlsx | 2 hr | 2 | High — API rewrite needed |
| 3D: webpack-dev-server | N/A | 2 | Accepted (dev-only) |
