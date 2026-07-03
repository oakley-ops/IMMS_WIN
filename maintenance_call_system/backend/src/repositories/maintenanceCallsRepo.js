// Repository layer — every SQL string lives here, nowhere else.
// Functions accept a db client and return rows (or a single row, or undefined).
// No business logic, no HTTP concepts.

const findActiveBadge = async (db, badgeId) => {
  const result = await db.query(
    'SELECT * FROM badge_registrations WHERE badge_id = $1 AND active = true',
    [badgeId]
  );
  return result.rows[0];
};

const findActiveReader = async (db, readerKey) => {
  const result = await db.query(
    `SELECT br.*, m.name AS machine_name, m.location
       FROM badge_readers br
       LEFT JOIN machines m ON br.machine_id = m.machine_id
      WHERE br.reader_key = $1 AND br.active = true`,
    [readerKey]
  );
  return result.rows[0];
};

const findOpenCallForMachine = async (db, machineId) => {
  const result = await db.query(
    `SELECT * FROM maintenance_calls
      WHERE machine_id = $1 AND status IN ('open', 'in_progress', 'suspended')
      ORDER BY called_at DESC LIMIT 1`,
    [machineId]
  );
  return result.rows[0];
};

const insertCall = async (db, { machineId, readerId, badgeId, personName, shiftName }) => {
  const result = await db.query(
    `INSERT INTO maintenance_calls
         (machine_id, reader_id, operator_badge_id, operator_name, status, priority, shift_name, called_at)
       VALUES ($1, $2, $3, $4, 'open', 'normal', $5, NOW())
     RETURNING *`,
    [machineId, readerId, badgeId, personName, shiftName]
  );
  return result.rows[0];
};

const resumeCall = async (db, { callId, badgeId, technicianId, personName }) => {
  const result = await db.query(
    `UPDATE maintenance_calls
        SET status = 'in_progress',
            technician_badge_id = $1,
            technician_id = $2,
            technician_name = $3,
            suspended_at = NULL,
            suspension_notes = NULL,
            updated_at = NOW()
      WHERE call_id = $4
     RETURNING *`,
    [badgeId, technicianId, personName, callId]
  );
  return result.rows[0];
};

const acknowledgeCall = async (db, { callId, badgeId, technicianId, personName }) => {
  const result = await db.query(
    `UPDATE maintenance_calls
        SET status = 'in_progress',
            technician_badge_id = $1,
            technician_id = $2,
            technician_name = $3,
            technician_arrived_at = NOW(),
            updated_at = NOW()
      WHERE call_id = $4
     RETURNING *`,
    [badgeId, technicianId, personName, callId]
  );
  return result.rows[0];
};

const listActiveCalls = async (db) => {
  const result = await db.query(`
    SELECT mc.*,
           m.name AS machine_name,
           m.location AS machine_location,
           EXTRACT(EPOCH FROM (NOW() - mc.called_at)) AS seconds_since_called
      FROM maintenance_calls mc
      LEFT JOIN machines m ON mc.machine_id = m.machine_id
     WHERE mc.status IN ('open', 'in_progress', 'suspended')
     ORDER BY mc.priority DESC, mc.called_at ASC
  `);
  return result.rows;
};

