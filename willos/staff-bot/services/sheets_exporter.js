#!/usr/bin/env node
/**
 * sheets_exporter.js — Export queue to CSV files
 *
 * Manual import-ready CSVs for Google Sheets.
 * Run: node services/sheets_exporter.js [sheetName] [--date YYYY-MM-DD]
 *
 * Examples:
 *   node services/sheets_exporter.js
 *             → Export all sheets (today's unsynced rows)
 *   node services/sheets_exporter.js moca_log
 *             → Export only moca_log
 *   node services/sheets_exporter.js dongca_log --date 2026-02-28
 *             → Export specific sheet + date
 *   node services/sheets_exporter.js --all
 *             → Export all sheets (all dates, including synced)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { getQueuedRows, getUnsyncedRows, QUEUE_FILE } = require('./sheets_queue');
const { EXPORTS_DIR, SHEET_HEADERS } = require('./sheets');

const WORKSPACE_DATA = path.resolve(__dirname, '..', '..', '..', 'data');

function ensureExportsDir() {
  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }
}

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function rowToCSV(headers, rowObj) {
  return headers.map(h => escapeCSV(rowObj[h] !== undefined ? rowObj[h] : '')).join(',');
}

/**
 * Export a sheet's queued rows to CSV.
 * @param {string} sheetName
 * @param {string|null} date - 'YYYY-MM-DD' or null
 * @param {boolean} includeAll - include already-synced rows
 * @returns {string} output file path
 */
function exportToCSV(sheetName, date = null, includeAll = false) {
  ensureExportsDir();

  let rows;
  if (includeAll) {
    rows = getQueuedRows(sheetName, date);
  } else {
    const unsynced = getUnsyncedRows(sheetName);
    rows = date ? unsynced.filter(r => r.timestamp && r.timestamp.startsWith(date)) : unsynced;
  }

  if (rows.length === 0) {
    console.log(`  [skip] ${sheetName}: 0 rows to export`);
    return null;
  }

  const headers = SHEET_HEADERS[sheetName] || Object.keys(rows[0].row || {});
  const dateLabel = date || new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
  const filePath = path.join(EXPORTS_DIR, `${sheetName}_${dateLabel}.csv`);

  const lines = [headers.join(',')];
  for (const entry of rows) {
    lines.push(rowToCSV(headers, entry.row || {}));
  }

  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
  console.log(`  ✅ ${sheetName}: ${rows.length} rows → ${filePath}`);
  return filePath;
}

/**
 * Export all known sheets.
 * @param {string|null} date
 * @param {boolean} includeAll
 */
function exportAllSheets(date = null, includeAll = false) {
  const sheetNames = Object.keys(SHEET_HEADERS);
  const results = [];
  for (const name of sheetNames) {
    const out = exportToCSV(name, date, includeAll);
    if (out) results.push(out);
  }
  return results;
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  let targetSheet = null;
  let targetDate = null;
  let exportAll = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) {
      targetDate = args[++i];
    } else if (args[i] === '--all') {
      exportAll = true;
    } else if (!args[i].startsWith('--')) {
      targetSheet = args[i];
    }
  }

  console.log('\n📊 DG HR Bot — Sheets Exporter');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Queue: ${QUEUE_FILE}`);
  console.log(`Output: ${EXPORTS_DIR}`);
  if (targetDate) console.log(`Date filter: ${targetDate}`);
  if (exportAll) console.log(`Mode: all (including already-synced)`);
  console.log('');

  if (targetSheet) {
    exportToCSV(targetSheet, targetDate, exportAll);
  } else {
    exportAllSheets(targetDate, exportAll);
  }

  console.log('\nDone. Import CSV files manually into Google Sheets.');
  console.log('Tip: Run with --all to include already-synced rows.\n');
}

module.exports = { exportToCSV, exportAllSheets };
