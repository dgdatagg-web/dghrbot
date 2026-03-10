/**
 * agents/alertAgent.js — WillOS Alert Agent
 *
 * Scans KPI snapshots against thresholds and generates alerts.
 * Runs after metric recalculation.
 */

'use strict';

const thresholds = require('../config/thresholds.json');
const logger = require('../core/logger');

/**
 * Check a single date's KPI against thresholds and insert alerts.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} date — YYYY-MM-DD
 * @returns {object[]} — alerts generated
 */
function checkAlerts(db, date) {
  const kpi = db.prepare('SELECT * FROM kpi_snapshot WHERE date = ?').get(date);
  if (!kpi) return [];

  const insertAlert = db.prepare(`
    INSERT INTO alert_log (date, alert_type, value, threshold, message)
    VALUES (@date, @alert_type, @value, @threshold, @message)
  `);

  const alerts = [];

  // Gross margin drop (compared to baseline or absolute)
  if (kpi.gross_margin < (1 - thresholds.gross_margin_drop) * 0.6) {
    // 0.6 is a reasonable F&B target; will be replaced by baseline
    const alert = {
      date,
      alert_type: 'gross_margin_drop',
      value: kpi.gross_margin,
      threshold: thresholds.gross_margin_drop,
      message: `Gross margin dropped to ${(kpi.gross_margin * 100).toFixed(1)}%`,
    };
    insertAlert.run(alert);
    alerts.push(alert);
  }

  // Waste ratio too high
  if (kpi.waste_ratio > thresholds.waste_ratio_max) {
    const alert = {
      date,
      alert_type: 'waste_ratio_high',
      value: kpi.waste_ratio,
      threshold: thresholds.waste_ratio_max,
      message: `Waste ratio at ${(kpi.waste_ratio * 100).toFixed(1)}% — exceeds ${(thresholds.waste_ratio_max * 100)}% limit`,
    };
    insertAlert.run(alert);
    alerts.push(alert);
  }

  // Supplier price spike
  if (Math.abs(kpi.cost_drift) > thresholds.supplier_price_spike) {
    const alert = {
      date,
      alert_type: 'supplier_price_spike',
      value: kpi.cost_drift,
      threshold: thresholds.supplier_price_spike,
      message: `Cost drift ${(kpi.cost_drift * 100).toFixed(1)}% exceeds ${(thresholds.supplier_price_spike * 100)}% threshold`,
    };
    insertAlert.run(alert);
    alerts.push(alert);
  }

  if (alerts.length > 0) {
    logger.warn(`AlertAgent: ${alerts.length} alert(s) for ${date}`);
  }

  return alerts;
}

/**
 * Check for SKUs with zero sales in the last N days.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {object[]}
 */
function checkZeroSalesSkus(db) {
  const dayLimit = thresholds.sku_zero_sales_days;
  const skus = db.prepare(`
    SELECT sm.sku_id, sm.name_vi, sm.name_en,
           MAX(do2.date) AS last_sale_date
    FROM sku_master sm
    LEFT JOIN daily_operations do2 ON sm.sku_id = do2.sku_id AND do2.quantity_sold > 0
    GROUP BY sm.sku_id
    HAVING last_sale_date IS NULL OR last_sale_date < date('now', ?)
  `).all(`-${dayLimit} days`);

  const insertAlert = db.prepare(`
    INSERT INTO alert_log (date, alert_type, value, threshold, message)
    VALUES (@date, @alert_type, @value, @threshold, @message)
  `);

  const alerts = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const sku of skus) {
    const alert = {
      date: today,
      alert_type: 'sku_zero_sales',
      value: dayLimit,
      threshold: dayLimit,
      message: `SKU ${sku.sku_id} (${sku.name_vi || sku.name_en || 'unknown'}) — no sales in ${dayLimit}+ days`,
    };
    insertAlert.run(alert);
    alerts.push(alert);
  }

  return alerts;
}

module.exports = { checkAlerts, checkZeroSalesSkus };
