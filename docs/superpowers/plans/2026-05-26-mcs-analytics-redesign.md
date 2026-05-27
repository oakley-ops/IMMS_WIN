# MCS Analytics Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add parts-consumption analytics, surface four new metric fields (critical calls, suspensions, MTTA by shift), restructure the Analytics page into four labelled sections, and add a machine filter.

**Architecture:** Five independent tasks delivered in order — two backend tasks (new endpoint + updated queries), one frontend service task, one new component, one restructure of the existing Analytics page. No DB migrations required; all data already exists.

**Tech Stack:** Node/Express backend (CommonJS), Zod validation, PostgreSQL via `pg`. Next.js 14 App Router frontend, MUI v5, TypeScript, Vitest + Testing Library.

---

## File Map

| File | Change |
|---|---|
| `maintenance_call_system/backend/src/schemas/maintenanceCalls.js` | Add `partsMetricsQuery` schema |
| `maintenance_call_system/backend/src/repositories/maintenanceCallsRepo.js` | Add `partsMetrics()`, update `callMetrics()` |
| `maintenance_call_system/backend/src/routes/maintenanceCalls.js` | Add `GET /stats/parts-metrics` route |
| `maintenance_call_system/backend/src/routes/maintenanceCalls.test.js` | Add auth bypass mock + new tests |
| `maintenance_call_system/frontend/src/services/maintenanceCallService.ts` | Add `PartsMetrics` type + `getPartsMetrics()` |
| `maintenance_call_system/frontend/src/services/maintenanceCallService.test.ts` | Add `getPartsMetrics` test |
| `maintenance_call_system/frontend/src/components/analytics/PartsConsumptionSection.tsx` | Create (new) |
| `maintenance_call_system/frontend/src/components/analytics/PartsConsumptionSection.test.tsx` | Create (new) |
| `maintenance_call_system/frontend/src/components/Analytics.tsx` | Restructure + new sections |
| `maintenance_call_system/frontend/src/components/Analytics.test.tsx` | Create (new) |

---

## Task 1: Backend — `partsMetrics()` + `/stats/parts-metrics` route

**Files:**
- Modify: `maintenance_call_system/backend/src/schemas/maintenanceCalls.js`
- Modify: `maintenance_call_system/backend/src/repositories/maintenanceCallsRepo.js`
- Modify: `maintenance_call_system/backend/src/routes/maintenanceCalls.js`
- Modify: `maintenance_call_system/backend/src/routes/maintenanceCalls.test.js`

- [ ] **Step 1: Add auth bypass mock to top of test file**

Open `maintenance_call_system/backend/src/routes/maintenanceCalls.test.js`. Insert after `vi.mock('pg', ...)` and before `const db = require(...)`:

```js
// Bypass JWT auth so auth-protected routes can be tested without real tokens.
vi.mock('../middleware/auth', () => ({
  default: (_req, _res, next) => next(),
}));
```

- [ ] **Step 2: Write failing tests for the new endpoint**

Add this describe block at the bottom of `maintenanceCalls.test.js`:

```js
describe('GET /stats/parts-metrics', () => {
  it('returns top_parts, by_machine, and by_tech arrays', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ part_id: 1, part_name: 'Bearing 6205', part_number: 'B-6205', total_qty: 5, call_count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ machine_id: 125, machine_name: 'Die Press 701', unique_parts: 3, total_qty: 8 }] })
      .mockResolvedValueOnce({ rows: [{ technician_id: 1, technician_name: 'John D.', calls_with_parts: 4, unique_parts: 2, total_qty: 7 }] });

    const res = await request(app).get('/stats/parts-metrics');
    expect(res.status).toBe(200);
    expect(res.body.top_parts[0].part_name).toBe('Bearing 6205');
    expect(res.body.by_machine[0].machine_name).toBe('Die Press 701');
    expect(res.body.by_tech[0].technician_name).toBe('John D.');
  });

  it('returns empty arrays when no parts have been logged', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/stats/parts-metrics');
    expect(res.status).toBe(200);
    expect(res.body.top_parts).toEqual([]);
    expect(res.body.by_machine).toEqual([]);
    expect(res.body.by_tech).toEqual([]);
  });

  it('returns 500 when the database throws', async () => {
    db.query.mockRejectedValueOnce(new Error('db is down'));
    const res = await request(app).get('/stats/parts-metrics');
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd maintenance_call_system/backend && npx vitest run src/routes/maintenanceCalls.test.js
```

Expected: the three new tests FAIL with 404 (route not found).

- [ ] **Step 4: Add `partsMetricsQuery` schema**

In `maintenance_call_system/backend/src/schemas/maintenanceCalls.js`, add before `module.exports`:

```js
// ─── Parts metrics query (same shape as metricsQuery) ───────────────────────
const partsMetricsQuery = metricsQuery;
```

And add `partsMetricsQuery` to `module.exports`:

```js
module.exports = {
  idParam,
  badgeSwipeBody,
  resolveBody,
  suspendBody,
  logPartsBody,
  partsSearchQuery,
  callListQuery,
  createBadgeBody,
  updateBadgeBody,
  createReaderBody,
  updateReaderBody,
  metricsQuery,
  partsMetricsQuery,
};
```

- [ ] **Step 5: Add `partsMetrics()` to the repository**

In `maintenance_call_system/backend/src/repositories/maintenanceCallsRepo.js`, add this function before the `// ─── Badge admin ───` comment:

