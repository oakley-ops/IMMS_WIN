'use strict';

const { previousMonthRange } = require('./period');
const { buildSummaryHtml } = require('./summaryHtml');

// Orchestrates the monthly report. All I/O is injected so this is unit-testable.
// recipients: string[]  emailService: { sendEmailWithAttachment, sendEmail }
async function sendMonthlyAnalyticsReport({ mcsClient, emailService, recipients, now, log = console }) {
  if (!recipients || recipients.length === 0) {
    (log.warn || console.warn)('[monthly-analytics] no recipients configured; skipping');
    return { sent: false, reason: 'no_recipients' };
  }

  const { from, to, label } = previousMonthRange(now);
  const recipient = recipients.join(', ');

  try {
    const metrics = await mcsClient.fetchMetrics(from, to);
    const pdf = await mcsClient.fetchPdf(from, to);
    const html = buildSummaryHtml(metrics, label);
    await emailService.sendEmailWithAttachment(
      `Maintenance Report — ${label}`,
      html,
      recipient,
      [{ filename: `maintenance-report-${label.replace(/\s+/g, '-')}.pdf`, content: pdf, contentType: 'application/pdf' }]
    );
    return { sent: true, reason: 'ok' };
  } catch (err) {
    (log.error || console.error)(`[monthly-analytics] generation failed: ${err.message}`);
    try {
      await emailService.sendEmail(
        `Maintenance Report — ${label} — could not be generated`,
        `<p>This month's maintenance analytics report (covering ${label}) could not be generated. ` +
        `The team has been notified; you can request a manual resend.</p>`,
        recipient
      );
    } catch (notifyErr) {
      (log.error || console.error)(`[monthly-analytics] failure notice also failed: ${notifyErr.message}`);
    }
    return { sent: false, reason: 'generation_failed' };
  }
}

module.exports = { sendMonthlyAnalyticsReport };
