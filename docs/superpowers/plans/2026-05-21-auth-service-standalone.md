# Auth Service Standalone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a new `auth-service` Node app that owns users, tenants, and roles; issues RS256 JWTs in an httpOnly cookie via `POST /auth/login`; and exposes `/auth/me`, `/auth/logout`, `/auth/refresh`, and `/admin/users` CRUD. No callers yet — IMMS and MCS are wired in later plans.

**Architecture:** Express + Node 18, layered (routes → services → repositories), Postgres in a new `auth` schema, RS256 JWT signed with a local keypair and verified via the public key. Mirrors the MCS backend's conventions (Zod validation middleware, pino logging with request IDs, consistent error envelope, vitest + supertest for tests).

**Tech Stack:** Express 4, pg, bcrypt, jsonwebtoken (RS256), cookie-parser, zod, pino + pino-http, helmet, cors, express-rate-limit, vitest, supertest.

**Reference:** [Design spec](../specs/2026-05-21-mcs-imms-split-saas-foundations-design.md)

---

## File Structure

Everything lives in a new top-level directory:

```
auth-service/
├── package.json                   # NEW
├── .env.example                   # NEW
├── .gitignore                     # NEW (ignores keys/, node_modules/, .env)
├── ecosystem.config.js            # NEW (PM2)
├── README.md                      # NEW (short)
├── index.js                       # NEW — process entry: load env, start server
├── migrations/
│   └── 20260521000000_create_auth_schema.sql   # NEW
├── scripts/
│   ├── generate-keys.js           # NEW — writes keys/private.pem + keys/public.pem
│   └── seed.js                    # NEW — Fiserv tenant + admin user
├── keys/                          # NEW (gitignored)
└── src/
    ├── app.js                     # NEW — builds the express app (factored out for tests)
    ├── config/
    │   ├── database.js            # NEW — pg pool config
    │   └── keys.js                # NEW — loads RS256 PEM keys
    ├── database/
    │   └── index.js               # NEW — exports pg pool
    ├── lib/
    │   ├── logger.js              # NEW — pino logger
    │   ├── password.js            # NEW — bcrypt hash/verify
    │   ├── jwt.js                 # NEW — sign/verify RS256 token
    │   └── errors.js              # NEW — DomainError class + helpers
    ├── middleware/
    │   ├── validate.js            # NEW — zod validate (copy of MCS pattern)
    │   ├── auth.js                # NEW — verify JWT from cookie, attach req.user
    │   ├── requireRole.js         # NEW — role gate
    │   └── errorHandler.js        # NEW — central error handler
    ├── repositories/
    │   ├── tenantsRepo.js         # NEW
    │   ├── usersRepo.js           # NEW
    │   └── rolesRepo.js           # NEW
    ├── routes/
    │   ├── auth.js                # NEW — /auth/* endpoints
    │   └── adminUsers.js          # NEW — /admin/users CRUD
    ├── schemas/
    │   ├── auth.js                # NEW — zod schemas for /auth/*
    │   └── adminUsers.js          # NEW — zod schemas for /admin/users
    ├── services/
    │   ├── authService.js         # NEW — login, me, refresh, logout logic
    │   └── usersService.js        # NEW — admin user CRUD
    └── test/
        ├── setup.js               # NEW — vitest setup; ensures test DB schema
        └── helpers.js             # NEW — supertest agent, seed helpers
```

**Each file's one responsibility:**

- `index.js` — process bootstrap only (env loading, listen)
- `src/app.js` — builds and returns the configured Express app (consumed by both `index.js` and tests)
- `lib/*` — pure utilities, no Express knowledge
- `middleware/*` — Express-aware, thin
- `repositories/*` — SQL only, no business rules
- `services/*` — business logic, takes a `db` and a payload, throws `DomainError` on failure
- `routes/*` — HTTP shape only, ≤10 lines per handler

---

## Conventions (match MCS)

- **Error envelope:** `{ error: <code>, message: <human>, details?: any }` with codes `validation_error | bad_request | unauthorized | forbidden | not_found | conflict | server_error`. Success responses are raw resources.
- **Routes are thin.** Validate at boundary with `validate({ body: schema })`, call a service, return its result. No business logic in routes.
- **Services throw `DomainError`.** The central error handler translates to HTTP.
- **`req.log`** is the request-scoped pino logger. Use it, not the root logger, inside handlers.
- **TDD.** Every public function gets a failing test first.
- **One logical change per commit.** Each task ends in a commit.

---

## Task 1: Scaffold the project

**Files:**
- Create: `auth-service/package.json`
- Create: `auth-service/.env.example`
- Create: `auth-service/.gitignore`
- Create: `auth-service/README.md`

- [ ] **Step 1: Create the directory and package.json**

Run from repo root:
```bash
mkdir -p auth-service/src/{config,database,lib,middleware,repositories,routes,schemas,services,test} auth-service/migrations auth-service/scripts auth-service/keys
```

Create `auth-service/package.json`:
```json
{
  "name": "auth-service",
  "version": "1.0.0",
  "description": "Shared identity service for IMMS and MCS",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "migrate": "psql \"$DATABASE_URL\" -f migrations/20260521000000_create_auth_schema.sql",
    "keys": "node scripts/generate-keys.js",
    "seed": "node scripts/seed.js"
  },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "express-rate-limit": "^7.5.0",
    "helmet": "^8.0.0",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.13.3",
    "pino": "^10.3.1",
    "pino-http": "^11.0.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@vitest/coverage-v8": "^2.1.9",
    "nodemon": "^3.1.9",
    "pino-pretty": "^13.1.3",
    "supertest": "^7.2.2",
    "vitest": "^2.1.9"
  },
  "engines": { "node": ">=18.0.0" }
}
```

Create `auth-service/.env.example`:
```
# ─── Server ─────────────────────────────────────────────────────────────────
PORT=4002
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:3003

# ─── Cookies ───────────────────────────────────────────────────────────────
# Parent domain for the auth cookie. Leave unset for localhost dev.
# In production: .fiserv.local (or your real parent domain).
# COOKIE_DOMAIN=.fiserv.local
COOKIE_NAME=fiserv_auth
COOKIE_SECURE=false   # set true in production (HTTPS)
TOKEN_TTL_SECONDS=86400

# ─── Keys ───────────────────────────────────────────────────────────────────
# Paths to RS256 keypair. Generate with `npm run keys`.
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem

# ─── Database ───────────────────────────────────────────────────────────────
# DATABASE_URL=postgres://user:password@host:5432/dbname
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fiservinventory
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false
DB_SSL_INSECURE=false

# ─── Logging ────────────────────────────────────────────────────────────────
# LOG_LEVEL=info
```

Create `auth-service/.gitignore`:
```
node_modules/
.env
keys/*.pem
coverage/
logs/
```

Create `auth-service/README.md` (one paragraph + run instructions):
```markdown
# auth-service

Shared identity service for IMMS and MCS. Owns `auth.tenants`, `auth.users`, `auth.roles`. Issues RS256 JWTs in an httpOnly cookie via `POST /auth/login`. See `docs/superpowers/specs/2026-05-21-mcs-imms-split-saas-foundations-design.md`.

## First-time setup

```bash
cp .env.example .env       # edit DB_*, COOKIE_DOMAIN
npm install
npm run keys               # generate RS256 keypair into ./keys
npm run migrate            # apply auth schema to the database
npm run seed               # create Fiserv tenant + admin@fiserv user
npm run dev                # http://localhost:4002
```

## Verify

```bash
curl http://localhost:4002/health
# {"status":"healthy","service":"auth"}
```
```

