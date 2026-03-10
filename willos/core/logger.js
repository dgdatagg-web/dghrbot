/**
 * core/logger.js — WillOS Logger
 *
 * Simple file + console logger.
 * Writes to data/willos.log and stdout.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'data');
const LOG_FILE = path.join(LOG_DIR, 'willos.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Format a log line.
 * @param {'INFO'|'WARN'|'ERROR'} level
 * @param {string} message
 * @returns {string}
 */
function formatLine(level, message) {
  const ts = new Date().toISOString();
  return `[${ts}] [${level}] ${message}`;
}

/**
 * Write to console and append to log file.
 * @param {'INFO'|'WARN'|'ERROR'} level
 * @param {string} message
 */
function log(level, message) {
  const line = formatLine(level, message);
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (_err) {
    // Fail silently on file write errors — console still works
  }
}

const logger = {
  info: (msg) => log('INFO', msg),
  warn: (msg) => log('WARN', msg),
  error: (msg) => log('ERROR', msg),
};

module.exports = logger;
