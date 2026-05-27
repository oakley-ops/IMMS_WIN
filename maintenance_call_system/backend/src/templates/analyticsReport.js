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

const ORANGE = '#FF6B35';
const DARK = '#1a1a1a';

// ─── pdfmake helpers ─────────────────────────────────────────────────────────

const INVISIBLE = { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 4, paddingTop: () => 2, paddingBottom: () => 2 };

const section = (label) => [
  { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#ccc' }], margin: [0, 8, 0, 0] },
  { text: label, fontSize: 8, bold: true, color: ORANGE, margin: [0, 4, 0, 6] },
];

const sub = (label) => ({ text: label, fontSize: 7.5, bold: true, color: '#555', margin: [0, 4, 0, 3] });

const th = (text, right) => ({ text, fontSize: 7, bold: true, color: '#666', fillColor: '#f5f5f5', alignment: right ? 'right' : 'left' });
const td = (text, right) => ({ text: String(text), fontSize: 7.5, color: '#333', alignment: right ? 'right' : 'left' });
const empty = (cols) => [{ text: 'No data', colSpan: cols, alignment: 'center', italics: true, fontSize: 7, color: '#aaa' }, ...Array(cols - 1).fill('')];

const dataTable = (headers, rows, widths) => ({
  table: {
    headerRows: 1,
    widths: widths || Array(headers.length).fill('*'),
    body: [
      headers,
      ...(rows.length > 0 ? rows : [empty(headers.length)]),
    ],
  },
  layout: {
    hLineWidth: (i, node) => (i <= 1 || i === node.table.body.length) ? 0.5 : 0.25,
    vLineWidth: () => 0,
    hLineColor: (i) => i <= 1 ? '#ccc' : '#eee',
    fillColor: (i) => i === 0 ? '#f5f5f5' : null,
    paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 2.5, paddingBottom: () => 2.5,
  },
  margin: [0, 0, 0, 2],
});

// ─── Build document ──────────────────────────────────────────────────────────

function buildAnalyticsDocDef({ metrics, partsMetrics, filters, generatedAt }) {
  const o = metrics.overall;
  const pm = partsMetrics || {};

  const filterParts = [
    filters.shift_name && `Shift: ${filters.shift_name}`,
    filters.machine_id_label && `Machine: ${filters.machine_id_label}`,
    filters.reason && `Reason: ${reasonLabel(filters.reason)}`,
  ].filter(Boolean);
  const filterLine = filterParts.length ? filterParts.join('  ·  ') : 'All machines  ·  All shifts  ·  All reasons';

  // ── KPI table (2 rows × 4 cols, no borders, just clean numbers) ──
  const kpiTable = {
    table: {
      widths: ['*', '*', '*', '*'],
      body: [
        [
          { stack: [{ text: 'DOWNTIME COST', style: 'kLbl' }, { text: fmtMoney(o.total_downtime_cost), style: 'kVal', color: '#d32f2f' }] },
          { stack: [{ text: 'TOTAL DOWNTIME', style: 'kLbl' }, { text: `${fmt(o.total_downtime_hours)} hr`, style: 'kVal', color: '#f57c00' }] },
          { stack: [{ text: 'SLA %', style: 'kLbl' }, { text: o.sla_pct == null ? '—' : `${fmt(o.sla_pct)}%`, style: 'kVal', color: '#388e3c' }] },
          { stack: [{ text: 'OPEN CALLS', style: 'kLbl' }, { text: fmt(o.open_calls, 0), style: 'kVal', color: '#f57c00' }] },
        ],
        [
          { stack: [{ text: 'TOTAL CALLS', style: 'kLbl' }, { text: fmt(o.total_calls, 0), style: 'kVal' }] },
          { stack: [{ text: 'MTTA', style: 'kLbl' }, { text: `${fmt(o.avg_response_minutes)} min`, style: 'kVal', color: '#1976d2' }] },
          { stack: [{ text: 'MTTR', style: 'kLbl' }, { text: `${fmt(o.avg_repair_minutes)} min`, style: 'kVal', color: '#1976d2' }] },
          { stack: [{ text: 'CRITICAL', style: 'kLbl' }, { text: fmt(o.critical_calls, 0), style: 'kVal', color: '#d32f2f' }] },
        ],
      ],
    },
    layout: {
      hLineWidth: (i) => i === 1 ? 0.25 : 0,
      vLineWidth: (i) => (i > 0 && i < 4) ? 0.25 : 0,
      hLineColor: () => '#e0e0e0',
      vLineColor: () => '#e0e0e0',
      paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 5, paddingBottom: () => 5,
    },
    margin: [0, 0, 0, 2],
  };

  // ── Parts ──
  const topPartsRows = (pm.top_parts || []).slice(0, 8).map(p => [
    td(p.part_name || '—'), td(p.part_number || '—'), td(fmt(p.total_qty, 0), true), td(fmt(p.call_count, 0), true),
  ]);
  const partsMachineRows = (pm.by_machine || []).slice(0, 8).map(m => [
    td(m.machine_name || `#${m.machine_id}`), td(fmt(m.total_qty, 0), true), td(fmt(m.unique_parts, 0), true),
  ]);

  // ── Equipment ──
  const machineRows = (metrics.by_machine || []).slice(0, 8).map(m => [
    td(m.machine_name || `#${m.machine_id}`), td(fmt(m.call_count, 0), true),
    td(`${fmt(m.total_downtime_hours)} hr`, true), td(fmtMoney(m.total_downtime_cost), true),
  ]);
  const repeatRows = (metrics.repeat_failures || []).slice(0, 8).map(rw => [
    td(rw.machine_name || `#${rw.machine_id}`), td(reasonLabel(rw.reason_category)),
    td(fmt(rw.occurrences, 0), true), td(fmt(rw.suspensions, 0), true),
  ]);

  // ── Team ──
  const techRows = (metrics.by_tech || []).slice(0, 10).map(t => [
    td(t.technician_name || '—'), td(fmt(t.call_count, 0), true), td(fmt(t.avg_response_minutes), true),
    td(fmt(t.avg_repair_minutes), true), td(t.sla_pct == null ? '—' : `${fmt(t.sla_pct)}%`, true), td(fmt(t.suspensions, 0), true),
  ]);
  const shiftRows = (metrics.by_shift || []).map(s => [
    td(s.shift_name || 'Unknown'), td(fmt(s.call_count, 0), true),
    td(fmt(s.avg_response_minutes), true), td(fmt(s.avg_downtime_minutes), true),
  ]);
  const reasonRows = (metrics.by_reason || []).map(rv => [
    td(reasonLabel(rv.reason_category)), td(fmt(rv.count, 0), true), td(fmt(rv.avg_downtime_minutes), true),
  ]);
  const trendRows = (metrics.trend_weekly || []).slice(0, 8).map(t => [
    td(new Date(t.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    td(fmt(t.call_count, 0), true), td(fmt(t.avg_mtta_minutes), true), td(fmt(t.avg_mttr_minutes), true),
  ]);

  return {
    pageSize: 'A4',
    pageMargins: [28, 55, 28, 32],

    header: {
      columns: [
        {
          text: [
            { text: 'MCS  ', fontSize: 11, bold: true, color: ORANGE },
            { text: 'Maintenance Analytics Report', fontSize: 11, bold: true, color: DARK },
          ],
          margin: [28, 16, 0, 0],
        },
        {
          text: `${filters.from || 'All time'}  —  ${filters.to || 'Present'}`,
          fontSize: 8, color: '#888', alignment: 'right', margin: [0, 19, 28, 0],
        },
      ],
    },

    footer: (currentPage, pageCount) => ({
      columns: [
        { text: filterLine, fontSize: 6.5, color: '#bbb', margin: [28, 0, 0, 0] },
        { text: `Generated ${generatedAt}`, fontSize: 6.5, color: '#bbb', alignment: 'center' },
        { text: `${currentPage} / ${pageCount}`, fontSize: 6.5, color: '#bbb', alignment: 'right', margin: [0, 0, 28, 0] },
      ],
      margin: [0, 6, 0, 0],
    }),

    content: [
      // ── ① Production Health ──
      ...section('PRODUCTION HEALTH'),
      kpiTable,

      // ── ② Parts Consumption ──
      ...section('PARTS CONSUMPTION'),
      {
        columns: [
          {
            width: '50%',
            stack: [
              sub('Top Parts Used'),
              dataTable(
                [th('Part'), th('Part #'), th('Qty', true), th('Calls', true)],
                topPartsRows,
                ['*', 'auto', 30, 30],
              ),
            ],
          },
          {
            width: '50%',
            stack: [
              sub('Parts by Machine'),
              dataTable(
                [th('Machine'), th('Qty', true), th('Unique', true)],
                partsMachineRows,
                ['*', 36, 36],
              ),
            ],
          },
        ],
        columnGap: 14,
      },

      // ── ③ Equipment ──
      ...section('EQUIPMENT'),
      {
        columns: [
          {
            width: '55%',
            stack: [
              sub('Top Machines by Downtime'),
              dataTable(
                [th('Machine'), th('Calls', true), th('Downtime', true), th('Cost', true)],
                machineRows,
                ['*', 32, 50, 48],
              ),
            ],
          },
          {
            width: '45%',
            stack: [
              sub('Repeat Failures (3+ in range)'),
              dataTable(
                [th('Machine'), th('Reason'), th('#', true), th('Susp.', true)],
                repeatRows,
                ['*', 'auto', 22, 28],
              ),
            ],
          },
        ],
        columnGap: 14,
      },

      // ── ④ Team Performance ──
      ...section('TEAM PERFORMANCE'),
      sub('Technician Workload'),
      dataTable(
        [th('Technician'), th('Calls', true), th('Avg MTTA', true), th('Avg MTTR', true), th('SLA %', true), th('Susp.', true)],
        techRows,
        ['*', 32, 44, 44, 34, 30],
      ),

      {
        columns: [
          {
            width: '25%',
            stack: [
              sub('By Shift'),
              dataTable(
                [th('Shift'), th('Calls', true), th('MTTA', true), th('Down', true)],
                shiftRows,
                ['*', 28, 30, 30],
              ),
            ],
          },
          {
            width: '30%',
            stack: [
              sub('Failure Reasons'),
              dataTable(
                [th('Reason'), th('Count', true), th('Avg Down', true)],
                reasonRows,
                ['*', 30, 40],
              ),
            ],
          },
          {
            width: '45%',
            stack: [
              sub('Weekly Trend'),
              dataTable(
                [th('Week'), th('Calls', true), th('MTTA', true), th('MTTR', true)],
                trendRows,
                ['*', 30, 34, 34],
              ),
            ],
          },
        ],
        columnGap: 10,
        margin: [0, 4, 0, 0],
      },
    ],

    styles: {
      kLbl: { fontSize: 6.5, bold: true, color: '#999', characterSpacing: 0.5 },
      kVal: { fontSize: 14, bold: true, color: DARK },
    },

    defaultStyle: { font: 'Helvetica', fontSize: 7.5, color: '#333' },
  };
}

module.exports = { buildAnalyticsDocDef };
