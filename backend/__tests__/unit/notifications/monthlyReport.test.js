const { sendMonthlyAnalyticsReport } = require('../../../src/services/notifications/monthlyAnalytics');

const metrics = { overall: { total_calls: '10', total_downtime_hours: '5', total_downtime_cost: '600', avg_repair_minutes: '20' }, repeat_failures: [] };
const pdf = Buffer.from('%PDF-1.4 fake');
const now = new Date(2026, 6, 1); // July 1 -> reports June
const silentLog = { warn: () => {}, error: () => {} };

function makeEmail() {
  return { sendEmailWithAttachment: jest.fn().mockResolvedValue({}), sendEmail: jest.fn().mockResolvedValue({}) };
}

test('happy path: fetches June, emails summary + PDF attachment', async () => {
  const mcsClient = { fetchMetrics: jest.fn().mockResolvedValue(metrics), fetchPdf: jest.fn().mockResolvedValue(pdf) };
  const emailService = makeEmail();
  const res = await sendMonthlyAnalyticsReport({ mcsClient, emailService, recipients: ['a@x.com', 'b@x.com'], now, log: silentLog });

  expect(res).toEqual({ sent: true, reason: 'ok' });
  // both endpoints called with the same period
  const [mFrom, mTo] = mcsClient.fetchMetrics.mock.calls[0];
  expect(mcsClient.fetchPdf).toHaveBeenCalledWith(mFrom, mTo);
  // one email with the joined recipients and the PDF buffer attached
  expect(emailService.sendEmailWithAttachment).toHaveBeenCalledTimes(1);
  const [subject, html, recipient, attachments] = emailService.sendEmailWithAttachment.mock.calls[0];
  expect(subject).toContain('June 2026');
  expect(html).toContain('June 2026');
  expect(recipient).toBe('a@x.com, b@x.com');
  expect(attachments[0].content).toBe(pdf);
  expect(attachments[0].contentType).toBe('application/pdf');
  expect(emailService.sendEmail).not.toHaveBeenCalled();
});

test('no recipients: returns no_recipients and sends nothing', async () => {
  const mcsClient = { fetchMetrics: jest.fn(), fetchPdf: jest.fn() };
  const emailService = makeEmail();
  const res = await sendMonthlyAnalyticsReport({ mcsClient, emailService, recipients: [], now, log: silentLog });
  expect(res).toEqual({ sent: false, reason: 'no_recipients' });
  expect(mcsClient.fetchMetrics).not.toHaveBeenCalled();
  expect(emailService.sendEmailWithAttachment).not.toHaveBeenCalled();
});

test('MCS failure: sends the plain failure notice and returns generation_failed', async () => {
  const mcsClient = { fetchMetrics: jest.fn().mockRejectedValue(new Error('MCS down')), fetchPdf: jest.fn() };
  const emailService = makeEmail();
  const res = await sendMonthlyAnalyticsReport({ mcsClient, emailService, recipients: ['a@x.com'], now, log: silentLog });
  expect(res).toEqual({ sent: false, reason: 'generation_failed' });
  expect(emailService.sendEmailWithAttachment).not.toHaveBeenCalled();
  expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
  const [subject, , recipient] = emailService.sendEmail.mock.calls[0];
  expect(subject).toContain('could not be generated');
  expect(recipient).toBe('a@x.com');
});
