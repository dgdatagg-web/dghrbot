/**
 * agents/metricAgent.js — WillOS Metric Agent
 *
 * Recalculates KPI snapshots for given dates.
 * Called after data ingestion or on demand.
 */

'use strict';

const {
  calcGrossMargin,
  calcLaborEfficiency,
  calcWasteRatio,
  calcCostDrift,
} = require('../core/calculations');
const logger = require('../core/logger');

/**
 * Recalculate KPI snapshot for a specific date.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} date — YYYY-MM-DD
 */
function recalcDate(db, date) {
  const agg = db.prepare(`
    SELECT
      COALESCE(SUM(revenue), 0)    AS revenue,
      COALESCE(SUM(total_cogs), 0) AS total_cogs,
      COALESCE(SUM(waste), 0)      AS waste,
      COALESCE(SUM(labor_cost), 0) AS labor_cost
    FROM daily_operations
    WHERE date = ?
  `).get(date);

  // Rolling 30-day avg supplier price for cost drift
  const avg30 = db.prepare(`
    SELECT AVG(supplier_price_change) AS avg_price
    FROM daily_operations
    WHERE date BETWEEN date(?, '-30 days') AND date(?, '-1 day')
  `).get(date, date);

  const latestPrice = db.prepare(`
    SELECT AVG(supplier_price_change) AS current_price
    FROM daily_operations
    WHERE date = ?
  `).get(date);

  const kpi = {
    date,
    gross_margin: calcGrossMargin(agg.revenue, agg.total_cogs),
    labor_efficiency: calcLaborEfficiency(agg.revenue, agg.labor_cost),
    waste_ratio: calcWasteRatio(agg.waste, agg.total_cogs),
    cost_drift: calcCostDrift(latestPrice?.current_price || 0, avg30?.avg_price || 0),
  };

  db.prepare(`
    INSERT OR REPLACE INTO kpi_snapshot (date, gross_margin, labor_efficiency, waste_ratio, cost_drift)
    VALUES (@date, @gross_margin, @labor_efficiency, @waste_ratio, @cost_drift)
  `).run(kpi);

  logger.info(`MetricAgent: recalculated KPI for ${date}`);
  return kpi;
}

/**
 * Recalculate KPIs for all dates that have data.
 *
 * @param {import('better-sqlite3').Database} db
 */
function recalcAll(db) {
  const dates = db.prepare('SELECT DISTINCT date FROM daily_operations ORDER BY date').all();
  const results = [];
  for (const { date } of dates) {
    results.push(recalcDate(db, date));
  }
  logger.info(`MetricAgent: recalculated ${results.length} dates`);
  return results;
}

module.exports = { recalcDate, recalcAll };
