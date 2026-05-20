-- Parts-on-repair join: which parts were consumed to resolve a maintenance call.
--
-- Referenced by `maintenanceCallsRepo.insertCallParts` / `listCallParts` and
-- planned in ANALYTICS_PLAN §7 (Phase 2 parts-on-repair). Schema mirrors the
-- INSERT columns plus `noted_at` used by the listing ORDER BY, and the
-- `transaction_id` link to the IMMS inventory transaction so consumption can
-- be reconciled against stock movements.
--
-- `part_id` is a soft reference (ON DELETE SET NULL) so deleting a part in
-- IMMS does not erase the historical record of its use on a call. `part_name`
-- / `part_number` are snapshotted at insert time for the same reason.

CREATE TABLE IF NOT EXISTS maintenance_call_parts (
  call_part_id    SERIAL PRIMARY KEY,
  call_id         INTEGER NOT NULL REFERENCES maintenance_calls(call_id) ON DELETE CASCADE,
  part_id         INTEGER REFERENCES parts(part_id) ON DELETE SET NULL,
  part_name       VARCHAR(255),
  part_number     VARCHAR(100),
  quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  transaction_id  INTEGER,
  noted_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_call_parts_call ON maintenance_call_parts(call_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_call_parts_part ON maintenance_call_parts(part_id);
