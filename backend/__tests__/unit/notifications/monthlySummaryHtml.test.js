const { buildSummaryHtml } = require('../../../src/services/notifications/monthlyAnalytics/summaryHtml');

const metrics = {
  overall: { total_calls: '42', total_downtime_hours: '18.5', total_downtime_cost: '2400.00', avg_repair_minutes: '31.2' },
  repeat_failures: [{ machine_name: 'Press 701', reason_category: 'mechanical', occurrences: '5' }],
};

test('includes the label and headline figures', () => {
  const html = buildSummaryHtml(metrics, 'June 2026');
  expect(html).toContain('June 2026');
  expect(html).toContain('42');
  expect(html).toContain('18.5');
  expect(html).toContain('2400.00');
  expect(html).toContain('31.2');
  expect(html).toContain('Press 701');
});

test('is null-safe: empty metrics render dashes without throwing', () => {
  const html = buildSummaryHtml({}, 'June 2026');
  expect(html).toContain('June 2026');
  expect(html).toContain('—');
  expect(html).toContain('None');
});

test('escapes HTML in technician-entered fields', () => {
  const html = buildSummaryHtml({ repeat_failures: [{ machine_name: 'A<b>', reason_category: 'x', occurrences: '1' }] }, 'June 2026');
  expect(html).toContain('A&lt;b&gt;');
  expect(html).not.toContain('<b>');
});
