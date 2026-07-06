# Auth-Service JWT Verification in IMMS + MCS — Implementation Plan (Step 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make IMMS and MCS recognize and accept the auth-service's RS256 JWT (delivered via the `imms_auth` httpOnly cookie set in Step 1) **in addition to** their existing HS256 Bearer-token flow. Both auth paths work simultaneously — old IMMS/MCS logins stay live; the auth-service is now a parallel option. Step 6 later deletes the old paths.

**Architecture:** Each app gets a small helper module that verifies the auth-service JWT against the auth-service's public RSA key (loaded once at startup). Each app's existing auth middleware is updated to first check the cookie; if absent or invalid, fall through to the existing Bearer-header logic. `req.user` is populated with a unified shape that satisfies both old controllers (`id`, `username`, `role`) and new code (`tenant_id`, `roles[]`).

**Tech Stack:** Node.js, Express, jsonwebtoken (RS256 verify), cookie-parser (new dependency in both apps).

**Reference:** [Design spec](../specs/2026-05-21-mcs-imms-split-saas-foundations-design.md). This plan covers Step 3 of the spec's "Order of work."

---

## Why "transitional" matters

The spec is explicit: in Step 3, both auth paths must work side-by-side. Why not just replace?

- IMMS has many controllers and routes that already use existing auth middleware. Replacing in one shot risks breaking flows we don't see.
- The IMMS frontend hasn't been migrated yet (that's Steps 4-6). It still logs in via IMMS's own `/api/auth/login` endpoint and gets a Bearer token. If we kill the old path now, the IMMS UI breaks.
- The MCS kiosk station route (`/badge-swipe`) is intentionally unauthenticated and stays that way. No change here.

So this step is purely **additive**: same surface area, more accepted credentials.

---

## Design decisions (locked in this plan)

1. **Public key distribution:** Each app reads the auth-service's `public.pem` at startup from a path given by env var `AUTH_PUBLIC_KEY_PATH`. Default for dev: `../../auth-service/keys/public.pem` (relative to each app's backend root). Production override: any absolute path or PEM content via `AUTH_PUBLIC_KEY` (raw PEM, takes precedence over path).

2. **Cookie name:** `imms_auth` (matches what auth-service sets in Step 1). Configurable via `AUTH_COOKIE_NAME` env var, defaults to that name.

3. **Auth precedence on each request:**
   - If `req.cookies.imms_auth` exists and verifies against the auth-service public key → use it. Populate `req.user`.
   - Else if `Authorization: Bearer <token>` header exists and verifies against the legacy `JWT_SECRET` (HS256) → use existing flow. Populate `req.user` as before.
   - Else → 401 (same envelope each app already uses).

4. **`req.user` shape — unified to satisfy old AND new code:**
   ```js
   {
     // Old shape (for existing controllers):
     id: <user_id>,
     username: <email>,         // best-effort; auth-service JWT doesn't include username, so we use email as a placeholder when coming from new auth
     role: <derived>,           // see role-mapping below
     // New shape (for new code, undefined when coming from old auth):
     user_id: <same as id>,
     tenant_id: <int or 1 fallback>,
     roles: <array or []>,
     // Marker so controllers can tell which path was used (rarely needed):
     auth_source: 'auth-service' | 'legacy',
   }
   ```

5. **Role mapping (new → old):** If the auth-service JWT contains any of `*.admin` → `req.user.role = 'admin'`. Otherwise → `req.user.role = 'user'`. Crude but transitional; existing role-gated routes only check for `'admin'`/`'user'` anyway. After Step 6, `roles[]` becomes the only thing that matters.

6. **No HTTP call to auth-service.** Verification is local using the public key. Auth-service can be down and IMMS/MCS still validate already-issued tokens (preserves the resilience guarantee).

