/**
 * api/grab.js — WillOS Grab Sales API
 *
 * GET /api/grab/summary   — overall KPI summary from grab_sales_daily + grab_raw
 * GET /api/grab/monthly   — revenue by month
 */

'use strict';

/**
 * @param {import('express').Express} app
 * @param {import('better-sqlite3').Database} db
 */
function mount(app, db) {

  // ── GET /api/grab/summary ─────────────────────────────────────
  app.get('/api/grab/summary', (req, res) => {
    try {
      // Overall totals
      const totals = db.prepare(`
        SELECT
          ROUND(SUM(gross_sales), 0)      AS total_gross,
          ROUND(SUM(net_sales), 0)        AS total_net,
          SUM(num_transactions)           AS total_transactions,
          ROUND(AVG(avg_transaction), 0)  AS avg_per_transaction,
          COUNT(DISTINCT date)            AS days_with_data,
          ROUND(AVG(avg_rating), 2)       AS avg_rating
        FROM grab_sales_daily
      `).get();

      // Revenue by month for growth calc
      const monthly = db.prepare(`
        SELECT
          strftime('%Y-%m', date) AS month,
          ROUND(SUM(gross_sales), 0) AS gross,
          SUM(num_transactions) AS transactions
        FROM grab_sales_daily
        GROUP BY month
        ORDER BY month
      `).all();

      // #1 SKU by units sold
      const topSku = db.prepare(`
        SELECT item_name, SUM(units_sold) AS total_units
        FROM grab_raw
        GROUP BY item_name
        ORDER BY total_units DESC
        LIMIT 5
      `).all();

      // Growth T2 vs T12 (latest month vs Dec 2025)
      const t12 = monthly.find(m => m.month === '2025-12');
      const latestMonths = monthly.slice(-2);
      const latestMonth = latestMonths[latestMonths.length - 1];
      const prevMonth   = latestMonths.length > 1 ? latestMonths[latestMonths.length - 2] : null;

      let growthT2vsT12 = null;
      if (t12 && latestMonth && latestMonth.month !== '2025-12') {
        growthT2vsT12 = Math.round(((latestMonth.gross - t12.gross) / t12.gross) * 100);
      }
      let growthMoM = null;
      if (prevMonth && latestMonth) {
        growthMoM = Math.round(((latestMonth.gross - prevMonth.gross) / prevMonth.gross) * 100);
      }

      // Top SKU share of total
      const totalUnits = topSku.reduce((acc, s) => acc + s.total_units, 0);
      const topSkuShare = topSku.length > 0 ? Math.round((topSku[0].total_units / totalUnits) * 1000) / 10 : null;

      res.json({
        ok: true,
        data: {
          total_gross: totals.total_gross,
          total_net: totals.total_net,
          total_transactions: totals.total_transactions,
          avg_per_transaction: totals.avg_per_transaction,
          days_with_data: totals.days_with_data,
          avg_rating: totals.avg_rating,
          growth_vs_t12: growthT2vsT12,
          growth_mom: growthMoM,
          latest_month: latestMonth?.month || null,
          top_sku: topSku[0]?.item_name || null,
          top_sku_share: topSkuShare,
          top_skus: topSku,
          monthly,
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── GET /api/grab/monthly ──────────────────────────────────────
  app.get('/api/grab/monthly', (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT
          strftime('%Y-%m', date)       AS month,
          ROUND(SUM(gross_sales), 0)    AS gross,
          ROUND(SUM(net_sales), 0)      AS net,
          SUM(num_transactions)         AS transactions,
          ROUND(AVG(avg_rating), 2)     AS avg_rating
        FROM grab_sales_daily
        GROUP BY month
        ORDER BY month
      `).all();
      res.json({ ok: true, data: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mount };
