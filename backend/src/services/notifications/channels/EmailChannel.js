class EmailChannel {
  constructor(emailService) {
    this.emailService = emailService;
    this.name = 'email';
  }
  // content: { to, subject, body }
  async send({ to, subject, body }) {
    await this.emailService.sendEmail(subject, body, to);
    return { ok: true };
  }
}
module.exports = EmailChannel;
