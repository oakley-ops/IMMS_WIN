-- MCS analytics: schema additions and enriched view
-- Companion to 20260509_create_maintenance_calls.sql
-- Adds fields required for MTTA, SLA tracking, repeat-failure linking,
-- downtime cost, and the parts-on-repair join. Creates the view every
-- report queries.

-- 1. maintenance_calls: analytics fields
ALTER TABLE maintenance_calls
  ADD COLUMN IF NOT EXISTS shift_name VARCHAR(20),
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS escalated_to VARCHAR(255),
  ADD COLUMN IF NOT EXISTS reopened_from_call_id INTEGER REFERENCES maintenance_calls(call_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS root_cause VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_maintenance_calls_shift ON maintenance_calls(shift_name);
CREATE INDEX IF NOT EXISTS idx_maintenance_calls_reason ON maintenance_calls(reason_category);
CREATE INDEX IF NOT EXISTS idx_maintenance_calls_resolved_at ON maintenance_calls(resolved_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_calls_reopened_from ON maintenance_calls(reopened_from_call_id);

-- 2. machines: cost and scheduling for downtime $ and OEE contribution
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS cost_per_hour NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS scheduled_hours_per_week NUMERIC(5, 2);

-- 3. maintenance_call_parts table — owned by the prior MCS migration; do not
--    re-create here. Mentioned only so readers know the analytics view does
--    not depend on parts joins (yet).

-- 4. Enriched view: every report queries this, no report recomputes timing
CREATE OR REPLACE VIEW v_maintenance_calls_enriched AS
SELECT
  mc.call_id,
  mc.machine_id,
  m.name              AS machine_name,
  m.location          AS machine_location,
  m.cost_per_hour     AS machine_cost_per_hour,
  mc.reader_id,
  mc.operator_badge_id,
  mc.operator_name,
  mc.technician_badge_id,
  mc.technician_id,
  mc.technician_name,
  mc.status,
  mc.priority,
  mc.shift_name,
  mc.reason_category,
  mc.root_cause,
  mc.problem_description,
  mc.resolution_notes,
  mc.reopened_from_call_id,
  mc.called_at,
  mc.acknowledged_at,
  mc.technician_arrived_at,
  mc.escalated_at,
  mc.escalated_to,
  mc.resolved_at,
  EXTRACT(EPOCH FROM (mc.acknowledged_at      - mc.called_at))              / 60.0 AS response_minutes,
  EXTRACT(EPOCH FROM (mc.technician_arrived_at - mc.acknowledged_at))       / 60.0 AS travel_minutes,
  EXTRACT(EPOCH FROM (mc.resolved_at          - mc.technician_arrived_at)) / 60.0 AS repair_minutes,
  EXTRACT(EPOCH FROM (mc.resolved_at          - mc.called_at))              / 60.0 AS downtime_minutes,
  CASE
    WHEN mc.acknowledged_at IS NULL THEN NULL
    ELSE (mc.acknowledged_at - mc.called_at) <= INTERVAL '10 minutes'
  END AS sla_met,
  CASE
    WHEN mc.resolved_at IS NULL OR m.cost_per_hour IS NULL THEN NULL
    ELSE ROUND(
      (EXTRACT(EPOCH FROM (mc.resolved_at - mc.called_at)) / 3600.0)::NUMERIC
      * m.cost_per_hour,
      2
    )
  END AS downtime_cost,
  mc.created_at,
  mc.updated_at
FROM maintenance_calls mc
LEFT JOIN machines m ON m.machine_id = mc.machine_id;
