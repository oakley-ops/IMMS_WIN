const cron = require('node-cron');
const EmailChannel = require('./channels/EmailChannel');
const { createSmsChannel } = require('./channels/SmsChannel');
const NotificationService = require('./NotificationService');
const InventoryReconciler = require('./InventoryReconciler');
const { sendDigest } = require('./digest');
const { sendMonthlyAnalyticsReport } = require('./monthlyAnalytics');
const mcsAnalyticsClient = require('./monthlyAnalytics/mcsAnalyticsClient');
const { isFirstBusinessDay } = require('./monthlyAnalytics/period');

// pool: the shared pg Pool from backend/db.js
function createNotifications(pool) {
  const emailService = require('../emailService');
  const channels = {
    email: new EmailChannel(emailService),
    sms: createSmsChannel(), // null if Twilio env missing
  };
  const service = new NotificationService({ pool, channels });
  const reconciler = new InventoryReconciler({ pool, notificationService: service });

  async function startSchedulers() {
    await reconciler.seedIfEmpty();

    const intervalMs = parseInt(process.env.RECONCILER_INTERVAL_MS, 10) || 60000;
    setInterval(() => {
      reconciler.reconcile().catch(e => console.error('[notifications] reconcile error:', e.message));
    }, intervalMs);

    const digestCron = process.env.DIGEST_CRON || '0 7 * * *';
    cron.schedule(digestCron, () => {
      sendDigest(pool, service).catch(e => console.error('[notifications] digest error:', e.message));
    });

    const monthlyCron = process.env.MONTHLY_ANALYTICS_CRON || '0 7 1-5 * *';
    cron.schedule(monthlyCron, () => {
      const now = new Date();
      if (!isFirstBusinessDay(now)) return; // only the first business day of the month
      const recipients = (process.env.ANALYTICS_RECIPIENTS || '')
        .split(',').map(s => s.trim()).filter(Boolean);
      sendMonthlyAnalyticsReport({ mcsClient: mcsAnalyticsClient, emailService, recipients, now })
        .catch(e => console.error('[notifications] monthly analytics error:', e.message));
    });
    console.log(`[notifications] reconciler every ${intervalMs}ms, digest at "${digestCron}", monthly analytics at "${monthlyCron}" (first business day only)`);
  }

  return { service, reconciler, startSchedulers };
}

module.exports = { createNotifications };
