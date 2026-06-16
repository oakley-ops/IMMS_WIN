class SmsChannel {
  constructor(client, from) {
    this.client = client;
    this.from = from;
    this.name = 'sms';
  }
  // content: { to, body }
  async send({ to, body }) {
    const msg = await this.client.messages.create({ to, from: this.from, body });
    return { ok: true, id: msg.sid };
  }
}

// Returns a configured SmsChannel, or null if Twilio env is missing.
function createSmsChannel() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
    console.warn('[notifications] Twilio not configured — SMS disabled');
    return null;
  }
  const client = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  return new SmsChannel(client, TWILIO_FROM);
}

module.exports = SmsChannel;
module.exports.createSmsChannel = createSmsChannel;
