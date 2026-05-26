# MCS Analytics Redesign — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the Analytics tab into four clearly labelled sections that serve both leadership (quick top-line summary) and maintenance supervisors (filterable detail), and add a fully new Parts Consumption section powered by the `maintenance_call_parts` data that is already being captured but never displayed.

**Audiences:**
- **Leadership / plant manager** — reads Section 1 (Production Health), stops there. Wants cost, downtime, SLA at a glance.
- **Maintenance supervisor** — scrolls all four sections, filters by machine/date/tech to investigate root causes.

---

## Page Structure

One vertically scrolling page. A sticky filter bar at the top applies to all four sections below.

```
┌─────────────────────────────────────────────────────┐
│  FILTER BAR  [From] [To] [Shift ▾] [Machine ▾] [Reason ▾]  [Refresh] │
├─────────────────────────────────────────────────────┤
│  ① PRODUCTION HEALTH                                │
│  ② PARTS CONSUMPTION  (new)                         │
│  ③ EQUIPMENT                                        │
│  ④ TEAM PERFORMANCE                                 │
└─────────────────────────────────────────────────────┘
```

**Filter bar changes from current:** add a **Machine** dropdown populated from `/machines/list`. All other filters (date range, shift, reason) already exist.

---

## Section 1: Production Health

Eight KPI cards in two rows of four. Reordered from current so the highest-impact numbers appear first.

**Row 1 — Production impact:**
| Card | Value | Sub-label | Data source |
|---|---|---|---|
| Downtime Cost | `$12,400` | in period | `overall.total_downtime_cost` (existing) |
| Total Downtime | `48.2 hr` | in period | `overall.total_downtime_hours` (existing) |
| SLA % | `91.3%` | acknowledged ≤ 10 min | `overall.sla_pct` (existing) |
| Open Calls | `3` | right now | `overall.open_calls` (existing) |

**Row 2 — Response metrics:**
| Card | Value | Sub-label | Data source |
|---|---|---|---|
| Total Calls | `142` | resolved in range | `overall.total_calls` (existing) |
| MTTA | `6.4 min` | mean time to acknowledge | `overall.avg_response_minutes` (existing) |
| MTTR | `38.2 min` | mean time to repair | `overall.avg_repair_minutes` (existing) |
| Critical Calls | `7` | priority = critical in range | `overall.critical_calls` **(new)** |

**Backend change:** add `COUNT(*) FILTER (WHERE priority = 'critical') AS critical_calls` to the overall query in `callMetrics()`.

---

## Section 2: Parts Consumption (New)

Entirely new. Powered by a new `/stats/parts-metrics` endpoint. Three panels.

### Panel A — Top Parts by Quantity Used (left, ~60% width)
Horizontal bar chart. Top 10 parts by total quantity consumed in the filter range.

Each bar shows: `Part Name  (Part #)  ████████  24 units  (8 calls)`

### Panel B — Top Machines by Parts Used (right, ~40% width)
Horizontal bar chart. Top 10 machines ranked by total parts quantity consumed.

Each bar shows: `Machine Name  ██████  38 units`

### Panel C — Parts Usage by Technician (full width table)
| Technician | Calls with Parts Logged | Unique Parts Used | Total Qty |
|---|---|---|---|
| John D. | 34 | 12 | 89 |
| Maria S. | 28 | 9 | 61 |

### New backend endpoint

**Route:** `GET /stats/parts-metrics`
**Auth:** required
**Query params:** `from`, `to`, `shift_name`, `machine_id`, `reason` (same as existing metrics)

**Response shape:**
```json
{
  "top_parts": [
    { "part_id": 1, "part_name": "Bearing 6205", "part_number": "BRG-6205",
      "total_qty": 24, "call_count": 8 }
  ],
  "by_machine": [
    { "machine_id": 125, "machine_name": "Die Press 701",
      "unique_parts": 6, "total_qty": 38 }
  ],
  "by_tech": [
    { "technician_id": 3, "technician_name": "John D.",
      "calls_with_parts": 34, "unique_parts": 12, "total_qty": 89 }
  ]
}
```

**SQL approach (all three run in parallel via `Promise.all`):**

*Top parts* — join `maintenance_call_parts` → `maintenance_calls`, filter by date/shift/machine/reason on `maintenance_calls`, group by part, order by `SUM(quantity) DESC LIMIT 10`.

*By machine* — same join, group by `machine_id`, order by `SUM(quantity) DESC LIMIT 10`.

*By tech* — same join, group by `technician_id`, order by `SUM(quantity) DESC`.

All three queries filter `mc.status = 'resolved'` plus the date/shift/machine/reason conditions.

### New frontend service method
Add `getPartsMetrics(filters: MetricsFilters): Promise<PartsMetrics>` to `maintenanceCallService.ts`.

Add `PartsMetrics` type:
```ts
export interface PartsMetrics {
  top_parts: { part_id: number; part_name: string; part_number: string; total_qty: number; call_count: number }[];
  by_machine: { machine_id: number; machine_name: string; unique_parts: number; total_qty: number }[];
  by_tech: { technician_id: number | null; technician_name: string | null; calls_with_parts: number; unique_parts: number; total_qty: number }[];
}
```

