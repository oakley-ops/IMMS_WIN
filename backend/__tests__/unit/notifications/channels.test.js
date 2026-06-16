const EmailChannel = require('../../../src/services/notifications/channels/EmailChannel');
const SmsChannel = require('../../../src/services/notifications/channels/SmsChannel');

describe('EmailChannel', () => {
  test('delegates to emailService.sendEmail(subject, body, to)', async () => {
    const emailService = { sendEmail: jest.fn().mockResolvedValue({ messageId: 'm1' }) };
    const ch = new EmailChannel(emailService);
    const res = await ch.send({ to: 'a@b.com', subject: 'Hi', body: '<b>x</b>' });
    expect(emailService.sendEmail).toHaveBeenCalledWith('Hi', '<b>x</b>', 'a@b.com');
    expect(res.ok).toBe(true);
    expect(ch.name).toBe('email');
  });
});

describe('SmsChannel', () => {
  test('sends via twilio client.messages.create', async () => {
    const client = { messages: { create: jest.fn().mockResolvedValue({ sid: 'SM1' }) } };
    const ch = new SmsChannel(client, '+15555550123');
    const res = await ch.send({ to: '+15555551234', body: 'hello' });
    expect(client.messages.create).toHaveBeenCalledWith({ to: '+15555551234', from: '+15555550123', body: 'hello' });
    expect(res).toEqual({ ok: true, id: 'SM1' });
    expect(ch.name).toBe('sms');
  });
});
