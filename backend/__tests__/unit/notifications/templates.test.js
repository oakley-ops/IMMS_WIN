const { renderEmail, renderSms } = require('../../../src/services/notifications/templates');
const { EVENTS } = require('../../../src/services/notifications/config');

test('inventory.out email has subject + html with part name', () => {
  const { subject, html } = renderEmail(EVENTS.INVENTORY_OUT, { name: 'Pressure Spring', quantity: 0, minimum_quantity: 10 });
  expect(subject).toMatch(/Out of Stock/i);
  expect(html).toContain('Pressure Spring');
});

test('inventory.out sms is short and names the part', () => {
  const text = renderSms(EVENTS.INVENTORY_OUT, { name: 'Pressure Spring' });
  expect(text).toContain('Pressure Spring');
  expect(text.length).toBeLessThanOrEqual(160);
});

test('po.approved email + sms reference the PO number', () => {
  const { subject } = renderEmail(EVENTS.PO_APPROVED, { po_number: '014743' });
  expect(subject).toContain('014743');
  expect(renderSms(EVENTS.PO_APPROVED, { po_number: '014743' })).toContain('014743');
});

test('inventory.digest lists out and low parts', () => {
  const { html } = renderEmail(EVENTS.INVENTORY_DIGEST, {
    outParts: [{ name: 'A', quantity: 0, minimum_quantity: 2 }],
    lowParts: [{ name: 'B', quantity: 1, minimum_quantity: 2 }],
  });
  expect(html).toContain('A');
  expect(html).toContain('B');
});
