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
const LIGHT_GRAY = '#f5f5f5';
const MED_GRAY = '#e0e0e0';
const DARK = '#1a1a1a';

// ─── pdfmake helpers ─────────────────────────────────────────────────────────

const sectionTitle = (text) => ({
  text, style: 'sectionTitle', margin: [0, 10, 0, 4],
  decoration: 'underline', decorationColor: MED_GRAY,
});

const subTitle = (text) => ({
  text, style: 'subTitle', margin: [0, 4, 0, 2],
});

const makeTable = (headers, rows, widths) => {
  const headerRow = headers.map(h => {
    const isRight = typeof h === 'object' && h.align === 'right';
    const text = typeof h === 'object' ? h.text : h;
    return { text, style: 'tableHeader', alignment: isRight ? 'right' : 'left' };
  });

  const bodyRows = rows.length > 0 ? rows : [
    [{ text: 'No data', colSpan: headers.length, alignment: 'center', italics: true, color: '#aaa' },
     ...Array(headers.length - 1).fill('')],
  ];

  return {
    table: {
      headerRows: 1,
      widths: widths || Array(headers.length).fill('*'),
      body: [headerRow, ...bodyRows],
    },
    layout: {
      hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 0.5 : 0.3,
      vLineWidth: () => 0,
      hLineColor: (i) => i === 1 ? '#ccc' : '#eee',
      fillColor: (i) => i === 0 ? LIGHT_GRAY : null,
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 2,
      paddingBottom: () => 2,
    },
    margin: [0, 0, 0, 4],
  };
};

const r = (text) => ({ text: String(text), alignment: 'right' });

const kpiRow = (items) => ({
  columns: items.map(([label, value, color]) => ({
    stack: [
      { text: label, style: 'kpiLabel' },
      { text: value, style: 'kpiValue' },
    ],
    width: '*',
    margin: [0, 0, 6, 0],
    decoration: null,
    _border: color,
  })),
  columnGap: 6,
  margin: [0, 0, 0, 4],
});

const kpiCard = (label, value, color = ORANGE) => ({
  stack: [
    { canvas: [{ type: 'rect', x: 0, y: 0, w: 3, h: 28, color }] },
    {
      stack: [
        { text: label, fontSize: 6.5, color: '#888', bold: true, margin: [0, 0, 0, 1] },
        { text: value, fontSize: 13, bold: true, color: DARK },
      ],
      relativePosition: { x: 8, y: -26 },
    },
  ],
  width: '*',
  margin: [0, 0, 4, 0],
  height: 30,
});

const barChart = (items, maxVal) => {
  if (!items || items.length === 0) return { text: 'No data', italics: true, color: '#aaa', margin: [0, 4, 0, 4] };
  return {
    table: {
      widths: [90, '*', 28],
      body: items.map(({ label, value, color }) => {
        const pct = maxVal > 0 ? Math.max(2, (value / maxVal) * 100) : 0;
        return [
          { text: label, fontSize: 7, color: '#444', margin: [0, 1, 0, 1] },
          {
            canvas: [
              { type: 'rect', x: 0, y: 1, w: 150, h: 6, color: '#eee', r: 1 },
              { type: 'rect', x: 0, y: 1, w: Math.max(2, pct * 1.5), h: 6, color: color || ORANGE, r: 1 },
            ],
            margin: [0, 1, 0, 1],
          },
          { text: fmt(value), fontSize: 7, color: '#888', alignment: 'right', margin: [0, 1, 0, 1] },
        ];
      }),
    },
    layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 2, paddingTop: () => 0, paddingBottom: () => 0 },
    margin: [0, 0, 0, 4],
  };
};

// ─── Build document definition ───────────────────────────────────────────────

