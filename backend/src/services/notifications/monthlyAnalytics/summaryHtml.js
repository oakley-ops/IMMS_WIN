'use strict';

const dash = (v) => (v === null || v === undefined || v === '' ? '—' : v);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function buildSummaryHtml(metrics, label) {
  const o = (metrics && metrics.overall) || {};
  const top = metrics && Array.isArray(metrics.repeat_failures) ? metrics.repeat_failures[0] : null;
  const topLine = top
    ? `${esc(top.machine_name)} — ${esc(top.reason_category || 'unspecified')} (${top.occurrences}×)`
    : 'None';
  const cost = o.total_downtime_cost != null && o.total_downtime_cost !== '' ? `$${o.total_downtime_cost}` : '—';

  return `<div style="font-family:Segoe UI,Arial,sans-serif;color:#23293a;max-width:560px;">
  <h2 style="color:#1a2744;margin:0 0 4px;">Maintenance Report — ${esc(label)}</h2>
  <p style="color:#6b7486;margin:0 0 12px;">Summary for ${esc(label)}. Full breakdown attached as PDF.</p>
  <table style="border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:4px 12px 4px 0;color:#6b7486;">Calls resolved</td><td style="padding:4px 0;font-weight:600;">${dash(o.total_calls)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7486;">Total downtime</td><td style="padding:4px 0;font-weight:600;">${dash(o.total_downtime_hours)} hrs</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7486;">Downtime cost</td><td style="padding:4px 0;font-weight:600;">${cost}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7486;">Avg repair time (MTTR)</td><td style="padding:4px 0;font-weight:600;">${dash(o.avg_repair_minutes)} min</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7486;">Top repeat offender</td><td style="padding:4px 0;font-weight:600;">${topLine}</td></tr>
  </table>
</div>`;
}

module.exports = { buildSummaryHtml };
