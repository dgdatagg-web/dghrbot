/**
 * api/metrics.js — WillOS Metrics Endpoint
 *
 * GET /api/metrics         — latest KPI snapshot
 * GET /api/metrics?date=   — snapshot for specific date
 * GET /api/metrics?days=7  — last N days
 */

'use strict';

const express = require('express');
const router = express.Router();

/**
 * @param {import('express').Express} app
 * @param {import('better-sqlite3').Database} db
 */
function mount(app, db) {
  const latest = db.prepare(`
    SELECT * FROM kpi_snapshot ORDER BY date DESC LIMIT 1
  `);

  const byDate = db.prepare(`
    SELECT * FROM kpi_snapshot WHERE date = ?
  `);

  const lastN = db.prepare(`
    SELECT * FROM kpi_snapshot ORDER BY date DESC LIMIT ?
  `);

  router.get('/', (req, res) => {
    try {
      if (req.query.date) {
        const row = byDate.get(req.query.date);
        return res.json(row || { message: 'No data for that date' });
      }

      if (req.query.days) {
        const days = parseInt(req.query.days, 10) || 7;
        const rows = lastN.all(days);
        return res.json(rows);
      }

      // Default: latest snapshot
      const row = latest.get();
      res.json(row || { message: 'No KPI data yet' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.use('/api/metrics', router);
}

module.exports = { mount };
