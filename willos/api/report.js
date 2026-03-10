/**
 * api/report.js — WillOS Executive Report Endpoint
 *
 * GET /api/report          — weekly executive brief (last 7 days)
 * GET /api/report?days=14  — custom range
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
    try {
      const days = parseInt(req.query.days, 10) || 7;

      // KPI trend
      const kpis = db.prepare(`
        SELECT * FROM kpi_snapshot ORDER BY date DESC LIMIT ?
      `).all(days);

      // Revenue & volume summary
      const summary = db.prepare(`
        SELECT
          COUNT(DISTINCT date) AS days_with_data,
          SUM(revenue) AS total_revenue,
          SUM(quantity_sold) AS total_units,
          SUM(waste) AS total_waste,
          AVG(revenue) AS avg_daily_revenue
        FROM daily_operations
        WHERE date >= date('now', ?)
      `).get(`-${days} days`);

      // Active alerts count
      const alertCount = db.prepare(`
        SELECT COUNT(*) AS count FROM alert_log WHERE resolved = 0
      `).get();

      // Top SKUs by revenue
      const topSkus = db.prepare(`
        SELECT sku_id, SUM(revenue) AS total_rev, SUM(quantity_sold) AS total_qty
        FROM daily_operations
        WHERE date >= date('now', ?)
        GROUP BY sku_id
        ORDER BY total_rev DESC
        LIMIT 5
      `).all(`-${days} days`);

      res.json({
        period_days: days,
        generated_at: new Date().toISOString(),
        summary: summary || {},
        active_alerts: alertCount?.count || 0,
        kpi_trend: kpis,
        top_skus: topSkus,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.use('/api/report', router);
}

module.exports = { mount };
