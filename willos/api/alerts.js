/**
 * api/alerts.js — WillOS Alerts Endpoint
 *
 * GET /api/alerts             — active (unresolved) alerts
 * GET /api/alerts?all=true    — all alerts including resolved
 * GET /api/alerts?type=waste  — filter by alert_type
 */

'use strict';

const express = require('express');
const router = express.Router();

/**
 * @param {import('express').Express} app
 * @param {import('better-sqlite3').Database} db
 */
function mount(app, db) {
  const active = db.prepare(`
    SELECT * FROM alert_log WHERE resolved = 0 ORDER BY date DESC
  `);

  const all = db.prepare(`
    SELECT * FROM alert_log ORDER BY date DESC LIMIT 100
  `);

  const byType = db.prepare(`
    SELECT * FROM alert_log WHERE alert_type = ? AND resolved = 0 ORDER BY date DESC
  `);

  router.get('/', (req, res) => {
    try {
      if (req.query.type) {
        return res.json(byType.all(req.query.type));
      }
      if (req.query.all === 'true') {
        return res.json(all.all());
      }
      res.json(active.all());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.use('/api/alerts', router);
}

module.exports = { mount };
