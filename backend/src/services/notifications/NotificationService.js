const { CHANNEL_MATRIX, RECIPIENT_ROLES } = require('./config');
const { renderEmail, renderSms } = require('./templates');

function refIdFor(payload) {
  if (payload == null) return null;
  if (payload.part_id != null) return String(payload.part_id);
  if (payload.po_id != null) return String(payload.po_id);
  if (payload.po_number != null) return String(payload.po_number);
  return null;
}

class NotificationService {
  constructor({ pool, channels }) {
    this.pool = pool;
    this.channels = channels; // { email: EmailChannel, sms: SmsChannel|null }
  }

  async resolveRecipients() {
    const { rows } = await this.pool.query(
      `SELECT email, phone FROM users WHERE role = ANY($1) AND email IS NOT NULL`,
      [RECIPIENT_ROLES]
    );
    return rows;
  }

  async log(eventType, channel, recipient, refId, status, error) {
    try {
      await this.pool.query(
        `INSERT INTO notification_log (event_type, channel, recipient, ref_id, status, error)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [eventType, channel, recipient, refId, status, error]
      );
    } catch (e) {
      console.error('[notifications] failed to write notification_log:', e.message);
    }
  }

  async notify(eventType, payload) {
    if (process.env.NOTIFICATIONS_ENABLED === 'false') return;
    const channelNames = CHANNEL_MATRIX[eventType] || [];
    if (channelNames.length === 0) return;

    const recipients = await this.resolveRecipients();
    const refId = refIdFor(payload);

    for (const channelName of channelNames) {
      const channel = this.channels[channelName];
      if (!channel) continue; // e.g. SMS not configured
      for (const r of recipients) {
        const to = channelName === 'sms' ? r.phone : r.email;
        if (!to) continue;
        const content = channelName === 'sms'
          ? { to, body: renderSms(eventType, payload) }
          : { to, ...renderEmail(eventType, payload) };
        try {
          await channel.send(content);
          await this.log(eventType, channelName, to, refId, 'sent', null);
        } catch (err) {
          console.error(`[notifications] ${channelName} send failed for ${eventType}:`, err.message);
          await this.log(eventType, channelName, to, refId, 'failed', err.message);
        }
      }
    }
  }
}

module.exports = NotificationService;
