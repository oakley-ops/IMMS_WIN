-- Audit log of every notification send attempt
CREATE TABLE IF NOT EXISTS notification_log (
  id         BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(32) NOT NULL,
  channel    VARCHAR(16) NOT NULL,
  recipient  VARCHAR(255) NOT NULL,
  ref_id     VARCHAR(64),
  status     VARCHAR(16) NOT NULL,
  error      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notification_log_created_at ON notification_log (created_at DESC);
