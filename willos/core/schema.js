/**
 * core/schema.js — WillOS Database Schema
 *
 * Define all SQLite tables for WillOS.
 * Uses better-sqlite3 (synchronous).
 */

'use strict';

/**
 * Initialize all tables in the given better-sqlite3 database instance.
 * Safe to call multiple times (IF NOT EXISTS).
 *
 * @param {import('better-sqlite3').Database} db
 */
function initSchema(db) {
  db.exec(`
    -- SKU master catalog
    CREATE TABLE IF NOT EXISTS sku_master (
      sku_id    TEXT PRIMARY KEY,
      name_vi   TEXT,
      name_en   TEXT,
      category  TEXT,
      price     REAL
    );

    -- Daily operational data (one row per SKU per day per source)
    CREATE TABLE IF NOT EXISTS daily_operations (
      date                  TEXT NOT NULL,
      sku_id                TEXT NOT NULL,
      quantity_sold         INTEGER DEFAULT 0,
      revenue               REAL DEFAULT 0,
      total_cogs            REAL DEFAULT 0,
      waste                 REAL DEFAULT 0,
      labor_cost            REAL DEFAULT 0,
      supplier_price_change REAL DEFAULT 0,
      source                TEXT DEFAULT 'manual',
      PRIMARY KEY (date, sku_id, source)
    );

    -- Grab raw data (verbatim from CSV)
    CREATE TABLE IF NOT EXISTS grab_raw (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      date        TEXT NOT NULL,
      item_name   TEXT NOT NULL,
      units_sold  INTEGER DEFAULT 0,
      gross_sales REAL DEFAULT 0,
      source      TEXT DEFAULT 'grab'
    );

    -- KPI snapshot (one row per day, aggregated)
    CREATE TABLE IF NOT EXISTS kpi_snapshot (
      date              TEXT PRIMARY KEY,
      gross_margin      REAL,
      labor_efficiency  REAL,
      waste_ratio       REAL,
      cost_drift        REAL
    );

    -- Alert log
    CREATE TABLE IF NOT EXISTS alert_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      date        TEXT NOT NULL,
      alert_type  TEXT NOT NULL,
      value       REAL,
      threshold   REAL,
      message     TEXT,
      resolved    INTEGER DEFAULT 0
    );

    -- Baseline metrics (frozen reference values)
    CREATE TABLE IF NOT EXISTS baseline_metrics (
      metric_name TEXT PRIMARY KEY,
      value       REAL,
      frozen_at   TEXT,
      frozen_by   TEXT
    );

    -- Staff master list
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT,
      dept TEXT,
      emoji TEXT,
      color TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- EXP state per staff
    CREATE TABLE IF NOT EXISTS staff_exp (
      staff_id TEXT PRIMARY KEY,
      total_xp INTEGER DEFAULT 0,
      weekly_xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 0,
      performance_ratio REAL DEFAULT 1.0,
      positive_events INTEGER DEFAULT 0,
      negative_events INTEGER DEFAULT 0,
      weekly_reset_at TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    );

    -- Event log
    CREATE TABLE IF NOT EXISTS exp_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      xp_delta INTEGER NOT NULL,
      xp_actual INTEGER NOT NULL,
      shift_id INTEGER,
      logged_by TEXT,
      note TEXT,
      verified INTEGER DEFAULT 0,
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (staff_id) REFERENCES staff(id),
      FOREIGN KEY (shift_id) REFERENCES shift_report(id)
    );

    -- EXP alerts
    CREATE TABLE IF NOT EXISTS exp_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      reason TEXT,
      resolved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Shift reports (parsed from team Telegram messages)
    CREATE TABLE IF NOT EXISTS shift_report (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date     TEXT NOT NULL,
      reporter        TEXT,
      grab_revenue    INTEGER DEFAULT 0,
      fabi_revenue    INTEGER DEFAULT 0,
      total_revenue   INTEGER DEFAULT 0,
      qty_curry       INTEGER DEFAULT 0,
      qty_rice        INTEGER DEFAULT 0,
      qty_noodle      INTEGER DEFAULT 0,
      qty_takoyaki    INTEGER DEFAULT 0,
      qty_other       INTEGER DEFAULT 0,
      stock_rice      TEXT,
      stock_noodle    TEXT,
      stock_missing   TEXT,
      waste_note      TEXT,
      incident_note   TEXT,
      import_note     TEXT,
      export_note     TEXT,
      raw_text        TEXT,
      source          TEXT DEFAULT 'telegram',
      created_at      TEXT DEFAULT (datetime('now','localtime'))
    );
  `);
}

module.exports = { initSchema };
