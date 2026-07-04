'use strict';

const jwt = require('jsonwebtoken');

const TIMEOUT_MS = 30000; // PDF generation is the slow part

const baseUrl = () => process.env.MCS_BASE_URL || 'http://localhost:4001/api/v1';

// Short-lived admin service token, signed with the shared JWT_SECRET.
// role:admin passes MCS's requirePermission('analytics_view') admin bypass.
// id must be truthy — MCS requirePermission rejects a falsy id before the
// admin-role bypass; -1 is a non-DB sentinel.
function mintToken() {
  return jwt.sign(
    { id: -1, username: 'imms-scheduler', role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );
}

async function request(path, from, to, asBuffer) {
  const url = `${baseUrl()}${path}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${mintToken()}` },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`MCS ${path} returned ${res.status}`);
    return asBuffer ? Buffer.from(await res.arrayBuffer()) : await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const fetchMetrics = (from, to) => request('/maintenance-calls/stats/metrics', from, to, false);
const fetchPdf = (from, to) => request('/mcs/analytics/pdf', from, to, true);

module.exports = { fetchMetrics, fetchPdf, mintToken };
