'use strict';

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
  mechanical: 'Mechanical', electrical: 'Electrical', tooling: 'Tooling',
  material: 'Material', operator_error: 'Operator Err.', other: 'Other', unknown: 'Unknown',
};
const reasonLabel = (k) => REASON_LABELS[k] || k || 'Unknown';

const REASON_COLORS = {
  mechanical: '#f57c00', electrical: '#1976d2', tooling: '#42a5f5',
  material: '#9c27b0', operator_error: '#388e3c', other: '#9e9e9e', unknown: '#9e9e9e',
};

const kpi = (label, value, color = '#FF6B35') => `
  <div class="kpi" style="border-left:3px solid ${color};">
    <div class="kpi-l">${label}</div>
    <div class="kpi-v">${value}</div>
  </div>`;

const hBar = (label, value, max, color = '#FF6B35') => {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return `<div class="hb"><span class="hb-l">${label}</span><span class="hb-t"><span class="hb-f" style="width:${pct.toFixed(1)}%;background:${color};"></span></span><span class="hb-v">${fmt(value)}</span></div>`;
};

const sec = (title) => `<div class="sec"><span>${title}</span></div>`;

function buildAnalyticsReport({ metrics, partsMetrics, filters, generatedAt }) {
  const o = metrics.overall;
  const pm = partsMetrics || {};

  const filterParts = [
    filters.shift_name && `Shift: ${filters.shift_name}`,
    filters.machine_id_label && `Machine: ${filters.machine_id_label}`,
    filters.reason && `Reason: ${reasonLabel(filters.reason)}`,
  ].filter(Boolean);
  const filterLine = filterParts.length ? filterParts.join(' · ') : 'All machines · All shifts · All reasons';

  // ── KPIs ──
  const kpis = `
    <div class="kpi-grid">
      ${kpi('Downtime Cost', fmtMoney(o.total_downtime_cost), '#d32f2f')}
      ${kpi('Total Downtime', `${fmt(o.total_downtime_hours)} hr`, '#f57c00')}
      ${kpi('SLA %', o.sla_pct == null ? '—' : `${fmt(o.sla_pct)}%`, '#388e3c')}
      ${kpi('Open Calls', fmt(o.open_calls, 0), '#f57c00')}
      ${kpi('Total Calls', fmt(o.total_calls, 0))}
      ${kpi('MTTA', `${fmt(o.avg_response_minutes)} min`, '#1976d2')}
      ${kpi('MTTR', `${fmt(o.avg_repair_minutes)} min`, '#1976d2')}
      ${kpi('Critical', fmt(o.critical_calls, 0), '#d32f2f')}
    </div>`;

  // ── Parts ──
  const topPartsRows = (pm.top_parts || []).slice(0, 8).map(p =>
    `<tr><td>${p.part_name || '—'}</td><td>${p.part_number || '—'}</td><td class="r">${fmt(p.total_qty, 0)}</td><td class="r">${fmt(p.call_count, 0)}</td></tr>`
  ).join('') || '<tr><td colspan="4" class="e">No data</td></tr>';

  const partsByMachineRows = (pm.by_machine || []).slice(0, 8).map(m =>
    `<tr><td>${m.machine_name || `#${m.machine_id}`}</td><td class="r">${fmt(m.total_qty, 0)}</td><td class="r">${fmt(m.unique_parts, 0)}</td></tr>`
  ).join('') || '<tr><td colspan="3" class="e">No data</td></tr>';

  // ── Equipment ──
  const machineMax = Math.max(0, ...(metrics.by_machine || []).map(m => num(m.total_downtime_hours)));
  const machinesBars = (metrics.by_machine || []).length === 0
    ? '<p class="e">No data</p>'
    : (metrics.by_machine || []).slice(0, 8).map(m =>
        hBar(`${m.machine_name || `#${m.machine_id}`} (${fmt(m.call_count, 0)})`, num(m.total_downtime_hours), machineMax, '#f57c00')
      ).join('');

  const repeatRows = (metrics.repeat_failures || []).slice(0, 8).map(r =>
    `<tr><td>${r.machine_name || `#${r.machine_id}`}</td><td>${reasonLabel(r.reason_category)}</td><td class="r">${fmt(r.occurrences, 0)}</td><td class="r">${fmt(r.suspensions, 0)}</td></tr>`
  ).join('') || '<tr><td colspan="4" class="e">No repeat failures</td></tr>';

  // ── Team ──
  const techRows = (metrics.by_tech || []).slice(0, 10).map(t =>
    `<tr><td>${t.technician_name || '—'}</td><td class="r">${fmt(t.call_count, 0)}</td><td class="r">${fmt(t.avg_response_minutes)}</td><td class="r">${fmt(t.avg_repair_minutes)}</td><td class="r">${t.sla_pct == null ? '—' : `${fmt(t.sla_pct)}%`}</td><td class="r">${fmt(t.suspensions, 0)}</td></tr>`
  ).join('') || '<tr><td colspan="6" class="e">No data</td></tr>';

  const shiftRows = (metrics.by_shift || []).map(s =>
    `<tr><td>${s.shift_name || 'Unknown'}</td><td class="r">${fmt(s.call_count, 0)}</td><td class="r">${fmt(s.avg_response_minutes)}</td><td class="r">${fmt(s.avg_downtime_minutes)}</td></tr>`
  ).join('') || '<tr><td colspan="4" class="e">No data</td></tr>';

  const reasonMax = Math.max(0, ...(metrics.by_reason || []).map(r => num(r.count)));
  const reasonBars = (metrics.by_reason || []).length === 0
    ? '<p class="e">No data</p>'
    : (metrics.by_reason || []).map(r =>
        hBar(reasonLabel(r.reason_category), num(r.count), reasonMax, REASON_COLORS[r.reason_category] || '#9e9e9e')
      ).join('');

  const trendRows = (metrics.trend_weekly || []).slice(0, 8).map(t =>
    `<tr><td>${new Date(t.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td><td class="r">${fmt(t.call_count, 0)}</td><td class="r">${fmt(t.avg_mtta_minutes)}</td><td class="r">${fmt(t.avg_mttr_minutes)}</td></tr>`
  ).join('') || '<tr><td colspan="4" class="e">No data</td></tr>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>MCS Analytics Report</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:9px;color:#222;background:#fff;}

/* Header */
.hdr{display:flex;align-items:baseline;justify-content:space-between;border-bottom:2px solid #FF6B35;padding-bottom:6px;margin-bottom:8px;}
.hdr h1{font-size:14px;font-weight:800;color:#1a1a1a;}
.hdr h1 span{color:#FF6B35;font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-right:8px;}
.hdr .meta{font-size:8px;color:#888;text-align:right;line-height:1.4;}

/* Section headers */
.sec{margin:10px 0 4px;font-size:8px;font-weight:800;color:#999;letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid #e0e0e0;padding-bottom:2px;}

/* KPIs */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:6px;}
.kpi{background:#fafafa;border-radius:3px;padding:4px 6px;border-left:3px solid #FF6B35;}
.kpi-l{font-size:7px;font-weight:700;color:#999;letter-spacing:.5px;text-transform:uppercase;}
.kpi-v{font-size:14px;font-weight:800;color:#1a1a1a;line-height:1.2;}

/* Two-col */
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}

/* Tables */
table{width:100%;border-collapse:collapse;font-size:8px;margin-bottom:2px;}
th{background:#f5f5f5;font-weight:700;font-size:7.5px;letter-spacing:.3px;padding:3px 4px;text-align:left;border-bottom:1.5px solid #ddd;color:#666;text-transform:uppercase;}
td{padding:2.5px 4px;border-bottom:1px solid #f0f0f0;color:#333;}
td.r,th.r{text-align:right;}
td.e{color:#aaa;font-style:italic;text-align:center;padding:6px;}
.sub{font-size:9px;font-weight:700;color:#444;margin-bottom:3px;}

/* Bar charts */
.hb{display:flex;align-items:center;gap:4px;margin-bottom:3px;}
.hb-l{flex:0 0 140px;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#444;font-weight:500;}
.hb-t{flex:1;height:7px;background:#eee;border-radius:1px;overflow:hidden;}
.hb-f{height:100%;border-radius:1px;}
.hb-v{flex:0 0 30px;font-size:7.5px;color:#888;text-align:right;}

/* Page 2 */
.page2{page-break-before:always;}

/* Print colours */
*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
</style>
</head>
<body>

<!-- ── HEADER ── -->
<div class="hdr">
  <h1><span>MCS</span> Analytics Report</h1>
  <div class="meta">
    ${filters.from || 'All time'} — ${filters.to || 'Present'} · ${filterLine}<br/>
    Generated ${generatedAt}
  </div>
</div>

<!-- ── PAGE 1 ── -->

${sec('① Production Health')}
${kpis}

${sec('② Parts Consumption')}
<div class="two">
  <div>
    <div class="sub">Top Parts Used</div>
    <table>
      <thead><tr><th>Part</th><th>Part #</th><th class="r">Qty</th><th class="r">Calls</th></tr></thead>
      <tbody>${topPartsRows}</tbody>
    </table>
  </div>
  <div>
    <div class="sub">Parts by Machine</div>
    <table>
      <thead><tr><th>Machine</th><th class="r">Total Qty</th><th class="r">Unique</th></tr></thead>
      <tbody>${partsByMachineRows}</tbody>
    </table>
  </div>
</div>

${sec('③ Equipment')}
<div class="two">
  <div>
    <div class="sub">Top Machines by Downtime (hr)</div>
    ${machinesBars}
  </div>
  <div>
    <div class="sub">Repeat Failures (3+ in range)</div>
    <table>
      <thead><tr><th>Machine</th><th>Reason</th><th class="r">#</th><th class="r">Susp.</th></tr></thead>
      <tbody>${repeatRows}</tbody>
    </table>
  </div>
</div>

<!-- ── PAGE 2 ── -->
<div class="page2">

${sec('④ Team Performance')}
<div class="sub">Technician Workload</div>
<table>
  <thead><tr><th>Technician</th><th class="r">Calls</th><th class="r">MTTA</th><th class="r">MTTR</th><th class="r">SLA%</th><th class="r">Susp.</th></tr></thead>
  <tbody>${techRows}</tbody>
</table>

<div class="three" style="margin-top:8px;">
  <div>
    <div class="sub">By Shift</div>
    <table>
      <thead><tr><th>Shift</th><th class="r">Calls</th><th class="r">MTTA</th><th class="r">Down</th></tr></thead>
      <tbody>${shiftRows}</tbody>
    </table>
  </div>
  <div>
    <div class="sub">Failure Reasons</div>
    ${reasonBars}
  </div>
  <div>
    <div class="sub">Weekly Trend</div>
    <table>
      <thead><tr><th>Week</th><th class="r">#</th><th class="r">MTTA</th><th class="r">MTTR</th></tr></thead>
      <tbody>${trendRows}</tbody>
    </table>
  </div>
</div>

</div>
</body>
</html>`;
}

module.exports = { buildAnalyticsReport };
