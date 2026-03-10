/**
 * api/report-intake.js — Shift Report Intake Endpoint
 *
 * POST /api/report/intake
 * Body: { "text": "<raw report text>", "source": "telegram" }
 * Response: { "success": true, "report_id": X, "parsed": {...} }
 */

'use strict';

const { parseReport, saveReport } = require('../scripts/parse-report');
const logger = require('../core/logger');

/**
 * Mount report intake routes on Express app.
 *
 * @param {import('express').Express} app
 * @param {import('better-sqlite3').Database} db
 */
function mount(app, db) {
  app.post('/api/report/intake', (req, res) => {
    try {
      const { text, source = 'telegram' } = req.body;

      if (!text || typeof text !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid "text" field. Expected a string.',
        });
      }

      const parsed = parseReport(text);

      if (!parsed.report_date) {
        return res.status(422).json({
          success: false,
          error: 'Could not extract report date. Ensure format: 📋 ĐÓNG CA DD/MM/YYYY',
          parsed,
        });
      }

      const reportId = saveReport(db, parsed, text, source);

      logger.info(`Shift report saved: id=${reportId}, date=${parsed.report_date}, reporter=${parsed.reporter}`);

      res.json({
        success: true,
        report_id: Number(reportId),
        parsed,
      });
    } catch (err) {
      logger.error(`Report intake error: ${err.message}`);
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  // GET latest reports
  app.get('/api/report/shifts', (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 10;
      const reports = db.prepare(
        'SELECT * FROM shift_report ORDER BY id DESC LIMIT ?'
      ).all(limit);

      res.json({ success: true, count: reports.length, reports });
    } catch (err) {
      logger.error(`Report list error: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = { mount };