const listCalls = async (db, filters) => {
  const { status, machine_id, shift_name, from, to, limit = 100, offset = 0 } = filters;
  const conditions = [];
  const params = [];
  let p = 1;
  if (status)     { conditions.push(`mc.status = $${p++}`);     params.push(status); }
  if (machine_id) { conditions.push(`mc.machine_id = $${p++}`); params.push(machine_id); }
  if (shift_name) { conditions.push(`mc.shift_name = $${p++}`); params.push(shift_name); }
  if (from)       { conditions.push(`mc.called_at >= $${p++}`); params.push(from); }
  if (to)         { conditions.push(`mc.called_at <= $${p++}`); params.push(to); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const result = await db.query(`
    SELECT mc.*,
           m.name AS machine_name,
           m.location AS machine_location,
           EXTRACT(EPOCH FROM (mc.technician_arrived_at - mc.called_at))   AS response_seconds,
           EXTRACT(EPOCH FROM (mc.resolved_at - mc.technician_arrived_at)) AS repair_seconds,
           EXTRACT(EPOCH FROM (mc.resolved_at - mc.called_at))             AS downtime_seconds
      FROM maintenance_calls mc
      LEFT JOIN machines m ON mc.machine_id = m.machine_id
      ${where}
     ORDER BY mc.called_at DESC
     LIMIT $${p++} OFFSET $${p++}
  `, [...params, limit, offset]);
  return result.rows;
};

const findCallById = async (db, callId) => {
  const result = await db.query(`
    SELECT mc.*,
           m.name AS machine_name,
           m.location AS machine_location,
           EXTRACT(EPOCH FROM (mc.technician_arrived_at - mc.called_at))   AS response_seconds,
           EXTRACT(EPOCH FROM (mc.resolved_at - mc.technician_arrived_at)) AS repair_seconds,
           EXTRACT(EPOCH FROM (mc.resolved_at - mc.called_at))             AS downtime_seconds
      FROM maintenance_calls mc
      LEFT JOIN machines m ON mc.machine_id = m.machine_id
     WHERE mc.call_id = $1
  `, [callId]);
  return result.rows[0];
};

const resolveCall = async (db, { callId, reasonCategory, resolutionNotes, problemDescription }) => {
  const result = await db.query(`
    UPDATE maintenance_calls
       SET status = 'resolved',
           resolved_at = NOW(),
           reason_category = $1,
           resolution_notes = $2,
           problem_description = COALESCE($3, problem_description),
           updated_at = NOW()
     WHERE call_id = $4 AND status != 'resolved'
    RETURNING *
  `, [reasonCategory, resolutionNotes, problemDescription, callId]);
  return result.rows[0];
};

// Resume a suspended call without requiring a fresh badge swipe.
// Used by the call board "Resume" action — flips a 'suspended' call back to
// 'in_progress'. Keeps the original technician fields intact.
const resumeCallById = async (db, callId) => {
  const result = await db.query(`
    UPDATE maintenance_calls
       SET status = 'in_progress',
           suspended_at = NULL,
           suspension_notes = NULL,
           updated_at = NOW()
     WHERE call_id = $1 AND status = 'suspended'
    RETURNING *
  `, [callId]);
  return result.rows[0];
};

// Per-machine status row for the call board.
// Status precedence: pm > suspend > te_present > wait > running.
// queue_position is set only for WAIT tiles, ordered critical-first then oldest-called.
const getBoardStatus = async (db) => {
  const result = await db.query(`
    WITH active_call AS (
      SELECT DISTINCT ON (machine_id)
             machine_id, call_id, status, called_at, operator_name,
             technician_name, technician_arrived_at, suspended_at,
             suspension_notes, priority, shift_name
        FROM maintenance_calls
       WHERE status IN ('open', 'in_progress', 'suspended')
       ORDER BY machine_id, called_at DESC
    ),
    active_pm AS (
      SELECT DISTINCT ON (machine_id)
             machine_id, session_id AS pm_id, started_at AS pm_started_at
        FROM pm_sessions
       WHERE status = 'in_progress'
       ORDER BY machine_id, started_at DESC
    ),
    wait_queue AS (
      SELECT machine_id,
             ROW_NUMBER() OVER (
               ORDER BY (priority = 'critical') DESC, called_at ASC
             )::int AS queue_position
        FROM active_call
       WHERE status = 'open'
    )
    SELECT
      m.machine_id,
      m.name,
      m.location,
      CASE
        WHEN ap.pm_id IS NOT NULL       THEN 'pm'
        WHEN ac.status = 'suspended'    THEN 'suspend'
        WHEN ac.status = 'in_progress'  THEN 'te_present'
        WHEN ac.status = 'open'         THEN 'wait'
        ELSE 'running'
      END AS status,
      ac.call_id,
      ac.called_at,
      ac.operator_name,
      ac.technician_name,
      ac.technician_arrived_at,
      ac.suspended_at,
      ac.suspension_notes,
      ac.priority,
      ac.shift_name,
      ap.pm_id,
      ap.pm_started_at,
      wq.queue_position
    FROM machines m
    LEFT JOIN active_call ac ON ac.machine_id = m.machine_id
    LEFT JOIN active_pm   ap ON ap.machine_id = m.machine_id
    LEFT JOIN wait_queue  wq ON wq.machine_id = m.machine_id
    WHERE m.status = 'active'
    ORDER BY m.name
  `);
  return result.rows;
};

const suspendCall = async (db, { callId, suspensionNotes }) => {
  const result = await db.query(`
    UPDATE maintenance_calls
       SET status = 'suspended',
           suspended_at = NOW(),
           suspension_notes = $1,
           updated_at = NOW()
     WHERE call_id = $2 AND status = 'in_progress'
    RETURNING *
  `, [suspensionNotes, callId]);
  return result.rows[0];
};

const searchParts = async (db, q) => {
  const result = await db.query(
    `SELECT part_id, name, NULL AS fiserv_part_number, manufacturer_part_number, quantity
       FROM parts
      WHERE (name ILIKE $1 OR manufacturer_part_number ILIKE $1)
        AND quantity > 0
      ORDER BY name ASC
      LIMIT 20`,
    [`%${q}%`]
  );
  return result.rows;
};

const insertCallParts = async (db, callId, parts) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const rows = [];
    for (const p of parts) {
      const result = await client.query(
        `INSERT INTO maintenance_call_parts (call_id, part_id, part_name, part_number, quantity)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [callId, p.part_id, p.part_name, p.part_number, p.quantity || 1]
      );
      rows.push(result.rows[0]);
    }
    await client.query('COMMIT');
    return rows;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const listCallParts = async (db, callId) => {
  const result = await db.query(
    `SELECT * FROM maintenance_call_parts WHERE call_id = $1 ORDER BY noted_at ASC`,
    [callId]
  );
  return result.rows;
};

// All metrics read from v_maintenance_calls_enriched. Filters are shared
// between every dimension. "Resolved-only" queries exclude open calls;
// open_calls comes from the unfiltered-by-status view query.
const callMetrics = async (db, { from, to, shift_name, machine_id, reason }) => {
  const baseConditions = [];
  const baseConditionsV = [];  // same conditions but prefixed with v. for joined queries
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

  const baseWhere = baseConditions.length ? 'WHERE ' + baseConditions.join(' AND ') : '';
  const resolvedWhere = baseConditions.length
    ? `WHERE status = 'resolved' AND ` + baseConditions.join(' AND ')
    : `WHERE status = 'resolved'`;
  const openWhere = baseConditions.length
    ? `${baseWhere} AND status IN ('open', 'in_progress', 'suspended')`
    : `WHERE status IN ('open', 'in_progress', 'suspended')`;
  // For queries that JOIN maintenance_calls mc alongside view alias v
  const resolvedWhereV = baseConditionsV.length
    ? `WHERE v.status = 'resolved' AND ` + baseConditionsV.join(' AND ')
    : `WHERE v.status = 'resolved'`;

  const [overall, openCount, byMachine, byReason, byShift, byTech, trend, repeats] = await Promise.all([
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

    db.query(`
      SELECT COUNT(*) AS open_calls
      FROM v_maintenance_calls_enriched
      ${openWhere}
    `, baseParams),

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

    db.query(`
      SELECT COALESCE(reason_category, 'unknown') AS reason_category,
             COUNT(*)                                  AS count,
             ROUND(AVG(downtime_minutes)::numeric, 1)  AS avg_downtime_minutes
      FROM v_maintenance_calls_enriched
      ${resolvedWhere}
      GROUP BY reason_category
      ORDER BY count DESC
    `, baseParams),

    db.query(`
      SELECT COALESCE(shift_name, 'Unknown')         AS shift_name,
             COUNT(*)                                AS call_count,
             ROUND(AVG(response_minutes)::numeric, 1) AS avg_response_minutes,
             ROUND(AVG(downtime_minutes)::numeric, 1) AS avg_downtime_minutes
      FROM v_maintenance_calls_enriched
      ${resolvedWhere}
      GROUP BY shift_name
      ORDER BY shift_name
    `, baseParams),

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

// ─── Badge admin ────────────────────────────────────────────────────────────

const listBadges = async (db) => {
  const result = await db.query(`
    SELECT br.*, t.name AS technician_name
      FROM badge_registrations br
      LEFT JOIN technicians t ON br.technician_id = t.technician_id
     ORDER BY br.person_name
  `);
  return result.rows;
};

const upsertBadge = async (db, { badge_id, person_name, role, technician_id }) => {
  const result = await db.query(
    `INSERT INTO badge_registrations (badge_id, person_name, role, technician_id)
         VALUES ($1, $2, $3, $4)
       ON CONFLICT (badge_id) DO UPDATE
         SET person_name = $2, role = $3, technician_id = $4, active = true, updated_at = NOW()
     RETURNING *`,
    [badge_id, person_name, role, technician_id || null]
  );
  return result.rows[0];
};

const updateBadge = async (db, badgeId, { person_name, role, technician_id, active }) => {
  const result = await db.query(
    `UPDATE badge_registrations
        SET person_name = COALESCE($1, person_name),
            role = COALESCE($2, role),
            technician_id = $3,
            active = COALESCE($4, active),
            updated_at = NOW()
      WHERE badge_id = $5 RETURNING *`,
    [person_name, role, technician_id ?? null, active, badgeId]
  );
  return result.rows[0];
};

// ─── Reader admin ───────────────────────────────────────────────────────────

const listReaders = async (db) => {
  const result = await db.query(`
    SELECT br.*, m.name AS machine_name
      FROM badge_readers br
      LEFT JOIN machines m ON br.machine_id = m.machine_id
     ORDER BY br.location_label
  `);
  return result.rows;
};

const insertReader = async (db, { reader_key, machine_id, location_label }) => {
  const result = await db.query(
    `INSERT INTO badge_readers (reader_key, machine_id, location_label)
       VALUES ($1, $2, $3) RETURNING *`,
    [reader_key, machine_id, location_label || null]
  );
  return result.rows[0];
};

const updateReader = async (db, readerId, { reader_key, machine_id, location_label, active }) => {
  const result = await db.query(
    `UPDATE badge_readers
        SET reader_key = COALESCE($1, reader_key),
            machine_id = COALESCE($2, machine_id),
            location_label = COALESCE($3, location_label),
            active = COALESCE($4, active),
            updated_at = NOW()
      WHERE reader_id = $5 RETURNING *`,
    [reader_key, machine_id, location_label, active, readerId]
  );
  return result.rows[0];
};

const listActiveMachines = async (db) => {
  const result = await db.query(
    'SELECT machine_id, name, location FROM machines WHERE status = $1 ORDER BY name',
    ['active']
  );
  return result.rows;
};

module.exports = {
  findActiveBadge,
  findActiveReader,
  findOpenCallForMachine,
  insertCall,
  resumeCall,
  acknowledgeCall,
  listActiveCalls,
  listCalls,
  findCallById,
  resolveCall,
  suspendCall,
  resumeCallById,
  getBoardStatus,
  searchParts,
  insertCallParts,
  listCallParts,
  callMetrics,
  partsMetrics,
  listBadges,
  upsertBadge,
  updateBadge,
  listReaders,
  insertReader,
  updateReader,
  listActiveMachines,
};