---

## Section 3: Equipment

Two panels side by side. Both already exist; one gets a new column.

### Panel A — Top Machines by Downtime (left, ~60% width)
No changes. HBar chart, machines ranked by `total_downtime_hours`. Already implemented.

### Panel B — Repeat Failures (right, ~40% width)
Add a **Suspensions** column.

| Machine | Reason | Occurrences | Suspensions |
|---|---|---|---|
| Die Press 701 | Mechanical | 7 | 2 |
| EMV 5 | Electrical | 5 | 1 |

**Backend change:** add `COUNT(*) FILTER (WHERE suspended_at IS NOT NULL) AS suspensions` to the repeat failures query in `callMetrics()`. This requires querying `maintenance_calls` directly (not the enriched view, which does not expose `suspended_at`). Update the repeat failures query to join `maintenance_calls` directly or add `suspended_at` to the GROUP BY aggregation.

A high suspension count on a repeat failure means the team frequently stops mid-repair — signals a parts stocking or skills gap for that failure type.

---

## Section 4: Team Performance

Two panels. Both already exist; each gets one new column.

### Panel A — Technician Workload (full width table)
Add a **Suspensions** column.

| Technician | Calls | Avg MTTA | Avg MTTR | SLA % | Suspensions |
|---|---|---|---|---|---|
| John D. | 34 | 5.2 min | 31.4 min | 94% | 4 |
| Maria S. | 28 | 8.1 min | 44.2 min | 86% | 8 |

**Backend change:** add `COUNT(*) FILTER (WHERE suspended_at IS NOT NULL) AS suspensions` to the by-tech query in `callMetrics()`. Same note as Section 3 — query `maintenance_calls` directly for the `suspended_at` filter since the enriched view does not expose it.

A tech with high suspensions relative to their call count is frequently stalling mid-repair. Paired with a high MTTR it indicates a pattern worth investigating.

### Panel B — By Shift (HBar)
Add **Avg MTTA** column.

| Shift | Calls | Avg MTTA | Avg Downtime |
|---|---|---|---|
| 1st Shift | 58 | 5.8 min | 42 min |
| 2nd Shift | 49 | 7.2 min | 48 min |
| 3rd Shift | 35 | 11.4 min | 61 min |

**Backend change:** add `ROUND(AVG(response_minutes)::numeric, 1) AS avg_response_minutes` to the by-shift query in `callMetrics()`. Already computable from `v_maintenance_calls_enriched`.

---

## Frontend Architecture

### Files to modify
- `maintenance_call_system/frontend/src/components/Analytics.tsx` — restructure into four named sections, add machine filter, reorder KPI cards, add new columns, add Parts Consumption section
- `maintenance_call_system/frontend/src/services/maintenanceCallService.ts` — add `getPartsMetrics()` and `PartsMetrics` type

### Files to create
- None required — Parts Consumption can be implemented inline in `Analytics.tsx`. If the file grows unwieldy (>500 lines), extract `PartsConsumptionSection.tsx` as a separate component.

### State management
Add a second independent fetch for parts metrics alongside the existing metrics fetch. Both are triggered by filter changes. Each has its own `loading` and `error` state so a parts fetch failure does not blank the whole page.

---

## Backend Architecture

### Files to modify
- `maintenance_call_system/backend/src/repositories/maintenanceCallsRepo.js`
  - Add `partsMetrics(db, filters)` function
  - Update `callMetrics()`: add `critical_calls` to overall query, `avg_response_minutes` to by-shift query, `suspensions` to by-tech and repeat-failures queries
- `maintenance_call_system/backend/src/routes/maintenanceCalls.js`
  - Add `GET /stats/parts-metrics` route (auth required)
- `maintenance_call_system/backend/src/schemas/maintenanceCalls.js`
  - Add `partsMetricsQuery` schema (same shape as `metricsQuery`, reuse or extend)

### No schema migrations required
All data needed already exists in `maintenance_call_parts`, `maintenance_calls`, and `machines`. The `suspended_at` column already exists on `maintenance_calls`. No new tables or columns needed.

---

## Testing

### Backend
- Unit tests for `partsMetrics()` in the repo test suite: assert correct grouping, correct filter application, empty result when no parts logged
- Unit tests for the updated `callMetrics()` fields: `critical_calls` appears in overall, `suspensions` appears in by-tech and repeat-failures, `avg_response_minutes` appears in by-shift

### Frontend
- Vitest tests for the Parts Consumption section: mock `getPartsMetrics`, assert top-parts bars render, assert by-machine bars render, assert tech table rows render
- Test that a `getPartsMetrics` failure shows an inline error without hiding the rest of the page

---

## Out of Scope
- Parts cost / spend (requires `unit_cost` on the `parts` table; not confirmed available — treat as a future enhancement)
- Exporting analytics to CSV or PDF
- Real-time auto-refresh of analytics (manual Refresh button is sufficient)
- Chart library (recharts, chart.js) — existing HBar component is sufficient for all new charts