7. **Email-coming-from-JWT for username:** the auth-service JWT shape from Step 1 is `{ sub, tenant_id, roles, iat, exp }`. It does **not** include email. For `username`, we use `auth-service-user-<sub>` as a placeholder. (Real username can be re-derived by hitting auth-service's `/auth/me` if any controller actually needs it — none do today; this is a non-issue in practice.)

8. **Shared helper, not shared package.** Each app gets its own `verifyAuthServiceJwt.js` (essentially identical content, ~25 lines). The spec called this out: "small enough that a shared package isn't worth it yet."

---

## File structure

```
backend/
├── package.json                              # MODIFY — add cookie-parser dep
├── src/
│   ├── app.js                                # MODIFY — wire cookie-parser middleware
│   ├── middleware/
│   │   ├── verifyAuthServiceJwt.js           # NEW — pure JWT verification helper
│   │   ├── auth.js                           # MODIFY — try cookie first, then Bearer
│   │   └── authMiddleware.js                 # MODIFY — same dual-path logic
│   └── config/
│       └── authServiceKey.js                 # NEW — loads public key once at startup

maintenance_call_system/backend/
├── package.json                              # MODIFY — add cookie-parser dep
├── index.js                                  # MODIFY — wire cookie-parser middleware
├── src/
│   ├── middleware/
│   │   ├── verifyAuthServiceJwt.js           # NEW — pure JWT verification helper
│   │   └── auth.js                           # MODIFY — try cookie first, then Bearer
│   └── config/
│       └── authServiceKey.js                 # NEW — loads public key once at startup

backend/README.md (if exists) + maintenance_call_system/README.md
                                              # MODIFY — update auth status section
```

Each file's responsibility:
- `config/authServiceKey.js` — load the public PEM at startup. One-time read. Exports the key string.
- `middleware/verifyAuthServiceJwt.js` — pure function: given a cookie value, returns the decoded payload or throws. No Express coupling.
- `middleware/auth.js` / `authMiddleware.js` — Express middleware. Tries cookie path, falls back to Bearer, returns 401 if both fail.

---

## Conventions

- **No new test framework setup.** IMMS uses Jest; MCS uses Vitest. Each app's test files match its native framework.
- **TDD for the helper, light for the middleware.** The pure JWT verify helper gets unit tests with a mocked keypair (same pattern as auth-service's `jwt.test.js`). Middleware integration is verified by a single integration-style test per app that sends a cookie and confirms `req.user` is populated.
- **Don't refactor.** Existing middleware keeps its existing API. We just add a code branch at the top.
- **Don't touch tenant scoping.** Step 2a left `currentTenantId(req)` returning the default; this step makes `req.user.tenant_id` real, so the helper now returns the right value for free. No code change needed to wire that up.

---

## Task 1: Verify prerequisites

**Files:** none

- [ ] **Step 1: Confirm local main has Step 1 + Step 2a landed**

```bash
git log --oneline main -5
```

Expected: shows `37d1f298 Merge pull request #2 from oakley-ops/tenant-id-schema-rollout` (Step 2a merge) at or near the tip.

- [ ] **Step 2: Confirm the auth-service public key exists on disk**

```bash
ls auth-service/keys/public.pem
```

Expected: file exists. If not, `cd auth-service && npm run keys`.

- [ ] **Step 3: Capture baseline test counts for both apps**

```bash
cd backend && (npm test 2>&1 | tail -8) ; cd ..
cd maintenance_call_system/backend && (npm test 2>&1 | tail -8) ; cd ../..
```

Note pass/fail counts. They must not regress.

- [ ] **Step 4: No commit.**

---

## Task 2: Install cookie-parser in IMMS

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json` (auto-updated by npm)

- [ ] **Step 1: Install**

```bash
cd backend && npm install cookie-parser@^1.4.7 2>&1 | tail -5 ; cd ..
```

- [ ] **Step 2: Verify it's in dependencies (not devDependencies)**

```bash
grep -A1 '"cookie-parser"' backend/package.json
```

Expected: appears under `"dependencies"`, version `^1.4.7`.

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "feat(backend): add cookie-parser dependency"
```

---

## Task 3: Install cookie-parser in MCS

**Files:**
- Modify: `maintenance_call_system/backend/package.json`
- Modify: `maintenance_call_system/backend/package-lock.json`

- [ ] **Step 1: Install**

```bash
cd maintenance_call_system/backend && npm install cookie-parser@^1.4.7 2>&1 | tail -5 ; cd ../..
```

- [ ] **Step 2: Verify**

```bash
grep -A1 '"cookie-parser"' maintenance_call_system/backend/package.json
```

- [ ] **Step 3: Commit**

```bash
git add maintenance_call_system/backend/package.json maintenance_call_system/backend/package-lock.json
git commit -m "feat(mcs): add cookie-parser dependency"
```

---

## Task 4: Add auth-service public key loader to IMMS

**Files:**
- Create: `backend/src/config/authServiceKey.js`

- [ ] **Step 1: Write the loader**

```js
// backend/src/config/authServiceKey.js
// Loads the auth-service's RS256 public key once at startup so IMMS can
// verify JWTs issued by the auth-service. Three sources, in priority order:
//   1. AUTH_PUBLIC_KEY env var — raw PEM content (typical for production)
//   2. AUTH_PUBLIC_KEY_PATH env var — path to the .pem file (absolute or relative to CWD)
//   3. Default path: ../auth-service/keys/public.pem (sibling directory; dev convenience)
// Returns null if no key is found — IMMS still starts, but auth-service JWTs
// won't be accepted (legacy auth still works).

const fs = require('fs');
const path = require('path');

const loadKey = () => {
  if (process.env.AUTH_PUBLIC_KEY) {
    return process.env.AUTH_PUBLIC_KEY;
  }
  const candidatePaths = [];
  if (process.env.AUTH_PUBLIC_KEY_PATH) {
    candidatePaths.push(
      path.isAbsolute(process.env.AUTH_PUBLIC_KEY_PATH)
        ? process.env.AUTH_PUBLIC_KEY_PATH
        : path.resolve(process.cwd(), process.env.AUTH_PUBLIC_KEY_PATH)
    );
  }
  candidatePaths.push(path.resolve(__dirname, '../../../auth-service/keys/public.pem'));

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf8');
    }
  }
  return null;
};

const publicKey = loadKey();

if (!publicKey) {
  // Soft warning. Auth-service JWTs won't be accepted; legacy auth still works.
  // eslint-disable-next-line no-console
  console.warn('[auth] auth-service public key not found. Set AUTH_PUBLIC_KEY or AUTH_PUBLIC_KEY_PATH to enable auth-service JWT validation.');
}

module.exports = { publicKey };
```

- [ ] **Step 2: Sanity-check it loads with the default path**

```bash
cd backend && node -e "console.log(require('./src/config/authServiceKey').publicKey ? 'KEY_OK' : 'KEY_MISSING')" ; cd ..
```

Expected output: `KEY_OK`. If `KEY_MISSING`, confirm `auth-service/keys/public.pem` exists and the relative path resolves correctly.

- [ ] **Step 3: Commit**

```bash
git add backend/src/config/authServiceKey.js
git commit -m "feat(backend): add auth-service public key loader"
```

---

## Task 5: Add auth-service public key loader to MCS

**Files:**
- Create: `maintenance_call_system/backend/src/config/authServiceKey.js`

- [ ] **Step 1: Write the loader**

```js
// maintenance_call_system/backend/src/config/authServiceKey.js
// See backend/src/config/authServiceKey.js (IMMS) — identical contract.

const fs = require('fs');
const path = require('path');

const loadKey = () => {
  if (process.env.AUTH_PUBLIC_KEY) {
    return process.env.AUTH_PUBLIC_KEY;
  }
  const candidatePaths = [];
  if (process.env.AUTH_PUBLIC_KEY_PATH) {
    candidatePaths.push(
      path.isAbsolute(process.env.AUTH_PUBLIC_KEY_PATH)
        ? process.env.AUTH_PUBLIC_KEY_PATH
        : path.resolve(process.cwd(), process.env.AUTH_PUBLIC_KEY_PATH)
    );
  }
  candidatePaths.push(path.resolve(__dirname, '../../../../auth-service/keys/public.pem'));

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf8');
    }
  }
  return null;
};

const publicKey = loadKey();

if (!publicKey) {
  // eslint-disable-next-line no-console
  console.warn('[auth] auth-service public key not found. Set AUTH_PUBLIC_KEY or AUTH_PUBLIC_KEY_PATH to enable auth-service JWT validation.');
}

module.exports = { publicKey };
```

Note: the default path here goes up FOUR levels (`../../../../auth-service/keys/public.pem`) because MCS lives one directory deeper (`maintenance_call_system/backend/src/config/`) than IMMS (`backend/src/config/`). Verify the relative path resolves to the actual `auth-service/keys/public.pem` at the repo root.

- [ ] **Step 2: Sanity-check**

```bash
cd maintenance_call_system/backend && node -e "console.log(require('./src/config/authServiceKey').publicKey ? 'KEY_OK' : 'KEY_MISSING')" ; cd ../..
```

Expected: `KEY_OK`. If `KEY_MISSING`, adjust the relative path until it resolves.

- [ ] **Step 3: Commit**

```bash
git add maintenance_call_system/backend/src/config/authServiceKey.js
git commit -m "feat(mcs): add auth-service public key loader"
```

---

## Task 6: IMMS — verifyAuthServiceJwt helper (TDD)

**Files:**
- Create: `backend/src/middleware/verifyAuthServiceJwt.js`
- Create: `backend/src/__tests__/verifyAuthServiceJwt.test.js`

IMMS uses Jest. Test pattern follows IMMS conventions.

- [ ] **Step 1: Write the failing test**

```js
// backend/src/__tests__/verifyAuthServiceJwt.test.js
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Generate a fresh keypair and stub the key-loader BEFORE requiring the helper.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

jest.mock('../config/authServiceKey', () => ({ publicKey }), { virtual: false });

const verify = require('../middleware/verifyAuthServiceJwt');

const validToken = () =>
  jwt.sign({ sub: 42, tenant_id: 1, roles: ['mcs.admin'] }, privateKey,
    { algorithm: 'RS256', expiresIn: '5m' });

describe('verifyAuthServiceJwt', () => {
  it('returns the decoded payload for a valid auth-service JWT', () => {
    const payload = verify(validToken());
    expect(payload.sub).toBe(42);
    expect(payload.tenant_id).toBe(1);
    expect(payload.roles).toEqual(['mcs.admin']);
  });

  it('throws on a tampered token', () => {
    const t = validToken();
    const [h, p, s] = t.split('.');
    expect(() => verify(`${h}.${p}.${s.slice(0, -2)}xx`)).toThrow();
  });

  it('throws on a token signed by a different key', () => {
    const { privateKey: otherKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding:  { type: 'spki',  format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const evil = jwt.sign({ sub: 9 }, otherKey, { algorithm: 'RS256' });
    expect(() => verify(evil)).toThrow();
  });

  it('throws on HS256 token (algorithm confusion defense)', () => {
    const hs = jwt.sign({ sub: 1 }, 'hs-secret', { algorithm: 'HS256' });
    expect(() => verify(hs)).toThrow();
  });
});
```

Run: `cd backend && npx jest src/__tests__/verifyAuthServiceJwt.test.js` — expect FAIL (helper missing).

- [ ] **Step 2: Implement**

```js
// backend/src/middleware/verifyAuthServiceJwt.js
// Pure helper: given a JWT string, returns the decoded payload if it's a
// valid RS256 token signed by the auth-service. Throws on any failure —
// caller decides how to handle (typically: fall back to legacy auth).
//
// Hard-pins algorithm to RS256 to prevent algorithm-confusion attacks.

const jwt = require('jsonwebtoken');
const { publicKey } = require('../config/authServiceKey');

const verify = (token) => {
  if (!publicKey) {
    throw new Error('auth-service public key not configured');
  }
  return jwt.verify(token, publicKey, { algorithms: ['RS256'] });
};

module.exports = verify;
```

- [ ] **Step 3: Run, expect PASS**

```bash
cd backend && npx jest src/__tests__/verifyAuthServiceJwt.test.js ; cd ..
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/middleware/verifyAuthServiceJwt.js backend/src/__tests__/verifyAuthServiceJwt.test.js
git commit -m "feat(backend): add auth-service JWT verifier"
```

---

## Task 7: MCS — verifyAuthServiceJwt helper (TDD)

**Files:**
- Create: `maintenance_call_system/backend/src/middleware/verifyAuthServiceJwt.js`
- Create: `maintenance_call_system/backend/src/middleware/verifyAuthServiceJwt.test.js`

MCS uses Vitest with globals enabled (set up during Step 1). No `require('vitest')`.

- [ ] **Step 1: Write the failing test**

```js
// maintenance_call_system/backend/src/middleware/verifyAuthServiceJwt.test.js
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

vi.mock('../config/authServiceKey', () => ({ publicKey }));

const verify = require('./verifyAuthServiceJwt');

const validToken = () =>
  jwt.sign({ sub: 42, tenant_id: 1, roles: ['mcs.admin'] }, privateKey,
    { algorithm: 'RS256', expiresIn: '5m' });

describe('verifyAuthServiceJwt', () => {
  it('returns the decoded payload for a valid auth-service JWT', () => {
    const payload = verify(validToken());
    expect(payload.sub).toBe(42);
    expect(payload.tenant_id).toBe(1);
    expect(payload.roles).toEqual(['mcs.admin']);
  });

  it('throws on a tampered token', () => {
    const t = validToken();
    const [h, p, s] = t.split('.');
    expect(() => verify(`${h}.${p}.${s.slice(0, -2)}xx`)).toThrow();
  });

  it('throws on a token signed by a different key', () => {
    const { privateKey: otherKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding:  { type: 'spki',  format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const evil = jwt.sign({ sub: 9 }, otherKey, { algorithm: 'RS256' });
    expect(() => verify(evil)).toThrow();
  });

  it('throws on HS256 token (algorithm confusion defense)', () => {
    const hs = jwt.sign({ sub: 1 }, 'hs-secret', { algorithm: 'HS256' });
    expect(() => verify(hs)).toThrow();
  });
});
```

Run: `cd maintenance_call_system/backend && npx vitest run src/middleware/verifyAuthServiceJwt.test.js` — expect FAIL.

- [ ] **Step 2: Implement**

```js
// maintenance_call_system/backend/src/middleware/verifyAuthServiceJwt.js
const jwt = require('jsonwebtoken');
const { publicKey } = require('../config/authServiceKey');

const verify = (token) => {
  if (!publicKey) {
    throw new Error('auth-service public key not configured');
  }
  return jwt.verify(token, publicKey, { algorithms: ['RS256'] });
};

module.exports = verify;
```

- [ ] **Step 3: Run, expect PASS (4 tests)**

```bash
cd maintenance_call_system/backend && npx vitest run src/middleware/verifyAuthServiceJwt.test.js ; cd ../..
```

- [ ] **Step 4: Commit**

```bash
git add maintenance_call_system/backend/src/middleware/verifyAuthServiceJwt.js maintenance_call_system/backend/src/middleware/verifyAuthServiceJwt.test.js
git commit -m "feat(mcs): add auth-service JWT verifier"
```

---

## Task 8: IMMS — wire cookie-parser + dual-path auth middleware

**Files:**
- Modify: `backend/src/app.js`
- Modify: `backend/src/middleware/auth.js`
- Modify: `backend/src/middleware/authMiddleware.js`

- [ ] **Step 1: Read current app.js to find where middleware is wired**

```bash
grep -n "cookieParser\|express.json\|app.use" backend/src/app.js
```

Find a line near `app.use(express.json())`. We'll add `app.use(cookieParser())` immediately after it.

- [ ] **Step 2: Wire cookie-parser in `backend/src/app.js`**

Add near the top, with the other `require` lines:
```js
const cookieParser = require('cookie-parser');
```

Then in the middleware chain, right after `app.use(express.json(...))`:
```js
app.use(cookieParser());
```

(Don't reformat the file. Just add these two lines.)

- [ ] **Step 3: Update `backend/src/middleware/auth.js`**

Replace the entire file with:
```js
const jwt = require('jsonwebtoken');
const verifyAuthServiceJwt = require('./verifyAuthServiceJwt');

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'imms_auth';

const populateFromAuthService = (payload) => ({
  // New shape:
  user_id:   payload.sub,
  tenant_id: payload.tenant_id || 1,
  roles:     Array.isArray(payload.roles) ? payload.roles : [],
  auth_source: 'auth-service',
  // Backward-compatible shape:
  id:       payload.sub,
  username: `auth-service-user-${payload.sub}`,
  role:     (payload.roles || []).some((r) => r.endsWith('.admin')) ? 'admin' : 'user',
});

const populateFromLegacy = (decoded) => ({
  ...decoded,
  auth_source: 'legacy',
});

const auth = (req, res, next) => {
  // 1) Try auth-service cookie
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken) {
    try {
      req.user = populateFromAuthService(verifyAuthServiceJwt(cookieToken));
      return next();
    } catch (_) {
      // fall through to legacy
    }
  }

  // 2) Try legacy Bearer token
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET environment variable is not set');
      return res.status(500).json({ message: 'Server configuration error' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = populateFromLegacy(decoded);
    return next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired. Please login again.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

module.exports = auth;
```

- [ ] **Step 4: Update `backend/src/middleware/authMiddleware.js`**

This middleware does a DB lookup against the legacy `users` table — we keep that for legacy Bearer tokens but skip it when coming from auth-service (the user lives in `auth.users`, not `users`).

Replace the entire file with:
```js
const jwt = require('jsonwebtoken');
const verifyAuthServiceJwt = require('./verifyAuthServiceJwt');
const { pool } = require('../../db');

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'imms_auth';

const populateFromAuthService = (payload) => ({
  user_id:   payload.sub,
  tenant_id: payload.tenant_id || 1,
  roles:     Array.isArray(payload.roles) ? payload.roles : [],
  auth_source: 'auth-service',
  id:       payload.sub,
  username: `auth-service-user-${payload.sub}`,
  role:     (payload.roles || []).some((r) => r.endsWith('.admin')) ? 'admin' : 'user',
});

const authMiddleware = async (req, res, next) => {
  // 1) Try auth-service cookie
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken) {
    try {
      req.user = populateFromAuthService(verifyAuthServiceJwt(cookieToken));
      return next();
    } catch (_) {
      // fall through to legacy
    }
  }

  // 2) Legacy Bearer + DB lookup (unchanged behavior)
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided or invalid format.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!pool || typeof pool.query !== 'function') {
      console.error('Database pool not available in auth middleware');
      req.user = {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role || 'admin',
        auth_source: 'legacy',
      };
      return next();
    }

    try {
      const result = await pool.query(
        'SELECT user_id, username, role FROM users WHERE user_id = $1',
        [decoded.id]
      );
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid token. User not found.' });
      }
      req.user = {
        id: result.rows[0].user_id,
        username: result.rows[0].username,
        role: result.rows[0].role || 'admin',
        auth_source: 'legacy',
      };
    } catch (dbError) {
      console.error('Database error in auth middleware:', dbError);
      req.user = {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role || 'admin',
        auth_source: 'legacy',
      };
    }
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
};

module.exports = authMiddleware;
module.exports.authenticateToken = authMiddleware;
```

- [ ] **Step 5: Run IMMS tests — no regressions**

```bash
cd backend && (npm test 2>&1 | tail -8) ; cd ..
```

Expected: same pass/fail counts as Task 1's baseline. The dual-path auth doesn't break existing Bearer-token tests because the cookie branch is skipped when no cookie is present.

- [ ] **Step 6: Commit**

```bash
git add backend/src/app.js backend/src/middleware/auth.js backend/src/middleware/authMiddleware.js
git commit -m "feat(backend): accept auth-service JWT cookie alongside legacy Bearer"
```

---

## Task 9: MCS — wire cookie-parser + dual-path auth middleware

**Files:**
- Modify: `maintenance_call_system/backend/index.js`
- Modify: `maintenance_call_system/backend/src/middleware/auth.js`

- [ ] **Step 1: Wire cookie-parser in `maintenance_call_system/backend/index.js`**

Find the line `app.use(express.json());` and add immediately after:

```js
const cookieParser = require('cookie-parser');
app.use(cookieParser());
```

(Place the `require` near the other top-level requires, and the `app.use` line with the other middleware uses. Don't reformat the file.)

- [ ] **Step 2: Replace `maintenance_call_system/backend/src/middleware/auth.js`**

```js
const jwt = require('jsonwebtoken');
const { errors } = require('./errors');
const verifyAuthServiceJwt = require('./verifyAuthServiceJwt');

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'imms_auth';

const populateFromAuthService = (payload) => ({
  user_id:   payload.sub,
  tenant_id: payload.tenant_id || 1,
  roles:     Array.isArray(payload.roles) ? payload.roles : [],
  auth_source: 'auth-service',
  id:       payload.sub,
  username: `auth-service-user-${payload.sub}`,
  role:     (payload.roles || []).some((r) => r.endsWith('.admin')) ? 'admin' : 'user',
});

const auth = (req, res, next) => {
  // 1) Try auth-service cookie
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken) {
    try {
      req.user = populateFromAuthService(verifyAuthServiceJwt(cookieToken));
      return next();
    } catch (_) {
      // fall through to legacy
    }
  }

  // 2) Legacy Bearer token
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errors.unauthorized(res, 'Authentication required');
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { ...decoded, auth_source: 'legacy' };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return errors.unauthorized(res, 'Token expired. Please login again.');
    }
    return errors.unauthorized(res, 'Invalid token.');
  }
};

module.exports = auth;
```

- [ ] **Step 3: Run MCS tests — no regressions**

```bash
cd maintenance_call_system/backend && (npm test 2>&1 | tail -8) ; cd ../..
```

Expected: still 52/52 plus the 4 new from Task 7 = 56 passing.

- [ ] **Step 4: Commit**

```bash
git add maintenance_call_system/backend/index.js maintenance_call_system/backend/src/middleware/auth.js
git commit -m "feat(mcs): accept auth-service JWT cookie alongside legacy Bearer"
```

---

## Task 10: Update IMMS auth middleware tests to cover the cookie path

**Files:**
- Modify or Create: `backend/src/__tests__/auth.test.js`

The dual-path middleware needs at least one test confirming the cookie branch works. If `backend/src/__tests__/` already has an auth test, extend it. Otherwise create new.

- [ ] **Step 1: Inspect existing IMMS auth tests**

```bash
ls backend/src/__tests__/ 2>&1 | head -20
grep -l "auth" backend/src/__tests__/*.js 2>&1
```

If a test file already covers `auth.js`, extend it. Otherwise create `backend/src/__tests__/auth.test.js`.

- [ ] **Step 2: Add (or write) this test**

```js
// backend/src/__tests__/auth.test.js — auth-service cookie path
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

jest.mock('../config/authServiceKey', () => ({ publicKey }));

const auth = require('../middleware/auth');

const makeReq = (cookies = {}, headers = {}) => ({ cookies, headers });
const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('auth middleware — auth-service cookie path', () => {
  it('populates req.user from a valid auth-service cookie', (done) => {
    const token = jwt.sign({ sub: 7, tenant_id: 1, roles: ['mcs.admin'] }, privateKey, { algorithm: 'RS256', expiresIn: '5m' });
    const req = makeReq({ imms_auth: token }, {});
    auth(req, makeRes(), () => {
      expect(req.user.user_id).toBe(7);
      expect(req.user.tenant_id).toBe(1);
      expect(req.user.roles).toEqual(['mcs.admin']);
      expect(req.user.role).toBe('admin');
      expect(req.user.auth_source).toBe('auth-service');
      done();
    });
  });

  it('falls back to legacy Bearer when cookie is missing', (done) => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-legacy-secret';
    const legacy = jwt.sign({ id: 5, username: 'maria', role: 'admin' }, process.env.JWT_SECRET);
    const req = makeReq({}, { authorization: `Bearer ${legacy}` });
    auth(req, makeRes(), () => {
      expect(req.user.id).toBe(5);
      expect(req.user.auth_source).toBe('legacy');
      done();
    });
  });

  it('returns 401 when neither cookie nor Bearer is present', () => {
    const req = makeReq({}, {});
    const res = makeRes();
    auth(req, res, () => { throw new Error('next() should not be called'); });
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
```

- [ ] **Step 3: Run the new test**

```bash
cd backend && npx jest src/__tests__/auth.test.js ; cd ..
```

Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/__tests__/auth.test.js
git commit -m "test(backend): cover auth-service cookie path in auth middleware"
```

---

## Task 11: Update MCS auth middleware tests to cover the cookie path

**Files:**
- Modify: `maintenance_call_system/backend/src/middleware/auth.test.js` (file already exists from Step 1)

MCS uses Vitest with globals enabled.

- [ ] **Step 1: Read the existing test file**

```bash
cat maintenance_call_system/backend/src/middleware/auth.test.js | head -30
```

This file was set up during the MCS standalone work. Its existing tests cover the legacy Bearer path. We append cookie-path tests.

- [ ] **Step 2: Append the cookie-path tests**

Add this block to the end of the file (before the final closing `});` if the whole file is wrapped in one describe; otherwise as a new top-level describe):

```js
// --- auth-service cookie path (Step 3) ------------------------------------

describe('auth middleware — auth-service cookie path', () => {
  const crypto = require('crypto');
  const jwt = require('jsonwebtoken');

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  vi.mock('../config/authServiceKey', () => ({ publicKey }));

  // Re-require auth after the mock is in place. Vitest hoists vi.mock,
  // but the require here keeps the binding fresh.
  const auth = require('./auth');

  const makeReq = (cookies = {}, headers = {}) => ({ cookies, headers });
  const makeRes = () => {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  it('populates req.user from a valid auth-service cookie', () => new Promise((resolve) => {
    const token = jwt.sign({ sub: 7, tenant_id: 1, roles: ['mcs.admin'] }, privateKey, { algorithm: 'RS256', expiresIn: '5m' });
    const req = makeReq({ imms_auth: token }, {});
    auth(req, makeRes(), () => {
      expect(req.user.user_id).toBe(7);
      expect(req.user.tenant_id).toBe(1);
      expect(req.user.roles).toEqual(['mcs.admin']);
      expect(req.user.role).toBe('admin');
      expect(req.user.auth_source).toBe('auth-service');
      resolve();
    });
  }));

  it('returns 401 when neither cookie nor Bearer is present', () => {
    const req = makeReq({}, {});
    const res = makeRes();
    auth(req, res, () => { throw new Error('next() should not be called'); });
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
```

- [ ] **Step 3: Run**

```bash
cd maintenance_call_system/backend && npx vitest run src/middleware/auth.test.js ; cd ../..
```

Expected: previous tests still pass + 2 new pass.

- [ ] **Step 4: Commit**

```bash
git add maintenance_call_system/backend/src/middleware/auth.test.js
git commit -m "test(mcs): cover auth-service cookie path in auth middleware"
```

---

## Task 12: Update READMEs — auth status

**Files:**
- Modify: `maintenance_call_system/README.md` (skip `backend/README.md` if it doesn't exist)

- [ ] **Step 1: Append a "Step 3 status" subsection under the existing "Multi-tenancy status" section in `maintenance_call_system/README.md`**

```markdown
## Auth-service JWT support (Step 3 complete)

MCS now accepts auth-service-issued RS256 JWTs in the `imms_auth` httpOnly cookie **in addition to** the existing HS256 Bearer-token flow. Verification is local using the auth-service's public key — no per-request HTTP call to the auth-service.

**Configuration:**
- `AUTH_PUBLIC_KEY_PATH` (default: `../../../../auth-service/keys/public.pem`) — file path
- `AUTH_PUBLIC_KEY` (production preferred) — raw PEM content; takes precedence over path
- `AUTH_COOKIE_NAME` (default: `imms_auth`) — cookie name to read

**What works today:** users can log in via either path. Auth-service users land with `req.user.tenant_id` and `req.user.roles[]` populated; legacy users land with `req.user.role` (string) as before.

**What's next (Step 6 — cutover):** delete the legacy login flow, MCS's own `users` table, and HS256 paths. Until then, both work.
```

If `backend/README.md` does not exist, only edit `maintenance_call_system/README.md`. Otherwise add the equivalent block (with the IMMS-specific relative path) to it too.

- [ ] **Step 2: Commit**

```bash
git add maintenance_call_system/README.md
git commit -m "docs: auth-service JWT acceptance status (Step 3)"
```

(Add `backend/README.md` to the `git add` if it was also edited.)

---

## Task 13: Live smoke test against running auth-service

**Files:** none

This proves end-to-end that an auth-service-issued cookie unlocks IMMS and MCS routes. Optional but strongly recommended — it's the only test that exercises the full path.

- [ ] **Step 1: Start the three services** (in separate terminals, or background them)

```bash
cd auth-service && npm run dev &       # :4002
cd backend && npm run dev &            # IMMS backend, :4000 (or whatever IMMS uses)
cd maintenance_call_system/backend && npm run dev &  # MCS backend, :4001
```

- [ ] **Step 2: Log in via auth-service to get a cookie**

```bash
curl -i -c /tmp/auth.jar -H "Content-Type: application/json" \
  -d '{"email":"admin@imms","password":"changemeplease"}' \
  http://localhost:4002/auth/login
```

Expected: 200 + `Set-Cookie: imms_auth=...` in headers.

- [ ] **Step 3: Hit MCS using that cookie** (no Bearer header)

```bash
curl -i -b /tmp/auth.jar http://localhost:4001/api/v1/maintenance-calls/stats/metrics
```

Expected: 200 with JSON body (not 401). This proves the cookie path works in MCS.

- [ ] **Step 4: Hit an IMMS authenticated route**

Find any authenticated IMMS route (e.g., `/api/v1/parts`). Try with the same cookie:

```bash
curl -i -b /tmp/auth.jar http://localhost:4000/api/v1/parts
```

Expected: 200 (or whatever the endpoint normally returns for an authenticated user). Definitely NOT 401.

- [ ] **Step 5: Confirm legacy Bearer still works**

Use the IMMS / MCS legacy login endpoint to get a Bearer token, then hit the same routes with `-H "Authorization: Bearer <token>"` and no cookie jar. Expected: still 200.

- [ ] **Step 6: Stop the dev servers**

```bash
kill %1 %2 %3 2>/dev/null || true
```

If any step fails, **STOP** and report findings — don't commit anything until smoke passes.

---

## Task 14: Final verification + branch handoff

**Files:** none

- [ ] **Step 1: Re-run all test suites and confirm no regressions**

```bash
cd backend && (npm test 2>&1 | tail -8) ; cd ..
cd maintenance_call_system/backend && (npm test 2>&1 | tail -8) ; cd ../..
cd auth-service && (npm test 2>&1 | tail -8) ; cd ..
```

Expected:
- IMMS: at least Task 1's baseline + 4 new (verifier) + 3 new (auth middleware) = baseline + 7 net new passing.
- MCS: 52 baseline + 4 new (verifier) + 2 new (auth middleware) = 58 passing.
- auth-service: 29/29 (unchanged).

- [ ] **Step 2: Clean git status + commit summary**

```bash
git status
git log --oneline -15
```

Expected: clean working tree (ignore pre-existing untracked files), and ~12 new commits on this branch.

- [ ] **Step 3: Done.** Branch ready for PR.

---

## What's NOT in this plan (deferred)

- **Step 4**: MCS standalone UI changes (top nav, admin section, badges/readers/users/layouts pages).
- **Step 5**: Portal page.
- **Step 6**: **Cutover** — delete IMMS's MCS pages, delete both apps' legacy login flows, delete the legacy `users`/`user_sessions`/`login_attempts` tables, force everyone through the auth-service. This is when the dual-path becomes single-path.
- **Step 7**: Schema reorg — move MCS tables into `mcs` schema.
- **Frontend changes** — neither IMMS nor MCS frontends know about the new cookie yet. They still call their respective `/api/auth/login` endpoints. The Portal page (Step 5) is what introduces UI-level auth-service usage. This plan is backend-only.
- **Real-time / Socket.io auth** — if Socket.io requires auth, the cookie path needs separate handling. Not in scope here; bring it up if a Socket.io test breaks.
