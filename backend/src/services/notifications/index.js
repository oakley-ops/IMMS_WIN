const cron = require('node-cron');
const EmailChannel = require('./channels/EmailChannel');
const { createSmsChannel } = require('./channels/SmsChannel');
const NotificationService = require('./NotificationService');
const InventoryReconciler = require('./InventoryReconciler');
const { sendDigest } = require('./digest');

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
    console.log(`[notifications] reconciler every ${intervalMs}ms, digest at "${digestCron}"`);
  }

  return { service, reconciler, startSchedulers };
}

module.exports = { createNotifications };
