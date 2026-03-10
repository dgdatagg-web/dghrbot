/**
 * core/validator.js — WillOS Ingestion Validator
 *
 * Validates incoming daily_operations records before DB insert.
 * Returns { valid: boolean, errors: string[] }
 */

'use strict';

const REQUIRED_FIELDS = [
  'date',
  'sku_id',
  'quantity_sold',
  'revenue',
  'total_cogs',
];

/**
 * Validate a single ingestion record.
 *
 * @param {object} record
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateRecord(record) {
  const errors = [];

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (record[field] === undefined || record[field] === null || record[field] === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Date format check (YYYY-MM-DD)
  if (record.date && !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
    errors.push(`Invalid date format: ${record.date} (expected YYYY-MM-DD)`);
  }

  // Numeric sanity checks
  if (typeof record.revenue === 'number' && record.revenue < 0) {
    errors.push(`Negative revenue: ${record.revenue}`);
  }
  if (typeof record.total_cogs === 'number' && record.total_cogs < 0) {
    errors.push(`Negative total_cogs: ${record.total_cogs}`);
  }
  if (typeof record.quantity_sold === 'number' && record.quantity_sold < 0) {
    errors.push(`Negative quantity_sold: ${record.quantity_sold}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate an array of records. Returns per-row results.
 *
 * @param {object[]} records
 * @returns {{ index: number, valid: boolean, errors: string[] }[]}
 */
function validateBatch(records) {
  return records.map((record, index) => ({
    index,
    ...validateRecord(record),
  }));
}

module.exports = { validateRecord, validateBatch };
