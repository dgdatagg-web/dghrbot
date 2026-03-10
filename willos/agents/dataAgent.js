/**
 * agents/dataAgent.js — WillOS Data Agent
 *
 * Responsible for data ingestion orchestration:
 * - Validate incoming records
 * - Store to daily_operations
 * - Trigger downstream agents (metric recalculation)
 */

'use strict';

const { validateRecord } = require('../core/validator');
const logger = require('../core/logger');

/**
 * Process a batch of raw records and insert valid ones.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object[]} records
 * @returns {{ stored: number, rejected: number, errors: object[] }}
 */
function ingestBatch(db, records) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO daily_operations
      (date, sku_id, quantity_sold, revenue, total_cogs, waste, labor_cost, supplier_price_change)
    VALUES
      (@date, @sku_id, @quantity_sold, @revenue, @total_cogs, @waste, @labor_cost, @supplier_price_change)
  `);

  let stored = 0;
  let rejected = 0;
  const errors = [];

  const insertMany = db.transaction((rows) => {
    for (const record of rows) {
      const result = validateRecord(record);
      if (!result.valid) {
        rejected++;
        errors.push({ record, errors: result.errors });
        continue;
      }
      insert.run({
        date: record.date,
        sku_id: record.sku_id,
        quantity_sold: record.quantity_sold || 0,
        revenue: record.revenue || 0,
        total_cogs: record.total_cogs || 0,
        waste: record.waste || 0,
        labor_cost: record.labor_cost || 0,
        supplier_price_change: record.supplier_price_change || 0,
      });
      stored++;
    }
  });

  insertMany(records);
  logger.info(`DataAgent: ingested ${stored}, rejected ${rejected}`);

  return { stored, rejected, errors };
}

module.exports = { ingestBatch };
