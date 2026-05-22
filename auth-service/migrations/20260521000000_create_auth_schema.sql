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