- [ ] **Step 2: Commit**

```bash
git add auth-service/package.json auth-service/.env.example auth-service/.gitignore auth-service/README.md
git commit -m "feat(auth-service): scaffold project"
```

---

## Task 2: Database migration — auth schema

**Files:**
- Create: `auth-service/migrations/20260521000000_create_auth_schema.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260521000000_create_auth_schema.sql
-- Creates the auth schema and its four tables. Idempotent.

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.tenants (
  tenant_id    SERIAL PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'suspended')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.users (
  user_id       SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL REFERENCES auth.tenants(tenant_id),
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'disabled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS users_tenant_email_idx
  ON auth.users (tenant_id, email);

CREATE TABLE IF NOT EXISTS auth.roles (
  role_id     SERIAL PRIMARY KEY,
  key         TEXT UNIQUE NOT NULL,
  app         TEXT NOT NULL CHECK (app IN ('imms', 'mcs', 'portal')),
  description TEXT
);

CREATE TABLE IF NOT EXISTS auth.user_roles (
  user_id INT NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
  role_id INT NOT NULL REFERENCES auth.roles(role_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Seed roles (the matrix from the spec).
INSERT INTO auth.roles (key, app, description) VALUES
  ('imms.viewer', 'imms', 'Read-only access to IMMS'),
  ('imms.user',   'imms', 'Standard IMMS user'),
  ('imms.admin',  'imms', 'IMMS administrator'),
  ('mcs.viewer',  'mcs',  'Read board, calls, analytics'),
  ('mcs.tech',    'mcs',  'Technician: resolve/suspend calls'),
  ('mcs.admin',   'mcs',  'MCS administrator')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Apply against a local Postgres**

```bash
cd auth-service
# from a shell where DATABASE_URL is set, or use the DB_* env vars:
psql "postgres://postgres:postgres@localhost:5432/fiservinventory" -f migrations/20260521000000_create_auth_schema.sql
```

Expected: prints `CREATE SCHEMA`, `CREATE TABLE` (×4), `CREATE INDEX`, `INSERT 0 6`. Re-running prints `0` inserts (idempotent).

- [ ] **Step 3: Verify with psql**

```bash
psql "postgres://postgres:postgres@localhost:5432/fiservinventory" -c "SELECT key, app FROM auth.roles ORDER BY key;"
```

Expected: six rows (`imms.admin`, `imms.user`, `imms.viewer`, `mcs.admin`, `mcs.tech`, `mcs.viewer`).

- [ ] **Step 4: Commit**

```bash
git add auth-service/migrations/20260521000000_create_auth_schema.sql
git commit -m "feat(auth-service): create auth schema with seed roles"
```

---

## Task 3: RS256 key generation script

**Files:**
- Create: `auth-service/scripts/generate-keys.js`

- [ ] **Step 1: Write the script**

```js
// scripts/generate-keys.js
// Generates a 2048-bit RSA keypair into ./keys/{private,public}.pem.
// Refuses to overwrite existing keys (rotate intentionally).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const keysDir = path.join(__dirname, '..', 'keys');
const privatePath = path.join(keysDir, 'private.pem');
const publicPath = path.join(keysDir, 'public.pem');

if (fs.existsSync(privatePath) || fs.existsSync(publicPath)) {
  console.error('Keys already exist. Delete keys/*.pem first to rotate.');
  process.exit(1);
}

fs.mkdirSync(keysDir, { recursive: true });

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

fs.writeFileSync(privatePath, privateKey, { mode: 0o600 });
fs.writeFileSync(publicPath,  publicKey,  { mode: 0o644 });

