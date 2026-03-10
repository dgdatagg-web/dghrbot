#!/usr/bin/env node
/**
 * sheets_sync_worker.js — Google Sheets real sync worker for DG HR Bot
 *
 * Reads unsynced rows from sheets_queue.jsonl, maps to ca_type,
 * detects correct week (1-4), then appends to the correct Google Sheet tab
 * using `gog sheets append`.
 *
 * Usage:
 *   node /Users/dongocminh/.openclaw/workspace/willos/staff-bot/services/sheets_sync_worker.js
 *
 * Returns summary: { synced: N, failed: M, skipped: K }
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getUnsyncedRows, markSynced } = require('./sheets_queue');

// ─── Config paths ─────────────────────────────────────────────────────────────

const CONFIG_PATH = process.env.SHEETS_CONFIG_PATH
  || path.resolve(__dirname, '..', '..', 'config', 'sheets_config.json');

const ACCOUNT = 'dgdatagg@gmail.com';

// ─── Header definitions by ca_type ───────────────────────────────────────────

const HEADERS = {
  bep:  ['date', 'staff_name', 'open_time', 'checklist_missing', 'huy_hang', 'don_saisot', 'com_mi', 'nhan_hang', 'giao_ca', 'notes'],
  bar:  ['date', 'staff_name', 'open_time', 'checklist_missing', 'don_saisot', 'nhan_hang', 'giao_ca', 'notes'],
  bida: ['date', 'staff_name', 'open_time', 'checklist_missing', 'don_saisot', 'giao_ca', 'notes'],
};

// ─── Parent folder IDs for each department (for auto-rotation) ───────────────

const PARENT_FOLDER_IDS = {
  bep:  '_meta.bepParentFolderId',
  bar:  '_meta.barParentFolderId',
  bida: '_meta.bidaParentFolderId',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`sheets_config.json not found at: ${CONFIG_PATH}`);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

/**
 * Get week number (1-4) from a date string 'YYYY-MM-DD' or Date object.
 * week 1 = days 1-7, week 2 = 8-14, week 3 = 15-21, week 4 = 22-end
 */
