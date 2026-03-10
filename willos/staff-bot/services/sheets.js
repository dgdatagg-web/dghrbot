/**
 * sheets.js — Google Sheets sync service
 *
 * Mode: Real Google Sheets API via `gog sheets append` CLI (dgdatagg@gmail.com)
 * Falls back to CSV export if gog sync fails.
 *
 * Usage:
 *   const { syncToSheets } = require('./sheets');
 *   await syncToSheets(); // push all unsynced rows
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { getUnsyncedRows, markSynced } = require('./sheets_queue');

const EXPORTS_DIR = path.resolve(__dirname, '..', '..', '..', 'data', 'exports');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureExportsDir() {
  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }
}

function todayStr() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
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

// ─── Sheet header definitions ─────────────────────────────────────────────────

const SHEET_HEADERS = {
  moca_log:     ['date', 'staff_name', 'department', 'open_time', 'inventory', 'prep'],
  bc_log:       ['date', 'staff_name', 'ca_type', 'sections_json', 'missing_checklist'],
  dongca_log:   ['date', 'staff_name', 'cash', 'transfer', 'grab', 'total', 'end_inventory', 'incidents'],
  nhaphang_log: ['date', 'staff_name', 'item', 'quantity', 'price', 'supplier', 'has_bill'],
  huy_hang_log: ['date', 'staff_name', 'item', 'reason', 'caused_by'],
  checkin_log:  ['date', 'staff_name', 'department', 'class_role', 'checkin_time', 'late_minutes', 'exp_delta', 'streak'],
  checkout_log: ['date', 'staff_name', 'department', 'checkout_time', 'duration_minutes'],
  exp_log:      ['date', 'staff_name', 'department', 'delta', 'reason', 'by_telegram_id'],
  staff_roster: ['date', 'name', 'username', 'role', 'department', 'class_role', 'status'],
};

// ─── CSV append ───────────────────────────────────────────────────────────────

/**
 * Append rows to today's CSV export for a sheet.
 * @param {string} sheetName
 * @param {Array<object>} rows
 */
function appendToCSV(sheetName, rows) {
  ensureExportsDir();
  const headers = SHEET_HEADERS[sheetName] || Object.keys((rows[0] || {}));
  const date = todayStr();
  const filePath = path.join(EXPORTS_DIR, `${sheetName}_${date}.csv`);

  const fileExists = fs.existsSync(filePath);
  const lines = [];

  if (!fileExists) {
    lines.push(headers.join(','));
  }

  for (const row of rows) {
    lines.push(rowToCSV(headers, row));
  }

  fs.appendFileSync(filePath, lines.join('\n') + '\n', 'utf8');
  return filePath;
}

// ─── Sync function ────────────────────────────────────────────────────────────

/**
 * Try real Sheets API via gog CLI first, then CSV fallback.
 * Returns { synced: number, mode: 'api'|'csv' }
 */
async function syncToSheets(sheetName = null) {
  const rows = getUnsyncedRows(sheetName);
  if (rows.length === 0) return { synced: 0, mode: 'csv' };

  // Try real Sheets API via sync worker
  try {
    const { syncWorker } = require('./sheets_sync_worker');
    const result = await syncWorker();
    if (result.synced > 0 || result.failed === 0) {
      return { synced: result.synced, mode: 'api', failed: result.failed, skipped: result.skipped };
    }
  } catch (err) {
    console.warn('[sheets] API sync (gog) failed, falling back to CSV:', err.message);
  }

  // CSV fallback: group by sheet
  const bySheet = {};
  for (const entry of rows) {
    if (!bySheet[entry.sheet]) bySheet[entry.sheet] = [];
    bySheet[entry.sheet].push(entry);
  }

  let totalSynced = 0;
  for (const [sheet, entries] of Object.entries(bySheet)) {
    const rowData = entries.map(e => e.row);
    appendToCSV(sheet, rowData);
    markSynced(entries.map(e => e.id));
    totalSynced += entries.length;
    console.log(`[sheets] CSV export: ${entries.length} rows → ${sheet}`);
  }

  return { synced: totalSynced, mode: 'csv' };
}

// ─── Status check ─────────────────────────────────────────────────────────────

function sheetsStatus() {
  const configPath = process.env.SHEETS_CONFIG_PATH
    || path.resolve(__dirname, '..', '..', '..', 'config', 'sheets_config.json');
  const hasConfig = require('fs').existsSync(configPath);
  return {
    mode: hasConfig ? 'api-gog' : 'csv-fallback',
    configPath,
    hasConfig,
    exportsDir: EXPORTS_DIR,
  };
}

module.exports = { syncToSheets, sheetsStatus, appendToCSV, EXPORTS_DIR, SHEET_HEADERS };
