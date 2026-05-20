const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
const { getShiftName } = require('../config/shifts');

// ─── Badge Swipe (core endpoint, no auth — called from kiosk) ───────────────

router.post('/badge-swipe', async (req, res) => {
  const { badge_id, reader_key } = req.body;
  if (!badge_id || !reader_key) {
    return res.status(400).json({ error: 'badge_id and reader_key are required' });
  }

  try {
    const badgeResult = await db.query(
      'SELECT * FROM badge_registrations WHERE badge_id = $1 AND active = true',
      [badge_id]
    );
    if (badgeResult.rows.length === 0) {
      return res.json({ action: 'unknown_badge', machine_name: null });
    }
    const badge = badgeResult.rows[0];

    const readerResult = await db.query(
      `SELECT br.*, m.name as machine_name, m.location
       FROM badge_readers br
       LEFT JOIN machines m ON br.machine_id = m.machine_id
       WHERE br.reader_key = $1 AND br.active = true`,
      [reader_key]
    );
    if (readerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Reader not found or inactive' });
    }
    const reader = readerResult.rows[0];

    // Find any active call for this machine
    const activeCallResult = await db.query(
      `SELECT * FROM maintenance_calls
       WHERE machine_id = $1 AND status IN ('open', 'in_progress')
       ORDER BY called_at DESC LIMIT 1`,
      [reader.machine_id]
    );
    const activeCall = activeCallResult.rows[0] || null;

    if (badge.role === 'operator') {
      if (activeCall) {
        return res.json({
          action: 'already_active',
          call: activeCall,
          machine_name: reader.machine_name
        });
      }

      const newCallResult = await db.query(
        `INSERT INTO maintenance_calls
           (machine_id, reader_id, operator_badge_id, operator_name, status, called_at, shift_name)
         VALUES ($1, $2, $3, $4, 'open', NOW(), $5)
         RETURNING *`,
        [reader.machine_id, reader.reader_id, badge.badge_id, badge.person_name, getShiftName()]
      );
      const newCall = { ...newCallResult.rows[0], machine_name: reader.machine_name };

      if (global.io) {
        global.io.emit('maintenance_call_created', newCall);
      }

      return res.json({ action: 'call_created', call: newCall, machine_name: reader.machine_name });
    }

    if (badge.role === 'technician') {
      if (!activeCall) {
        return res.json({ action: 'no_active_call', machine_name: reader.machine_name });
      }

      if (activeCall.status === 'in_progress' && activeCall.technician_badge_id === badge.badge_id) {
        return res.json({ action: 'already_in_progress', call: activeCall, machine_name: reader.machine_name });
      }

      const updatedResult = await db.query(
        `UPDATE maintenance_calls
         SET status = 'in_progress',
             technician_badge_id = $1,
             technician_id = $2,
             technician_name = $3,
             acknowledged_at = COALESCE(acknowledged_at, NOW()),
             technician_arrived_at = NOW(),
             updated_at = NOW()
         WHERE call_id = $4
         RETURNING *`,
        [badge.badge_id, badge.technician_id, badge.person_name, activeCall.call_id]
      );
      const updatedCall = { ...updatedResult.rows[0], machine_name: reader.machine_name };

      if (global.io) {
        global.io.emit('maintenance_call_updated', updatedCall);
      }

      return res.json({ action: 'call_acknowledged', call: updatedCall, machine_name: reader.machine_name });
    }

    return res.status(400).json({ error: 'Unknown badge role' });
  } catch (err) {
    console.error('Badge swipe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Active calls for the call board (no auth — public TV display) ───────────

router.get('/active', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *,
             EXTRACT(EPOCH FROM (NOW() - called_at)) AS seconds_since_called
      FROM v_maintenance_calls_enriched
      WHERE status IN ('open', 'in_progress')
      ORDER BY called_at ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching active calls:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Reader info for station page (no auth — kiosk) ─────────────────────────

router.get('/reader/:reader_key', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT br.*, m.name as machine_name, m.location
       FROM badge_readers br
       LEFT JOIN machines m ON br.machine_id = m.machine_id
       WHERE br.reader_key = $1 AND br.active = true`,
      [req.params.reader_key]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reader not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching reader:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── All calls (auth required) ───────────────────────────────────────────────

router.get('/', auth, async (req, res) => {
  try {
    const { status, machine_id, from, to, shift, reason, limit = 100, offset = 0 } = req.query;
    const params = [];
    const conditions = [];
    let p = 1;

    if (status)     { conditions.push(`status = $${p++}`);          params.push(status); }
    if (machine_id) { conditions.push(`machine_id = $${p++}`);      params.push(machine_id); }
    if (from)       { conditions.push(`called_at >= $${p++}`);      params.push(from); }
    if (to)         { conditions.push(`called_at <= $${p++}`);      params.push(to); }
    if (shift)      { conditions.push(`shift_name = $${p++}`);      params.push(shift); }
    if (reason)     { conditions.push(`reason_category = $${p++}`); params.push(reason); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await db.query(`
      SELECT *
      FROM v_maintenance_calls_enriched
      ${where}
      ORDER BY called_at DESC
      LIMIT $${p++} OFFSET $${p++}
    `, [...params, limit, offset]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching calls:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Single call ─────────────────────────────────────────────────────────────

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM v_maintenance_calls_enriched WHERE call_id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Call not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching call:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Resolve a call ───────────────────────────────────────────────────────────

router.put('/:id/resolve', auth, async (req, res) => {
  const { reason_category, resolution_notes, problem_description } = req.body;
  if (!resolution_notes) {
    return res.status(400).json({ error: 'resolution_notes is required' });
  }

  try {
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
    `, [reason_category, resolution_notes, problem_description, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Call not found or already resolved' });
    }

    const resolved = result.rows[0];
    if (global.io) {
      global.io.emit('maintenance_call_resolved', resolved);
    }

    res.json(resolved);
  } catch (err) {
    console.error('Error resolving call:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Metrics ─────────────────────────────────────────────────────────────────
// Every query reads v_maintenance_calls_enriched. Filters: from, to, machine_id,
// shift, reason. "Resolved-only" dimensions exclude open calls; KPI cards
// include an open_calls count from the unfiltered (status-wise) base.

router.get('/stats/metrics', auth, async (req, res) => {
  try {
    const { from, to, machine_id, shift, reason } = req.query;

    const baseConditions = [];
    const baseParams = [];
    let p = 1;
    if (from)       { baseConditions.push(`called_at >= $${p++}`); baseParams.push(from); }
    if (to)         { baseConditions.push(`called_at <= $${p++}`); baseParams.push(to); }
    if (machine_id) { baseConditions.push(`machine_id = $${p++}`); baseParams.push(machine_id); }
    if (shift)      { baseConditions.push(`shift_name = $${p++}`); baseParams.push(shift); }
    if (reason)     { baseConditions.push(`reason_category = $${p++}`); baseParams.push(reason); }

    const baseWhere = baseConditions.length ? 'WHERE ' + baseConditions.join(' AND ') : '';
    const resolvedWhere = baseConditions.length
      ? `WHERE status = 'resolved' AND ` + baseConditions.join(' AND ')
      : `WHERE status = 'resolved'`;

    const [overall, openCount, byMachine, byReason, byShift, byTech, trend, repeats] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*)                                            AS total_calls,
          ROUND(AVG(response_minutes)::numeric, 1)            AS avg_response_minutes,
          ROUND(AVG(repair_minutes)::numeric, 1)              AS avg_repair_minutes,
          ROUND(AVG(downtime_minutes)::numeric, 1)            AS avg_downtime_minutes,
          ROUND((SUM(downtime_minutes) / 60.0)::numeric, 1)   AS total_downtime_hours,
          ROUND(SUM(downtime_cost)::numeric, 2)               AS total_downtime_cost,
          ROUND((100.0 * COUNT(*) FILTER (WHERE sla_met) / NULLIF(COUNT(*) FILTER (WHERE sla_met IS NOT NULL), 0))::numeric, 1) AS sla_pct
        FROM v_maintenance_calls_enriched
        ${resolvedWhere}
      `, baseParams),

      db.query(`
        SELECT COUNT(*) AS open_calls
        FROM v_maintenance_calls_enriched
        ${baseWhere ? baseWhere + ' AND ' : 'WHERE '} status IN ('open', 'in_progress')
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
        SELECT reason_category,
               COUNT(*)                                  AS count,
               ROUND(AVG(downtime_minutes)::numeric, 1)  AS avg_downtime_minutes
        FROM v_maintenance_calls_enriched
        ${resolvedWhere}
        GROUP BY reason_category
        ORDER BY count DESC
      `, baseParams),

      db.query(`
        SELECT shift_name,
               COUNT(*)                                   AS call_count,
               ROUND(AVG(response_minutes)::numeric, 1)   AS avg_response_minutes,
               ROUND(AVG(downtime_minutes)::numeric, 1)   AS avg_downtime_minutes
        FROM v_maintenance_calls_enriched
        ${resolvedWhere}
        GROUP BY shift_name
        ORDER BY shift_name
      `, baseParams),

      db.query(`
        SELECT technician_id,
               technician_name,
               COUNT(*)                                            AS call_count,
               ROUND(AVG(response_minutes)::numeric, 1)            AS avg_response_minutes,
               ROUND(AVG(repair_minutes)::numeric, 1)              AS avg_repair_minutes,
               ROUND((100.0 * COUNT(*) FILTER (WHERE sla_met) / NULLIF(COUNT(*) FILTER (WHERE sla_met IS NOT NULL), 0))::numeric, 1) AS sla_pct
        FROM v_maintenance_calls_enriched
        ${resolvedWhere}
        GROUP BY technician_id, technician_name
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
        SELECT machine_id,
               machine_name,
               reason_category,
               COUNT(*) AS occurrences
        FROM v_maintenance_calls_enriched
        ${resolvedWhere}
        GROUP BY machine_id, machine_name, reason_category
        HAVING COUNT(*) >= 3
        ORDER BY occurrences DESC
        LIMIT 10
      `, baseParams)
    ]);

    res.json({
      overall: { ...overall.rows[0], open_calls: Number(openCount.rows[0].open_calls) },
      by_machine: byMachine.rows,
      by_reason: byReason.rows,
      by_shift: byShift.rows,
      by_tech: byTech.rows,
      trend_weekly: trend.rows,
      repeat_failures: repeats.rows
    });
  } catch (err) {
    console.error('Error fetching metrics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Badge admin ──────────────────────────────────────────────────────────────

router.get('/admin/badges', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT br.*, t.name as technician_name
      FROM badge_registrations br
      LEFT JOIN technicians t ON br.technician_id = t.technician_id
      ORDER BY br.person_name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching badges:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/badges', auth, async (req, res) => {
  const { badge_id, person_name, role, technician_id } = req.body;
  if (!badge_id || !person_name || !role) {
    return res.status(400).json({ error: 'badge_id, person_name, and role are required' });
  }
  try {
    const result = await db.query(
      `INSERT INTO badge_registrations (badge_id, person_name, role, technician_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (badge_id) DO UPDATE
         SET person_name = $2, role = $3, technician_id = $4, active = true, updated_at = NOW()
       RETURNING *`,
      [badge_id, person_name, role, technician_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error registering badge:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/admin/badges/:badge_id', auth, async (req, res) => {
  const { person_name, role, technician_id, active } = req.body;
  try {
    const result = await db.query(
      `UPDATE badge_registrations
       SET person_name = COALESCE($1, person_name),
           role = COALESCE($2, role),
           technician_id = $3,
           active = COALESCE($4, active),
           updated_at = NOW()
       WHERE badge_id = $5
       RETURNING *`,
      [person_name, role, technician_id ?? null, active, req.params.badge_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Badge not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating badge:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Reader admin ─────────────────────────────────────────────────────────────

router.get('/admin/readers', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT br.*, m.name as machine_name
      FROM badge_readers br
      LEFT JOIN machines m ON br.machine_id = m.machine_id
      ORDER BY br.location_label
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching readers:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/readers', auth, async (req, res) => {
  const { reader_key, machine_id, location_label } = req.body;
  if (!reader_key || !machine_id) {
    return res.status(400).json({ error: 'reader_key and machine_id are required' });
  }
  try {
    const result = await db.query(
      `INSERT INTO badge_readers (reader_key, machine_id, location_label)
       VALUES ($1, $2, $3) RETURNING *`,
      [reader_key, machine_id, location_label]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'reader_key already exists' });
    console.error('Error registering reader:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/admin/readers/:id', auth, async (req, res) => {
  const { reader_key, machine_id, location_label, active } = req.body;
  try {
    const result = await db.query(
      `UPDATE badge_readers
       SET reader_key = COALESCE($1, reader_key),
           machine_id = COALESCE($2, machine_id),
           location_label = COALESCE($3, location_label),
           active = COALESCE($4, active),
           updated_at = NOW()
       WHERE reader_id = $5
       RETURNING *`,
      [reader_key, machine_id, location_label, active, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reader not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating reader:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
