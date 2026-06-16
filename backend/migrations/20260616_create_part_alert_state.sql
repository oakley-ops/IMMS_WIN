-- Tracks the last-notified stock status per part (drives transition detection + dedupe)
CREATE TABLE IF NOT EXISTS part_alert_state (
  part_id     INTEGER PRIMARY KEY REFERENCES parts(part_id) ON DELETE CASCADE,
  last_status VARCHAR(16) NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
