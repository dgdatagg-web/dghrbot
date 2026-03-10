-- ============================================================
-- Migration: 002_hr_engine.sql
-- Layer: HR/EXP
-- WillOS DB — HR Engine Schema
--
-- NOTE: staff table already exists with TEXT primary key.
-- We ADD HR columns to it and create new HR tables.
-- ============================================================

-- Add HR columns to existing staff table (idempotent — SQLite ignores if column exists)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we handle this in the runner

-- [HR/EXP LAYER] exp_events
-- Immutable event log — every XP action goes here
-- staff_id references staff.id (TEXT)
CREATE TABLE IF NOT EXISTS exp_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id     TEXT    NOT NULL REFERENCES staff(id),
  event_type   TEXT    NOT NULL,
  -- Positive: on_time_checkin, task_completed, customer_compliment, support_teammate, cleanliness_pass
  -- Negative: late_checkin, order_mistake, customer_complaint, conflict_report, no_show
  xp_delta     INTEGER NOT NULL,
  shift_id     TEXT,    -- reference to shift (can be null for non-shift events)
  logged_by    TEXT    NOT NULL DEFAULT 'system', -- 'system' | telegram_id | staff_id
  verified     INTEGER NOT NULL DEFAULT 0,        -- 0=pending, 1=verified, -1=rejected
  audit_flag   INTEGER NOT NULL DEFAULT 0,        -- 1=flagged for audit (5% random)
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exp_events_staff_id    ON exp_events(staff_id);
CREATE INDEX IF NOT EXISTS idx_exp_events_shift_id    ON exp_events(shift_id);
CREATE INDEX IF NOT EXISTS idx_exp_events_created_at  ON exp_events(created_at);
CREATE INDEX IF NOT EXISTS idx_exp_events_event_type  ON exp_events(event_type);

-- [HR/EXP LAYER] exp_snapshot
-- Rolling summary per staff — updated after every event
-- week_start: ISO date string (YYYY-MM-DD) of Monday of current week
CREATE TABLE IF NOT EXISTS exp_snapshot (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id          TEXT    NOT NULL REFERENCES staff(id) UNIQUE,
  total_xp          INTEGER NOT NULL DEFAULT 0,
  weekly_xp         INTEGER NOT NULL DEFAULT 0,
  level             INTEGER NOT NULL DEFAULT 0,   -- floor(total_xp / 100)
  performance_ratio REAL    NOT NULL DEFAULT 0.0, -- positive_events / total_events
  week_start        TEXT    NOT NULL DEFAULT (date('now', 'weekday 1', '-7 days')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exp_snapshot_staff_id ON exp_snapshot(staff_id);
CREATE INDEX IF NOT EXISTS idx_exp_snapshot_weekly   ON exp_snapshot(weekly_xp DESC);

-- [HR/EXP LAYER] alert_log_hr
CREATE TABLE IF NOT EXISTS alert_log_hr (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id     TEXT    REFERENCES staff(id),  -- nullable for system-wide alerts
  alert_type   TEXT    NOT NULL,
  -- Types: negative_burst, xp_drop_24h, complaint_critical, inactivity
  severity     TEXT    NOT NULL DEFAULT 'INFO', -- 'INFO' | 'WARNING' | 'CRITICAL'
  message      TEXT    NOT NULL,
  resolved     INTEGER NOT NULL DEFAULT 0,  -- 0=open, 1=resolved
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alert_log_hr_staff_id  ON alert_log_hr(staff_id);
CREATE INDEX IF NOT EXISTS idx_alert_log_hr_resolved  ON alert_log_hr(resolved);
CREATE INDEX IF NOT EXISTS idx_alert_log_hr_severity  ON alert_log_hr(severity);

-- Add telegram_id and status columns to existing staff table if not present
-- (Handled in migration runner — SQLite ALTER TABLE ADD COLUMN)
-- Run these manually if needed (idempotent, SQLite will error if column exists):
--   ALTER TABLE staff ADD COLUMN telegram_id TEXT;
--   ALTER TABLE staff ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
--   CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_telegram_id ON staff(telegram_id) WHERE telegram_id IS NOT NULL;
