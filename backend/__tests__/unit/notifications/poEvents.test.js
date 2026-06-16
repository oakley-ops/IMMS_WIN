const { poEventForStatus } = require('../../../src/services/notifications/poEvents');
const { EVENTS } = require('../../../src/services/notifications/config');

test('maps PO statuses to events', () => {
  expect(poEventForStatus('submitted')).toBe(EVENTS.PO_SUBMITTED);
  expect(poEventForStatus('approved')).toBe(EVENTS.PO_APPROVED);
  expect(poEventForStatus('received')).toBe(EVENTS.PO_RECEIVED);
  expect(poEventForStatus('on_hold')).toBe(EVENTS.PO_ON_HOLD);
  expect(poEventForStatus('rejected')).toBe(EVENTS.PO_REJECTED);
});

test('returns null for statuses with no notification', () => {
  expect(poEventForStatus('pending')).toBeNull();
  expect(poEventForStatus('on_order')).toBeNull();
  expect(poEventForStatus(undefined)).toBeNull();
});
