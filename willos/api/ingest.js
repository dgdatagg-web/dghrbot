/**
 * api/ingest.js — WillOS Data Ingestion Endpoint
 *
 * POST /api/ingest
 * Accepts JSON body (single record or array) → validate → store → trigger KPI recalculation.
 */

'use strict';

const express = require('express');
const router = express.Router();
const { validateRecord } = require('../core/validator');
const { calcGrossMargin, calcLaborEfficiency, calcWasteRatio } = require('../core/calculations');
const logger = require('../core/logger');

/**
 * Mount ingest routes on the given Express app.
 * @param {import('express').Express} app
 * @param {import('better-sqlite3').Database} db
 */
function mount(app, db) {
  // Prepared statements
  const insertOp = db.prepare(`
    INSERT OR REPLACE INTO daily_operations
      (date, sku_id, quantity_sold, revenue, total_cogs, waste, labor_cost, supplier_price_change)
    VALUES
      (@date, @sku_id, @quantity_sold, @revenue, @total_cogs, @waste, @labor_cost, @supplier_price_change)
  `);

  const upsertKpi = db.prepare(`
    INSERT OR REPLACE INTO kpi_snapshot (date, gross_margin, labor_efficiency, waste_ratio, cost_drift)
    VALUES (@date, @gross_margin, @labor_efficiency, @waste_ratio, @cost_drift)
  `);

  const sumByDate = db.prepare(`
    SELECT
      COALESCE(SUM(revenue), 0)    AS revenue,
      COALESCE(SUM(total_cogs), 0) AS total_cogs,
      COALESCE(SUM(waste), 0)      AS waste,
      COALESCE(SUM(labor_cost), 0) AS labor_cost
    FROM daily_operations
    WHERE date = ?
  `);

  router.post('/', express.json(), (req, res) => {
    try {
      const records = Array.isArray(req.body) ? req.body : [req.body];
      const results = [];
      const datesToRecalc = new Set();

      for (const record of records) {
        const validation = validateRecord(record);
        if (!validation.valid) {
          results.push({ record, status: 'rejected', errors: validation.errors });
          continue;
        }

        // Defaults for optional fields
        const row = {
          date: record.date,
          sku_id: record.sku_id,
          quantity_sold: record.quantity_sold || 0,
          revenue: record.revenue || 0,
          total_cogs: record.total_cogs || 0,
          waste: record.waste || 0,
          labor_cost: record.labor_cost || 0,
          supplier_price_change: record.supplier_price_change || 0,
        };

        insertOp.run(row);
        datesToRecalc.add(row.date);
        results.push({ record: row, status: 'stored' });
      }

      // Recalculate KPI for affected dates
      for (const date of datesToRecalc) {
        const agg = sumByDate.get(date);
        const kpi = {
          date,
          gross_margin: calcGrossMargin(agg.revenue, agg.total_cogs),
          labor_efficiency: calcLaborEfficiency(agg.revenue, agg.labor_cost),
          waste_ratio: calcWasteRatio(agg.waste, agg.total_cogs),
          cost_drift: 0, // Requires rolling avg — computed by metricAgent
        };
        upsertKpi.run(kpi);
      }

      const stored = results.filter((r) => r.status === 'stored').length;
      const rejected = results.filter((r) => r.status === 'rejected').length;
      logger.info(`Ingest: ${stored} stored, ${rejected} rejected`);

      res.json({ stored, rejected, details: results });
    } catch (err) {
      logger.error(`Ingest error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.use('/api/ingest', router);
}

module.exports = { mount };