function buildAnalyticsDocDef({ metrics, partsMetrics, filters, generatedAt }) {
  const o = metrics.overall;
  const pm = partsMetrics || {};

  const filterParts = [
    filters.shift_name && `Shift: ${filters.shift_name}`,
    filters.machine_id_label && `Machine: ${filters.machine_id_label}`,
    filters.reason && `Reason: ${reasonLabel(filters.reason)}`,
  ].filter(Boolean);
  const filterLine = filterParts.length ? filterParts.join(' · ') : 'All machines · All shifts · All reasons';

  // ── Parts rows ──
  const topPartsRows = (pm.top_parts || []).slice(0, 8).map(p => [
    p.part_name || '—', p.part_number || '—', r(fmt(p.total_qty, 0)), r(fmt(p.call_count, 0)),
  ]);
  const partsMachineRows = (pm.by_machine || []).slice(0, 8).map(m => [
    m.machine_name || `#${m.machine_id}`, r(fmt(m.total_qty, 0)), r(fmt(m.unique_parts, 0)),
  ]);

  // ── Equipment ──
  const machineMax = Math.max(0, ...(metrics.by_machine || []).map(m => num(m.total_downtime_hours)));
  const machineItems = (metrics.by_machine || []).slice(0, 8).map(m => ({
    label: `${m.machine_name || `#${m.machine_id}`} (${fmt(m.call_count, 0)})`,
    value: num(m.total_downtime_hours),
    color: '#f57c00',
  }));
  const repeatRows = (metrics.repeat_failures || []).slice(0, 8).map(rw => [
    rw.machine_name || `#${rw.machine_id}`, reasonLabel(rw.reason_category), r(fmt(rw.occurrences, 0)), r(fmt(rw.suspensions, 0)),
  ]);

  // ── Team ──
  const techRows = (metrics.by_tech || []).slice(0, 10).map(t => [
    t.technician_name || '—', r(fmt(t.call_count, 0)), r(fmt(t.avg_response_minutes)),
    r(fmt(t.avg_repair_minutes)), r(t.sla_pct == null ? '—' : `${fmt(t.sla_pct)}%`), r(fmt(t.suspensions, 0)),
  ]);
  const shiftRows = (metrics.by_shift || []).map(s => [
    s.shift_name || 'Unknown', r(fmt(s.call_count, 0)), r(fmt(s.avg_response_minutes)), r(fmt(s.avg_downtime_minutes)),
  ]);

  const REASON_COLORS = {
    mechanical: '#f57c00', electrical: '#1976d2', tooling: '#42a5f5',
    material: '#9c27b0', operator_error: '#388e3c', other: '#9e9e9e', unknown: '#9e9e9e',
  };
  const reasonMax = Math.max(0, ...(metrics.by_reason || []).map(rv => num(rv.count)));
  const reasonItems = (metrics.by_reason || []).map(rv => ({
    label: reasonLabel(rv.reason_category),
    value: num(rv.count),
    color: REASON_COLORS[rv.reason_category] || '#9e9e9e',
  }));

  const trendRows = (metrics.trend_weekly || []).slice(0, 8).map(t => [
    new Date(t.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    r(fmt(t.call_count, 0)), r(fmt(t.avg_mtta_minutes)), r(fmt(t.avg_mttr_minutes)),
  ]);

  return {
    pageSize: 'A4',
    pageMargins: [28, 50, 28, 35],

    header: {
      columns: [
        { text: 'MCS', fontSize: 10, bold: true, color: ORANGE, margin: [28, 14, 0, 0] },
        { text: 'Maintenance Analytics Report', fontSize: 10, bold: true, color: DARK, margin: [4, 14, 0, 0], width: '*' },
        { text: `${filters.from || 'All time'} — ${filters.to || 'Present'}`, fontSize: 7.5, color: '#888', alignment: 'right', margin: [0, 16, 28, 0] },
      ],
    },

    footer: (currentPage, pageCount) => ({
      columns: [
        { text: filterLine, fontSize: 7, color: '#aaa', margin: [28, 0, 0, 0] },
        { text: `Generated ${generatedAt}`, fontSize: 7, color: '#aaa', alignment: 'center' },
        { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7, color: '#aaa', alignment: 'right', margin: [0, 0, 28, 0] },
      ],
      margin: [0, 8, 0, 0],
    }),

    content: [
      // ── ① Production Health ──
      sectionTitle('① PRODUCTION HEALTH'),
      {
        columns: [
          kpiCard('Downtime Cost', fmtMoney(o.total_downtime_cost), '#d32f2f'),
          kpiCard('Total Downtime', `${fmt(o.total_downtime_hours)} hr`, '#f57c00'),
          kpiCard('SLA %', o.sla_pct == null ? '—' : `${fmt(o.sla_pct)}%`, '#388e3c'),
          kpiCard('Open Calls', fmt(o.open_calls, 0), '#f57c00'),
        ],
        columnGap: 4,
        margin: [0, 0, 0, 3],
      },
      {
        columns: [
          kpiCard('Total Calls', fmt(o.total_calls, 0)),
          kpiCard('MTTA', `${fmt(o.avg_response_minutes)} min`, '#1976d2'),
          kpiCard('MTTR', `${fmt(o.avg_repair_minutes)} min`, '#1976d2'),
          kpiCard('Critical', fmt(o.critical_calls, 0), '#d32f2f'),
        ],
        columnGap: 4,
        margin: [0, 0, 0, 4],
      },

      // ── ② Parts Consumption ──
      sectionTitle('② PARTS CONSUMPTION'),
      {
        columns: [
          {
            stack: [
              subTitle('Top Parts Used'),
              makeTable(
                ['Part', 'Part #', { text: 'Qty', align: 'right' }, { text: 'Calls', align: 'right' }],
                topPartsRows,
                ['*', 'auto', 35, 35],
              ),
            ],
            width: '50%',
          },
          {
            stack: [
              subTitle('Parts by Machine'),
              makeTable(
                ['Machine', { text: 'Qty', align: 'right' }, { text: 'Unique', align: 'right' }],
                partsMachineRows,
                ['*', 40, 40],
              ),
            ],
            width: '50%',
          },
        ],
        columnGap: 12,
      },

      // ── ③ Equipment ──
      sectionTitle('③ EQUIPMENT'),
      {
        columns: [
          {
            stack: [
              subTitle('Top Machines by Downtime (hr)'),
              barChart(machineItems, machineMax),
            ],
            width: '50%',
          },
          {
            stack: [
              subTitle('Repeat Failures (3+ in range)'),
              makeTable(
                ['Machine', 'Reason', { text: '#', align: 'right' }, { text: 'Susp.', align: 'right' }],
                repeatRows,
                ['*', 'auto', 24, 30],
              ),
            ],
            width: '50%',
          },
        ],
        columnGap: 12,
      },

      // ── ④ Team Performance ──
      sectionTitle('④ TEAM PERFORMANCE'),
      subTitle('Technician Workload'),
      makeTable(
        ['Technician', { text: 'Calls', align: 'right' }, { text: 'MTTA', align: 'right' },
         { text: 'MTTR', align: 'right' }, { text: 'SLA%', align: 'right' }, { text: 'Susp.', align: 'right' }],
        techRows,
        ['*', 35, 35, 35, 35, 30],
      ),
      {
        columns: [
          {
            stack: [
              subTitle('By Shift'),
              makeTable(
                ['Shift', { text: 'Calls', align: 'right' }, { text: 'MTTA', align: 'right' }, { text: 'Down', align: 'right' }],
                shiftRows,
                ['*', 32, 32, 32],
              ),
            ],
            width: '34%',
          },
          {
            stack: [
              subTitle('Failure Reasons'),
              barChart(reasonItems, reasonMax),
            ],
            width: '33%',
          },
          {
            stack: [
              subTitle('Weekly Trend'),
              makeTable(
                ['Week', { text: '#', align: 'right' }, { text: 'MTTA', align: 'right' }, { text: 'MTTR', align: 'right' }],
                trendRows,
                ['*', 22, 32, 32],
              ),
            ],
            width: '33%',
          },
        ],
        columnGap: 10,
        margin: [0, 4, 0, 0],
      },
    ],

    styles: {
      sectionTitle: { fontSize: 8, bold: true, color: '#888', characterSpacing: 1.5 },
      subTitle: { fontSize: 8, bold: true, color: '#444' },
      tableHeader: { fontSize: 7, bold: true, color: '#666' },
      kpiLabel: { fontSize: 6.5, bold: true, color: '#888' },
      kpiValue: { fontSize: 13, bold: true, color: DARK },
    },

    defaultStyle: { font: 'Helvetica', fontSize: 7.5, color: '#333' },
  };
}

module.exports = { buildAnalyticsDocDef };
