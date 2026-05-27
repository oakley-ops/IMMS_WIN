-- Creates the per-user MCS permission store.
-- One row per IMMS user who has been explicitly configured.
-- Missing row = all delegatable permissions FALSE (role defaults still apply).

CREATE TABLE IF NOT EXISTS mcs_user_permissions (
  user_id          INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  badges_add       BOOLEAN NOT NULL DEFAULT FALSE,
  readers_manage   BOOLEAN NOT NULL DEFAULT FALSE,
  calls_manage     BOOLEAN NOT NULL DEFAULT FALSE,
  analytics_view   BOOLEAN NOT NULL DEFAULT FALSE,
  skilled_operator BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by       INTEGER REFERENCES users(user_id),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcs_user_permissions_user ON mcs_user_permissions(user_id);
