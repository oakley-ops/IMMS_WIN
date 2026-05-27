'use strict';

// ─── Formatting helpers ───────────────────────────────────────────────────────

const num = (v) => {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmt = (v, digits = 1) => {
  if (v == null) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: digits });
};

const fmtMoney = (v) => {
  if (v == null) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  if (!Number.isFinite(n)) return '—';
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

const REASON_LABELS = {
  mechanical: 'Mechanical',
  electrical: 'Electrical',
  tooling: 'Tooling',
  material: 'Material',
  operator_error: 'Operator Error',
  other: 'Other',
  unknown: 'Unknown',
};
const reasonLabel = (k) => REASON_LABELS[k] || k || 'Unknown';

// ─── Reusable HTML chunks ─────────────────────────────────────────────────────

const kpi = (label, value, sub, color = '#FF6B35') => `
  <div class="kpi-card" style="border-top: 4px solid ${color};">
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${value}</div>
    ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
  </div>`;

const hBar = (label, value, max, color = '#FF6B35') => {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return `
    <div class="hbar-row">
      <div class="hbar-label">${label}</div>
      <div class="hbar-track">
        <div class="hbar-fill" style="width:${pct.toFixed(1)}%;background:${color};"></div>
      </div>
      <div class="hbar-val">${fmt(value)}</div>
    </div>`;
};

const sectionHeader = (title) => `
  <div class="section-header">
    <span class="section-label">${title}</span>
    <hr class="section-rule"/>
  </div>`;

// ─── Template ─────────────────────────────────────────────────────────────────

/**
 * Build the complete HTML string for the analytics report PDF.
 *
 * @param {object} opts
 * @param {object} opts.metrics      - result of callMetrics()
 * @param {object} opts.partsMetrics - result of partsMetrics()
 * @param {object} opts.filters      - { from, to, shift_name, machine_id_label, reason }
 * @param {string} opts.generatedAt  - human-readable timestamp
 * @returns {string} full HTML document
 */
function buildAnalyticsReport({ metrics, partsMetrics, filters, generatedAt }) {
  const o = metrics.overall;

  /* ── Filter summary line ── */
  const filterParts = [
    filters.shift_name  && `Shift: ${filters.shift_name}`,
    filters.machine_id_label && `Machine: ${filters.machine_id_label}`,
    filters.reason      && `Reason: ${reasonLabel(filters.reason)}`,
  ].filter(Boolean);
  const filterLine = filterParts.length
    ? filterParts.join('  ·  ')
    : 'All machines · All shifts · All reasons';

  /* ── ① Production Health ── */
  const prodHealth = `
    ${sectionHeader('① PRODUCTION HEALTH')}
    <div class="kpi-grid">
      ${kpi('Downtime Cost',   fmtMoney(o.total_downtime_cost),    'in period',                         '#d32f2f')}
      ${kpi('Total Downtime',  `${fmt(o.total_downtime_hours)} hr`, 'in period',                         '#f57c00')}
      ${kpi('SLA %',           o.sla_pct == null ? '—' : `${fmt(o.sla_pct)}%`, 'acknowledged ≤ 10 min', '#388e3c')}
      ${kpi('Open Calls',      fmt(o.open_calls, 0),               'right now',                         '#f57c00')}
      ${kpi('Total Calls',     fmt(o.total_calls, 0),              'resolved in range')}
      ${kpi('MTTA',            `${fmt(o.avg_response_minutes)} min`, 'mean time to acknowledge',         '#1976d2')}
      ${kpi('MTTR',            `${fmt(o.avg_repair_minutes)} min`,   'mean time to repair',              '#1976d2')}
      ${kpi('Critical Calls',  fmt(o.critical_calls, 0),           'priority = critical',               '#d32f2f')}
    </div>`;

  /* ── ② Parts Consumption ── */
  const pm = partsMetrics || {};

  const topPartsRows = (pm.top_parts || []).map(p => `
    <tr>
      <td>${p.part_name || '—'}</td>
      <td>${p.part_number || '—'}</td>
      <td class="num">${fmt(p.total_qty, 0)}</td>
      <td class="num">${fmt(p.call_count, 0)}</td>
    </tr>`).join('') || '<tr><td colspan="4" class="empty">No data</td></tr>';

  const byMachineRows = (pm.by_machine || []).map(m => `
    <tr>
      <td>${m.machine_name || `#${m.machine_id}`}</td>
      <td class="num">${fmt(m.total_qty, 0)}</td>
      <td class="num">${fmt(m.unique_parts, 0)}</td>
    </tr>`).join('') || '<tr><td colspan="3" class="empty">No data</td></tr>';

  const partsCons = `
    ${sectionHeader('② PARTS CONSUMPTION')}
    <div class="two-col">
      <div>
        <h3 class="subsection">Top Parts Used</h3>
        <table>
          <thead><tr><th>Part</th><th>Part #</th><th class="num">Qty</th><th class="num">Calls</th></tr></thead>
          <tbody>${topPartsRows}</tbody>
        </table>
      </div>
      <div>
        <h3 class="subsection">Parts by Machine</h3>
        <table>
          <thead><tr><th>Machine</th><th class="num">Total Qty</th><th class="num">Unique Parts</th></tr></thead>
          <tbody>${byMachineRows}</tbody>
        </table>
      </div>
    </div>`;

  /* ── ③ Equipment ── */
  const machineMax = Math.max(0, ...(metrics.by_machine || []).map(m => num(m.total_downtime_hours)));
  const machinesBars = (metrics.by_machine || []).length === 0
    ? '<p class="empty">No data</p>'
    : (metrics.by_machine || []).map(m =>
        hBar(
          `${m.machine_name || `#${m.machine_id}`} (${fmt(m.call_count, 0)} calls)`,
          num(m.total_downtime_hours), machineMax, '#f57c00'
        )
      ).join('');

  const repeatRows = (metrics.repeat_failures || []).map(r => `
    <tr>
      <td>${r.machine_name || `#${r.machine_id}`}</td>
      <td>${reasonLabel(r.reason_category)}</td>
      <td class="num">${fmt(r.occurrences, 0)}</td>
      <td class="num">${fmt(r.suspensions, 0)}</td>
    </tr>`).join('') || '<tr><td colspan="4" class="empty">No repeat failures (3+)</td></tr>';

  const equipment = `
    ${sectionHeader('③ EQUIPMENT')}
    <div class="two-col">
      <div>
        <h3 class="subsection">Top Machines by Downtime (hours)</h3>
        <div class="hbar-container">${machinesBars}</div>
      </div>
      <div>
        <h3 class="subsection">Repeat Failures (3+ in range)</h3>
        <table>
          <thead><tr><th>Machine</th><th>Reason</th><th class="num">Count</th><th class="num">Suspended</th></tr></thead>
          <tbody>${repeatRows}</tbody>
        </table>
      </div>
    </div>`;

  /* ── ④ Team Performance ── */
  const techRows = (metrics.by_tech || []).map(t => `
    <tr>
      <td>${t.technician_name || '—'}</td>
      <td class="num">${fmt(t.call_count, 0)}</td>
      <td class="num">${fmt(t.avg_response_minutes)}</td>
      <td class="num">${fmt(t.avg_repair_minutes)}</td>
      <td class="num">${t.sla_pct == null ? '—' : `${fmt(t.sla_pct)}%`}</td>
      <td class="num">${fmt(t.suspensions, 0)}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="empty">No data</td></tr>';

  const shiftRows = (metrics.by_shift || []).map(s => `
    <tr>
      <td>${s.shift_name || 'Unknown'}</td>
      <td class="num">${fmt(s.call_count, 0)}</td>
      <td class="num">${fmt(s.avg_response_minutes)}</td>
      <td class="num">${fmt(s.avg_downtime_minutes)}</td>
    </tr>`).join('') || '<tr><td colspan="4" class="empty">No data</td></tr>';

  const reasonMax = Math.max(0, ...(metrics.by_reason || []).map(r => num(r.count)));
  const REASON_COLORS = {
    mechanical: '#f57c00', electrical: '#1976d2', tooling: '#42a5f5',
    material: '#9c27b0', operator_error: '#388e3c', other: '#9e9e9e', unknown: '#9e9e9e',
  };
  const reasonBars = (metrics.by_reason || []).length === 0
    ? '<p class="empty">No data</p>'
    : (metrics.by_reason || []).map(r =>
        hBar(reasonLabel(r.reason_category), num(r.count), reasonMax,
          REASON_COLORS[r.reason_category] || '#9e9e9e')
      ).join('');

  const trendRows = (metrics.trend_weekly || []).map(t => `
    <tr>
      <td>${new Date(t.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
      <td class="num">${fmt(t.call_count, 0)}</td>
      <td class="num">${fmt(t.avg_mtta_minutes)}</td>
      <td class="num">${fmt(t.avg_mttr_minutes)}</td>
    </tr>`).join('') || '<tr><td colspan="4" class="empty">No data</td></tr>';

  const team = `
    ${sectionHeader('④ TEAM PERFORMANCE')}
    <h3 class="subsection">Technician Workload</h3>
    <table>
      <thead>
        <tr>
          <th>Technician</th><th class="num">Calls</th><th class="num">Avg MTTA (min)</th>
          <th class="num">Avg MTTR (min)</th><th class="num">SLA %</th><th class="num">Suspensions</th>
        </tr>
      </thead>
      <tbody>${techRows}</tbody>
    </table>

    <div class="two-col mt-lg">
      <div>
        <h3 class="subsection">By Shift</h3>
        <table>
          <thead><tr><th>Shift</th><th class="num">Calls</th><th class="num">Avg MTTA</th><th class="num">Avg Downtime</th></tr></thead>
          <tbody>${shiftRows}</tbody>
        </table>
      </div>
      <div>
        <h3 class="subsection">Failure Reasons</h3>
        <div class="hbar-container">${reasonBars}</div>
      </div>
    </div>

    <h3 class="subsection mt-lg">Weekly Trend</h3>
    <table>
      <thead><tr><th>Week of</th><th class="num">Calls</th><th class="num">MTTA (min)</th><th class="num">MTTR (min)</th></tr></thead>
      <tbody>${trendRows}</tbody>
    </table>`;

  /* ── Full document ── */
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>MCS Analytics Report</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 12px;
      color: #212121;
      background: #fff;
      padding: 28px 36px;
      max-width: 1100px;
    }

    /* ── Report header ── */
    .report-header { margin-bottom: 24px; border-bottom: 3px solid #FF6B35; padding-bottom: 14px; }
    .report-header .brand { font-size: 11px; font-weight: 700; color: #FF6B35; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
    .report-header h1 { font-size: 22px; font-weight: 700; color: #1a1a1a; margin-bottom: 6px; }
    .report-header .meta { font-size: 11px; color: #666; }
    .report-header .meta span { margin-right: 16px; }

    /* ── Section headers ── */
    .section-header { margin: 24px 0 12px; }
    .section-label { font-size: 10px; font-weight: 800; color: #888; letter-spacing: 3px; text-transform: uppercase; }
    .section-rule { border: none; border-top: 1px solid #e0e0e0; margin-top: 4px; }

    /* ── KPI grid ── */
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 8px; }
    .kpi-card { border-top: 4px solid #FF6B35; background: #fafafa; border-radius: 4px; padding: 10px 12px; }
    .kpi-label { font-size: 9px; font-weight: 700; color: #888; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 4px; }
    .kpi-value { font-size: 22px; font-weight: 800; color: #1a1a1a; line-height: 1.1; }
    .kpi-sub { font-size: 9px; color: #aaa; margin-top: 3px; }

    /* ── Two-column layout ── */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 8px; }

    /* ── Tables ── */
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 4px; }
    th { background: #f5f5f5; font-weight: 700; font-size: 10px; letter-spacing: 0.3px; padding: 6px 8px; text-align: left; border-bottom: 2px solid #e0e0e0; color: #555; text-transform: uppercase; }
    td { padding: 5px 8px; border-bottom: 1px solid #f0f0f0; color: #333; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #fafafa; }
    td.num, th.num { text-align: right; }
    td.empty { color: #aaa; font-style: italic; text-align: center; padding: 12px; }

    /* ── Horizontal bar charts ── */
    .hbar-container { margin-bottom: 4px; }
    .hbar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .hbar-label { flex: 0 0 200px; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #444; font-weight: 500; }
    .hbar-track { flex: 1; height: 9px; background: #eeeeee; border-radius: 2px; overflow: hidden; }
    .hbar-fill { height: 100%; border-radius: 2px; }
    .hbar-val { flex: 0 0 40px; font-size: 10px; color: #888; text-align: right; }

    /* ── Subsection titles ── */
    .subsection { font-size: 12px; font-weight: 700; color: #333; margin-bottom: 8px; }
    .mt-lg { margin-top: 20px; }

    /* ── Page breaks ── */
    .section-header.page-break { page-break-before: always; }

    /* ── Print colour fix ── */
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  </style>
</head>
<body>
  <div class="report-header">
    <div class="brand">Maintenance Call System</div>
    <h1>Analytics Report</h1>
    <div class="meta">
      <span>Period: <strong>${filters.from || 'all time'}</strong> to <strong>${filters.to || 'present'}</strong></span>
      <span>${filterLine}</span>
      <span style="float:right;color:#bbb;">Generated: ${generatedAt}</span>
    </div>
  </div>

  ${prodHealth}

  <div class="section-header page-break">
    <span class="section-label">② PARTS CONSUMPTION</span>
    <hr class="section-rule"/>
  </div>
  ${partsCons.replace(sectionHeader('② PARTS CONSUMPTION'), '')}

  <div class="section-header page-break">
    <span class="section-label">③ EQUIPMENT</span>
    <hr class="section-rule"/>
  </div>
  ${equipment.replace(sectionHeader('③ EQUIPMENT'), '')}

  <div class="section-header page-break">
    <span class="section-label">④ TEAM PERFORMANCE</span>
    <hr class="section-rule"/>
  </div>
  ${team.replace(sectionHeader('④ TEAM PERFORMANCE'), '')}
</body>
</html>`;
}

module.exports = { buildAnalyticsReport };
