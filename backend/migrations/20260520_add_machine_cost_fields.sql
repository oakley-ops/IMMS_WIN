-- Adds cost / scheduling fields to the machines table.
--
-- These were originally introduced by MCS's `20260512_mcs_analytics_fields.sql`
-- so its downtime-cost and OEE views could compute $/hour and weekly capacity.
-- IMMS is the system of record for `machines`, so authorship of these columns
-- now lives here. MCS reads them via the shared database.
--
-- `cost_per_hour`            — fully-burdened cost of running the machine,
--                              used for downtime $ on the enriched call view.
-- `scheduled_hours_per_week` — planned run hours, used as the denominator for
--                              availability / OEE contribution.

ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS cost_per_hour NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS scheduled_hours_per_week NUMERIC(5, 2);