```js
const partsMetrics = async (db, { from, to, shift_name, machine_id, reason } = {}) => {
  const conds = [];
  const params = [];
  let p = 1;
  if (from)       { conds.push(`mc.called_at >= $${p++}`);      params.push(from); }
  if (to)         { conds.push(`mc.called_at <= $${p++}`);      params.push(to); }
  if (machine_id) { conds.push(`mc.machine_id = $${p++}`);      params.push(machine_id); }
  if (shift_name) { conds.push(`mc.shift_name = $${p++}`);      params.push(shift_name); }
  if (reason)     { conds.push(`mc.reason_category = $${p++}`); params.push(reason); }

  const extra = conds.length ? ' AND ' + conds.join(' AND ') : '';
  const whereResolved = `mc.status = 'resolved'${extra}`;

  const [topParts, byMachine, byTech] = await Promise.all([
    db.query(`
      SELECT mcp.part_id, mcp.part_name, mcp.part_number,
             SUM(mcp.quantity)::int           AS total_qty,
             COUNT(DISTINCT mcp.call_id)::int  AS call_count
        FROM maintenance_call_parts mcp
        JOIN maintenance_calls mc ON mcp.call_id = mc.call_id
       WHERE ${whereResolved}
       GROUP BY mcp.part_id, mcp.part_name, mcp.part_number
       ORDER BY total_qty DESC
       LIMIT 10
    `, params),

    db.query(`
      SELECT mc.machine_id, m.name AS machine_name,
             COUNT(DISTINCT mcp.part_id)::int  AS unique_parts,
             SUM(mcp.quantity)::int             AS total_qty
        FROM maintenance_call_parts mcp
        JOIN maintenance_calls mc ON mcp.call_id = mc.call_id
        JOIN machines m ON mc.machine_id = m.machine_id
       WHERE ${whereResolved}
       GROUP BY mc.machine_id, m.name
       ORDER BY total_qty DESC
       LIMIT 10
    `, params),

    db.query(`
      SELECT mc.technician_id, mc.technician_name,
             COUNT(DISTINCT mcp.call_id)::int  AS calls_with_parts,
             COUNT(DISTINCT mcp.part_id)::int  AS unique_parts,
             SUM(mcp.quantity)::int             AS total_qty
        FROM maintenance_call_parts mcp
        JOIN maintenance_calls mc ON mcp.call_id = mc.call_id
       WHERE ${whereResolved}
       GROUP BY mc.technician_id, mc.technician_name
       ORDER BY total_qty DESC
    `, params),
  ]);

  return {
    top_parts: topParts.rows,
    by_machine: byMachine.rows,
    by_tech: byTech.rows,
  };
};
```

Add `partsMetrics` to `module.exports` at the bottom of the file.

- [ ] **Step 6: Add `GET /stats/parts-metrics` route**

In `maintenance_call_system/backend/src/routes/maintenanceCalls.js`, add this route directly after the existing `GET /stats/metrics` route:

```js
// ─── Parts metrics — auth required ──────────────────────────────────────────

router.get(
  '/stats/parts-metrics',
  auth,
  validate({ query: S.partsMetricsQuery }),
  handler(async (req, res) => res.json(await repo.partsMetrics(db, req.query)))
);
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd maintenance_call_system/backend && npx vitest run src/routes/maintenanceCalls.test.js
```

Expected: all tests PASS (including the three new ones).

- [ ] **Step 8: Commit**

```bash
cd maintenance_call_system
git add backend/src/schemas/maintenanceCalls.js \
        backend/src/repositories/maintenanceCallsRepo.js \
        backend/src/routes/maintenanceCalls.js \
        backend/src/routes/maintenanceCalls.test.js
git commit -m "feat(mcs-backend): add GET /stats/parts-metrics endpoint

New partsMetrics() repo function aggregates maintenance_call_parts
data into top_parts, by_machine, and by_tech dimensions.
Route is auth-protected and accepts the same filter params as /stats/metrics."
```

---

## Task 2: Backend — Update `callMetrics()` with critical_calls and suspensions

**Files:**
- Modify: `maintenance_call_system/backend/src/repositories/maintenanceCallsRepo.js`
- Modify: `maintenance_call_system/backend/src/routes/maintenanceCalls.test.js`

- [ ] **Step 1: Write failing tests for the new fields**

Add this describe block at the bottom of `maintenanceCalls.test.js`:

```js
describe('GET /stats/metrics', () => {
  // Helper: mock all 8 parallel queries in callMetrics order:
  // [overall, openCount, byMachine, byReason, byShift, byTech, trend, repeats]
  const mockAllMetrics = ({
    overrideOverall = {},
    overrideTech = [],
    overrideRepeats = [],
  } = {}) => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total_calls: '10', avg_response_minutes: '5', avg_repair_minutes: '30', avg_downtime_minutes: '35', total_downtime_hours: '6', total_downtime_cost: '1200', sla_pct: '90', critical_calls: '3', ...overrideOverall }] })
      .mockResolvedValueOnce({ rows: [{ open_calls: '2' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: overrideTech })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: overrideRepeats });
  };

  it('overall includes critical_calls', async () => {
    mockAllMetrics({ overrideOverall: { critical_calls: '7' } });
    const res = await request(app).get('/stats/metrics');
    expect(res.status).toBe(200);
    expect(Number(res.body.overall.critical_calls)).toBe(7);
  });

  it('by_tech includes suspensions per technician', async () => {
    mockAllMetrics({
      overrideTech: [{ technician_id: 1, technician_name: 'John D.', call_count: '8', avg_response_minutes: '6', avg_repair_minutes: '30', sla_pct: '87', suspensions: '3' }],
    });
    const res = await request(app).get('/stats/metrics');
    expect(res.status).toBe(200);
    expect(Number(res.body.by_tech[0].suspensions)).toBe(3);
  });

  it('repeat_failures includes suspensions per machine+reason combo', async () => {
    mockAllMetrics({
      overrideRepeats: [{ machine_id: 125, machine_name: 'Die Press 701', reason_category: 'mechanical', occurrences: '5', suspensions: '2' }],
    });
    const res = await request(app).get('/stats/metrics');
    expect(res.status).toBe(200);
    expect(Number(res.body.repeat_failures[0].suspensions)).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd maintenance_call_system/backend && npx vitest run src/routes/maintenanceCalls.test.js
```

Expected: three new tests FAIL (fields `critical_calls` and `suspensions` are absent).

- [ ] **Step 3: Update `callMetrics()` in the repository**

In `maintenance_call_system/backend/src/repositories/maintenanceCallsRepo.js`, replace the entire `callMetrics` function with:

