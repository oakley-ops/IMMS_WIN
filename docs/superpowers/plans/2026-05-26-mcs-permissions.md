# MCS User Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-user MCS permissions system so an admin can grant specific capabilities (add badges, manage readers, etc.) to individual IMMS users via a checkbox UI, enforced on the backend.

**Architecture:** New `mcs_user_permissions` DB table stores delegatable permission flags per IMMS user_id. A `requirePermission(key)` Express middleware guards individual routes, with role-based shortcuts (admin always passes, `tech` role passes for `calls_manage`/`analytics_view`). Frontend adds a Permissions tab to the Admin page with a searchable user list and a per-user checkbox grid.

**Tech Stack:** Node.js/Express/Zod/pg (backend), Next.js 14/MUI v5/TypeScript/Vitest + Testing Library (frontend), PostgreSQL migration

---

## File Map

### Created
- `maintenance_call_system/backend/migrations/20260526_mcs_user_permissions.sql`
- `maintenance_call_system/backend/src/repositories/permissionsRepo.js`
- `maintenance_call_system/backend/src/schemas/permissions.js`
- `maintenance_call_system/backend/src/middleware/requirePermission.js`
- `maintenance_call_system/backend/src/middleware/requirePermission.test.js`
- `maintenance_call_system/backend/src/routes/permissions.js`
- `maintenance_call_system/backend/src/routes/permissions.test.js`
- `maintenance_call_system/frontend/src/services/permissionsService.ts`
- `maintenance_call_system/frontend/src/components/admin/PermissionsPanel.tsx`
- `maintenance_call_system/frontend/src/components/admin/PermissionsPanel.test.tsx`

### Modified
- `maintenance_call_system/backend/index.js` — mount permissions router
- `maintenance_call_system/backend/src/routes/maintenanceCalls.js` — add requirePermission to badge/reader/call routes
- `maintenance_call_system/backend/src/routes/maintenanceCalls.test.js` — patch requirePermission as pass-through
- `maintenance_call_system/frontend/src/app/admin/page.tsx` — add Tabs (Badge Admin | Permissions)

---

## Task 1: Database Migration

**Files:**
- Create: `maintenance_call_system/backend/migrations/20260526_mcs_user_permissions.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Creates the per-user MCS permission store.
-- One row per IMMS user who has been explicitly configured.
-- Missing row = all delegatable permissions FALSE (role defaults still apply).

CREATE TABLE IF NOT EXISTS mcs_user_permissions (
  user_id          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  badges_add       BOOLEAN NOT NULL DEFAULT FALSE,
  readers_manage   BOOLEAN NOT NULL DEFAULT FALSE,
  calls_manage     BOOLEAN NOT NULL DEFAULT FALSE,
  analytics_view   BOOLEAN NOT NULL DEFAULT FALSE,
  skilled_operator BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by       INTEGER REFERENCES users(id),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcs_user_permissions_user ON mcs_user_permissions(user_id);
```

- [ ] **Step 2: Run the migration**

```bash
cd maintenance_call_system/backend
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(fs.readFileSync('migrations/20260526_mcs_user_permissions.sql', 'utf8'))
  .then(() => { console.log('Migration complete'); pool.end(); })
  .catch(err => { console.error(err); pool.end(); process.exit(1); });
"
```

Expected output: `Migration complete`

- [ ] **Step 3: Verify the table exists**

```bash
cd maintenance_call_system/backend
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'mcs_user_permissions' ORDER BY ordinal_position\")
  .then(r => { console.table(r.rows); pool.end(); });
"
```

Expected: 8 columns: `user_id`, `badges_add`, `readers_manage`, `calls_manage`, `analytics_view`, `skilled_operator`, `updated_by`, `updated_at`

- [ ] **Step 4: Commit**

```bash
git add maintenance_call_system/backend/migrations/20260526_mcs_user_permissions.sql
git commit -m "feat(mcs-db): add mcs_user_permissions table"
```

---

## Task 2: Backend — permissionsRepo + schema

**Files:**
- Create: `maintenance_call_system/backend/src/repositories/permissionsRepo.js`
- Create: `maintenance_call_system/backend/src/schemas/permissions.js`

- [ ] **Step 1: Write `permissionsRepo.js`**

```js
// Repository layer — all SQL for mcs_user_permissions lives here.
// Functions accept a db client (pool) and return plain objects.

// Defaults object when no row exists for a user.
const defaultPerms = () => ({
  badges_add: false,
  readers_manage: false,
  calls_manage: false,
  analytics_view: false,
  skilled_operator: false,
  updated_by: null,
  updated_at: null,
});

// Role-based defaults applied on top of the stored row.
const ROLE_DEFAULTS = {
  tech: { calls_manage: true, analytics_view: true },
};

// Merges explicit grants with role defaults: either source being true wins.
const mergeRoleDefaults = (role, stored) => {
  const rd = ROLE_DEFAULTS[role] || {};
  return {
    badges_add: stored.badges_add || false,
    readers_manage: stored.readers_manage || false,
    calls_manage: stored.calls_manage || rd.calls_manage || false,
    analytics_view: stored.analytics_view || rd.analytics_view || false,
    skilled_operator: stored.skilled_operator || false,
  };
};

// For admin role: all permissions are effectively true.
const adminPerms = () => ({
  badges_add: true, readers_manage: true, calls_manage: true,
  analytics_view: true, skilled_operator: true,
});

/**
 * Returns the stored permission row for a user, or all-false defaults.
 * Does NOT apply role defaults — use mergeRoleDefaults separately.
 */
const getPermissions = async (db, userId) => {
  const result = await db.query(
    `SELECT badges_add, readers_manage, calls_manage, analytics_view,
            skilled_operator, updated_by, updated_at
       FROM mcs_user_permissions
      WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] || defaultPerms();
};

