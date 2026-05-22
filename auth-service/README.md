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