```js
const callMetrics = async (db, { from, to, shift_name, machine_id, reason }) => {
  // Plain conditions (for queries directly on v_maintenance_calls_enriched).
  const baseConditions = [];
  // Aliased conditions (for queries that JOIN maintenance_calls mc alongside the view alias v).
  const baseConditionsV = [];
  const baseParams = [];
  let p = 1;
  if (from) {
    baseConditions.push(`called_at >= $${p}`);
    baseConditionsV.push(`v.called_at >= $${p}`);
    baseParams.push(from); p++;
  }
  if (to) {
    baseConditions.push(`called_at <= $${p}`);
    baseConditionsV.push(`v.called_at <= $${p}`);
    baseParams.push(to); p++;
  }
  if (machine_id) {
    baseConditions.push(`machine_id = $${p}`);
    baseConditionsV.push(`v.machine_id = $${p}`);
    baseParams.push(machine_id); p++;
  }
  if (shift_name) {
    baseConditions.push(`shift_name = $${p}`);
    baseConditionsV.push(`v.shift_name = $${p}`);
    baseParams.push(shift_name); p++;
  }
  if (reason) {
    baseConditions.push(`reason_category = $${p}`);
    baseConditionsV.push(`v.reason_category = $${p}`);
    baseParams.push(reason); p++;
  }

  const baseWhere    = baseConditions.length  ? 'WHERE ' + baseConditions.join(' AND ')  : '';
  const resolvedWhere = baseConditions.length
    ? `WHERE status = 'resolved' AND ` + baseConditions.join(' AND ')
    : `WHERE status = 'resolved'`;
  const openWhere = baseConditions.length
    ? `${baseWhere} AND status IN ('open', 'in_progress', 'suspended')`
    : `WHERE status IN ('open', 'in_progress', 'suspended')`;

  // Used by queries that JOIN maintenance_calls mc to access suspended_at.
  const resolvedWhereV = baseConditionsV.length
    ? `WHERE v.status = 'resolved' AND ` + baseConditionsV.join(' AND ')
    : `WHERE v.status = 'resolved'`;

  const [overall, openCount, byMachine, byReason, byShift, byTech, trend, repeats] = await Promise.all([
    // 1. Overall KPIs — add critical_calls
    db.query(`
      SELECT
        COUNT(*)                                            AS total_calls,
        ROUND(AVG(response_minutes)::numeric, 1)            AS avg_response_minutes,
        ROUND(AVG(repair_minutes)::numeric, 1)              AS avg_repair_minutes,
        ROUND(AVG(downtime_minutes)::numeric, 1)            AS avg_downtime_minutes,
        ROUND((SUM(downtime_minutes) / 60.0)::numeric, 1)   AS total_downtime_hours,
        ROUND(SUM(downtime_cost)::numeric, 2)               AS total_downtime_cost,
        ROUND((100.0 * COUNT(*) FILTER (WHERE sla_met)
               / NULLIF(COUNT(*) FILTER (WHERE sla_met IS NOT NULL), 0))::numeric, 1) AS sla_pct,
        COUNT(*) FILTER (WHERE priority = 'critical')        AS critical_calls
      FROM v_maintenance_calls_enriched
      ${resolvedWhere}
    `, baseParams),

    // 2. Open call count
    db.query(`
      SELECT COUNT(*) AS open_calls
      FROM v_maintenance_calls_enriched
      ${openWhere}
    `, baseParams),

    // 3. By machine
    db.query(`
      SELECT machine_id,
             machine_name,
             COUNT(*)                                            AS call_count,
             ROUND(AVG(downtime_minutes)::numeric, 1)            AS avg_downtime_minutes,
             ROUND((SUM(downtime_minutes) / 60.0)::numeric, 1)   AS total_downtime_hours,
             ROUND(SUM(downtime_cost)::numeric, 2)               AS total_downtime_cost
      FROM v_maintenance_calls_enriched
      ${resolvedWhere}
      GROUP BY machine_id, machine_name
      ORDER BY total_downtime_hours DESC NULLS LAST
      LIMIT 10
    `, baseParams),

    // 4. By reason
    db.query(`
      SELECT COALESCE(reason_category, 'unknown') AS reason_category,
             COUNT(*)                                  AS count,
             ROUND(AVG(downtime_minutes)::numeric, 1)  AS avg_downtime_minutes
      FROM v_maintenance_calls_enriched
      ${resolvedWhere}
      GROUP BY reason_category
      ORDER BY count DESC
    `, baseParams),

    // 5. By shift
    db.query(`
      SELECT COALESCE(shift_name, 'Unknown')           AS shift_name,
             COUNT(*)                                  AS call_count,
             ROUND(AVG(response_minutes)::numeric, 1)   AS avg_response_minutes,
             ROUND(AVG(downtime_minutes)::numeric, 1)   AS avg_downtime_minutes
      FROM v_maintenance_calls_enriched
      ${resolvedWhere}
      GROUP BY shift_name
      ORDER BY shift_name
    `, baseParams),

    // 6. By tech — JOIN maintenance_calls to access suspended_at
    db.query(`
      SELECT v.technician_id,
             v.technician_name,
             COUNT(*)                                             AS call_count,
             ROUND(AVG(v.response_minutes)::numeric, 1)           AS avg_response_minutes,
             ROUND(AVG(v.repair_minutes)::numeric, 1)             AS avg_repair_minutes,
             ROUND((100.0 * COUNT(*) FILTER (WHERE v.sla_met)
                    / NULLIF(COUNT(*) FILTER (WHERE v.sla_met IS NOT NULL), 0))::numeric, 1) AS sla_pct,
             COUNT(*) FILTER (WHERE mc.suspended_at IS NOT NULL)  AS suspensions
        FROM v_maintenance_calls_enriched v
        JOIN maintenance_calls mc ON mc.call_id = v.call_id
        ${resolvedWhereV}
        GROUP BY v.technician_id, v.technician_name
        ORDER BY call_count DESC
        LIMIT 20
    `, baseParams),

    // 7. Weekly trend
    db.query(`
      SELECT DATE_TRUNC('week', called_at)::date         AS week_start,
             COUNT(*)                                    AS call_count,
             ROUND(AVG(response_minutes)::numeric, 1)    AS avg_mtta_minutes,
             ROUND(AVG(repair_minutes)::numeric, 1)      AS avg_mttr_minutes,
             ROUND(AVG(downtime_minutes)::numeric, 1)    AS avg_downtime_minutes
      FROM v_maintenance_calls_enriched
      ${resolvedWhere}
      GROUP BY 1
      ORDER BY 1
    `, baseParams),

    // 8. Repeat failures — JOIN maintenance_calls to access suspended_at
    db.query(`
      SELECT v.machine_id,
             v.machine_name,
             v.reason_category,
             COUNT(*)                                             AS occurrences,
             COUNT(*) FILTER (WHERE mc.suspended_at IS NOT NULL)  AS suspensions
        FROM v_maintenance_calls_enriched v
        JOIN maintenance_calls mc ON mc.call_id = v.call_id
        ${resolvedWhereV}
        GROUP BY v.machine_id, v.machine_name, v.reason_category
        HAVING COUNT(*) >= 3
        ORDER BY occurrences DESC
        LIMIT 10
    `, baseParams),
  ]);

  return {
    overall: { ...overall.rows[0], open_calls: Number(openCount.rows[0].open_calls) },
    by_machine: byMachine.rows,
    by_reason: byReason.rows,
    by_shift: byShift.rows,
    by_tech: byTech.rows,
    trend_weekly: trend.rows,
    repeat_failures: repeats.rows,
  };
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd maintenance_call_system/backend && npx vitest run src/routes/maintenanceCalls.test.js
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd maintenance_call_system
git add backend/src/repositories/maintenanceCallsRepo.js \
        backend/src/routes/maintenanceCalls.test.js
git commit -m "feat(mcs-backend): add critical_calls and suspensions to callMetrics

- overall: adds critical_calls (COUNT FILTER priority = critical)
- by_tech: adds suspensions (calls where suspended_at IS NOT NULL) via JOIN
- repeat_failures: adds suspensions column via same JOIN
- by_shift already returned avg_response_minutes; no change needed there
- Introduces resolvedWhereV (v.-prefixed WHERE) for joined queries"
```

