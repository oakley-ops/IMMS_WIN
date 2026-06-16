const NotificationService = require('../../../src/services/notifications/NotificationService');
const { EVENTS } = require('../../../src/services/notifications/config');

function makeService(channels) {
  const queries = [];
  const pool = {
    query: jest.fn(async (text, params) => {
      queries.push({ text, params });
      if (/auth\.users/i.test(text)) {
        return { rows: [
          { email: 'admin@x.com', phone: '+15555550001' },
          { email: 'buyer@x.com', phone: null },
        ] };
      }
      return { rows: [] }; // notification_log inserts
    }),
  };
  return { service: new NotificationService({ pool, channels }), pool, queries };
}

test('inventory.out → email to both, sms only to those with a phone', async () => {
  const email = { name: 'email', send: jest.fn().mockResolvedValue({ ok: true }) };
  const sms = { name: 'sms', send: jest.fn().mockResolvedValue({ ok: true }) };
  const { service } = makeService({ email, sms });

  await service.notify(EVENTS.INVENTORY_OUT, { part_id: 7, name: 'Spring', quantity: 0, minimum_quantity: 3 });

  expect(email.send).toHaveBeenCalledTimes(2);                 // both recipients
  expect(sms.send).toHaveBeenCalledTimes(1);                   // only the one with a phone
  expect(sms.send.mock.calls[0][0].to).toBe('+15555550001');
});

test('inventory.low → email only (no sms channel use)', async () => {
  const email = { name: 'email', send: jest.fn().mockResolvedValue({ ok: true }) };
  const sms = { name: 'sms', send: jest.fn().mockResolvedValue({ ok: true }) };
  const { service } = makeService({ email, sms });
  await service.notify(EVENTS.INVENTORY_LOW, { part_id: 7, name: 'Spring', quantity: 1, minimum_quantity: 3 });
  expect(email.send).toHaveBeenCalledTimes(2);
  expect(sms.send).not.toHaveBeenCalled();
});

test('a channel failure is logged and does not throw', async () => {
  const email = { name: 'email', send: jest.fn().mockRejectedValue(new Error('smtp down')) };
  const { service, queries } = makeService({ email, sms: null });
  await expect(service.notify(EVENTS.INVENTORY_LOW, { part_id: 9, name: 'X', quantity: 0, minimum_quantity: 1 })).resolves.toBeUndefined();
  const logInserts = queries.filter(q => /INSERT INTO notification_log/i.test(q.text));
  expect(logInserts.length).toBe(2);
  expect(logInserts[0].params).toContain('failed');
});

test('NOTIFICATIONS_ENABLED=false short-circuits', async () => {
  process.env.NOTIFICATIONS_ENABLED = 'false';
  const email = { name: 'email', send: jest.fn() };
  const { service } = makeService({ email, sms: null });
  await service.notify(EVENTS.INVENTORY_LOW, { part_id: 1, name: 'X', quantity: 0, minimum_quantity: 1 });
  expect(email.send).not.toHaveBeenCalled();
  delete process.env.NOTIFICATIONS_ENABLED;
});
