'use strict';

const express = require('express');
const router = express.Router();
const PdfPrinter = require('pdfmake/src/printer');
const db = require('../database/db');
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const validate = require('../middleware/validate');
const S = require('../schemas/maintenanceCalls');
const repo = require('../repositories/maintenanceCallsRepo');
const { buildAnalyticsDocDef } = require('../templates/analyticsReport');
const logger = require('../lib/logger');
const { captureException } = require('../observability/sentry');

const printer = new PdfPrinter({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});

// ─── GET /api/v1/mcs/analytics/pdf ───────────────────────────────────────────

router.get(
  '/pdf',
  auth,
  requirePermission('analytics_view'),
  validate({ query: S.metricsQuery }),
  async (req, res) => {
    const log = req.log || logger;
    const filters = req.query;

    try {
      const [metrics, partsMetrics] = await Promise.all([
        repo.callMetrics(db, filters),
        repo.partsMetrics(db, filters),
      ]);

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

      const docDef = buildAnalyticsDocDef({
        metrics,
        partsMetrics,
        filters: { ...filters, machine_id_label },
        generatedAt,
      });

      const pdfDoc = printer.createPdfKitDocument(docDef);

      const chunks = [];
      pdfDoc.on('data', (chunk) => chunks.push(chunk));
      pdfDoc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        const fromStr = filters.from ? filters.from.slice(0, 10) : 'all';
        const toStr   = filters.to   ? filters.to.slice(0, 10)   : 'present';
        const filename = `mcs-analytics-${fromStr}-to-${toStr}.pdf`;

        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': pdfBuffer.length,
        });
        res.send(pdfBuffer);
      });
      pdfDoc.on('error', (err) => {
        log.error({ err }, 'pdfmake stream error');
        captureException(err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'pdf_generation_failed', message: 'Failed to generate PDF' });
        }
      });
      pdfDoc.end();
    } catch (err) {
      log.error({ err }, 'analytics PDF generation failed');
      captureException(err);
      res.status(500).json({ error: 'pdf_generation_failed', message: 'Failed to generate PDF' });
    }
  }
);

module.exports = router;