/**
 * Upserts a full permission set for a user.
 * `permissions` must contain all 5 boolean keys.
 * Returns the saved row.
 */
const upsertPermissions = async (db, userId, permissions, updatedBy) => {
  const result = await db.query(
    `INSERT INTO mcs_user_permissions
       (user_id, badges_add, readers_manage, calls_manage, analytics_view, skilled_operator, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       badges_add       = EXCLUDED.badges_add,
       readers_manage   = EXCLUDED.readers_manage,
       calls_manage     = EXCLUDED.calls_manage,
       analytics_view   = EXCLUDED.analytics_view,
       skilled_operator = EXCLUDED.skilled_operator,
       updated_by       = EXCLUDED.updated_by,
       updated_at       = NOW()
     RETURNING *`,
    [
      userId,
      permissions.badges_add,
      permissions.readers_manage,
      permissions.calls_manage,
      permissions.analytics_view,
      permissions.skilled_operator,
      updatedBy,
    ]
  );
  return result.rows[0];
};

/**
 * Returns all IMMS users joined with their MCS permission row.
 * Includes resolved effective permissions (role defaults merged in).
 */
const listUsersWithPermissions = async (db) => {
  const result = await db.query(
    `SELECT u.id          AS user_id,
            u.username,
            u.role,
            COALESCE(p.badges_add,       false) AS badges_add,
            COALESCE(p.readers_manage,   false) AS readers_manage,
            COALESCE(p.calls_manage,     false) AS calls_manage,
            COALESCE(p.analytics_view,   false) AS analytics_view,
            COALESCE(p.skilled_operator, false) AS skilled_operator,
            p.updated_by,
            p.updated_at,
            adm.username                         AS updated_by_username
       FROM users u
  LEFT JOIN mcs_user_permissions p   ON p.user_id = u.id
  LEFT JOIN users adm                ON adm.id = p.updated_by
      ORDER BY u.username`
  );
  return result.rows.map((row) => {
    const { user_id, username, role, updated_at, updated_by_username, ...stored } = row;
    const perms = role === 'admin'
      ? adminPerms()
      : mergeRoleDefaults(role, stored);
    return { user_id, username, role, permissions: perms, updated_at, updated_by_username };
  });
};

module.exports = { getPermissions, upsertPermissions, listUsersWithPermissions, mergeRoleDefaults, defaultPerms, adminPerms };
```

- [ ] **Step 2: Write `schemas/permissions.js`**

```js
const { z } = require('zod');

// All keys optional — PUT body is a partial update; omitted keys are unchanged.
const updatePermissionsBody = z.object({
  badges_add:       z.boolean().optional(),
  readers_manage:   z.boolean().optional(),
  calls_manage:     z.boolean().optional(),
  analytics_view:   z.boolean().optional(),
  skilled_operator: z.boolean().optional(),
}).strict();

const userIdParam = z.object({
  userId: z.string().regex(/^\d+$/, 'userId must be a positive integer'),
});

module.exports = { updatePermissionsBody, userIdParam };
```

- [ ] **Step 3: Commit**

```bash
git add maintenance_call_system/backend/src/repositories/permissionsRepo.js \
        maintenance_call_system/backend/src/schemas/permissions.js
git commit -m "feat(mcs-permissions): add permissionsRepo and schema"
```

---

## Task 3: Backend — requirePermission middleware

**Files:**
- Create: `maintenance_call_system/backend/src/middleware/requirePermission.js`
- Create: `maintenance_call_system/backend/src/middleware/requirePermission.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// maintenance_call_system/backend/src/middleware/requirePermission.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: vi.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
    connect: vi.fn(),
  })),
}));

const db = require('../database/db');
db.query = vi.fn();

const requirePermission = require('./requirePermission');

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => { vi.clearAllMocks(); });

