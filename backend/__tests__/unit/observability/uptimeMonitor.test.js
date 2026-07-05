const { runOnce, checkUrl } = require('../../../src/scripts/uptimeMonitor');

const okEmail = () => ({ sendEmail: jest.fn().mockResolvedValue({}) });

test('checkUrl: 200 is up, non-200 is down, throw is down', async () => {
  expect(await checkUrl('u', async () => ({ status: 200 }))).toEqual({ url: 'u', up: true });
  expect(await checkUrl('u', async () => ({ status: 500 }))).toEqual({ url: 'u', up: false });
  expect(await checkUrl('u', async () => { throw new Error('refused'); })).toEqual({ url: 'u', up: false });
});

test('emails on up->down transition, to the recipients', async () => {
  const email = okEmail();
  const states = await runOnce(
    { 'http://x/health': true },
    { urls: ['http://x/health'], recipients: ['a@b.com'], emailService: email,
      fetchImpl: async () => ({ status: 500 }), now: () => new Date('2026-06-01T00:00:00Z') }
  );
  expect(states['http://x/health']).toBe(false);
  expect(email.sendEmail).toHaveBeenCalledTimes(1);
  const [subject, html, recipient] = email.sendEmail.mock.calls[0];
  expect(subject).toContain('DOWN');
  expect(html).toContain('http://x/health');
  expect(recipient).toBe('a@b.com');
});

test('no email when there is no transition', async () => {
  const email = okEmail();
  await runOnce({ 'http://x/health': true },
    { urls: ['http://x/health'], recipients: ['a@b.com'], emailService: email,
      fetchImpl: async () => ({ status: 200 }) });
  expect(email.sendEmail).not.toHaveBeenCalled();
});

test('no email when recipients is empty (feature off)', async () => {
  const email = okEmail();
  await runOnce({ 'http://x/health': true },
    { urls: ['http://x/health'], recipients: [], emailService: email,
      fetchImpl: async () => ({ status: 500 }) });
  expect(email.sendEmail).not.toHaveBeenCalled();
});

test('a failed alert email does not throw out of runOnce', async () => {
  const email = { sendEmail: jest.fn().mockRejectedValue(new Error('smtp down')) };
  const states = await runOnce({ 'http://x/health': true },
    { urls: ['http://x/health'], recipients: ['a@b.com'], emailService: email,
      fetchImpl: async () => ({ status: 500 }) });
  expect(states['http://x/health']).toBe(false); // still returns updated states
});
