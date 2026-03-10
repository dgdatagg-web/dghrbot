/**
 * api/coo.js — WillOS COO Advisory Endpoint
 *
 * GET /api/coo
 * Placeholder for LLM-powered COO advisory.
 * Will be wired to cooAgent once LLM integration is ready.
 */

'use strict';

const express = require('express');
const router = express.Router();

/**
 * @param {import('express').Express} app
 * @param {import('better-sqlite3').Database} db
 */
function mount(app, db) {
  router.get('/', (req, res) => {
    // Phase 1: return latest metrics + alerts as context stub
    try {
      const latestKpi = db.prepare('SELECT * FROM kpi_snapshot ORDER BY date DESC LIMIT 1').get();
      const activeAlerts = db.prepare('SELECT * FROM alert_log WHERE resolved = 0 ORDER BY date DESC LIMIT 10').all();

      res.json({
        status: 'placeholder',
        message: 'COO advisory endpoint — LLM integration pending',
        context: {
          latest_kpi: latestKpi || null,
          active_alerts: activeAlerts,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.use('/api/coo', router);
}

module.exports = { mount };