---

## Task 3: Frontend — `PartsMetrics` type + `getPartsMetrics()` service method

**Files:**
- Modify: `maintenance_call_system/frontend/src/services/maintenanceCallService.ts`
- Modify: `maintenance_call_system/frontend/src/services/maintenanceCallService.test.ts`

- [ ] **Step 1: Write failing test**

Add this describe block at the bottom of `maintenanceCallService.test.ts`:

```ts
describe('getPartsMetrics', () => {
  it('GETs /stats/parts-metrics and forwards filter params', async () => {
    const parts = { top_parts: [], by_machine: [], by_tech: [] };
    mockAxiosInstance.get.mockResolvedValueOnce({ data: parts });
    const result = await svc.getPartsMetrics({ from: '2026-01-01', machine_id: 125 });
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/stats/parts-metrics', {
      params: { from: '2026-01-01', machine_id: 125 },
    });
    expect(result).toEqual(parts);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd maintenance_call_system/frontend && npx vitest run src/services/maintenanceCallService.test.ts
```

Expected: FAIL with `svc.getPartsMetrics is not a function`.

- [ ] **Step 3: Add `PartsMetrics` type and update `CallMetrics`**

In `maintenance_call_system/frontend/src/services/maintenanceCallService.ts`:

After the `MetricsFilters` interface, add:

```ts
export interface PartsMetrics {
  top_parts: {
    part_id: number;
    part_name: string;
    part_number: string | null;
    total_qty: number;
    call_count: number;
  }[];
  by_machine: {
    machine_id: number;
    machine_name: string;
    unique_parts: number;
    total_qty: number;
  }[];
  by_tech: {
    technician_id: number | null;
    technician_name: string | null;
    calls_with_parts: number;
    unique_parts: number;
    total_qty: number;
  }[];
}
```

Also update the `CallMetrics` interface to add new fields:

```ts
// In overall:
overall: {
  total_calls: string;
  open_calls: number;
  avg_response_minutes: string | null;
  avg_repair_minutes: string | null;
  avg_downtime_minutes: string | null;
  total_downtime_hours: string | null;
  total_downtime_cost: string | null;
  sla_pct: string | null;
  critical_calls: string | null;   // NEW
};

// In by_tech[]:
by_tech: {
  technician_id: number | null;
  technician_name: string | null;
  call_count: string;
  avg_response_minutes: string | null;
  avg_repair_minutes: string | null;
  sla_pct: string | null;
  suspensions: string | null;   // NEW
}[];

// In repeat_failures[]:
repeat_failures: {
  machine_id: number;
  machine_name: string;
  reason_category: string | null;
  occurrences: string;
  suspensions: string | null;   // NEW
}[];
```

- [ ] **Step 4: Add `getPartsMetrics` to the service object**

In the `svc` object in `maintenanceCallService.ts`, add after `getMetrics`:

```ts
getPartsMetrics: (params?: MetricsFilters) =>
  api.get<PartsMetrics>('/stats/parts-metrics', { params }).then(r => r.data),
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd maintenance_call_system/frontend && npx vitest run src/services/maintenanceCallService.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
cd maintenance_call_system
git add frontend/src/services/maintenanceCallService.ts \
        frontend/src/services/maintenanceCallService.test.ts
git commit -m "feat(mcs-frontend): add PartsMetrics type and getPartsMetrics() service method

Updates CallMetrics to include critical_calls, suspensions (by_tech,
repeat_failures). Adds PartsMetrics interface and getPartsMetrics()
method calling GET /stats/parts-metrics."
```

---

## Task 4: Frontend — `PartsConsumptionSection` component

**Files:**
- Create: `maintenance_call_system/frontend/src/components/analytics/PartsConsumptionSection.tsx`
- Create: `maintenance_call_system/frontend/src/components/analytics/PartsConsumptionSection.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `maintenance_call_system/frontend/src/components/analytics/PartsConsumptionSection.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import PartsConsumptionSection from './PartsConsumptionSection';
import type { PartsMetrics } from '../../services/maintenanceCallService';

const emptyParts: PartsMetrics = { top_parts: [], by_machine: [], by_tech: [] };

const filledParts: PartsMetrics = {
  top_parts: [
    { part_id: 1, part_name: 'Bearing 6205', part_number: 'B-6205', total_qty: 24, call_count: 8 },
  ],
  by_machine: [
    { machine_id: 125, machine_name: 'Die Press 701', unique_parts: 6, total_qty: 38 },
  ],
  by_tech: [
    { technician_id: 1, technician_name: 'John D.', calls_with_parts: 12, unique_parts: 5, total_qty: 30 },
  ],
};

