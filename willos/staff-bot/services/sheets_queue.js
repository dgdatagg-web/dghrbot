/**
 * sheets_queue.js — Local queue for Google Sheets sync
 * Queue-based approach: write locally first, sync to Sheet later
 *
 * Format per line in sheets_queue.jsonl:
 *   { id, sheet, row, timestamp, synced }
 */

'use strict';

const fs = require('fs');
const path = require('path');

// willos/staff-bot/services/ → up 3 levels = /workspace/data
const WORKSPACE_DATA = path.resolve(__dirname, '..', '..', '..', 'data');
const QUEUE_FILE = path.join(WORKSPACE_DATA, 'sheets_queue.jsonl');

function ensureQueueFile() {
  if (!fs.existsSync(WORKSPACE_DATA)) {
    fs.mkdirSync(WORKSPACE_DATA, { recursive: true });
  }
  if (!fs.existsSync(QUEUE_FILE)) {
    fs.writeFileSync(QUEUE_FILE, '', 'utf8');
  }
}

/**
 * Append a row to the queue.
 * @param {string} sheetName - e.g. 'moca_log', 'bc_log'
 * @param {object} rowData   - fields to log
 */
function queueRow(sheetName, rowData) {
  try {
    ensureQueueFile();
    const entry = {
      id: `${sheetName}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      sheet: sheetName,
      row: rowData,
      timestamp: new Date().toISOString(),
      synced: false,
    };
    fs.appendFileSync(QUEUE_FILE, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    console.error('[sheets_queue] queueRow error:', err.message);
  }
}

/**
 * Get all queued rows for a sheet, optionally filtered by date.
 * @param {string} sheetName
 * @param {string|null} date - 'YYYY-MM-DD' or null for all
 * @returns {Array<object>}
 */
function getQueuedRows(sheetName, date = null) {
  try {
    ensureQueueFile();
    const lines = fs.readFileSync(QUEUE_FILE, 'utf8').split('\n').filter(Boolean);
    return lines
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(e => e && e.sheet === sheetName)
      .filter(e => {
        if (!date) return true;
        return e.timestamp && e.timestamp.startsWith(date);
      });
  } catch (err) {
    console.error('[sheets_queue] getQueuedRows error:', err.message);
    return [];
  }
}

/**
 * Mark rows as synced by their IDs.
 * @param {string[]} ids
 */
function markSynced(ids) {
  try {
    ensureQueueFile();
    const lines = fs.readFileSync(QUEUE_FILE, 'utf8').split('\n').filter(Boolean);
    const idSet = new Set(ids);
    const updated = lines.map(l => {
      try {
        const entry = JSON.parse(l);
        if (idSet.has(entry.id)) {
          entry.synced = true;
          entry.syncedAt = new Date().toISOString();
        }
        return JSON.stringify(entry);
      } catch {
        return l;
      }
    });
    fs.writeFileSync(QUEUE_FILE, updated.join('\n') + '\n', 'utf8');
  } catch (err) {
    console.error('[sheets_queue] markSynced error:', err.message);
  }
}

/**
 * Get all unsynced rows (optionally filtered by sheet).
 * @param {string|null} sheetName
 * @returns {Array<object>}
 */
function getUnsyncedRows(sheetName = null) {
  try {
    ensureQueueFile();
    const lines = fs.readFileSync(QUEUE_FILE, 'utf8').split('\n').filter(Boolean);
    return lines
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(e => e && !e.synced)
      .filter(e => !sheetName || e.sheet === sheetName);
  } catch (err) {
    console.error('[sheets_queue] getUnsyncedRows error:', err.message);
    return [];
  }
}

module.exports = { queueRow, getQueuedRows, markSynced, getUnsyncedRows, QUEUE_FILE };
