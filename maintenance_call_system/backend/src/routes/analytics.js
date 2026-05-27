'use strict';

const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const db = require('../database/db');
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const validate = require('../middleware/validate');
const S = require('../schemas/maintenanceCalls');
const repo = require('../repositories/maintenanceCallsRepo');
const { buildAnalyticsReport } = require('../templates/analyticsReport');
const logger = require('../lib/logger');

// ─── GET /api/v1/mcs/analytics/pdf ───────────────────────────────────────────
//
// Generates a PDF report of the analytics data for the current filter set.
// Requires authentication and analytics_view permission (or admin/tech role).
// Query params match the metrics endpoint: from, to, shift_name, machine_id, reason.
//
// Returns: application/pdf as an attachment download.

router.get(
  '/pdf',
  auth,
  requirePermission('analytics_view'),
  validate({ query: S.metricsQuery }),
  async (req, res) => {
    const log = req.log || logger;
    const filters = req.query;

    let browser;
    try {
      // Fetch both metric sets in parallel — same queries the analytics page uses.
      const [metrics, partsMetrics] = await Promise.all([
        repo.callMetrics(db, filters),
        repo.partsMetrics(db, filters),
      ]);

      // Resolve machine name for the filter summary if a machine_id was provided.
      let machine_id_label = null;
      if (filters.machine_id) {
        const row = (metrics.by_machine || []).find(
          m => String(m.machine_id) === String(filters.machine_id)
        );
        machine_id_label = row ? row.machine_name : `Machine #${filters.machine_id}`;
      }

      const generatedAt = new Date().toLocaleString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
      });

      const html = buildAnalyticsReport({
        metrics,
        partsMetrics,
        filters: { ...filters, machine_id_label },
        generatedAt,
      });

      // Launch Puppeteer and render the HTML to PDF.
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfRaw = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', right: '12mm', bottom: '15mm', left: '12mm' },
      });

      // Puppeteer v21+ returns Uint8Array; convert to Buffer for Express.
      const pdfBuffer = Buffer.from(pdfRaw);

      // Build a descriptive filename from the filter range.
      const fromStr = filters.from ? filters.from.slice(0, 10) : 'all';
      const toStr   = filters.to   ? filters.to.slice(0, 10)   : 'present';
      const filename = `mcs-analytics-${fromStr}-to-${toStr}.pdf`;

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length,
      });
      res.send(pdfBuffer);
    } catch (err) {
      log.error({ err }, 'analytics PDF generation failed');
      res.status(500).json({ error: 'pdf_generation_failed', message: 'Failed to generate PDF' });
    } finally {
      if (browser) {
        await browser.close().catch(() => {/* ignore close errors */});
      }
    }
  }
);

module.exports = router;