console.log(`Wrote ${privatePath}`);
console.log(`Wrote ${publicPath}`);
```

- [ ] **Step 2: Run it and verify**

```bash
cd auth-service
npm install        # install deps if not yet
npm run keys
ls keys/
```

Expected output:
```
private.pem
public.pem
```

- [ ] **Step 3: Commit (the script, NOT the keys)**

Confirm `.gitignore` is excluding `keys/*.pem`:
```bash
git status auth-service/keys/
# Expected: no output (ignored)
```

```bash
git add auth-service/scripts/generate-keys.js
git commit -m "feat(auth-service): add RS256 keypair generator"
```

---

## Task 4: Database config + pg pool

**Files:**
- Create: `auth-service/src/config/database.js`
- Create: `auth-service/src/database/index.js`

- [ ] **Step 1: Write `src/config/database.js`** (copy of MCS pattern)

```js
// src/config/database.js
require('dotenv').config();

module.exports = {
  development: {
    user:     process.env.DB_USER     || 'postgres',
    host:     process.env.DB_HOST     || 'localhost',
    database: process.env.DB_NAME     || 'fiservinventory',
    password: process.env.DB_PASSWORD || 'postgres',
    port:     parseInt(process.env.DB_PORT || '5432', 10),
  },
  production: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL
      ? { rejectUnauthorized: process.env.DB_SSL_INSECURE !== 'true' }
      : false,
  },
  test: {
    user:     process.env.DB_USER     || 'postgres',
    host:     process.env.DB_HOST     || 'localhost',
    database: process.env.DB_NAME     || 'fiservinventory',
    password: process.env.DB_PASSWORD || 'postgres',
    port:     parseInt(process.env.DB_PORT || '5432', 10),
  },
};
```

- [ ] **Step 2: Write `src/database/index.js`**

```js
// src/database/index.js
const { Pool } = require('pg');
const configs = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const pool = new Pool(configs[env] || configs.development);

pool.on('error', (err) => {
  // The root logger isn't imported here to avoid a cycle; print to stderr.
  // The error middleware catches per-request errors separately.
  // eslint-disable-next-line no-console
  console.error('Unexpected pg pool error:', err);
});

module.exports = { pool, query: (text, params) => pool.query(text, params) };
```

- [ ] **Step 3: Commit**

```bash
git add auth-service/src/config/database.js auth-service/src/database/index.js
git commit -m "feat(auth-service): add pg pool"
```

---

## Task 5: Logger

**Files:**
- Create: `auth-service/src/lib/logger.js`

- [ ] **Step 1: Write the logger**

```js
// src/lib/logger.js
const pino = require('pino');

const env = process.env.NODE_ENV || 'development';
const level = process.env.LOG_LEVEL
  || (env === 'production' ? 'info' : env === 'test' ? 'silent' : 'debug');

const transport = env === 'development'
  ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
  : undefined;

const logger = pino({
  level,
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.password_hash', '*.token'],
  ...(transport ? { transport } : {}),
});

module.exports = logger;
```

- [ ] **Step 2: Commit**

```bash
git add auth-service/src/lib/logger.js
git commit -m "feat(auth-service): add pino logger with secret redaction"
```

---

## Task 6: Errors lib (TDD)

**Files:**
- Create: `auth-service/src/lib/errors.js`
- Create: `auth-service/src/lib/errors.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/errors.test.js
const { describe, it, expect } = require('vitest');
const { DomainError } = require('./errors');

describe('DomainError', () => {
  it('captures code, message, status, and optional details', () => {
    const err = new DomainError('unauthorized', 'Bad creds', 401, { hint: 'try again' });
    expect(err.code).toBe('unauthorized');
    expect(err.message).toBe('Bad creds');
    expect(err.status).toBe(401);
    expect(err.details).toEqual({ hint: 'try again' });
    expect(err instanceof Error).toBe(true);
  });

  it('defaults details to undefined', () => {
    const err = new DomainError('not_found', 'Missing', 404);
    expect(err.details).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
cd auth-service
npx vitest run src/lib/errors.test.js
```

Expected: FAIL — `Cannot find module './errors'`.

- [ ] **Step 3: Write the implementation**

```js
// src/lib/errors.js
class DomainError extends Error {
  constructor(code, message, status, details) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

module.exports = { DomainError };
```

- [ ] **Step 4: Run test, expect pass**

```bash
npx vitest run src/lib/errors.test.js
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add auth-service/src/lib/errors.js auth-service/src/lib/errors.test.js
git commit -m "feat(auth-service): add DomainError class"
```

---

## Task 7: Password lib (TDD)

**Files:**
- Create: `auth-service/src/lib/password.js`
- Create: `auth-service/src/lib/password.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/password.test.js
const { describe, it, expect } = require('vitest');
const { hash, verify } = require('./password');

describe('password', () => {
  it('hash() returns a non-empty string different from the input', async () => {
    const h = await hash('hunter2');
    expect(typeof h).toBe('string');
    expect(h.length).toBeGreaterThan(20);
    expect(h).not.toBe('hunter2');
  });

  it('verify() returns true for the correct password', async () => {
    const h = await hash('hunter2');
    expect(await verify('hunter2', h)).toBe(true);
  });

  it('verify() returns false for the wrong password', async () => {
    const h = await hash('hunter2');
    expect(await verify('wrong', h)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/lib/password.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// src/lib/password.js
const bcrypt = require('bcrypt');

const ROUNDS = 12;

const hash = (plaintext) => bcrypt.hash(plaintext, ROUNDS);
const verify = (plaintext, hashed) => bcrypt.compare(plaintext, hashed);

module.exports = { hash, verify };
```

- [ ] **Step 4: Run, expect pass**

```bash
npx vitest run src/lib/password.test.js
```

Expected: PASS (3 tests). May take a few seconds — bcrypt is intentionally slow.

- [ ] **Step 5: Commit**

```bash
git add auth-service/src/lib/password.js auth-service/src/lib/password.test.js
git commit -m "feat(auth-service): add bcrypt password helper"
```

---

## Task 8: Keys loader

**Files:**
- Create: `auth-service/src/config/keys.js`

- [ ] **Step 1: Write the loader**

```js
// src/config/keys.js
// Loads the RS256 keypair from disk once at startup. Throws if either is missing.

const fs = require('fs');
const path = require('path');

const resolve = (envVar, fallback) =>
  path.isAbsolute(process.env[envVar] || '')
    ? process.env[envVar]
    : path.join(process.cwd(), process.env[envVar] || fallback);

const privatePath = resolve('JWT_PRIVATE_KEY_PATH', './keys/private.pem');
const publicPath  = resolve('JWT_PUBLIC_KEY_PATH',  './keys/public.pem');

const readOrThrow = (p, kind) => {
  if (!fs.existsSync(p)) {
    throw new Error(`Missing ${kind} key at ${p}. Run \`npm run keys\` first.`);
  }
  return fs.readFileSync(p, 'utf8');
};

module.exports = {
  privateKey: readOrThrow(privatePath, 'private'),
  publicKey:  readOrThrow(publicPath,  'public'),
};
```

- [ ] **Step 2: Commit**

```bash
git add auth-service/src/config/keys.js
git commit -m "feat(auth-service): add RS256 key loader"
```

---

## Task 9: JWT lib (TDD)

**Files:**
- Create: `auth-service/src/lib/jwt.js`
- Create: `auth-service/src/lib/jwt.test.js`

- [ ] **Step 1: Write the failing test**

The test uses keys generated for the test run. Place a tiny helper in the test file itself — we don't want a real key on disk for unit tests.

```js
// src/lib/jwt.test.js
const { describe, it, expect, beforeAll, vi } = require('vitest');
const crypto = require('crypto');

// Generate an in-memory keypair and stub the config/keys module BEFORE require.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

vi.mock('../config/keys', () => ({ privateKey, publicKey }));

const { sign, verify } = require('./jwt');

describe('jwt', () => {
  it('signs and verifies a token round-trip', () => {
    const token = sign({ sub: 1, tenant_id: 1, roles: ['mcs.admin'] });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const payload = verify(token);
    expect(payload.sub).toBe(1);
    expect(payload.tenant_id).toBe(1);
    expect(payload.roles).toEqual(['mcs.admin']);
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('verify() throws on a tampered token', () => {
    const token = sign({ sub: 1, tenant_id: 1, roles: [] });
    const [h, p, s] = token.split('.');
    const tampered = `${h}.${p}.${s.slice(0, -2)}xx`;
    expect(() => verify(tampered)).toThrow();
  });

  it('verify() throws on a token signed by a different key', () => {
    const { privateKey: otherKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding:  { type: 'spki',  format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const jwt = require('jsonwebtoken');
    const evil = jwt.sign({ sub: 9 }, otherKey, { algorithm: 'RS256' });
    expect(() => verify(evil)).toThrow();
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/lib/jwt.test.js
```

Expected: FAIL — `Cannot find module './jwt'`.

- [ ] **Step 3: Implement**

```js
// src/lib/jwt.js
const jwt = require('jsonwebtoken');
const { privateKey, publicKey } = require('../config/keys');

const TTL_SECONDS = parseInt(process.env.TOKEN_TTL_SECONDS || '86400', 10);

const sign = (payload) =>
  jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: TTL_SECONDS });

const verify = (token) =>
  jwt.verify(token, publicKey, { algorithms: ['RS256'] });

module.exports = { sign, verify, TTL_SECONDS };
```

- [ ] **Step 4: Run, expect pass**

```bash
npx vitest run src/lib/jwt.test.js
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add auth-service/src/lib/jwt.js auth-service/src/lib/jwt.test.js
git commit -m "feat(auth-service): add RS256 sign/verify"
```

---

## Task 10: Validate middleware

**Files:**
- Create: `auth-service/src/middleware/validate.js`

- [ ] **Step 1: Write (copy of MCS pattern)**

```js
// src/middleware/validate.js
const validate = (schemas) => (req, res, next) => {
  for (const key of ['body', 'query', 'params']) {
    const schema = schemas[key];
    if (!schema) continue;
    const result = schema.safeParse(req[key]);
    if (!result.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: `Invalid request ${key}`,
        details: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    req[key] = result.data;
  }
  return next();
};

module.exports = validate;
```

- [ ] **Step 2: Commit**

```bash
git add auth-service/src/middleware/validate.js
git commit -m "feat(auth-service): add zod validate middleware"
```

---

## Task 11: Error handler middleware

**Files:**
- Create: `auth-service/src/middleware/errorHandler.js`

- [ ] **Step 1: Write the handler**

```js
// src/middleware/errorHandler.js
const logger = require('../lib/logger');
const { DomainError } = require('../lib/errors');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof DomainError) {
    (req.log || logger).warn({ err: { code: err.code, message: err.message } }, 'DomainError');
    const body = { error: err.code, message: err.message };
    if (err.details !== undefined) body.details = err.details;
    return res.status(err.status).json(body);
  }

  (req.log || logger).error({ err }, 'Unhandled error');
  const isDev = process.env.NODE_ENV !== 'production';
  const body = { error: 'server_error', message: 'Internal server error' };
  if (isDev) body.details = err.message;
  return res.status(500).json(body);
};

module.exports = errorHandler;
```

- [ ] **Step 2: Commit**

```bash
git add auth-service/src/middleware/errorHandler.js
git commit -m "feat(auth-service): add error handler"
```

---

## Task 12: Auth middleware (verify cookie → req.user)

**Files:**
- Create: `auth-service/src/middleware/auth.js`

- [ ] **Step 1: Write the middleware**

```js
// src/middleware/auth.js
const { verify } = require('../lib/jwt');
const { DomainError } = require('../lib/errors');

const COOKIE_NAME = process.env.COOKIE_NAME || 'fiserv_auth';

const requireAuth = (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next(new DomainError('unauthorized', 'Authentication required', 401));
  try {
    const payload = verify(token);
    req.user = {
      user_id:   payload.sub,
      tenant_id: payload.tenant_id,
      roles:     payload.roles || [],
    };
    return next();
  } catch (err) {
    return next(new DomainError('unauthorized', 'Invalid or expired token', 401));
  }
};

module.exports = { requireAuth, COOKIE_NAME };
```

- [ ] **Step 2: Commit**

```bash
git add auth-service/src/middleware/auth.js
git commit -m "feat(auth-service): add requireAuth middleware"
```

---

## Task 13: requireRole middleware

**Files:**
- Create: `auth-service/src/middleware/requireRole.js`

- [ ] **Step 1: Write**

```js
// src/middleware/requireRole.js
const { DomainError } = require('../lib/errors');

// Usage: router.get('/admin/users', requireAuth, requireRole('imms.admin', 'mcs.admin'), handler)
// Passes if req.user.roles contains ANY of the listed roles.
const requireRole = (...allowed) => (req, res, next) => {
  const roles = req.user?.roles || [];
  if (roles.some((r) => allowed.includes(r))) return next();
  return next(new DomainError('forbidden', 'Insufficient role', 403));
};

module.exports = requireRole;
```

- [ ] **Step 2: Commit**

```bash
git add auth-service/src/middleware/requireRole.js
git commit -m "feat(auth-service): add requireRole middleware"
```

---

## Task 14: tenantsRepo

**Files:**
- Create: `auth-service/src/repositories/tenantsRepo.js`

- [ ] **Step 1: Write**

```js
// src/repositories/tenantsRepo.js
const findById = async (db, tenantId) => {
  const { rows } = await db.query(
    `SELECT tenant_id, slug, display_name, status, created_at
       FROM auth.tenants WHERE tenant_id = $1`,
    [tenantId]
  );
  return rows[0] || null;
};

const findBySlug = async (db, slug) => {
  const { rows } = await db.query(
    `SELECT tenant_id, slug, display_name, status, created_at
       FROM auth.tenants WHERE slug = $1`,
    [slug]
  );
  return rows[0] || null;
};

const insert = async (db, { slug, display_name }) => {
  const { rows } = await db.query(
    `INSERT INTO auth.tenants (slug, display_name) VALUES ($1, $2)
     RETURNING tenant_id, slug, display_name, status, created_at`,
    [slug, display_name]
  );
  return rows[0];
};

module.exports = { findById, findBySlug, insert };
```

- [ ] **Step 2: Commit**

```bash
git add auth-service/src/repositories/tenantsRepo.js
git commit -m "feat(auth-service): add tenantsRepo"
```

---

## Task 15: usersRepo

**Files:**
- Create: `auth-service/src/repositories/usersRepo.js`

- [ ] **Step 1: Write**

```js
// src/repositories/usersRepo.js
// All reads/writes are tenant-scoped — callers must pass tenantId.

const baseColumns = `user_id, tenant_id, email, display_name, status, created_at`;

const findByEmail = async (db, tenantId, email) => {
  const { rows } = await db.query(
    `SELECT ${baseColumns}, password_hash
       FROM auth.users
      WHERE tenant_id = $1 AND lower(email) = lower($2)`,
    [tenantId, email]
  );
  return rows[0] || null;
};

const findById = async (db, tenantId, userId) => {
  const { rows } = await db.query(
    `SELECT ${baseColumns}
       FROM auth.users
      WHERE tenant_id = $1 AND user_id = $2`,
    [tenantId, userId]
  );
  return rows[0] || null;
};

const list = async (db, tenantId) => {
  const { rows } = await db.query(
    `SELECT ${baseColumns}
       FROM auth.users
      WHERE tenant_id = $1
      ORDER BY user_id ASC`,
    [tenantId]
  );
  return rows;
};

const insert = async (db, { tenant_id, email, password_hash, display_name }) => {
  const { rows } = await db.query(
    `INSERT INTO auth.users (tenant_id, email, password_hash, display_name)
     VALUES ($1, $2, $3, $4)
     RETURNING ${baseColumns}`,
    [tenant_id, email, password_hash, display_name]
  );
  return rows[0];
};

const updateStatus = async (db, tenantId, userId, status) => {
  const { rows } = await db.query(
    `UPDATE auth.users SET status = $1
      WHERE tenant_id = $2 AND user_id = $3
      RETURNING ${baseColumns}`,
    [status, tenantId, userId]
  );
  return rows[0] || null;
};

const updatePassword = async (db, tenantId, userId, password_hash) => {
  const { rowCount } = await db.query(
    `UPDATE auth.users SET password_hash = $1
      WHERE tenant_id = $2 AND user_id = $3`,
    [password_hash, tenantId, userId]
  );
  return rowCount === 1;
};

module.exports = { findByEmail, findById, list, insert, updateStatus, updatePassword };
```

- [ ] **Step 2: Commit**

```bash
git add auth-service/src/repositories/usersRepo.js
git commit -m "feat(auth-service): add usersRepo (tenant-scoped)"
```

---

## Task 16: rolesRepo

**Files:**
- Create: `auth-service/src/repositories/rolesRepo.js`

- [ ] **Step 1: Write**

```js
// src/repositories/rolesRepo.js

const findKeysForUser = async (db, userId) => {
  const { rows } = await db.query(
    `SELECT r.key
       FROM auth.user_roles ur
       JOIN auth.roles r ON r.role_id = ur.role_id
      WHERE ur.user_id = $1`,
    [userId]
  );
  return rows.map((r) => r.key);
};

const findIdsByKeys = async (db, keys) => {
  if (!keys.length) return [];
  const { rows } = await db.query(
    `SELECT role_id, key FROM auth.roles WHERE key = ANY($1)`,
    [keys]
  );
  return rows;
};

const setRolesForUser = async (db, userId, roleKeys) => {
  await db.query(`DELETE FROM auth.user_roles WHERE user_id = $1`, [userId]);
  if (!roleKeys.length) return [];
  const roles = await findIdsByKeys(db, roleKeys);
  for (const r of roles) {
    await db.query(
      `INSERT INTO auth.user_roles (user_id, role_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, r.role_id]
    );
  }
  return roles.map((r) => r.key);
};

module.exports = { findKeysForUser, findIdsByKeys, setRolesForUser };
```

- [ ] **Step 2: Commit**

```bash
git add auth-service/src/repositories/rolesRepo.js
git commit -m "feat(auth-service): add rolesRepo"
```

---

## Task 17: Auth schemas (zod)

**Files:**
- Create: `auth-service/src/schemas/auth.js`

- [ ] **Step 1: Write**

```js
// src/schemas/auth.js
const { z } = require('zod');

const loginSchema = z.object({
  email:    z.string().email().max(254),
  password: z.string().min(1).max(200),
  tenant_slug: z.string().min(1).max(64).optional(), // defaults to 'fiserv' if absent
});

module.exports = { loginSchema };
```

- [ ] **Step 2: Commit**

```bash
git add auth-service/src/schemas/auth.js
git commit -m "feat(auth-service): add login zod schema"
```

---

## Task 18: authService (TDD)

**Files:**
- Create: `auth-service/src/services/authService.js`
- Create: `auth-service/src/services/authService.test.js`

This service has the core business logic. Test with a mocked `db` object — no real Postgres needed.

- [ ] **Step 1: Write the failing tests**

```js
// src/services/authService.test.js
const { describe, it, expect, vi, beforeEach } = require('vitest');
const crypto = require('crypto');

// Stub keys before requiring anything that pulls jwt.js.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
vi.mock('../config/keys', () => ({ privateKey, publicKey }));

const password = require('../lib/password');
const { DomainError } = require('../lib/errors');
const authService = require('./authService');

const FIXED_USER = {
  user_id: 42,
  tenant_id: 1,
  email: 'maria@fiserv',
  password_hash: '<replaced-in-beforeEach>',
  display_name: 'Maria',
  status: 'active',
};

const makeDb = (overrides = {}) => ({
  query: vi.fn(),
  ...overrides,
});

vi.mock('../repositories/usersRepo', () => ({
  findByEmail: vi.fn(),
  findById:    vi.fn(),
}));
vi.mock('../repositories/rolesRepo', () => ({
  findKeysForUser: vi.fn(),
}));
vi.mock('../repositories/tenantsRepo', () => ({
  findBySlug: vi.fn(),
}));

const usersRepo   = require('../repositories/usersRepo');
const rolesRepo   = require('../repositories/rolesRepo');
const tenantsRepo = require('../repositories/tenantsRepo');

describe('authService.login', () => {
  beforeEach(async () => {
    FIXED_USER.password_hash = await password.hash('hunter2');
    vi.clearAllMocks();
    tenantsRepo.findBySlug.mockResolvedValue({ tenant_id: 1, slug: 'fiserv', status: 'active' });
    usersRepo.findByEmail.mockResolvedValue(FIXED_USER);
    rolesRepo.findKeysForUser.mockResolvedValue(['mcs.admin']);
  });

  it('returns a JWT and user shape on correct credentials', async () => {
    const db = makeDb();
    const result = await authService.login(db, { email: 'maria@fiserv', password: 'hunter2', tenant_slug: 'fiserv' });
    expect(result.token).toBeTypeOf('string');
    expect(result.user).toMatchObject({
      user_id: 42,
      tenant_id: 1,
      email: 'maria@fiserv',
      display_name: 'Maria',
      roles: ['mcs.admin'],
    });
    expect(result.user.password_hash).toBeUndefined();
  });

  it('throws unauthorized on wrong password', async () => {
    const db = makeDb();
    await expect(
      authService.login(db, { email: 'maria@fiserv', password: 'wrong', tenant_slug: 'fiserv' })
    ).rejects.toThrow(DomainError);
  });

  it('throws unauthorized on unknown email (no user enumeration)', async () => {
    usersRepo.findByEmail.mockResolvedValue(null);
    const db = makeDb();
    await expect(
      authService.login(db, { email: 'ghost@fiserv', password: 'whatever', tenant_slug: 'fiserv' })
    ).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('throws unauthorized when tenant is missing or suspended', async () => {
    tenantsRepo.findBySlug.mockResolvedValue({ tenant_id: 1, slug: 'fiserv', status: 'suspended' });
    const db = makeDb();
    await expect(
      authService.login(db, { email: 'maria@fiserv', password: 'hunter2', tenant_slug: 'fiserv' })
    ).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('throws unauthorized when user status is disabled', async () => {
    usersRepo.findByEmail.mockResolvedValue({ ...FIXED_USER, status: 'disabled' });
    const db = makeDb();
    await expect(
      authService.login(db, { email: 'maria@fiserv', password: 'hunter2', tenant_slug: 'fiserv' })
    ).rejects.toMatchObject({ code: 'unauthorized' });
  });
});

describe('authService.me', () => {
  it('returns the current user without password_hash', async () => {
    usersRepo.findById.mockResolvedValue({ ...FIXED_USER });
    rolesRepo.findKeysForUser.mockResolvedValue(['mcs.tech']);
    const db = makeDb();
    const out = await authService.me(db, { user_id: 42, tenant_id: 1 });
    expect(out).toMatchObject({ user_id: 42, email: 'maria@fiserv', roles: ['mcs.tech'] });
    expect(out.password_hash).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/services/authService.test.js
```

Expected: FAIL — `./authService` does not exist.

- [ ] **Step 3: Implement**

```js
// src/services/authService.js
const password = require('../lib/password');
const { sign } = require('../lib/jwt');
const { DomainError } = require('../lib/errors');
const usersRepo = require('../repositories/usersRepo');
const rolesRepo = require('../repositories/rolesRepo');
const tenantsRepo = require('../repositories/tenantsRepo');

const DEFAULT_TENANT_SLUG = 'fiserv';

const stripSecrets = (user, roles) => {
  const { password_hash, ...safe } = user;
  return { ...safe, roles };
};

const login = async (db, { email, password: plaintext, tenant_slug }) => {
  // Resolve tenant. Fail with the same generic error on every bad-path to
  // avoid leaking which dimension was wrong (no user enumeration).
  const slug = tenant_slug || DEFAULT_TENANT_SLUG;
  const tenant = await tenantsRepo.findBySlug(db, slug);
  if (!tenant || tenant.status !== 'active') {
    throw new DomainError('unauthorized', 'Invalid credentials', 401);
  }

  const user = await usersRepo.findByEmail(db, tenant.tenant_id, email);
  if (!user || user.status !== 'active') {
    throw new DomainError('unauthorized', 'Invalid credentials', 401);
  }

  const ok = await password.verify(plaintext, user.password_hash);
  if (!ok) {
    throw new DomainError('unauthorized', 'Invalid credentials', 401);
  }

  const roles = await rolesRepo.findKeysForUser(db, user.user_id);
  const token = sign({ sub: user.user_id, tenant_id: user.tenant_id, roles });
  return { token, user: stripSecrets(user, roles) };
};

const me = async (db, { user_id, tenant_id }) => {
  const user = await usersRepo.findById(db, tenant_id, user_id);
  if (!user) throw new DomainError('unauthorized', 'User not found', 401);
  const roles = await rolesRepo.findKeysForUser(db, user.user_id);
  return stripSecrets(user, roles);
};

// Refresh re-issues a token for the current user, picking up any role changes.
const refresh = async (db, { user_id, tenant_id }) => {
  const user = await me(db, { user_id, tenant_id });
  if (user.status !== 'active') {
    throw new DomainError('unauthorized', 'User disabled', 401);
  }
  const token = sign({ sub: user.user_id, tenant_id: user.tenant_id, roles: user.roles });
  return { token, user };
};

module.exports = { login, me, refresh };
```

- [ ] **Step 4: Run, expect pass**

```bash
npx vitest run src/services/authService.test.js
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add auth-service/src/services/authService.js auth-service/src/services/authService.test.js
git commit -m "feat(auth-service): authService (login, me, refresh)"
```

---

## Task 19: Auth routes

**Files:**
- Create: `auth-service/src/routes/auth.js`

- [ ] **Step 1: Write the routes**

```js
// src/routes/auth.js
const express = require('express');
const validate = require('../middleware/validate');
const { requireAuth, COOKIE_NAME } = require('../middleware/auth');
const { loginSchema } = require('../schemas/auth');
const authService = require('../services/authService');
const { TTL_SECONDS } = require('../lib/jwt');
const db = require('../database');

const router = express.Router();

const cookieOpts = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure:   process.env.COOKIE_SECURE === 'true',
  domain:   process.env.COOKIE_DOMAIN || undefined,
  maxAge:   TTL_SECONDS * 1000,
  path:     '/',
});

const handler = (fn) => async (req, res, next) => {
  try { await fn(req, res, next); } catch (err) { next(err); }
};

router.post('/login', validate({ body: loginSchema }), handler(async (req, res) => {
  const { token, user } = await authService.login(db, req.body);
  res.cookie(COOKIE_NAME, token, cookieOpts());
  res.json({ user });
}));

router.post('/logout', handler(async (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOpts(), maxAge: undefined });
  res.json({ ok: true });
}));

router.get('/me', requireAuth, handler(async (req, res) => {
  const user = await authService.me(db, req.user);
  res.json({ user });
}));

router.post('/refresh', requireAuth, handler(async (req, res) => {
  const { token, user } = await authService.refresh(db, req.user);
  res.cookie(COOKIE_NAME, token, cookieOpts());
  res.json({ user });
}));

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add auth-service/src/routes/auth.js
git commit -m "feat(auth-service): /auth routes (login, logout, me, refresh)"
```

---

## Task 20: Admin users schemas

**Files:**
- Create: `auth-service/src/schemas/adminUsers.js`

- [ ] **Step 1: Write**

```js
// src/schemas/adminUsers.js
const { z } = require('zod');

const ROLE_KEYS = [
  'imms.viewer', 'imms.user', 'imms.admin',
  'mcs.viewer', 'mcs.tech', 'mcs.admin',
];

const createUserSchema = z.object({
  email:        z.string().email().max(254),
  display_name: z.string().min(1).max(120),
  password:     z.string().min(8).max(200),
  roles:        z.array(z.enum(ROLE_KEYS)).default([]),
});

const updateUserSchema = z.object({
  display_name: z.string().min(1).max(120).optional(),
  status:       z.enum(['active', 'disabled']).optional(),
  roles:        z.array(z.enum(ROLE_KEYS)).optional(),
  password:     z.string().min(8).max(200).optional(),
});

const idParamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

module.exports = { createUserSchema, updateUserSchema, idParamsSchema, ROLE_KEYS };
```

- [ ] **Step 2: Commit**

```bash
git add auth-service/src/schemas/adminUsers.js
git commit -m "feat(auth-service): admin users zod schemas"
```

---

## Task 21: usersService (TDD)

**Files:**
- Create: `auth-service/src/services/usersService.js`
- Create: `auth-service/src/services/usersService.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/services/usersService.test.js
const { describe, it, expect, vi, beforeEach } = require('vitest');

vi.mock('../repositories/usersRepo', () => ({
  list:           vi.fn(),
  findById:       vi.fn(),
  findByEmail:    vi.fn(),
  insert:         vi.fn(),
  updateStatus:   vi.fn(),
  updatePassword: vi.fn(),
}));
vi.mock('../repositories/rolesRepo', () => ({
  setRolesForUser: vi.fn(),
  findKeysForUser: vi.fn(),
}));
vi.mock('../lib/password', () => ({
  hash:   vi.fn(async (p) => `hashed:${p}`),
  verify: vi.fn(),
}));

const usersRepo = require('../repositories/usersRepo');
const rolesRepo = require('../repositories/rolesRepo');
const { DomainError } = require('../lib/errors');
const usersService = require('./usersService');

const db = { query: vi.fn() };

beforeEach(() => vi.clearAllMocks());

describe('usersService.create', () => {
  it('creates a user, hashes password, and assigns roles', async () => {
    usersRepo.findByEmail.mockResolvedValue(null);
    usersRepo.insert.mockResolvedValue({ user_id: 7, tenant_id: 1, email: 'a@b', display_name: 'A', status: 'active' });
    rolesRepo.setRolesForUser.mockResolvedValue(['mcs.tech']);

    const out = await usersService.create(db, 1, { email: 'a@b', display_name: 'A', password: 'longpass123', roles: ['mcs.tech'] });

    expect(usersRepo.insert).toHaveBeenCalledWith(db, {
      tenant_id: 1, email: 'a@b', password_hash: 'hashed:longpass123', display_name: 'A',
    });
    expect(rolesRepo.setRolesForUser).toHaveBeenCalledWith(db, 7, ['mcs.tech']);
    expect(out).toMatchObject({ user_id: 7, email: 'a@b', roles: ['mcs.tech'] });
  });

  it('throws conflict if email already exists', async () => {
    usersRepo.findByEmail.mockResolvedValue({ user_id: 1 });
    await expect(
      usersService.create(db, 1, { email: 'a@b', display_name: 'A', password: 'longpass123', roles: [] })
    ).rejects.toMatchObject({ code: 'conflict' });
  });
});

describe('usersService.list', () => {
  it('returns users in the given tenant with role keys', async () => {
    usersRepo.list.mockResolvedValue([
      { user_id: 1, tenant_id: 1, email: 'a@b', display_name: 'A', status: 'active' },
      { user_id: 2, tenant_id: 1, email: 'c@d', display_name: 'C', status: 'active' },
    ]);
    rolesRepo.findKeysForUser.mockResolvedValueOnce(['mcs.admin']).mockResolvedValueOnce(['mcs.tech']);
    const out = await usersService.list(db, 1);
    expect(out).toHaveLength(2);
    expect(out[0].roles).toEqual(['mcs.admin']);
    expect(out[1].roles).toEqual(['mcs.tech']);
  });
});

describe('usersService.update', () => {
  it('updates status when provided', async () => {
    usersRepo.findById.mockResolvedValue({ user_id: 7, tenant_id: 1, email: 'a@b', status: 'active' });
    usersRepo.updateStatus.mockResolvedValue({ user_id: 7, tenant_id: 1, email: 'a@b', status: 'disabled' });
    rolesRepo.findKeysForUser.mockResolvedValue([]);
    const out = await usersService.update(db, 1, 7, { status: 'disabled' });
    expect(usersRepo.updateStatus).toHaveBeenCalledWith(db, 1, 7, 'disabled');
    expect(out.status).toBe('disabled');
  });

  it('throws not_found if user does not exist in tenant', async () => {
    usersRepo.findById.mockResolvedValue(null);
    await expect(usersService.update(db, 1, 99, { status: 'disabled' }))
      .rejects.toMatchObject({ code: 'not_found' });
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
npx vitest run src/services/usersService.test.js
```

- [ ] **Step 3: Implement**

```js
// src/services/usersService.js
const password = require('../lib/password');
const { DomainError } = require('../lib/errors');
const usersRepo = require('../repositories/usersRepo');
const rolesRepo = require('../repositories/rolesRepo');

const withRoles = async (db, user) => {
  const roles = await rolesRepo.findKeysForUser(db, user.user_id);
  return { ...user, roles };
};

const list = async (db, tenantId) => {
  const users = await usersRepo.list(db, tenantId);
  return Promise.all(users.map((u) => withRoles(db, u)));
};

const get = async (db, tenantId, userId) => {
  const user = await usersRepo.findById(db, tenantId, userId);
  if (!user) throw new DomainError('not_found', 'User not found', 404);
  return withRoles(db, user);
};

const create = async (db, tenantId, { email, display_name, password: plaintext, roles }) => {
  const existing = await usersRepo.findByEmail(db, tenantId, email);
  if (existing) throw new DomainError('conflict', 'Email already exists in this tenant', 409);

  const password_hash = await password.hash(plaintext);
  const user = await usersRepo.insert(db, { tenant_id: tenantId, email, password_hash, display_name });
  const assigned = await rolesRepo.setRolesForUser(db, user.user_id, roles);
  return { ...user, roles: assigned };
};

const update = async (db, tenantId, userId, patch) => {
  const existing = await usersRepo.findById(db, tenantId, userId);
  if (!existing) throw new DomainError('not_found', 'User not found', 404);

  if (patch.status) {
    await usersRepo.updateStatus(db, tenantId, userId, patch.status);
  }
  if (patch.password) {
    const hashed = await password.hash(patch.password);
    await usersRepo.updatePassword(db, tenantId, userId, hashed);
  }
  if (patch.roles) {
    await rolesRepo.setRolesForUser(db, userId, patch.roles);
  }

  return get(db, tenantId, userId);
};

module.exports = { list, get, create, update };
```

- [ ] **Step 4: Run, expect pass**

```bash
npx vitest run src/services/usersService.test.js
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add auth-service/src/services/usersService.js auth-service/src/services/usersService.test.js
git commit -m "feat(auth-service): usersService (CRUD)"
```

---

## Task 22: Admin users routes

**Files:**
- Create: `auth-service/src/routes/adminUsers.js`

- [ ] **Step 1: Write**

```js
// src/routes/adminUsers.js
const express = require('express');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { createUserSchema, updateUserSchema, idParamsSchema } = require('../schemas/adminUsers');
const usersService = require('../services/usersService');
const db = require('../database');

const router = express.Router();

const handler = (fn) => async (req, res, next) => {
  try { await fn(req, res, next); } catch (err) { next(err); }
};

// Any admin role suffices to manage users today. This is intentional —
// admin scoping per app can be added later if needed.
const adminOnly = [requireAuth, requireRole('imms.admin', 'mcs.admin')];

router.get('/', ...adminOnly, handler(async (req, res) => {
  const users = await usersService.list(db, req.user.tenant_id);
  res.json({ users });
}));

router.get('/:userId',
  ...adminOnly,
  validate({ params: idParamsSchema }),
  handler(async (req, res) => {
    const user = await usersService.get(db, req.user.tenant_id, req.params.userId);
    res.json({ user });
  })
);

router.post('/',
  ...adminOnly,
  validate({ body: createUserSchema }),
  handler(async (req, res) => {
    const user = await usersService.create(db, req.user.tenant_id, req.body);
    res.status(201).json({ user });
  })
);

router.put('/:userId',
  ...adminOnly,
  validate({ params: idParamsSchema, body: updateUserSchema }),
  handler(async (req, res) => {
    const user = await usersService.update(db, req.user.tenant_id, req.params.userId, req.body);
    res.json({ user });
  })
);

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
git add auth-service/src/routes/adminUsers.js
git commit -m "feat(auth-service): /admin/users routes"
```

---

## Task 23: app.js (compose Express)

**Files:**
- Create: `auth-service/src/app.js`

- [ ] **Step 1: Write**

```js
// src/app.js
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const rateLimit = require('express-rate-limit');

const logger = require('./lib/logger');
const errorHandler = require('./middleware/errorHandler');
const authRouter = require('./routes/auth');
const adminUsersRouter = require('./routes/adminUsers');

const buildApp = () => {
  const app = express();
  const CORS_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',').map((s) => s.trim());

  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id = (typeof incoming === 'string' && incoming.length <= 64)
        ? incoming
        : crypto.randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }));
  app.use(cors({
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());

  app.use('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false }));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 2000, standardHeaders: true, legacyHeaders: false }));

  app.get('/health', (req, res) =>
    res.json({ status: 'healthy', service: 'auth', timestamp: new Date().toISOString() })
  );

  app.use('/auth', authRouter);
  app.use('/admin/users', adminUsersRouter);

  app.use((req, res) =>
    res.status(404).json({ error: 'not_found', message: 'Not found' })
  );

  app.use(errorHandler);

  return app;
};

module.exports = buildApp;
```

- [ ] **Step 2: Commit**

```bash
git add auth-service/src/app.js
git commit -m "feat(auth-service): compose express app"
```

---

## Task 24: index.js (process entry)

**Files:**
- Create: `auth-service/index.js`

- [ ] **Step 1: Write**

```js
// index.js
require('dotenv').config();

const buildApp = require('./src/app');
const logger = require('./src/lib/logger');

const PORT = parseInt(process.env.PORT || '4002', 10);
const app = buildApp();

app.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT }, 'auth-service running');
});
```

- [ ] **Step 2: Smoke test it**

```bash
cd auth-service
npm run dev
```

In another shell:
```bash
curl http://localhost:4002/health
```

Expected:
```json
{"status":"healthy","service":"auth","timestamp":"..."}
```

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add auth-service/index.js
git commit -m "feat(auth-service): start http server"
```

---

## Task 25: Seed script

**Files:**
- Create: `auth-service/scripts/seed.js`

- [ ] **Step 1: Write**

```js
// scripts/seed.js
// Creates the 'fiserv' tenant and a single admin user with all admin roles.
// Idempotent: re-running prints a notice but doesn't error.

require('dotenv').config();
const readline = require('readline/promises');
const { pool } = require('../src/database');
const password = require('../src/lib/password');
const tenantsRepo = require('../src/repositories/tenantsRepo');
const usersRepo = require('../src/repositories/usersRepo');
const rolesRepo = require('../src/repositories/rolesRepo');

const TENANT_SLUG = 'fiserv';
const TENANT_NAME = 'Fiserv';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@fiserv';

const promptPassword = async () => {
  if (process.env.SEED_ADMIN_PASSWORD) return process.env.SEED_ADMIN_PASSWORD;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Admin password (min 12 chars): ');
  rl.close();
  if (answer.length < 12) throw new Error('Password too short');
  return answer;
};

(async () => {
  try {
    let tenant = await tenantsRepo.findBySlug(pool, TENANT_SLUG);
    if (!tenant) {
      tenant = await tenantsRepo.insert(pool, { slug: TENANT_SLUG, display_name: TENANT_NAME });
      console.log(`Created tenant: ${tenant.slug} (id=${tenant.tenant_id})`);
    } else {
      console.log(`Tenant already exists: ${tenant.slug} (id=${tenant.tenant_id})`);
    }

    const existing = await usersRepo.findByEmail(pool, tenant.tenant_id, ADMIN_EMAIL);
    if (existing) {
      console.log(`Admin user already exists: ${ADMIN_EMAIL}. Skipping.`);
      process.exit(0);
    }

    const plaintext = await promptPassword();
    const password_hash = await password.hash(plaintext);
    const user = await usersRepo.insert(pool, {
      tenant_id: tenant.tenant_id,
      email: ADMIN_EMAIL,
      password_hash,
      display_name: 'Admin',
    });
    await rolesRepo.setRolesForUser(pool, user.user_id, ['imms.admin', 'mcs.admin']);
    console.log(`Created admin user: ${ADMIN_EMAIL} (id=${user.user_id}) with imms.admin + mcs.admin`);
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
})();
```

- [ ] **Step 2: Run it**

```bash
cd auth-service
SEED_ADMIN_PASSWORD=changemeplease npm run seed
```

Expected output:
```
Created tenant: fiserv (id=1)
Created admin user: admin@fiserv (id=1) with imms.admin + mcs.admin
```

Re-run: should print "already exists" messages and exit 0.

- [ ] **Step 3: Commit**

```bash
git add auth-service/scripts/seed.js
git commit -m "feat(auth-service): add seed script (Fiserv tenant + admin user)"
```

---

## Task 26: End-to-end integration test

This test exercises the full HTTP path against a real Postgres. It depends on the schema being applied and the seed admin user existing.

**Files:**
- Create: `auth-service/src/test/helpers.js`
- Create: `auth-service/src/routes/auth.integration.test.js`

- [ ] **Step 1: Write helpers**

```js
// src/test/helpers.js
// Test helpers. The integration tests assume:
//   - NODE_ENV=test
//   - the auth schema is applied to the configured DB
//   - a fresh admin user is created per test run (we don't use the seed admin)

const request = require('supertest');
const buildApp = require('../app');
const { pool } = require('../database');
const password = require('../lib/password');
const tenantsRepo = require('../repositories/tenantsRepo');
const usersRepo = require('../repositories/usersRepo');
const rolesRepo = require('../repositories/rolesRepo');

const ensureTenant = async (slug = 'fiserv', display_name = 'Fiserv') => {
  let tenant = await tenantsRepo.findBySlug(pool, slug);
  if (!tenant) tenant = await tenantsRepo.insert(pool, { slug, display_name });
  return tenant;
};

const createTestUser = async (tenantId, { email, password: plaintext, roles = [] }) => {
  const existing = await usersRepo.findByEmail(pool, tenantId, email);
  if (existing) {
    await pool.query(`DELETE FROM auth.users WHERE user_id = $1`, [existing.user_id]);
  }
  const user = await usersRepo.insert(pool, {
    tenant_id: tenantId,
    email,
    password_hash: await password.hash(plaintext),
    display_name: email,
  });
  await rolesRepo.setRolesForUser(pool, user.user_id, roles);
  return user;
};

const app = buildApp();
const agent = () => request.agent(app);

module.exports = { app, agent, ensureTenant, createTestUser, pool };
```

- [ ] **Step 2: Write the integration test**

```js
// src/routes/auth.integration.test.js
const { describe, it, expect, beforeAll, afterAll } = require('vitest');
const { agent, ensureTenant, createTestUser, pool } = require('../test/helpers');

const EMAIL = 'integration@fiserv';
const PASSWORD = 'integration-pw-1234';

let tenant;

beforeAll(async () => {
  tenant = await ensureTenant('fiserv', 'Fiserv');
  await createTestUser(tenant.tenant_id, { email: EMAIL, password: PASSWORD, roles: ['mcs.admin'] });
});

afterAll(async () => {
  await pool.query(`DELETE FROM auth.users WHERE email = $1`, [EMAIL]);
  await pool.end();
});

describe('auth integration', () => {
  it('POST /auth/login → sets cookie and returns user', async () => {
    const a = agent();
    const res = await a.post('/auth/login').send({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(EMAIL);
    expect(res.body.user.roles).toContain('mcs.admin');
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.headers['set-cookie']?.join(';')).toMatch(/fiserv_auth=/);
  });

  it('GET /auth/me without cookie → 401', async () => {
    const res = await agent().get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('login then GET /auth/me returns the same user', async () => {
    const a = agent();
    await a.post('/auth/login').send({ email: EMAIL, password: PASSWORD });
    const me = await a.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(EMAIL);
    expect(me.body.user.roles).toContain('mcs.admin');
  });

  it('POST /auth/login with wrong password → 401 (no enumeration)', async () => {
    const a = agent();
    const res = await a.post('/auth/login').send({ email: EMAIL, password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('POST /auth/login with unknown email → identical 401 envelope', async () => {
    const a = agent();
    const res = await a.post('/auth/login').send({ email: 'ghost@fiserv', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('POST /auth/logout clears the cookie', async () => {
    const a = agent();
    await a.post('/auth/login').send({ email: EMAIL, password: PASSWORD });
    const out = await a.post('/auth/logout');
    expect(out.status).toBe(200);
    const cookie = out.headers['set-cookie']?.join(';') || '';
    expect(cookie).toMatch(/fiserv_auth=;/);
    const after = await a.get('/auth/me');
    expect(after.status).toBe(401);
  });
});

describe('/admin/users integration', () => {
  it('login as admin → create user → list shows it', async () => {
    const a = agent();
    await a.post('/auth/login').send({ email: EMAIL, password: PASSWORD });

    const create = await a.post('/admin/users').send({
      email: 'newbie@fiserv',
      display_name: 'Newbie',
      password: 'newbie-pw-1234',
      roles: ['mcs.tech'],
    });
    expect(create.status).toBe(201);
    expect(create.body.user.email).toBe('newbie@fiserv');
    expect(create.body.user.roles).toEqual(['mcs.tech']);

    const list = await a.get('/admin/users');
    expect(list.status).toBe(200);
    expect(list.body.users.find((u) => u.email === 'newbie@fiserv')).toBeTruthy();

    await pool.query(`DELETE FROM auth.users WHERE email = $1`, ['newbie@fiserv']);
  });

  it('non-admin role → 403 on /admin/users', async () => {
    await createTestUser(tenant.tenant_id, { email: 'viewer@fiserv', password: 'viewer-pw-1234', roles: ['mcs.viewer'] });
    const a = agent();
    await a.post('/auth/login').send({ email: 'viewer@fiserv', password: 'viewer-pw-1234' });
    const res = await a.get('/admin/users');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
    await pool.query(`DELETE FROM auth.users WHERE email = $1`, ['viewer@fiserv']);
  });
});
```

- [ ] **Step 3: Run it**

Prereqs: schema applied, RS256 keys generated.
```bash
cd auth-service
NODE_ENV=test npx vitest run src/routes/auth.integration.test.js
```

Expected: PASS (8 tests).

- [ ] **Step 4: Commit**

```bash
git add auth-service/src/test/helpers.js auth-service/src/routes/auth.integration.test.js
git commit -m "test(auth-service): end-to-end integration tests for auth + admin"
```

---

## Task 27: PM2 ecosystem config

**Files:**
- Create: `auth-service/ecosystem.config.js`

- [ ] **Step 1: Write**

```js
// auth-service/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'auth-service',
      cwd: './',
      script: 'index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 4002,
      },
      watch: false,
      max_memory_restart: '200M',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add auth-service/ecosystem.config.js
git commit -m "feat(auth-service): PM2 ecosystem config"
```

---

## Task 28: Full test pass + verification

- [ ] **Step 1: Run the full test suite**

```bash
cd auth-service
npm test
```

Expected: all unit + integration tests pass.

- [ ] **Step 2: Spin it up and verify with curl**

```bash
npm run dev
```

In another shell — login and call /me using the cookie jar:
```bash
curl -i -c /tmp/auth.jar -b /tmp/auth.jar \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@fiserv","password":"changemeplease"}' \
     http://localhost:4002/auth/login

curl -i -b /tmp/auth.jar http://localhost:4002/auth/me
```

Expected: first call returns 200 with `Set-Cookie: fiserv_auth=...`; second call returns 200 with the admin user.

Stop the dev server.

- [ ] **Step 3: Final verification — no committed secrets**

```bash
git ls-files auth-service/ | grep -E '\.(pem|env)$' || echo "OK: no keys or .env committed"
```

Expected: `OK: no keys or .env committed`.

- [ ] **Step 4: Done — Step 1 of the spec is shipped.**

No further commit needed; this is a checklist step.

---

## What's NOT in this plan (deferred)

These come in later plans, in the order the spec lays out:

- IMMS / MCS verifying the new JWT (Step 3 of the spec)
- Tenant_id columns on IMMS/MCS domain tables (Step 2)
- MCS admin UI that calls `/admin/users` (Step 4)
- Portal page (Step 5)
- Cutover / delete old login flows (Step 6)
- Schema reorg moving MCS tables to `mcs` schema (Step 7)
- Forgot-password / refresh-token rotation / audit log (all deferred per spec)
