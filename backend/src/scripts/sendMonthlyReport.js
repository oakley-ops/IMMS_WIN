'use strict';

// On-demand monthly report: `npm run report:monthly`.
// Dev testing and manual resends. Uses the real MCS client + email service.
require('dotenv').config();

const emailService = require('../services/emailService');
const mcsAnalyticsClient = require('../services/notifications/monthlyAnalytics/mcsAnalyticsClient');
const { sendMonthlyAnalyticsReport } = require('../services/notifications/monthlyAnalytics');

const recipients = (process.env.ANALYTICS_RECIPIENTS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

sendMonthlyAnalyticsReport({ mcsClient: mcsAnalyticsClient, emailService, recipients, now: new Date() })
  .then((r) => { console.log('[report:monthly]', r); process.exit(r.sent ? 0 : 1); })
  .catch((e) => { console.error('[report:monthly] error:', e); process.exit(1); });