describe('PartsConsumptionSection', () => {
  it('shows "No parts data" for all three panels when arrays are empty', () => {
    render(<PartsConsumptionSection partsMetrics={emptyParts} loading={false} error={null} />);
    expect(screen.getAllByText(/No data/i).length).toBeGreaterThanOrEqual(2);
  });

  it('renders part name in the top parts bar chart', () => {
    render(<PartsConsumptionSection partsMetrics={filledParts} loading={false} error={null} />);
    expect(screen.getByText('Bearing 6205')).toBeInTheDocument();
  });

  it('renders machine name in the by-machine bar chart', () => {
    render(<PartsConsumptionSection partsMetrics={filledParts} loading={false} error={null} />);
    expect(screen.getByText('Die Press 701')).toBeInTheDocument();
  });

  it('renders technician name in the by-tech table', () => {
    render(<PartsConsumptionSection partsMetrics={filledParts} loading={false} error={null} />);
    expect(screen.getByText('John D.')).toBeInTheDocument();
  });

  it('shows a loading spinner when loading=true', () => {
    render(<PartsConsumptionSection partsMetrics={null} loading={true} error={null} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows an inline error alert without hiding the whole section', () => {
    render(<PartsConsumptionSection partsMetrics={null} loading={false} error="Failed to load parts" />);
    expect(screen.getByText(/Failed to load parts/i)).toBeInTheDocument();
    // Section header still visible
    expect(screen.getByText(/Top Parts/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd maintenance_call_system/frontend && npx vitest run src/components/analytics/PartsConsumptionSection.test.tsx
```

Expected: FAIL — component file does not exist.

- [ ] **Step 3: Create the component**

Create `maintenance_call_system/frontend/src/components/analytics/PartsConsumptionSection.tsx`:

```tsx
'use client';
import React from 'react';
import {
  Box, Typography, Paper, Grid, Stack, Alert, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody,
} from '@mui/material';
import type { PartsMetrics } from '../../services/maintenanceCallService';
import { MCS_ORANGE, STATUS_OPEN, STATUS_IN_PROGRESS } from '../../theme';

interface Props {
  partsMetrics: PartsMetrics | null;
  loading: boolean;
  error: string | null;
}

// Local copy of HBar — same as Analytics.tsx utility bar component.
function HBar({ label, value, max, color, suffix }: {
  label: string; value: number; max: number; color: string; suffix?: string;
}) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <Box sx={{ mb: 1 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
        <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: '65%' }}>{label}</Typography>
        <Typography variant="body2" color="text.secondary">{value}{suffix || ''}</Typography>
      </Stack>
      <Box sx={{ height: 10, bgcolor: 'grey.200', borderRadius: 1, overflow: 'hidden' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: color, transition: 'width 0.3s' }} />
      </Box>
    </Box>
  );
}

export default function PartsConsumptionSection({ partsMetrics, loading, error }: Props) {
  const topMax = Math.max(0, ...(partsMetrics?.top_parts.map(p => p.total_qty) ?? []));
  const machMax = Math.max(0, ...(partsMetrics?.by_machine.map(m => m.total_qty) ?? []));

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Panel A — Top Parts by Quantity */}
        <Grid item xs={12} lg={7}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Top Parts by Quantity Used</Typography>
            {loading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress size={32} sx={{ color: MCS_ORANGE }} />
              </Box>
            ) : !partsMetrics || partsMetrics.top_parts.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No data</Typography>
            ) : (
              partsMetrics.top_parts.map(p => (
                <HBar
                  key={p.part_id}
                  label={`${p.part_name}${p.part_number ? ` (${p.part_number})` : ''}  · ${p.call_count} call${p.call_count !== 1 ? 's' : ''}`}
                  value={p.total_qty}
                  max={topMax}
                  color={STATUS_OPEN}
                  suffix=" units"
                />
              ))
            )}
          </Paper>
        </Grid>

        {/* Panel B — Top Machines by Parts Used */}
        <Grid item xs={12} lg={5}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Top Machines by Parts Used</Typography>
            {loading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress size={32} sx={{ color: MCS_ORANGE }} />
              </Box>
            ) : !partsMetrics || partsMetrics.by_machine.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No data</Typography>
            ) : (
              partsMetrics.by_machine.map(m => (
                <HBar
                  key={m.machine_id}
                  label={`${m.machine_name}  (${m.unique_parts} unique)`}
                  value={m.total_qty}
                  max={machMax}
                  color={STATUS_IN_PROGRESS}
                  suffix=" units"
                />
              ))
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Panel C — Parts Usage by Technician */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Parts Usage by Technician</Typography>
        {loading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress size={32} sx={{ color: MCS_ORANGE }} />
          </Box>
        ) : !partsMetrics || partsMetrics.by_tech.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>No data</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Technician</strong></TableCell>
                <TableCell align="right"><strong>Calls w/ Parts</strong></TableCell>
                <TableCell align="right"><strong>Unique Parts</strong></TableCell>
                <TableCell align="right"><strong>Total Qty</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {partsMetrics.by_tech.map((t, i) => (
                <TableRow key={`${t.technician_id ?? 'na'}-${i}`} hover>
                  <TableCell>{t.technician_name || '—'}</TableCell>
                  <TableCell align="right">{t.calls_with_parts}</TableCell>
                  <TableCell align="right">{t.unique_parts}</TableCell>
                  <TableCell align="right">{t.total_qty}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd maintenance_call_system/frontend && npx vitest run src/components/analytics/PartsConsumptionSection.test.tsx
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd maintenance_call_system
git add frontend/src/components/analytics/
git commit -m "feat(mcs-frontend): add PartsConsumptionSection component

Three panels: top parts by quantity (HBar), top machines by parts (HBar),
parts by technician (table). Accepts partsMetrics/loading/error props.
Shows inline error without hiding the section headers."
```

---

## Task 5: Frontend — Restructure `Analytics.tsx`

**Files:**
- Modify: `maintenance_call_system/frontend/src/components/Analytics.tsx`
- Create: `maintenance_call_system/frontend/src/components/Analytics.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `maintenance_call_system/frontend/src/components/Analytics.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const { getMetrics, getPartsMetrics, getMachines } = vi.hoisted(() => ({
  getMetrics: vi.fn(),
  getPartsMetrics: vi.fn(),
  getMachines: vi.fn(),
}));

vi.mock('../services/maintenanceCallService', () => ({
  default: { getMetrics, getPartsMetrics, getMachines },
}));

import Analytics from './Analytics';

const emptyMetrics = {
  overall: {
    total_calls: '0', open_calls: 0, avg_response_minutes: null,
    avg_repair_minutes: null, avg_downtime_minutes: null,
    total_downtime_hours: null, total_downtime_cost: null,
    sla_pct: null, critical_calls: '0',
  },
  by_machine: [], by_reason: [], by_shift: [], by_tech: [],
  trend_weekly: [], repeat_failures: [],
};

const emptyParts = { top_parts: [], by_machine: [], by_tech: [] };

beforeEach(() => {
  vi.clearAllMocks();
  getMetrics.mockResolvedValue(emptyMetrics);
  getPartsMetrics.mockResolvedValue(emptyParts);
  getMachines.mockResolvedValue([]);
});

describe('Analytics', () => {
  it('renders all four section headers', async () => {
    render(<Analytics />);
    await waitFor(() => {
      expect(screen.getByText(/PRODUCTION HEALTH/i)).toBeInTheDocument();
      expect(screen.getByText(/PARTS CONSUMPTION/i)).toBeInTheDocument();
      expect(screen.getByText(/EQUIPMENT/i)).toBeInTheDocument();
      expect(screen.getByText(/TEAM PERFORMANCE/i)).toBeInTheDocument();
    });
  });

  it('renders a Critical Calls KPI card', async () => {
    getMetrics.mockResolvedValueOnce({
      ...emptyMetrics,
      overall: { ...emptyMetrics.overall, critical_calls: '5' },
    });
    render(<Analytics />);
    await waitFor(() => {
      expect(screen.getByText(/Critical Calls/i)).toBeInTheDocument();
    });
  });

  it('calls getPartsMetrics on mount alongside getMetrics', async () => {
    render(<Analytics />);
    await waitFor(() => {
      expect(getPartsMetrics).toHaveBeenCalledTimes(1);
      expect(getMetrics).toHaveBeenCalledTimes(1);
    });
  });

  it('renders a Machine filter dropdown', async () => {
    getMachines.mockResolvedValueOnce([
      { machine_id: 125, name: 'Die Press 701', location: 'Floor 1' },
    ]);
    render(<Analytics />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Machine/i)).toBeInTheDocument();
    });
  });

  it('shows Suspensions column in technician workload table when techs are present', async () => {
    getMetrics.mockResolvedValueOnce({
      ...emptyMetrics,
      by_tech: [{ technician_id: 1, technician_name: 'John D.', call_count: '8', avg_response_minutes: '5', avg_repair_minutes: '30', sla_pct: '90', suspensions: '2' }],
    });
    render(<Analytics />);
    await waitFor(() => {
      expect(screen.getByText('Suspensions')).toBeInTheDocument();
      expect(screen.getByText('John D.')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd maintenance_call_system/frontend && npx vitest run src/components/Analytics.test.tsx
```

Expected: FAIL — section headers don't exist, Critical Calls card missing, getPartsMetrics not called, etc.

- [ ] **Step 3: Replace `Analytics.tsx` with the restructured version**

Replace the entire contents of `maintenance_call_system/frontend/src/components/Analytics.tsx` with:

```tsx
'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, CircularProgress,
  TextField, MenuItem, Stack, Table, TableHead, TableRow, TableCell,
  TableBody, Chip, Button, Alert, Divider,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import svc, { CallMetrics, MetricsFilters, PartsMetrics, ReasonCategory } from '../services/maintenanceCallService';
import {
  MCS_ORANGE, STATUS_OPEN, STATUS_IN_PROGRESS, STATUS_RESOLVED,
  STATUS_SUSPENDED, STATUS_CRITICAL,
} from '../theme';
import PartsConsumptionSection from './analytics/PartsConsumptionSection';

type ReasonMeta = { value: ReasonCategory; label: string; color: string };

const REASONS: ReasonMeta[] = [
  { value: 'mechanical',     label: 'Mechanical',    color: STATUS_OPEN },
  { value: 'electrical',     label: 'Electrical',    color: STATUS_IN_PROGRESS },
  { value: 'tooling',        label: 'Tooling',       color: '#42A5F5' },
  { value: 'material',       label: 'Material',      color: STATUS_SUSPENDED },
  { value: 'operator_error', label: 'Operator Err.', color: STATUS_RESOLVED },
  { value: 'other',          label: 'Other',         color: '#9E9E9E' },
];

const SHIFTS = ['1st Shift', '2nd Shift', '3rd Shift'];

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

const num = (v: string | number | null | undefined): number => {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

const fmt = (v: string | number | null | undefined, digits = 1): string => {
  if (v == null) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
};

const fmtMoney = (v: string | number | null | undefined): string => {
  if (v == null) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (!Number.isFinite(n)) return '—';
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

const reasonLabel = (k: string | null): string =>
  REASONS.find(r => r.value === k)?.label || k || 'Unknown';
const reasonColor = (k: string | null): string =>
  REASONS.find(r => r.value === k)?.color || '#9E9E9E';

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <Card sx={{ borderTop: `3px solid ${accent || MCS_ORANGE}` }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
        <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5 }}>{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

function HBar({ label, value, max, color, suffix }: {
  label: string; value: number; max: number; color: string; suffix?: string;
}) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <Box sx={{ mb: 1 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
        <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: '60%' }}>{label}</Typography>
        <Typography variant="body2" color="text.secondary">{fmt(value)}{suffix || ''}</Typography>
      </Stack>
      <Box sx={{ height: 10, bgcolor: 'grey.200', borderRadius: 1, overflow: 'hidden' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: color, transition: 'width 0.3s' }} />
      </Box>
    </Box>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <Box sx={{ mt: 4, mb: 2 }}>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ letterSpacing: 3, fontWeight: 700, fontSize: '0.75rem' }}
      >
        {label}
      </Typography>
      <Divider sx={{ mt: 0.5 }} />
    </Box>
  );
}

interface Machine { machine_id: number; name: string; location: string | null; }

export default function Analytics() {
  const [metrics, setMetrics] = useState<CallMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [partsMetrics, setPartsMetrics] = useState<PartsMetrics | null>(null);
  const [partsLoading, setPartsLoading] = useState(false);
  const [partsError, setPartsError] = useState<string | null>(null);

  const [machines, setMachines] = useState<Machine[]>([]);

  const [from, setFrom] = useState(ymd(daysAgo(30)));
  const [to, setTo] = useState(ymd(new Date()));
  const [shift, setShift] = useState('');
  const [machineId, setMachineId] = useState('');
  const [reason, setReason] = useState<'' | ReasonCategory>('');

  // Load machine list once on mount for the filter dropdown.
  useEffect(() => {
    svc.getMachines().then(setMachines).catch(() => {/* non-critical */});
  }, []);

  const buildFilters = useCallback((): MetricsFilters => ({
    from: from || undefined,
    to: to || undefined,
    shift_name: shift || undefined,
    machine_id: machineId ? parseInt(machineId) : undefined,
    reason: (reason as ReasonCategory) || undefined,
  }), [from, to, shift, machineId, reason]);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMetrics(await svc.getMetrics(buildFilters()));
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, [buildFilters]);

  const fetchPartsMetrics = useCallback(async () => {
    setPartsLoading(true);
    setPartsError(null);
    try {
      setPartsMetrics(await svc.getPartsMetrics(buildFilters()));
    } catch (err: any) {
      setPartsError(err?.response?.data?.error || err?.message || 'Failed to load parts data');
    } finally {
      setPartsLoading(false);
    }
  }, [buildFilters]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);
  useEffect(() => { fetchPartsMetrics(); }, [fetchPartsMetrics]);

  const handleRefresh = () => { fetchMetrics(); fetchPartsMetrics(); };

  const machineMax = useMemo(
    () => Math.max(0, ...((metrics?.by_machine || []).map(m => num(m.total_downtime_hours)))),
    [metrics]
  );
  const reasonMax = useMemo(
    () => Math.max(0, ...((metrics?.by_reason || []).map(r => num(r.count)))),
    [metrics]
  );
  const trendMax = useMemo(
    () => Math.max(
      0,
      ...((metrics?.trend_weekly || []).flatMap(t => [num(t.avg_mtta_minutes), num(t.avg_mttr_minutes)]))
    ),
    [metrics]
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* ── Page title + refresh ── */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h4" fontWeight={700}>Maintenance Analytics</Typography>
        <Button startIcon={<Refresh />} onClick={handleRefresh} disabled={loading} variant="outlined">
          Refresh
        </Button>
      </Stack>

      {/* ── Filter bar ── */}
      <Paper sx={{ p: 2, mb: 1 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap">
          <TextField
            label="From" type="date" size="small"
            value={from} onChange={e => setFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To" type="date" size="small"
            value={to} onChange={e => setTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Shift" select size="small"
            value={shift} onChange={e => setShift(e.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All shifts</MenuItem>
            {SHIFTS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <TextField
            label="Machine" select size="small"
            value={machineId} onChange={e => setMachineId(e.target.value)}
            sx={{ minWidth: 180 }}
            inputProps={{ 'aria-label': 'Machine' }}
          >
            <MenuItem value="">All machines</MenuItem>
            {machines.map(m => (
              <MenuItem key={m.machine_id} value={m.machine_id.toString()}>{m.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Reason" select size="small"
            value={reason} onChange={e => setReason(e.target.value as any)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All reasons</MenuItem>
            {REASONS.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
          </TextField>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && !metrics ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
          <CircularProgress sx={{ color: MCS_ORANGE }} />
        </Box>
      ) : !metrics ? null : (
        <>
          {/* ── ① PRODUCTION HEALTH ── */}
          <SectionHeader label="① PRODUCTION HEALTH" />
          <Grid container spacing={2} sx={{ mb: 1 }}>
            {/* Row 1: production impact */}
            <Grid item xs={6} md={3}>
              <KpiCard label="Downtime Cost"   value={fmtMoney(metrics.overall.total_downtime_cost)} sub="in period" accent={STATUS_CRITICAL} />
            </Grid>
            <Grid item xs={6} md={3}>
              <KpiCard label="Total Downtime"  value={`${fmt(metrics.overall.total_downtime_hours)} hr`} sub="in period" accent={STATUS_OPEN} />
            </Grid>
            <Grid item xs={6} md={3}>
              <KpiCard label="SLA %"           value={metrics.overall.sla_pct == null ? '—' : `${fmt(metrics.overall.sla_pct)}%`} sub="acknowledged ≤ 10 min" accent={STATUS_RESOLVED} />
            </Grid>
            <Grid item xs={6} md={3}>
              <KpiCard label="Open Calls"      value={fmt(metrics.overall.open_calls, 0)} sub="right now" accent={STATUS_OPEN} />
            </Grid>
            {/* Row 2: response metrics */}
            <Grid item xs={6} md={3}>
              <KpiCard label="Total Calls"     value={fmt(metrics.overall.total_calls, 0)} sub="resolved in range" />
            </Grid>
            <Grid item xs={6} md={3}>
              <KpiCard label="MTTA"            value={`${fmt(metrics.overall.avg_response_minutes)} min`} sub="mean time to acknowledge" accent={STATUS_IN_PROGRESS} />
            </Grid>
            <Grid item xs={6} md={3}>
              <KpiCard label="MTTR"            value={`${fmt(metrics.overall.avg_repair_minutes)} min`} sub="mean time to repair" accent={STATUS_IN_PROGRESS} />
            </Grid>
            <Grid item xs={6} md={3}>
              <KpiCard label="Critical Calls"  value={fmt(metrics.overall.critical_calls, 0)} sub="priority = critical" accent={STATUS_CRITICAL} />
            </Grid>
          </Grid>

          {/* ── ② PARTS CONSUMPTION ── */}
          <SectionHeader label="② PARTS CONSUMPTION" />
          <PartsConsumptionSection
            partsMetrics={partsMetrics}
            loading={partsLoading}
            error={partsError}
          />

          {/* ── ③ EQUIPMENT ── */}
          <SectionHeader label="③ EQUIPMENT" />
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} lg={7}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>Top Machines by Downtime</Typography>
                {(metrics.by_machine || []).length === 0 ? (
                  <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No data</Typography>
                ) : (
                  metrics.by_machine.map(m => (
                    <HBar
                      key={m.machine_id}
                      label={`${m.machine_name || `#${m.machine_id}`}  (${fmt(m.call_count, 0)} calls)`}
                      value={num(m.total_downtime_hours)}
                      max={machineMax}
                      color={STATUS_OPEN}
                      suffix=" hr"
                    />
                  ))
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} lg={5}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>Repeat Failures (3+ in range)</Typography>
                {(metrics.repeat_failures || []).length === 0 ? (
                  <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                    No machine + reason combos with 3 or more occurrences
                  </Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Machine</TableCell>
                        <TableCell>Reason</TableCell>
                        <TableCell align="right">Count</TableCell>
                        <TableCell align="right">Suspensions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {metrics.repeat_failures.map((r, i) => (
                        <TableRow key={`${r.machine_id}-${r.reason_category}-${i}`}>
                          <TableCell>{r.machine_name || `#${r.machine_id}`}</TableCell>
                          <TableCell>
                            <Chip size="small" label={reasonLabel(r.reason_category)} sx={{ bgcolor: reasonColor(r.reason_category), color: 'white' }} />
                          </TableCell>
                          <TableCell align="right">{fmt(r.occurrences, 0)}</TableCell>
                          <TableCell align="right">{fmt(r.suspensions, 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* ── ④ TEAM PERFORMANCE ── */}
          <SectionHeader label="④ TEAM PERFORMANCE" />

          {/* Technician workload */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Technician Workload</Typography>
            {(metrics.by_tech || []).length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 2 }}>No data</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Technician</TableCell>
                    <TableCell align="right">Calls</TableCell>
                    <TableCell align="right">Avg MTTA (min)</TableCell>
                    <TableCell align="right">Avg MTTR (min)</TableCell>
                    <TableCell align="right">SLA %</TableCell>
                    <TableCell align="right">Suspensions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {metrics.by_tech.map((t, i) => (
                    <TableRow key={`${t.technician_id ?? 'na'}-${i}`}>
                      <TableCell>{t.technician_name || '—'}</TableCell>
                      <TableCell align="right">{fmt(t.call_count, 0)}</TableCell>
                      <TableCell align="right">{fmt(t.avg_response_minutes)}</TableCell>
                      <TableCell align="right">{fmt(t.avg_repair_minutes)}</TableCell>
                      <TableCell align="right">{t.sla_pct == null ? '—' : `${fmt(t.sla_pct)}%`}</TableCell>
                      <TableCell align="right">{fmt(t.suspensions, 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>

          {/* By shift — table showing calls, MTTA, avg downtime */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>By Shift</Typography>
            {(metrics.by_shift || []).length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 2 }}>No data</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Shift</TableCell>
                    <TableCell align="right">Calls</TableCell>
                    <TableCell align="right">Avg MTTA (min)</TableCell>
                    <TableCell align="right">Avg Downtime (min)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {metrics.by_shift.map(s => (
                    <TableRow key={s.shift_name || 'Unknown'}>
                      <TableCell>{s.shift_name || 'Unknown'}</TableCell>
                      <TableCell align="right">{fmt(s.call_count, 0)}</TableCell>
                      <TableCell align="right">{fmt(s.avg_response_minutes)}</TableCell>
                      <TableCell align="right">{fmt(s.avg_downtime_minutes)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>

          {/* Failure reasons + weekly trend */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} lg={5}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>Failure Reasons</Typography>
                {(metrics.by_reason || []).length === 0 ? (
                  <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No data</Typography>
                ) : (
                  metrics.by_reason.map(r => (
                    <HBar
                      key={r.reason_category || 'unknown'}
                      label={reasonLabel(r.reason_category)}
                      value={num(r.count)}
                      max={reasonMax}
                      color={reasonColor(r.reason_category)}
                    />
                  ))
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} lg={7}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Weekly Trend</Typography>
                {(metrics.trend_weekly || []).length === 0 ? (
                  <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No data</Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Week of</TableCell>
                        <TableCell align="right">Calls</TableCell>
                        <TableCell align="right">MTTA (min)</TableCell>
                        <TableCell align="right">MTTR (min)</TableCell>
                        <TableCell>MTTA vs MTTR</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {metrics.trend_weekly.map(t => {
                        const mtta = num(t.avg_mtta_minutes);
                        const mttr = num(t.avg_mttr_minutes);
                        const mttaPct = trendMax > 0 ? (mtta / trendMax) * 100 : 0;
                        const mttrPct = trendMax > 0 ? (mttr / trendMax) * 100 : 0;
                        return (
                          <TableRow key={t.week_start}>
                            <TableCell>{new Date(t.week_start).toLocaleDateString()}</TableCell>
                            <TableCell align="right">{fmt(t.call_count, 0)}</TableCell>
                            <TableCell align="right">{fmt(t.avg_mtta_minutes)}</TableCell>
                            <TableCell align="right">{fmt(t.avg_mttr_minutes)}</TableCell>
                            <TableCell sx={{ width: 200 }}>
                              <Stack spacing={0.3}>
                                <Box sx={{ height: 6, bgcolor: 'grey.200', borderRadius: 0.5, overflow: 'hidden' }}>
                                  <Box sx={{ width: `${mttaPct}%`, height: '100%', bgcolor: STATUS_IN_PROGRESS }} />
                                </Box>
                                <Box sx={{ height: 6, bgcolor: 'grey.200', borderRadius: 0.5, overflow: 'hidden' }}>
                                  <Box sx={{ width: `${mttrPct}%`, height: '100%', bgcolor: STATUS_OPEN }} />
                                </Box>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}
```

- [ ] **Step 4: Run all frontend tests**

```bash
cd maintenance_call_system/frontend && npx vitest run
```

Expected: all tests PASS, including the 5 new `Analytics.test.tsx` tests and all previously passing tests.

- [ ] **Step 5: Commit**

```bash
cd maintenance_call_system
git add frontend/src/components/Analytics.tsx \
        frontend/src/components/Analytics.test.tsx
git commit -m "feat(mcs-frontend): restructure Analytics into four labelled sections

① PRODUCTION HEALTH — reordered KPIs, new Critical Calls card
② PARTS CONSUMPTION — PartsConsumptionSection component
③ EQUIPMENT — machines + repeat failures with Suspensions column
④ TEAM PERFORMANCE — tech table with Suspensions, by-shift as table with Avg MTTA

Adds Machine filter dropdown (uses getMachines()).
Independent fetch for parts metrics; failure shows inline error only."
```

---

## Self-Review

**Spec coverage check:**
- ✅ Machine filter added to filter bar
- ✅ Critical Calls KPI card (Task 2 backend + Task 5 frontend)
- ✅ Parts Consumption section: top parts, by machine, by tech (Tasks 1, 3, 4)
- ✅ Suspensions on repeat_failures (Tasks 2 + 5)
- ✅ Suspensions on by_tech (Tasks 2 + 5)
- ✅ Avg MTTA on by_shift (data already returned by backend; Task 5 displays it)
- ✅ Section headers (Task 5)
- ✅ KPI card reorder (Task 5)
- ✅ No DB migrations required (confirmed — all data exists)

**Placeholder scan:** No TBDs, no "add appropriate error handling", all steps have complete code blocks. ✅

**Type consistency:**
- `PartsMetrics` defined in Task 3, used in Task 4 (`PartsConsumptionSection` props) and Task 5 (`Analytics` state). ✅
- `getPartsMetrics()` defined in Task 3, called in Task 5. ✅
- `critical_calls` added to `CallMetrics.overall` in Task 3, read as `metrics.overall.critical_calls` in Task 5. ✅
- `suspensions` added to `by_tech[]` and `repeat_failures[]` in Task 3, rendered in Task 5. ✅
