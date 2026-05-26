# Auth Security Fixes — Design Spec

**Date:** 2026-05-26  
**Status:** Approved  
**Scope:** Local LAN deployment only (not public-facing)

---

## Problem Summary

Three high-confidence security vulnerabilities were identified in the auth layer:

1. **Privilege escalation via `|| 'admin'` defaults** — `authMiddleware.js` defaults `role` to `'admin'` in three code paths: pool-unavailable, DB error catch, and DB success with a NULL role. A leftover dev shortcut that was never removed.
2. **Fail-open on DB unavailability** — when the DB pool is missing or a DB error occurs, the middleware calls `next()` instead of returning an error, allowing unauthenticated/unvalidated requests through.
3. **JWT auth cookie sent over HTTP** — `auth-service` cookie defaults `secure: false` unless `COOKIE_SECURE=true` is explicitly set, exposing the token to network interception on the local unmanaged switch.

---

## Changes

### File 1: `backend/src/middleware/authMiddleware.js`

#### Change 1 — Pool-unavailable branch (lines 18–27)
**Before:** Sets `req.user` with `role: decoded.role || 'admin'` and calls `next()`.  
**After:** Returns `503` immediately. No user object is set, no request proceeds.

```js
if (!pool || typeof pool.query !== 'function') {
  console.error('Database pool not available in auth middleware');
  return res.status(503).json({ error: 'Authentication service temporarily unavailable.' });
}
```

#### Change 2 — DB success path (line 44)
**Before:** `role: result.rows[0].role || 'admin'`  
**After:** Remove the fallback. After confirming the user exists, check for a NULL/empty role and return `403` if missing.

```js
const { user_id, username, role } = result.rows[0];

if (!role) {
  return res.status(403).json({ error: 'Account has no role assigned. Contact an administrator.' });
}

req.user = { id: user_id, username, role };
```

#### Change 3 — DB error catch (lines 46–54)
**Before:** Sets `req.user` with `role: decoded.role || 'admin'` and falls through to `next()`.  
**After:** Returns `503` immediately.

```js
} catch (dbError) {
  console.error('Database error in auth middleware:', dbError);
  return res.status(503).json({ error: 'Authentication service temporarily unavailable.' });
}
```

---

### File 2: `auth-service/src/routes/auth.js`

#### Change 4 — Cookie `secure` default (line 15)
**Before:** `secure: process.env.COOKIE_SECURE === 'true'` (opt-in, defaults to `false`)  
**After:** `secure: process.env.COOKIE_SECURE !== 'false'` (opt-out, defaults to `true`)

To run locally over HTTP, add `COOKIE_SECURE=false` to `.env`. No other change needed.

---

## Behavior After Fix

| Condition | Before | After |
|-----------|--------|-------|
| DB pool unavailable | Request proceeds as `admin` | `503` returned |
| DB query throws error | Request proceeds as `admin` | `503` returned |
| User exists, role is NULL | Request proceeds as `admin` | `403` returned |
| User exists, role is set | ✅ Correct | ✅ Unchanged |
| User not found in DB | ✅ `401` returned | ✅ Unchanged |
| `COOKIE_SECURE` not set | Cookie sent over HTTP | Cookie requires HTTPS |
| `COOKIE_SECURE=false` in `.env` | Cookie sent over HTTP | Cookie sent over HTTP (explicit opt-out) |
| `COOKIE_SECURE=true` in `.env` | Cookie requires HTTPS | Cookie requires HTTPS |

---

## Files Changed

| File | Lines Changed | Type |
|------|--------------|-------|
| `backend/src/middleware/authMiddleware.js` | ~18–54 | Bug fix |
| `auth-service/src/routes/auth.js` | 15 | Bug fix |

---

## Testing

- Existing auth middleware tests should be updated to assert `503` responses on DB-error and pool-unavailable paths.
- Add a test case for NULL role → `403`.
- Manually verify local dev login still works after setting `COOKIE_SECURE=false` in `auth-service/.env`.

---

## Out of Scope

- No restructuring of `authMiddleware.js` beyond the targeted lines.
- No changes to RBAC logic, JWT signing, or token refresh paths.
- No TLS/HTTPS setup (local HTTP deployment with explicit `COOKIE_SECURE=false` is acceptable).
