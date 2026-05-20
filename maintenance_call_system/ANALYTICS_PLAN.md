# MCS Analytics & Reporting Plan
**Version:** 1.0
**Date:** 2026-05-12
**Status:** Pre-Implementation (Phase 3 prep, schema additions in Phase 1)

---

## 1. Purpose

Define the data the Maintenance Call System must capture so that operators, supervisors, production managers, and upper management get answers — not just dashboards. This document drives schema additions, reporting endpoints, and the order in which we build reports.

The guiding principle: **store raw timestamps and categorical facts; compute every metric in a view**. Derived values rot the moment the formula changes.

---

## 2. Stakeholders & the Questions They Ask

| Audience | Question | Metric | Formula |
|---|---|---|---|
| Upper management | How much production are we losing? | Total downtime hours | `Σ (resolved_at − called_at)` |
| Upper management | What is it costing us? | Downtime dollars | `downtime_minutes × machines.cost_per_hour / 60` |
| Production manager | Which machines are problem children? | Downtime by machine (Pareto) | group by `machine_id` |
| Production manager | Are we improving? | MTTR trend (weekly/monthly) | avg repair time over time |
| Production manager | How reliable is each machine? | MTBF | `uptime_hours / failure_count` |
| Supervisor | Are techs responding fast enough? | MTTA (Mean Time To Acknowledge) | `avg(acknowledged_at − called_at)` |
| Supervisor | Who is carrying the load? | Calls / repair time by tech | group by `technician_id` |
| Supervisor | Are we hitting SLA? | % calls acknowledged < 10 min | `count(sla_met) / count(*)` |
| Supervisor | Where are we breaking? | Top failure reasons | group by `reason_category` |
| Maintenance lead | Recurring issues? | Repeat-failure rate | same machine + reason inside N days |
| All | Shift comparison | Calls / MTTR / MTTA by shift | group by `shift_name` |

---

## 3. Time Fields — the Foundation

Derived in the SQL view, never stored:

- **Response time** = `acknowledged_at − called_at`
- **Travel/dispatch time** = `technician_arrived_at − acknowledged_at`
- **Repair time** = `resolved_at − technician_arrived_at`
- **Total downtime** = `resolved_at − called_at`
- **SLA met** = `acknowledged_at − called_at <= 10 minutes`

---

## 4. Schema Gaps to Close Now

The current `maintenance_calls` migration is missing fields several reports need. Adding them later means losing historical data. Address in the companion migration `20260512_mcs_analytics_fields.sql`.

1. **`shift_name VARCHAR(20)`** on `maintenance_calls` — required by spec §2.7 but missing.
2. **`acknowledged_at TIMESTAMP`** — distinct from arrival. Tech may ack from the board before walking over. Conflating the two hides dispatch latency.
3. **`escalated_at TIMESTAMP`** and **`escalated_to VARCHAR(255)`** — needed to measure SLA breaches and whether escalations help.
4. **`reopened_from_call_id INTEGER`** — links a new call to a prior one on the same machine within a configurable window. Enables clean repeat-failure reports without fuzzy matching.
5. **`root_cause VARCHAR(50)`** — separate from `reason_category`. Reason is *what failed* (mechanical, electrical). Root cause is *why* (`missed_pm`, `worn_part`, `bad_material_lot`, `operator_setup`). Drives PM and supplier decisions.
6. **`machines.cost_per_hour NUMERIC(10,2)`** and **`machines.scheduled_hours_per_week NUMERIC(5,2)`** — required for downtime dollars and OEE contribution. Flagged as open question in MCS_REQUIREMENTS §6.
7. **`maintenance_call_parts`** join table `(call_id, part_id, quantity, transaction_id)` — Phase 2 parts-on-repair. Design now so the resolve flow does not need to be rewritten.

---

## 5. The Enriched View

A single view powers every report. Every report queries `v_maintenance_calls_enriched` — no report computes downtime itself.

Columns:
- All raw `maintenance_calls` columns
- `response_minutes`, `travel_minutes`, `repair_minutes`, `downtime_minutes`
- `sla_met` boolean (configurable SLA threshold lives in app config, not the view, if it needs to change)
- `downtime_cost` (NULL when `machines.cost_per_hour` is NULL)
- `machine_name`, `machine_location` joined in for convenience

---

## 6. Reporting Surfaces — Build Order

Build in this order. Each step unlocks decisions; do not skip ahead to "pretty" reports before the data is trustworthy.

1. **Live KPI cards** (top of dashboard): open call count, avg MTTA today, avg downtime today, SLA % today.
2. **Pareto: downtime by machine** (last 30 / 90 / 365 days, switchable). Biggest ROI conversation driver.
3. **Trend lines**: MTTR and MTTA, weekly, trailing 12 weeks.
4. **Reason breakdown**: stacked bar by month, colored by `reason_category`.
5. **Machine drill-down**: pick a machine → call history, MTBF, top reasons, parts used (Phase 2).
6. **Tech leaderboard** — supervisor view only. Calls handled, avg repair time, SLA hit rate. Frame as workload not performance ranking.
7. **Shift report** — auto-generated at end of each shift: open at start, opened during, resolved during, still open, top reason.

---

## 7. Query Architecture

- **Views over rollups, until you can't.** `v_maintenance_calls_enriched` first. Add materialized daily rollups (`mv_downtime_daily`) only past ~50k calls.
- **One stats endpoint.** `GET /api/v1/maintenance-calls/stats/metrics?from=&to=&machine_id=&shift=&reason=` returns one JSON blob. Frontend stays simple, caching trivial.
- **Parameterized everywhere.** Filter values come from query params, never interpolated.
- **Time zone:** store UTC, format in the client. Shift boundary is local time and is captured as a string label on the call (`shift_name`), so this is not load-bearing.

---

## 8. Data Quality Rules

These keep reports trustworthy:

- `resolution_notes` required to resolve (already in spec §4.3).
- `reason_category` required to resolve — promote from optional. Without this, the reason chart is garbage.
- `acknowledged_at` set automatically the moment a tech badge-swipes the call; cannot be edited.
- `shift_name` written once at call creation; never recomputed (operator shift, not resolution shift).
- A machine has at most one non-resolved call at a time (spec §4.3).

---

## 9. Out of Scope (For Now)

Listed so we don't get pulled in:

- OEE composite metric (availability × performance × quality). We contribute only the availability term until production/quality data is integrated.
- Predictive maintenance / ML failure prediction.
- Cross-plant benchmarking.
- Public dashboards. All reports are auth-gated.

---

## 10. Open Questions

- [ ] Confirm SLA threshold — 10 minutes assumed from §1.5. Configurable?
- [ ] `cost_per_hour` per machine — who owns this data, and is it differentiated by shift / product?
- [ ] Repeat-failure window — 24h, 7d, 30d? Likely needs to be per-reason.
- [ ] Root cause taxonomy — start with the 4 suggested, expand from real data after 90 days.
