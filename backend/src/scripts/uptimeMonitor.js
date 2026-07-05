'use strict';

// Standalone uptime monitor (its own PM2 process). Polls the prod URLs and
// emails OPS_ALERT_RECIPIENTS only on up/down transitions. No-op (no email)
// when OPS_ALERT_RECIPIENTS is empty. Requires emailService lazily inside
// main() so importing this module for tests does not create a pg Pool.
require('dotenv').config();
const { computeTransitions } = require('../observability/uptimeCheck');

const DEFAULT_URLS = [
  'http://localhost:4000/health',
  'http://localhost:4001/health',
  'http://localhost:3001/',
  'http://localhost:3002/',
  'http://localhost:3003/board',
];
const REQ_TIMEOUT_MS = 5000;

const parseList = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);

async function checkUrl(url, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQ_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    return { url, up: res.status === 200 };
  } catch {
    return { url, up: false };
  } finally {
    clearTimeout(timer);
  }
}

async function runOnce(prevStates, { urls, recipients, emailService, fetchImpl = fetch, now = () => new Date() }) {
  const results = await Promise.all(urls.map((u) => checkUrl(u, fetchImpl)));
  const { transitions, states } = computeTransitions(prevStates, results);
  if (transitions.length && recipients.length) {
    const down = transitions.filter((t) => !t.up).map((t) => t.url);
    const up = transitions.filter((t) => t.up).map((t) => t.url);
    const parts = [];
    if (down.length) parts.push(`DOWN: ${down.join(', ')}`);
    if (up.length) parts.push(`RECOVERED: ${up.join(', ')}`);
    const subject = `[IMMS uptime] ${parts.join(' | ')}`;
    const html =
      `<p>Uptime status change at ${now().toISOString()}:</p><ul>` +
      transitions.map((t) => `<li>${t.url} &rarr; ${t.up ? 'UP' : 'DOWN'}</li>`).join('') +
      '</ul>';
    try {
      await emailService.sendEmail(subject, html, recipients.join(', '));
    } catch (err) {
      console.error('[uptime] alert email failed:', err.message);
    }
  }
  return states;
}

function main() {
  const emailService = require('../services/emailService');
  const urls = parseList(process.env.UPTIME_URLS).length ? parseList(process.env.UPTIME_URLS) : DEFAULT_URLS;
  const recipients = parseList(process.env.OPS_ALERT_RECIPIENTS);
  const interval = parseInt(process.env.UPTIME_INTERVAL_MS, 10) || 120000;
  console.log(`[uptime] watching ${urls.length} URLs every ${interval}ms; alerts: ${recipients.length ? recipients.join(',') : 'OFF (no OPS_ALERT_RECIPIENTS)'}`);

  let states = {};
  const tick = () => runOnce(states, { urls, recipients, emailService })
    .then((s) => { states = s; })
    .catch((e) => console.error('[uptime] round error:', e.message));
  tick();
  setInterval(tick, interval);
}

if (require.main === module) main();

module.exports = { runOnce, checkUrl };
