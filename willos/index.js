/**
 * index.js — WillOS Server Entry Point
 *
 * Express server setup, mount all API routes, init SQLite DB on start.
 *
 * Usage:
 *   node index.js
 *   PORT=4000 node index.js
 */

'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');
const { initSchema } = require('./core/schema');
const logger = require('./core/logger');

// ------- Config -------
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'willos.db');

// ------- Init Database -------
logger.info(`Initializing database at ${DB_PATH}`);
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
initSchema(db);
logger.info('Database schema initialized');

// ------- Express App -------
const app = express();
app.use(express.json());

// Allow dashboard (file:// or any origin) to fetch from this server
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Health check
app.get('/', (req, res) => {
  const systemConfig = require('./config/system.json');
  res.json({
    name: systemConfig.name,
    version: systemConfig.version,
    environment: systemConfig.environment,
    status: 'running',
    uptime: process.uptime(),
  });
});

// ------- Mount API Routes -------
require('./api/ingest').mount(app, db);
require('./api/metrics').mount(app, db);
require('./api/alerts').mount(app, db);
require('./api/coo').mount(app, db);
require('./api/report').mount(app, db);
require('./api/report-intake').mount(app, db);
require('./api/exp').mount(app, db);
require('./api/hr').mount(app, db);
require('./api/grab').mount(app, db);

// Wire HR engine to shared DB
const expEngine = require('./core/exp_engine');
expEngine.setDb(db);

// HR Bot chạy standalone qua hr-bot.js — không spawn ở đây để tránh 409 conflict
// logger.info('[telegram_hr_bot] Skipped — use hr-bot.js standalone');

logger.info('API routes mounted: /api/ingest, /api/metrics, /api/alerts, /api/coo, /api/report, /api/report/intake, /api/exp, /api/hr');

// ------- Start Server -------
app.listen(PORT, () => {
  logger.info(`WillOS server running on port ${PORT}`);
  console.log(`\n⚡ WillOS v${require('./config/system.json').version} — http://localhost:${PORT}`);
  console.log(`   Environment: ${require('./config/system.json').environment}`);
  console.log(`   Database: ${DB_PATH}\n`);
});

// ------- Graceful Shutdown -------
process.on('SIGINT', () => {
  logger.info('Shutting down...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down...');
  db.close();
  process.exit(0);
});

module.exports = { app, db };