function getWeekNumber(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const day = d.getDate();
  if (day <= 7)  return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

/**
 * Get month key 'YYYY_MM' from a date string or Date.
 */
function getMonthKey(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}_${mm}`;
}

/**
 * Get month label for folder/sheet naming: e.g. "3_2026" / "THÁNG 3_2026"
 */
function getMonthLabel(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const yyyy = d.getFullYear();
  const mm   = d.getMonth() + 1;
  return { folderName: `THÁNG ${mm}_${yyyy}`, sheetTitle: null, month: mm, year: yyyy };
}

/**
 * Derive ca_type (bep/bar/bida) from a queue entry.
 * Checks entry.row.ca_type, entry.row.department, or sheet name mapping.
 */
function deriveCaType(entry) {
  const row = entry.row || {};

  // Direct field
  if (row.ca_type) {
    const ct = row.ca_type.toLowerCase();
    if (ct.includes('bep') || ct.includes('bếp')) return 'bep';
    if (ct.includes('bar'))  return 'bar';
    if (ct.includes('bida')) return 'bida';
  }

  // Department field
  if (row.department) {
    const dep = row.department.toLowerCase();
    if (dep.includes('bep') || dep.includes('bếp') || dep.includes('kitchen')) return 'bep';
    if (dep.includes('bar'))  return 'bar';
    if (dep.includes('bida') || dep.includes('billiard')) return 'bida';
  }

  // Fallback: sheet name heuristic
  const sheet = (entry.sheet || '').toLowerCase();
  if (sheet.includes('bep') || sheet.includes('bếp')) return 'bep';
  if (sheet.includes('bar'))  return 'bar';
  if (sheet.includes('bida')) return 'bida';

  // moca_log/bc_log/dongca_log → try to detect from row content
  // Default to bep if unknown (most common)
  console.warn(`[sheets] Cannot determine ca_type for entry ${entry.id} (sheet: ${entry.sheet}), defaulting to bep`);
  return 'bep';
}

/**
 * Get a date string from a queue entry row.
 * Tries row.date, row.timestamp, entry.timestamp.
 */
function getEntryDate(entry) {
  const row = entry.row || {};
  if (row.date) return row.date.split('T')[0]; // handles ISO or plain date
  if (row.timestamp) return row.timestamp.split('T')[0];
  if (entry.timestamp) return entry.timestamp.split('T')[0];
  // fallback: today ICT
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().split('T')[0];
}

/**
 * Build a 2D array row from a queue entry row using HEADERS for ca_type.
 */
function buildSheetRow(caType, rowData) {
  const headers = HEADERS[caType] || HEADERS.bep;
  return headers.map(h => {
    const val = rowData[h];
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  });
}

/**
 * Append rows to a Google Sheet tab using gog CLI.
 */
function gogSheetsAppend(spreadsheetId, tabName, rows) {
  const range = `${tabName}!A:Z`;
  const valuesJson = JSON.stringify(rows);
  const cmd = [
    'gog', 'sheets', 'append',
    spreadsheetId,
    `"${range}"`,
    '--values-json', `'${valuesJson}'`,
    '--insert', 'INSERT_ROWS',
    '--account', ACCOUNT,
    '-j',
  ].join(' ');

  const output = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
  return JSON.parse(output);
}

// ─── Month rotation logic (TASK 4) ───────────────────────────────────────────

/**
 * Check if config has entry for a given ca_type + month key.
 * If not, create the folder+sheet and update config.
 */
function ensureMonthExists(config, caType, monthKey, dateInput) {
  if (config[caType] && config[caType][monthKey]) {
    return config[caType][monthKey];
  }

  console.log(`[sheets] Auto-creating new month: ${caType.toUpperCase()} THÁNG ${monthKey}`);

  const { folderName, month, year } = getMonthLabel(dateInput);
  const sheetTitle = `${caType.toUpperCase()} - THÁNG ${month}/${year}`;

  // Determine parent folder ID for this ca_type
  const metaKey = PARENT_FOLDER_IDS[caType];
  const parentFolderId = config._meta && config._meta[metaKey.replace('_meta.', '')];
  if (!parentFolderId) {
    throw new Error(`No parent folder ID found for ${caType} in _meta`);
  }

  // Create month subfolder
  const mkdirCmd = `gog drive mkdir "${folderName}" --parent "${parentFolderId}" --account ${ACCOUNT} -j`;
  const folderResult = JSON.parse(execSync(mkdirCmd, { encoding: 'utf8', timeout: 15000 }));
  const folderId = folderResult.folder.id;
  console.log(`[sheets] Created folder: ${folderName} (${folderId})`);

  // Create Google Sheet with 4 tabs
  const createCmd = `gog sheets create "${sheetTitle}" --sheets "Tuần 1,Tuần 2,Tuần 3,Tuần 4" --account ${ACCOUNT} -j`;
  const sheetResult = JSON.parse(execSync(createCmd, { encoding: 'utf8', timeout: 15000 }));
  const spreadsheetId = sheetResult.spreadsheetId;
  console.log(`[sheets] Created sheet: ${sheetTitle} (${spreadsheetId})`);

  // Move sheet into month folder
  const moveCmd = `gog drive move "${spreadsheetId}" --parent "${folderId}" --account ${ACCOUNT} -j`;
  execSync(moveCmd, { encoding: 'utf8', timeout: 15000 });

  // Add headers to all 4 tabs
  const headers = HEADERS[caType];
  const headersJson = JSON.stringify([headers]);
  const colEnd = String.fromCharCode(64 + headers.length);
  for (let w = 1; w <= 4; w++) {
    const tabName = `Tuần ${w}`;
    const updateCmd = `gog sheets update "${spreadsheetId}" "${tabName}!A1:${colEnd}1" --values-json '${headersJson}' --account ${ACCOUNT} -j`;
    execSync(updateCmd, { encoding: 'utf8', timeout: 15000 });
  }

  // Save to config
  if (!config[caType]) config[caType] = {};
  config[caType][monthKey] = { spreadsheetId, folderId };
  saveConfig(config);

  console.log(`[sheets] Auto-created new month: ${caType.toUpperCase()} THÁNG ${month}_${year}`);
  return config[caType][monthKey];
}

// ─── Main sync function ───────────────────────────────────────────────────────

async function syncWorker() {
  const startTime = Date.now();
  console.log(`[sheets] ===== Sync worker started at ${new Date().toISOString()} =====`);

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`[sheets] FATAL: Cannot load config: ${err.message}`);
    process.exit(1);
  }

  const unsyncedRows = getUnsyncedRows();
  console.log(`[sheets] Found ${unsyncedRows.length} unsynced rows`);

  if (unsyncedRows.length === 0) {
    console.log('[sheets] Nothing to sync. Exiting.');
    return { synced: 0, failed: 0, skipped: 0 };
  }

  // Group rows by (caType, monthKey, weekNum)
  const groups = {};
  const skippedEntries = [];

  for (const entry of unsyncedRows) {
    let caType, dateStr, monthKey, weekNum;

    try {
      caType   = deriveCaType(entry);
      dateStr  = getEntryDate(entry);
      monthKey = getMonthKey(dateStr);
      weekNum  = getWeekNumber(dateStr);
    } catch (err) {
      console.warn(`[sheets] Skipping entry ${entry.id}: ${err.message}`);
      skippedEntries.push(entry);
      continue;
    }

    const groupKey = `${caType}|${monthKey}|${weekNum}`;
    if (!groups[groupKey]) {
      groups[groupKey] = { caType, monthKey, weekNum, dateStr, entries: [] };
    }
    groups[groupKey].entries.push(entry);
  }

  let synced = 0;
  let failed = 0;
  let skipped = skippedEntries.length;

  // Process each group
  for (const [groupKey, group] of Object.entries(groups)) {
    const { caType, monthKey, weekNum, dateStr, entries } = group;
    const tabName = `Tuần ${weekNum}`;

    console.log(`[sheets] Processing group ${groupKey}: ${entries.length} rows → ${caType} / ${tabName}`);

    let monthConfig;
    try {
      monthConfig = ensureMonthExists(config, caType, monthKey, dateStr);
    } catch (err) {
      console.error(`[sheets] ERROR: Cannot ensure month ${monthKey} for ${caType}: ${err.message}`);
      failed += entries.length;
      continue;
    }

    const { spreadsheetId } = monthConfig;

    // Build rows for this group
    const sheetRows = entries.map(e => buildSheetRow(caType, e.row || {}));

    try {
      const result = gogSheetsAppend(spreadsheetId, tabName, sheetRows);
      console.log(`[sheets] Appended ${sheetRows.length} rows to ${caType} ${tabName}:`, JSON.stringify(result));

      // Mark as synced
      markSynced(entries.map(e => e.id));
      synced += entries.length;
    } catch (err) {
      console.error(`[sheets] ERROR appending group ${groupKey}: ${err.message}`);
      failed += entries.length;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const summary = { synced, failed, skipped };
  console.log(`[sheets] ===== Sync complete in ${elapsed}s — synced:${synced} failed:${failed} skipped:${skipped} =====`);

  return summary;
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

if (require.main === module) {
  syncWorker()
    .then(summary => {
      console.log('[sheets] Summary:', JSON.stringify(summary));
      if (summary.failed > 0) process.exit(1);
      process.exit(0);
    })
    .catch(err => {
      console.error('[sheets] Unhandled error:', err.message);
      process.exit(1);
    });
}


// ─── Master sheet daily summary sync ─────────────────────────────────────────
// Pushes a one-row daily ops summary to Will's master Google Sheet.

function syncDailySummaryToMaster(db) {
  try {
    const config = loadConfig();
    const masterSheetId = config?._meta?.masterSheetId;
    const account       = config?._meta?.account || ACCOUNT;
    if (!masterSheetId) {
      console.warn('[sheets/master] No masterSheetId in sheets_config.json — skipping');
      return;
    }

    const ict   = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const today = ict.toISOString().split('T')[0];

    // Pull key metrics from db
    const checkins  = db.prepare(`SELECT COUNT(*) as c FROM checkin_log WHERE date = ?`).get(today)?.c || 0;
    const checkouts = db.prepare(`SELECT COUNT(*) as c FROM checkin_log WHERE date = ? AND checkout_time IS NOT NULL`).get(today)?.c || 0;
    const bc_count  = db.prepare(`SELECT COUNT(*) as c FROM shift_report WHERE date = ? AND report_type LIKE 'bc%'`).get(today)?.c || 0;
    const staff_total = db.prepare(`SELECT COUNT(*) as c FROM staff WHERE status = 'active'`).get()?.c || 0;

    // Revenue — sum of today's entries if table exists
    let revenue = 0;
    try {
      revenue = db.prepare(`SELECT COALESCE(SUM(amount),0) as r FROM revenue_reports WHERE date = ?`).get(today)?.r || 0;
    } catch (_) {}

    const row = {
      date:         today,
      staff_total,
      checkins,
      checkouts,
      missed_checkouts: Math.max(0, checkins - checkouts),
      bc_count,
      revenue,
      synced_at: new Date().toISOString(),
    };

    const headers = ['date','staff_total','checkins','checkouts','missed_checkouts','bc_count','revenue','synced_at'];
    const result  = gogSheetsAppend(masterSheetId, 'Daily Summary', [headers.map(h => row[h] !== undefined ? String(row[h]) : '')]);
    console.log(`[sheets/master] Daily summary synced for ${today}:`, JSON.stringify(result));

  } catch (err) {
    console.error('[sheets/master] Failed to sync daily summary:', err.message);
  }
}

module.exports = { syncWorker, getWeekNumber, getMonthKey, deriveCaType, syncDailySummaryToMaster };

