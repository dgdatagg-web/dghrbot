/**
 * agents/reportAgent.js — WillOS Report Agent
 *
 * Generates structured executive reports from DB data.
 * Used by api/report.js and future scheduled report generation.
 */

'use strict';

const logger = require('../core/logger');

/**
 * Generate a weekly executive brief.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} [days=7] — number of days to cover
 * @returns {object}
 */
function generateWeeklyBrief(db, days = 7) {
  const kpis = db.prepare(`
    SELECT * FROM kpi_snapshot ORDER BY date DESC LIMIT ?
  `).all(days);

  const summary = db.prepare(`
    SELECT
      COUNT(DISTINCT date) AS days_with_data,
      COALESCE(SUM(revenue), 0) AS total_revenue,
      COALESCE(SUM(quantity_sold), 0) AS total_units,
      COALESCE(SUM(waste), 0) AS total_waste,
      COALESCE(AVG(revenue), 0) AS avg_daily_revenue
    FROM daily_operations
    WHERE date >= date('now', ?)
  `).get(`-${days} days`);

  const alertCount = db.prepare(`
    SELECT COUNT(*) AS count FROM alert_log WHERE resolved = 0
  `).get();

  const topSkus = db.prepare(`
    SELECT sku_id, SUM(revenue) AS total_rev, SUM(quantity_sold) AS total_qty
    FROM daily_operations
    WHERE date >= date('now', ?)
    GROUP BY sku_id
    ORDER BY total_rev DESC
    LIMIT 5
  `).all(`-${days} days`);

  const report = {
    period_days: days,
    generated_at: new Date().toISOString(),
    summary: summary || {},
    active_alerts: alertCount?.count || 0,
    kpi_trend: kpis,
    top_skus: topSkus,
  };

  logger.info(`ReportAgent: generated ${days}-day brief`);
  return report;
}

module.exports = { generateWeeklyBrief };