describe('requirePermission', () => {
  it('throws during factory call with an unknown permission key', () => {
    expect(() => requirePermission('nonexistent_key')).toThrow('Unknown permission key');
  });

  it('calls next() immediately for admin role without querying db', async () => {
    const mw = requirePermission('badges_add');
    const req = { user: { id: 1, role: 'admin' } };
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('calls next() for tech role with calls_manage (role default) without querying db', async () => {
    const mw = requirePermission('calls_manage');
    const req = { user: { id: 2, role: 'tech' } };
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('calls next() for tech role with analytics_view (role default) without querying db', async () => {
    const mw = requirePermission('analytics_view');
    const req = { user: { id: 2, role: 'tech' } };
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('queries db and calls next() when explicit grant exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ badges_add: true }] });
    const mw = requirePermission('badges_add');
    const req = { user: { id: 3, role: 'purchasing' } };
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(db.query).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 403 when db row has the permission set to false', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ badges_add: false }] });
    const mw = requirePermission('badges_add');
    const req = { user: { id: 3, role: 'purchasing' } };
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when no row exists in db for user', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const mw = requirePermission('badges_add');
    const req = { user: { id: 3, role: 'purchasing' } };
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when req.user is not set', async () => {
    const mw = requirePermission('badges_add');
    const req = {};
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when db query throws', async () => {
    db.query.mockRejectedValueOnce(new Error('db down'));
    const mw = requirePermission('badges_add');
    const req = { user: { id: 3, role: 'purchasing' } };
    const res = mockRes();
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd maintenance_call_system/backend
npx vitest run src/middleware/requirePermission.test.js
```

Expected: All tests fail with "Cannot find module './requirePermission'"

- [ ] **Step 3: Write the implementation**

```js
// maintenance_call_system/backend/src/middleware/requirePermission.js
const db = require('../database/db');
const { errors } = require('./errors');

// Keys that can be checked — validates at factory time to catch typos.
const VALID_KEYS = new Set([
  'badges_add',
  'readers_manage',
  'calls_manage',
  'analytics_view',
  'skilled_operator',
]);

// Which keys each non-admin role gets for free (no DB lookup needed).
const ROLE_DEFAULTS = {
  tech: new Set(['calls_manage', 'analytics_view']),
};

/**
 * Returns Express middleware that enforces a single MCS permission.
 * Usage: router.post('/admin/badges', auth, requirePermission('badges_add'), handler(...))
 *
 * Resolution order:
 *   1. admin role → always pass
 *   2. role default for the caller's role → pass
 *   3. mcs_user_permissions row for user_id → pass if column is true
 *   4. otherwise → 403
 */
const requirePermission = (key) => {
  if (!VALID_KEYS.has(key)) {
    throw new Error(`Unknown permission key: "${key}". Valid keys: ${[...VALID_KEYS].join(', ')}`);
  }

  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) return errors.unauthorized(res, 'Authentication required');

      // Admin bypasses all checks.
      if (user.role === 'admin') return next();

      // Role default bypasses DB lookup.
      const roleDefaults = ROLE_DEFAULTS[user.role];
      if (roleDefaults && roleDefaults.has(key)) return next();

      // Check explicit grant in DB.
      const result = await db.query(
        `SELECT ${key} FROM mcs_user_permissions WHERE user_id = $1`,
        [user.id]
      );
      const row = result.rows[0];
      if (row && row[key] === true) return next();

      return errors.forbidden(res, 'Insufficient MCS permissions');
    } catch (err) {
      return errors.serverError(res);
    }
  };
};

module.exports = requirePermission;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd maintenance_call_system/backend
npx vitest run src/middleware/requirePermission.test.js
```

Expected: 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add maintenance_call_system/backend/src/middleware/requirePermission.js \
        maintenance_call_system/backend/src/middleware/requirePermission.test.js
git commit -m "feat(mcs-permissions): add requirePermission middleware"
```

---

## Task 4: Backend — permissions routes + server mount

**Files:**
- Create: `maintenance_call_system/backend/src/routes/permissions.js`
- Create: `maintenance_call_system/backend/src/routes/permissions.test.js`
- Modify: `maintenance_call_system/backend/index.js`

- [ ] **Step 1: Write the failing tests**

```js
// maintenance_call_system/backend/src/routes/permissions.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: vi.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
    connect: vi.fn(),
  })),
}));

const db = require('../database/db');
db.query = vi.fn();

const request = require('supertest');
const express = require('express');

// Patch auth to inject req.user. Tests that need a non-admin user
// temporarily reassign currentUser before the request.
let currentUser = { id: 1, username: 'admin', role: 'admin' };
{
  const authPath = require.resolve('../middleware/auth');
  require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true,
    exports: (req, _res, next) => { req.user = { ...currentUser }; next(); },
  };
}

const router = require('./permissions');
const app = express();
app.use(express.json());
app.use('/', router);

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: 1, username: 'admin', role: 'admin' };
});

describe('GET /mcs/permissions', () => {
  it('returns list of users with resolved permissions for admin', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          user_id: 2, username: 'maria', role: 'tech',
          badges_add: true, readers_manage: false, calls_manage: false,
          analytics_view: false, skilled_operator: false,
          updated_at: null, updated_by_username: null,
        },
      ],
    });
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].user_id).toBe(2);
    // badges_add = true from explicit grant
    expect(res.body[0].permissions.badges_add).toBe(true);
    // calls_manage = true from tech role default (even though stored=false)
    expect(res.body[0].permissions.calls_manage).toBe(true);
  });

  it('returns 403 for non-admin caller', async () => {
    currentUser = { id: 2, username: 'tech1', role: 'tech' };
    const res = await request(app).get('/');
    expect(res.status).toBe(403);
  });
});

describe('GET /mcs/permissions/:userId', () => {
  it('returns resolved permissions for a single user', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 5, username: 'bob', role: 'purchasing' }] }) // user lookup
      .mockResolvedValueOnce({ rows: [{ badges_add: true, readers_manage: false, calls_manage: false, analytics_view: false, skilled_operator: false, updated_by: 1, updated_at: '2026-05-26T00:00:00Z' }] }) // perm row
      .mockResolvedValueOnce({ rows: [{ username: 'admin' }] }); // updated_by lookup
    const res = await request(app).get('/5');
    expect(res.status).toBe(200);
    expect(res.body.user_id).toBe(5);
    expect(res.body.permissions.badges_add).toBe(true);
  });

  it('returns 404 when user does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/999');
    expect(res.status).toBe(404);
  });

  it('returns 403 for non-admin caller', async () => {
    currentUser = { id: 2, role: 'tech' };
    const res = await request(app).get('/5');
    expect(res.status).toBe(403);
  });
});

describe('PUT /mcs/permissions/:userId', () => {
  it('saves permissions and returns the updated user object', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 5, username: 'bob', role: 'purchasing' }] }) // user exists check
      .mockResolvedValueOnce({ rows: [{ badges_add: false, readers_manage: false, calls_manage: false, analytics_view: false, skilled_operator: false, updated_by: null, updated_at: null }] }) // getPermissions (current)
      .mockResolvedValueOnce({ rows: [{ user_id: 5, badges_add: true, readers_manage: false, calls_manage: false, analytics_view: false, skilled_operator: false, updated_by: 1, updated_at: '2026-05-26T00:00:00Z' }] }) // upsert RETURNING *
      .mockResolvedValueOnce({ rows: [{ username: 'admin' }] }); // updated_by username lookup
    const res = await request(app).put('/5').send({ badges_add: true });
    expect(res.status).toBe(200);
    expect(res.body.user_id).toBe(5);
    expect(res.body.permissions.badges_add).toBe(true);
    expect(res.body.updated_by_username).toBe('admin');
  });

  it('returns 400 for invalid body (boolean coercion fails)', async () => {
    const res = await request(app).put('/5').send({ badges_add: 'yes_please' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('returns 404 when userId does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // user exists check returns empty
    const res = await request(app).put('/999').send({ badges_add: true });
    expect(res.status).toBe(404);
  });

  it('returns 403 for non-admin caller', async () => {
    currentUser = { id: 2, role: 'tech' };
    const res = await request(app).put('/5').send({ badges_add: true });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd maintenance_call_system/backend
npx vitest run src/routes/permissions.test.js
```

Expected: All tests fail with "Cannot find module './permissions'"

- [ ] **Step 3: Write `routes/permissions.js`**

```js
// maintenance_call_system/backend/src/routes/permissions.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { errors } = require('../middleware/errors');
const S = require('../schemas/permissions');
const repo = require('../repositories/permissionsRepo');

const handler = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    (req.log || console).error(err);
    return errors.serverError(res);
  });

// All three routes are admin-only: auth + role check.
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return errors.forbidden(res, 'Admin access required');
  return next();
};

// ─── GET / — list all IMMS users with resolved MCS permissions ───────────────

router.get(
  '/',
  auth,
  adminOnly,
  handler(async (req, res) => {
    const users = await repo.listUsersWithPermissions(db);
    return res.json(users);
  })
);

// ─── GET /:userId — single user's permissions ────────────────────────────────

router.get(
  '/:userId',
  auth,
  adminOnly,
  validate({ params: S.userIdParam }),
  handler(async (req, res) => {
    const userId = parseInt(req.params.userId, 10);

    // Verify user exists in IMMS.
    const userResult = await db.query(
      'SELECT id, username, role FROM users WHERE id = $1',
      [userId]
    );
    if (!userResult.rows[0]) return errors.notFound(res, 'User not found');
    const user = userResult.rows[0];

    // Get stored permission row (may be all-false defaults).
    const stored = await repo.getPermissions(db, userId);

    // Resolve effective permissions.
    const perms = user.role === 'admin'
      ? repo.adminPerms()
      : repo.mergeRoleDefaults(user.role, stored);

    // Resolve updated_by username if present.
    let updatedByUsername = null;
    if (stored.updated_by) {
      const adminResult = await db.query(
        'SELECT username FROM users WHERE id = $1',
        [stored.updated_by]
      );
      updatedByUsername = adminResult.rows[0]?.username || null;
    }

    return res.json({
      user_id: user.id,
      username: user.username,
      role: user.role,
      permissions: perms,
      updated_at: stored.updated_at,
      updated_by_username: updatedByUsername,
    });
  })
);

// ─── PUT /:userId — save permissions (admin only) ────────────────────────────

router.put(
  '/:userId',
  auth,
  adminOnly,
  validate({ params: S.userIdParam, body: S.updatePermissionsBody }),
  handler(async (req, res) => {
    const userId = parseInt(req.params.userId, 10);

    // Verify user exists.
    const userResult = await db.query(
      'SELECT id, username, role FROM users WHERE id = $1',
      [userId]
    );
    if (!userResult.rows[0]) return errors.notFound(res, 'User not found');
    const user = userResult.rows[0];

    // Merge body with current stored values (partial update).
    const current = await repo.getPermissions(db, userId);
    const merged = {
      badges_add:       req.body.badges_add       ?? current.badges_add,
      readers_manage:   req.body.readers_manage   ?? current.readers_manage,
      calls_manage:     req.body.calls_manage     ?? current.calls_manage,
      analytics_view:   req.body.analytics_view   ?? current.analytics_view,
      skilled_operator: req.body.skilled_operator ?? current.skilled_operator,
    };

    const saved = await repo.upsertPermissions(db, userId, merged, req.user.id);

    // Resolve effective permissions for response.
    const perms = user.role === 'admin'
      ? repo.adminPerms()
      : repo.mergeRoleDefaults(user.role, saved);

    // Resolve updated_by username.
    let updatedByUsername = null;
    if (saved.updated_by) {
      const adminResult = await db.query(
        'SELECT username FROM users WHERE id = $1',
        [saved.updated_by]
      );
      updatedByUsername = adminResult.rows[0]?.username || null;
    }

    return res.json({
      user_id: userId,
      username: user.username,
      role: user.role,
      permissions: perms,
      updated_at: saved.updated_at,
      updated_by_username: updatedByUsername,
    });
  })
);

module.exports = router;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd maintenance_call_system/backend
npx vitest run src/routes/permissions.test.js
```

Expected: All 8 tests pass

- [ ] **Step 5: Mount the router in `index.js`**

In `maintenance_call_system/backend/index.js`, add the import and mount after the existing routers:

```js
// Add after the existing require lines (around line 13):
const permissionsRouter = require('./src/routes/permissions');
```

```js
// Add after line 85 (app.use('/api/v1/call-board-layouts', callBoardLayoutsRouter)):
app.use('/api/v1/mcs/permissions', permissionsRouter);
```

- [ ] **Step 6: Run all backend tests**

```bash
cd maintenance_call_system/backend
npx vitest run
```

Expected: All tests pass (no regressions)

- [ ] **Step 7: Commit**

```bash
git add maintenance_call_system/backend/src/routes/permissions.js \
        maintenance_call_system/backend/src/routes/permissions.test.js \
        maintenance_call_system/backend/index.js
git commit -m "feat(mcs-permissions): add permissions routes and mount"
```

---

## Task 5: Apply requirePermission to existing routes

**Files:**
- Modify: `maintenance_call_system/backend/src/routes/maintenanceCalls.js`
- Modify: `maintenance_call_system/backend/src/routes/maintenanceCalls.test.js`

- [ ] **Step 1: Update `maintenanceCalls.test.js` — add requirePermission pass-through patch**

The existing test setup (around lines 22-31) already patches `auth` via require.cache. Add the `requirePermission` patch immediately after it, before `require('./maintenanceCalls')`:

Find this block in the file:
```js
{
  const authPath = require.resolve('../middleware/auth');
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: (_req, _res, next) => next(),
  };
}
```

Add after it:
```js
{
  const rpPath = require.resolve('../middleware/requirePermission');
  require.cache[rpPath] = {
    id: rpPath,
    filename: rpPath,
    loaded: true,
    // Factory that always produces a pass-through middleware.
    exports: (_key) => (_req, _res, next) => next(),
  };
}
```

- [ ] **Step 2: Run existing tests to confirm they still pass before changing routes**

```bash
cd maintenance_call_system/backend
npx vitest run src/routes/maintenanceCalls.test.js
```

Expected: All existing tests pass

- [ ] **Step 3: Update `maintenanceCalls.js` — add requirePermission import and apply to routes**

Add the import at the top of the file (after the existing `require` lines, around line 10):
```js
const requirePermission = require('../middleware/requirePermission');
```

Apply to `POST /admin/badges` (create badge — requires badges_add):

Find:
```js
router.post(
  '/admin/badges',
  auth,
  validate({ body: S.createBadgeBody }),
  handler(async (req, res) => res.status(201).json(await repo.upsertBadge(db, req.body)))
);
```

Replace with:
```js
router.post(
  '/admin/badges',
  auth,
  requirePermission('badges_add'),
  validate({ body: S.createBadgeBody }),
  handler(async (req, res) => res.status(201).json(await repo.upsertBadge(db, req.body)))
);
```

Apply to `PUT /admin/badges/:badge_id` (edit badge — admin only, hard role check):

Find:
```js
router.put(
  '/admin/badges/:badge_id',
  auth,
  validate({ body: S.updateBadgeBody }),
  handler(async (req, res) => {
    const updated = await repo.updateBadge(db, req.params.badge_id, req.body);
    if (!updated) return errors.notFound(res, 'Badge not found');
    return res.json(updated);
  })
);
```

Replace with:
```js
router.put(
  '/admin/badges/:badge_id',
  auth,
  (req, res, next) => {
    if (req.user?.role !== 'admin') return errors.forbidden(res, 'Admin access required');
    return next();
  },
  validate({ body: S.updateBadgeBody }),
  handler(async (req, res) => {
    const updated = await repo.updateBadge(db, req.params.badge_id, req.body);
    if (!updated) return errors.notFound(res, 'Badge not found');
    return res.json(updated);
  })
);
```

Apply to `POST /admin/readers` (create reader — requires readers_manage):

Find:
```js
router.post(
  '/admin/readers',
  auth,
  validate({ body: S.createReaderBody }),
  (req, res) => repo.insertReader(db, req.body)
```

Replace with:
```js
router.post(
  '/admin/readers',
  auth,
  requirePermission('readers_manage'),
  validate({ body: S.createReaderBody }),
  (req, res) => repo.insertReader(db, req.body)
```

Apply to `PUT /admin/readers/:id` (update reader — requires readers_manage):

Find:
```js
router.put(
  '/admin/readers/:id',
  auth,
  validate({ params: S.idParam, body: S.updateReaderBody }),
```

Replace with:
```js
router.put(
  '/admin/readers/:id',
  auth,
  requirePermission('readers_manage'),
  validate({ params: S.idParam, body: S.updateReaderBody }),
```

- [ ] **Step 4: Run all backend tests**

```bash
cd maintenance_call_system/backend
npx vitest run
```

Expected: All tests still pass (requirePermission is bypassed in test setup)

- [ ] **Step 5: Commit**

```bash
git add maintenance_call_system/backend/src/routes/maintenanceCalls.js \
        maintenance_call_system/backend/src/routes/maintenanceCalls.test.js
git commit -m "feat(mcs-permissions): enforce requirePermission on badge/reader routes"
```

---

## Task 6: Frontend — permissionsService

**Files:**
- Create: `maintenance_call_system/frontend/src/services/permissionsService.ts`

- [ ] **Step 1: Write `permissionsService.ts`**

```ts
// maintenance_call_system/frontend/src/services/permissionsService.ts
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api/v1';

const api = axios.create({ baseURL: `${API}/mcs/permissions` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mcs_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface UserPermissions {
  badges_add: boolean;
  readers_manage: boolean;
  calls_manage: boolean;
  analytics_view: boolean;
  skilled_operator: boolean;
}

export interface UserWithPermissions {
  user_id: number;
  username: string;
  role: string;
  permissions: UserPermissions;
  updated_at: string | null;
  updated_by_username: string | null;
}

const svc = {
  getUsers: (): Promise<UserWithPermissions[]> =>
    api.get<UserWithPermissions[]>('/').then((r) => r.data),

  getUserPermissions: (userId: number): Promise<UserWithPermissions> =>
    api.get<UserWithPermissions>(`/${userId}`).then((r) => r.data),

  savePermissions: (userId: number, permissions: Partial<UserPermissions>): Promise<UserWithPermissions> =>
    api.put<UserWithPermissions>(`/${userId}`, permissions).then((r) => r.data),
};

export default svc;
```

- [ ] **Step 2: Commit**

```bash
git add maintenance_call_system/frontend/src/services/permissionsService.ts
git commit -m "feat(mcs-permissions): add permissionsService"
```

---

## Task 7: Frontend — PermissionsPanel component

**Files:**
- Create: `maintenance_call_system/frontend/src/components/admin/PermissionsPanel.tsx`
- Create: `maintenance_call_system/frontend/src/components/admin/PermissionsPanel.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// maintenance_call_system/frontend/src/components/admin/PermissionsPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const { getUsers, savePermissions } = vi.hoisted(() => ({
  getUsers: vi.fn(),
  savePermissions: vi.fn(),
}));

vi.mock('../../services/permissionsService', () => ({
  default: { getUsers, savePermissions },
}));

import PermissionsPanel from './PermissionsPanel';

const sampleUsers = [
  {
    user_id: 2,
    username: 'maria.santos',
    role: 'tech',
    permissions: { badges_add: false, readers_manage: false, calls_manage: true, analytics_view: true, skilled_operator: false },
    updated_at: null,
    updated_by_username: null,
  },
  {
    user_id: 3,
    username: 'john.doe',
    role: 'purchasing',
    permissions: { badges_add: false, readers_manage: false, calls_manage: false, analytics_view: false, skilled_operator: false },
    updated_at: null,
    updated_by_username: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  getUsers.mockResolvedValue(sampleUsers);
});

describe('PermissionsPanel', () => {
  it('renders the user list after loading', async () => {
    render(<PermissionsPanel />);
    expect(await screen.findByText('maria.santos')).toBeInTheDocument();
    expect(screen.getByText('john.doe')).toBeInTheDocument();
  });

  it('renders search box that filters the user list', async () => {
    render(<PermissionsPanel />);
    await screen.findByText('maria.santos');
    const search = screen.getByPlaceholderText(/search/i);
    await userEvent.type(search, 'john');
    expect(screen.queryByText('maria.santos')).not.toBeInTheDocument();
    expect(screen.getByText('john.doe')).toBeInTheDocument();
  });

  it('shows permission checkboxes when a user is selected', async () => {
    render(<PermissionsPanel />);
    await screen.findByText('maria.santos');
    await userEvent.click(screen.getByText('maria.santos'));
    expect(await screen.findByLabelText(/Add new badges/i)).toBeInTheDocument();
  });

  it('locked items render as disabled (Edit / deactivate badges)', async () => {
    render(<PermissionsPanel />);
    await screen.findByText('maria.santos');
    await userEvent.click(screen.getByText('maria.santos'));
    await screen.findByLabelText(/Add new badges/i);
    // The locked row should exist but its checkbox should be disabled or absent
    expect(screen.getByText(/Edit \/ deactivate badges/i)).toBeInTheDocument();
    // Confirm no enabled checkbox for this locked row
    const lockIcon = screen.getAllByTestId('lock-icon');
    expect(lockIcon.length).toBeGreaterThanOrEqual(1);
  });

  it('applies Supervisor preset when clicked', async () => {
    render(<PermissionsPanel />);
    await screen.findByText('maria.santos');
    await userEvent.click(screen.getByText('maria.santos'));
    await screen.findByRole('button', { name: /Supervisor/i });
    await userEvent.click(screen.getByRole('button', { name: /Supervisor/i }));
    // badges_add should now be checked (preset sets it true)
    const badgesAddCheckbox = screen.getByLabelText(/Add new badges/i) as HTMLInputElement;
    expect(badgesAddCheckbox.checked).toBe(true);
  });

  it('calls savePermissions with correct payload when Save is clicked', async () => {
    savePermissions.mockResolvedValue({ ...sampleUsers[1], permissions: { ...sampleUsers[1].permissions, badges_add: true } });
    render(<PermissionsPanel />);
    await screen.findByText('john.doe');
    await userEvent.click(screen.getByText('john.doe'));
    await screen.findByLabelText(/Add new badges/i);
    await userEvent.click(screen.getByLabelText(/Add new badges/i));
    await userEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
    await waitFor(() => {
      expect(savePermissions).toHaveBeenCalledWith(3, expect.objectContaining({ badges_add: true }));
    });
  });

  it('shows success message after save', async () => {
    savePermissions.mockResolvedValue(sampleUsers[1]);
    render(<PermissionsPanel />);
    await screen.findByText('john.doe');
    await userEvent.click(screen.getByText('john.doe'));
    await screen.findByRole('button', { name: /Save Changes/i });
    await userEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
    expect(await screen.findByText(/Permissions saved/i)).toBeInTheDocument();
  });

  it('shows error message when save fails', async () => {
    savePermissions.mockRejectedValue(new Error('Network error'));
    render(<PermissionsPanel />);
    await screen.findByText('john.doe');
    await userEvent.click(screen.getByText('john.doe'));
    await screen.findByRole('button', { name: /Save Changes/i });
    await userEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
    expect(await screen.findByText(/Failed to save/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd maintenance_call_system/frontend
npx vitest run src/components/admin/PermissionsPanel.test.tsx
```

Expected: All tests fail with "Cannot find module './PermissionsPanel'"

- [ ] **Step 3: Write `PermissionsPanel.tsx`**

```tsx
// maintenance_call_system/frontend/src/components/admin/PermissionsPanel.tsx
'use client';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Paper, List, ListItem, ListItemAvatar, ListItemText,
  Avatar, Chip, TextField, InputAdornment, CircularProgress, Alert,
  Checkbox, FormControlLabel, Button, Stack, Divider, Tooltip,
} from '@mui/material';
import { Search, Lock } from '@mui/icons-material';
import permSvc, { UserPermissions, UserWithPermissions } from '../../services/permissionsService';
import { MCS_ORANGE } from '../../theme';

type PermKey = 'badges_add' | 'readers_manage' | 'calls_manage' | 'analytics_view' | 'skilled_operator';

// Which keys each non-admin role gets automatically (cannot be unchecked).
const ROLE_DEFAULTS: Record<string, Set<PermKey>> = {
  tech: new Set(['calls_manage', 'analytics_view'] as PermKey[]),
};

const PRESETS: Record<string, UserPermissions> = {
  Supervisor:    { badges_add: true,  readers_manage: false, calls_manage: true,  analytics_view: true,  skilled_operator: false },
  'Senior Tech': { badges_add: false, readers_manage: true,  calls_manage: true,  analytics_view: true,  skilled_operator: false },
  Analyst:       { badges_add: false, readers_manage: false, calls_manage: false, analytics_view: true,  skilled_operator: false },
  'Clear All':   { badges_add: false, readers_manage: false, calls_manage: false, analytics_view: false, skilled_operator: false },
};

interface PermGroup {
  label: string;
  items: Array<{
    key: PermKey | null;
    label: string;
    description: string;
    locked?: boolean;
  }>;
}

const PERMISSION_GROUPS: PermGroup[] = [
  {
    label: 'BADGE MANAGEMENT',
    items: [
      { key: 'badges_add', label: 'Add new badges', description: 'Register new badge/operator pairs' },
      { key: null, label: 'Edit / deactivate badges', description: 'Modify or suspend existing badges — Admin only', locked: true },
    ],
  },
  {
    label: 'READER MANAGEMENT',
    items: [
      { key: 'readers_manage', label: 'Manage badge readers', description: 'Add, edit, and delete badge readers' },
    ],
  },
  {
    label: 'CALL MANAGEMENT',
    items: [
      { key: 'calls_manage', label: 'Create / resolve / suspend calls', description: 'Full call lifecycle management' },
    ],
  },
  {
    label: 'ANALYTICS',
    items: [
      { key: 'analytics_view', label: 'View analytics page', description: 'Access the analytics dashboard' },
    ],
  },
  {
    label: 'OPERATOR SETTINGS',
    items: [
      { key: 'skilled_operator', label: 'Skilled operator', description: 'Operator badge allows logging calls at the station' },
    ],
  },
  {
    label: 'PERMISSIONS MANAGEMENT',
    items: [
      { key: null, label: 'Manage permissions', description: 'Configure user permissions — Admin only forever', locked: true },
    ],
  },
];

const ROLE_COLORS: Record<string, string> = {
  admin: '#D32F2F',
  tech: '#1565C0',
  purchasing: '#6A1B9A',
};

const initials = (username: string) =>
  username.slice(0, 2).toUpperCase();

export default function PermissionsPanel() {
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<UserWithPermissions | null>(null);
  const [localPerms, setLocalPerms] = useState<UserPermissions | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await permSvc.getUsers();
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const selectUser = (u: UserWithPermissions) => {
    setSelected(u);
    setLocalPerms({ ...u.permissions });
    setSaveSuccess(false);
    setSaveError(null);
  };

  const isRoleDefault = (user: UserWithPermissions, key: PermKey): boolean => {
    if (user.role === 'admin') return true;
    return ROLE_DEFAULTS[user.role]?.has(key) ?? false;
  };

  const togglePerm = (key: PermKey) => {
    if (!localPerms || !selected) return;
    if (isRoleDefault(selected, key)) return; // cannot uncheck role defaults
    setLocalPerms({ ...localPerms, [key]: !localPerms[key] });
  };

  const applyPreset = (presetName: string) => {
    if (!selected || !localPerms) return;
    const preset = PRESETS[presetName];
    // Merge: role defaults stay true; preset overrides the rest.
    const merged: UserPermissions = { ...preset };
    (Object.keys(merged) as PermKey[]).forEach((k) => {
      if (isRoleDefault(selected, k)) merged[k] = true;
    });
    setLocalPerms(merged);
  };

  const handleSave = async () => {
    if (!selected || !localPerms) return;
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const updated = await permSvc.savePermissions(selected.user_id, localPerms);
      setUsers((prev) => prev.map((u) => u.user_id === updated.user_id ? updated : u));
      setSelected(updated);
      setLocalPerms({ ...updated.permissions });
      setSaveSuccess(true);
    } catch {
      setSaveError('Failed to save permissions. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box display="flex" gap={2} height="calc(100vh - 130px)">
      {/* ── Left panel: user list ── */}
      <Paper sx={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box p={2} borderBottom="1px solid #eee">
          <TextField
            size="small"
            fullWidth
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          />
        </Box>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}><CircularProgress size={32} sx={{ color: MCS_ORANGE }} /></Box>
        ) : (
          <List dense sx={{ overflowY: 'auto', flex: 1 }}>
            {filtered.map((u) => (
              <ListItem
                key={u.user_id}
                button
                selected={selected?.user_id === u.user_id}
                onClick={() => selectUser(u)}
                sx={{ '&.Mui-selected': { bgcolor: 'rgba(255,107,53,0.08)' } }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: MCS_ORANGE, width: 32, height: 32, fontSize: 13 }}>
                    {initials(u.username)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={u.username}
                  secondary={
                    <Chip
                      label={u.role}
                      size="small"
                      sx={{ bgcolor: ROLE_COLORS[u.role] || '#666', color: 'white', fontSize: 10, height: 18 }}
                    />
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {/* ── Right panel: permission grid ── */}
      <Paper sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
        {!selected ? (
          <Box display="flex" alignItems="center" justifyContent="center" height="100%">
            <Typography color="text.secondary">Select a user to configure permissions</Typography>
          </Box>
        ) : (
          <>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
              <Box display="flex" alignItems="center" gap={2}>
                <Avatar sx={{ bgcolor: MCS_ORANGE, width: 48, height: 48, fontSize: 18 }}>
                  {initials(selected.username)}
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight="bold">{selected.username}</Typography>
                  <Chip label={selected.role} size="small" sx={{ bgcolor: ROLE_COLORS[selected.role] || '#666', color: 'white', fontSize: 11 }} />
                  {selected.updated_by_username && (
                    <Typography variant="caption" display="block" color="text.secondary" mt={0.5}>
                      Last updated by {selected.updated_by_username}
                    </Typography>
                  )}
                </Box>
              </Box>
              {/* Presets */}
              <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end">
                {Object.keys(PRESETS).map((p) => (
                  <Button
                    key={p}
                    size="small"
                    variant="outlined"
                    onClick={() => applyPreset(p)}
                    sx={{ borderColor: MCS_ORANGE, color: MCS_ORANGE, fontSize: 11 }}
                  >
                    {p}
                  </Button>
                ))}
              </Stack>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Feedback */}
            {saveSuccess && <Alert severity="success" sx={{ mb: 2 }}>Permissions saved successfully.</Alert>}
            {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}

            {/* Permission groups */}
            {PERMISSION_GROUPS.map((group) => (
              <Box key={group.label} mb={2}>
                <Typography variant="overline" fontWeight="bold" color="text.secondary" fontSize={10} letterSpacing={1.5}>
                  {group.label}
                </Typography>
                {group.items.map((item) => {
                  if (item.locked) {
                    return (
                      <Box key={item.label} display="flex" alignItems="center" gap={1} py={0.5} pl={2} sx={{ opacity: 0.5 }}>
                        <Lock fontSize="small" data-testid="lock-icon" />
                        <Box>
                          <Typography variant="body2">{item.label}</Typography>
                          <Typography variant="caption" color="text.secondary">{item.description}</Typography>
                        </Box>
                        <Chip label="Admin only" size="small" color="error" sx={{ ml: 'auto', fontSize: 10, height: 18 }} />
                      </Box>
                    );
                  }
                  const key = item.key as PermKey;
                  const isDefault = isRoleDefault(selected, key);
                  const checked = localPerms ? localPerms[key] : false;
                  return (
                    <Box key={key} pl={2}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={checked}
                            disabled={isDefault}
                            onChange={() => togglePerm(key)}
                            size="small"
                            sx={{ color: MCS_ORANGE, '&.Mui-checked': { color: MCS_ORANGE } }}
                            inputProps={{ 'aria-label': item.label }}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2">
                              {item.label}
                              {isDefault && <Chip label="Role default" size="small" sx={{ ml: 1, fontSize: 10, height: 16 }} />}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">{item.description}</Typography>
                          </Box>
                        }
                      />
                    </Box>
                  );
                })}
                <Divider sx={{ mt: 1 }} />
              </Box>
            ))}

            {/* Save */}
            <Box display="flex" justifyContent="flex-end" mt={2}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving}
                sx={{ bgcolor: MCS_ORANGE, '&:hover': { bgcolor: '#E55A2B' } }}
              >
                {saving ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Save Changes'}
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd maintenance_call_system/frontend
npx vitest run src/components/admin/PermissionsPanel.test.tsx
```

Expected: All 7 tests pass

- [ ] **Step 5: Run all frontend tests to check for regressions**

```bash
cd maintenance_call_system/frontend
npx vitest run
```

Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add maintenance_call_system/frontend/src/services/permissionsService.ts \
        maintenance_call_system/frontend/src/components/admin/PermissionsPanel.tsx \
        maintenance_call_system/frontend/src/components/admin/PermissionsPanel.test.tsx
git commit -m "feat(mcs-permissions): add PermissionsPanel component and permissionsService"
```

---

## Task 8: Wire PermissionsPanel into Admin page

**Files:**
- Modify: `maintenance_call_system/frontend/src/app/admin/page.tsx`

- [ ] **Step 1: Rewrite `admin/page.tsx` with tabs**

Replace the entire file with:

```tsx
'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Box, CircularProgress, Tabs, Tab } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import NavLayout from '../../components/NavLayout';
import { MCS_ORANGE } from '../../theme';

// Client-only components (use localStorage via Axios interceptors).
const BadgeAdmin = dynamic(() => import('../../components/BadgeAdmin'), { ssr: false });
const PermissionsPanel = dynamic(() => import('../../components/admin/PermissionsPanel'), { ssr: false });

export default function AdminPage() {
  const { user, isAuthenticated, isLoading, redirectToLogin } = useAuth();
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      redirectToLogin();
    }
  }, [isLoading, isAuthenticated, redirectToLogin]);

  if (isLoading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh">
        <CircularProgress sx={{ color: MCS_ORANGE }} />
      </Box>
    );
  }

  if (!isAuthenticated) return null;

  const isAdmin = user?.role === 'admin';

  return (
    <NavLayout>
      <Box p={3}>
        <Tabs
          value={tab}
          onChange={(_e, v) => setTab(v)}
          sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}
          TabIndicatorProps={{ style: { backgroundColor: MCS_ORANGE } }}
        >
          <Tab label="Badge Admin" sx={{ '&.Mui-selected': { color: MCS_ORANGE } }} />
          {isAdmin && <Tab label="Permissions" sx={{ '&.Mui-selected': { color: MCS_ORANGE } }} />}
        </Tabs>

        {tab === 0 && <BadgeAdmin />}
        {tab === 1 && isAdmin && <PermissionsPanel />}
      </Box>
    </NavLayout>
  );
}
```

- [ ] **Step 2: Run all frontend tests**

```bash
cd maintenance_call_system/frontend
npx vitest run
```

Expected: All tests pass

- [ ] **Step 3: Run all backend tests**

```bash
cd maintenance_call_system/backend
npx vitest run
```

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add maintenance_call_system/frontend/src/app/admin/page.tsx
git commit -m "feat(mcs-permissions): wire PermissionsPanel into Admin page with tabs"
```

---

## Post-Implementation Verification

After all 8 tasks are complete:

- [ ] Restart MCS backend: kill process on port 4001 and run `cd maintenance_call_system/backend && node index.js`
- [ ] Restart MCS frontend: `cd maintenance_call_system/frontend && npm run dev` (or use `start-app.bat`)
- [ ] Open MCS as admin user, navigate to Admin → verify "Permissions" tab appears
- [ ] Select a non-admin user, grant `badges_add`, save — verify success message
- [ ] Verify the user now appears with badge_add=true in the list
- [ ] Log in as that user, attempt to create a badge — should succeed
- [ ] Log in as a user without `badges_add`, attempt `POST /api/v1/maintenance-calls/admin/badges` — should return 403
