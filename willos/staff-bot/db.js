/**
 * db.js — Database setup and migrations
 * WillOS Staff RPG Bot
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db;

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

function initDb(dbPath) {
  const resolvedPath = dbPath || path.join(__dirname, '..', '..', 'data', 'staff.db');

  // Ensure directory exists
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations();
  return db;
}

function runMigrations() {
  // Create staff table
  db.exec(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'newbie',
      exp INTEGER DEFAULT 0,
      streak INTEGER DEFAULT 0,
      last_checkin DATE,
      joined_date DATE DEFAULT (date('now')),
      promoted_dates TEXT DEFAULT '{}',
      status TEXT DEFAULT 'active',
      notes TEXT,
      referred_by INTEGER
    );
  `);

  // Add referred_by column if missing (for existing DBs)
  try {
    db.exec(`ALTER TABLE staff ADD COLUMN referred_by INTEGER;`);
  } catch (_) { /* column already exists */ }

  // Create exp_log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS exp_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER,
      delta INTEGER,
      reason TEXT,
      by_telegram_id TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    );
  `);

  // Create checkin_log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS checkin_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER,
      checkin_time DATETIME,
      checkout_time DATETIME,
      date DATE,
      late_minutes INTEGER DEFAULT 0,
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    );
  `);

  // Create shift_schedule table
  db.exec(`
    CREATE TABLE IF NOT EXISTS shift_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER,
      week TEXT,
      days TEXT,
      submitted_by TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    );
  `);

  // Add shift_detail column if missing (for existing DBs)
  try {
    db.exec(`ALTER TABLE shift_schedule ADD COLUMN shift_detail TEXT DEFAULT '{}';`);
  } catch (_) { /* column already exists */ }

  // Add department + class_role columns if missing (backward compatible)
  try {
    db.exec(`ALTER TABLE staff ADD COLUMN department TEXT;`);
  } catch (_) { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE staff ADD COLUMN class_role TEXT;`);
  } catch (_) { /* column already exists */ }

  // Add private_chat_id column if missing (Sprint 1 — DM reminder system)
  try {
    db.exec(`ALTER TABLE staff ADD COLUMN private_chat_id TEXT;`);
  } catch (_) { /* column already exists */ }

  // Add username + full_name columns if missing
  try {
    db.exec(`ALTER TABLE staff ADD COLUMN username TEXT;`);
  } catch (_) { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE staff ADD COLUMN full_name TEXT;`);
  } catch (_) { /* column already exists */ }

  // Add date_of_birth + nickname columns if missing
  try {
    db.exec(`ALTER TABLE staff ADD COLUMN date_of_birth TEXT;`);
  } catch (_) { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE staff ADD COLUMN nickname TEXT;`);
  } catch (_) { /* column already exists */ }

  // ESOP pool — fired EXP snapshot + leaderboard period snapshots
  try { db.exec(`ALTER TABLE staff ADD COLUMN fired_exp INTEGER DEFAULT NULL;`); } catch (_) {}
  try { db.exec(`ALTER TABLE staff ADD COLUMN exp_week_start INTEGER DEFAULT 0;`); } catch (_) {}
  try { db.exec(`ALTER TABLE staff ADD COLUMN exp_week_reset_at TEXT DEFAULT NULL;`); } catch (_) {}
  try { db.exec(`ALTER TABLE staff ADD COLUMN exp_month_start INTEGER DEFAULT 0;`); } catch (_) {}
  try { db.exec(`ALTER TABLE staff ADD COLUMN exp_month_reset_at TEXT DEFAULT NULL;`); } catch (_) {}

  // Bot settings table — key/value store (company_valuation, etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS bot_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Add GPS location columns to checkin_log if missing (Sprint GPS)
  try { db.exec(`ALTER TABLE checkin_log ADD COLUMN lat REAL;`); } catch (_) { /* exists */ }
  try { db.exec(`ALTER TABLE checkin_log ADD COLUMN lng REAL;`); } catch (_) { /* exists */ }
  try { db.exec(`ALTER TABLE checkin_log ADD COLUMN distance_meters INTEGER;`); } catch (_) { /* exists */ }
  try { db.exec(`ALTER TABLE checkin_log ADD COLUMN location_verified INTEGER DEFAULT 0;`); } catch (_) { /* exists */ }
  // OT / working-hours columns
  try { db.exec(`ALTER TABLE checkin_log ADD COLUMN actual_minutes INTEGER DEFAULT NULL;`); } catch (_) { /* exists */ }
  try { db.exec(`ALTER TABLE checkin_log ADD COLUMN ot_request_id INTEGER DEFAULT NULL;`); } catch (_) { /* exists */ }

  // OT requests table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ot_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      date DATE NOT NULL,
      requested_end TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      reviewed_by_id INTEGER DEFAULT NULL,
      reviewed_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    );
  `);

  // Create badges table
  db.exec(`
    CREATE TABLE IF NOT EXISTS badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER,
      badge_key TEXT,
      earned_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    );
  `);

  // Create shift_report table
  db.exec(`
    CREATE TABLE IF NOT EXISTS shift_report (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER,
      report_type TEXT,
      report_data TEXT,
      date DATE,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    );
  `);

  // Create procurement_log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS procurement_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER,
      item_name TEXT,
      quantity TEXT,
      price INTEGER,
      supplier TEXT,
      bill_file_id TEXT,
      date DATE,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    );
  `);

  // Create huy_hang_log table (v3 — bc redesign)
  db.exec(`
    CREATE TABLE IF NOT EXISTS huy_hang_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER,
      item TEXT,
      reason TEXT,
      caused_by TEXT,
      date DATE,
      created_at DATETIME DEFAULT (datetime('now'))
    );
  `);

  // Create don_saisot_log table (v3 — bc redesign)
  db.exec(`
    CREATE TABLE IF NOT EXISTS don_saisot_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER,
      order_type TEXT,
      order_id TEXT,
      issue TEXT,
      date DATE,
      created_at DATETIME DEFAULT (datetime('now'))
    );
  `);

  // ── Departments ──────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    );
  `);
  // Seed generic departments (ignore if already exist)
  const depts = [
    ['dept_production', 'Production'],
    ['dept_service',    'Service'],
    ['dept_bar',        'Bar & Entertainment'],
    ['dept_supply',     'Supply & Inventory'],
    ['dept_ops',        'Operations'],
  ];
  const insertDept = db.prepare(`INSERT OR IGNORE INTO departments (id, name) VALUES (?, ?)`);
  for (const [id, name] of depts) insertDept.run(id, name);

  // ── Staff access rights ───────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS staff_access_grants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      access_type TEXT NOT NULL,
      dept_id TEXT DEFAULT NULL,
      granted_by INTEGER NOT NULL,
      granted_at DATETIME DEFAULT (datetime('now')),
      revoked_at DATETIME DEFAULT NULL,
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    );
  `);

  // ── ESOP ─────────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS esop_pool (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL UNIQUE,
      dept_id TEXT NOT NULL,
      share_pct REAL DEFAULT 0,
      vesting_start DATE NOT NULL,
      cliff1_unlocked INTEGER DEFAULT 0,
      cliff2_unlocked INTEGER DEFAULT 0,
      cliff3_unlocked INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      assigned_by INTEGER NOT NULL,
      assigned_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS esop_kpi_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dept_id TEXT NOT NULL,
      kpi_key TEXT NOT NULL,
      label TEXT NOT NULL,
      weight REAL NOT NULL,
      set_by INTEGER NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT (datetime('now')),
      UNIQUE(dept_id, kpi_key)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS esop_kpi_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      dept_id TEXT NOT NULL,
      kpi_key TEXT NOT NULL,
      score REAL NOT NULL,
      period TEXT NOT NULL,
      recorded_by INTEGER,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS esop_cliff_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      cliff_year INTEGER NOT NULL,
      requested_pct REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      reviewed_by INTEGER DEFAULT NULL,
      reviewed_at DATETIME DEFAULT NULL,
      note TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS esop_candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      dept_id TEXT NOT NULL,
      nominated_by INTEGER NOT NULL,
      status TEXT DEFAULT 'racing',
      inherited_pct REAL DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    );
  `);

  // ── Revenue reporting ─────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS revenue_reporter_assignment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      assigned_by INTEGER NOT NULL,
      active INTEGER DEFAULT 1,
      assigned_at DATETIME DEFAULT (datetime('now')),
      revoked_at DATETIME DEFAULT NULL,
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS revenue_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE NOT NULL UNIQUE,
      reporter_id INTEGER NOT NULL,
      tien_mat INTEGER DEFAULT 0,
      chuyen_khoan INTEGER DEFAULT 0,
      grab INTEGER DEFAULT 0,
      tong_dt INTEGER DEFAULT 0,
      chi_phi INTEGER DEFAULT 0,
      chi_phi_label TEXT,
      ket_cuoi_ngay INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      submitted_at DATETIME DEFAULT NULL,
      drive_folder_id TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (reporter_id) REFERENCES staff(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS revenue_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      file_id TEXT NOT NULL,
      drive_file_id TEXT DEFAULT NULL,
      receipt_type TEXT DEFAULT NULL,
      extracted_amount INTEGER DEFAULT NULL,
      extracted_date TEXT DEFAULT NULL,
      extracted_account TEXT DEFAULT NULL,
      extracted_ref TEXT DEFAULT NULL,
      matched INTEGER DEFAULT NULL,
      mismatch_note TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (report_id) REFERENCES revenue_reports(id)
    );
  `);

  // ── Reward Engine ─────────────────────────────────────────────────────────────

  db.exec(`
    CREATE TABLE IF NOT EXISTS reward_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reward_type TEXT NOT NULL CHECK (reward_type IN ('quest', 'cash_kpi', 'company_kpi')),
      title TEXT NOT NULL,
      description TEXT,
      target_type TEXT NOT NULL CHECK (target_type IN ('individual', 'group', 'company')),
      dept_id TEXT,
      exp_reward INTEGER NOT NULL DEFAULT 0,
      cash_reward INTEGER NOT NULL DEFAULT 0,
      item_reward_desc TEXT,
      expires_at TEXT,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_active INTEGER NOT NULL DEFAULT 1
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS reward_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reward_id INTEGER NOT NULL REFERENCES reward_definitions(id),
      staff_id INTEGER NOT NULL REFERENCES staff(id),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_approval', 'approved', 'cancelled', 'completed')),
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      approved_by INTEGER,
      approved_at TEXT,
      cancelled_at TEXT,
      cancel_reason TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS reward_payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL REFERENCES reward_assignments(id),
      staff_id INTEGER NOT NULL REFERENCES staff(id),
      exp_credited INTEGER NOT NULL DEFAULT 0,
      cash_amount INTEGER NOT NULL DEFAULT 0,
      cash_confirmed INTEGER NOT NULL DEFAULT 0,
      cash_confirmed_by INTEGER,
      cash_confirmed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS company_kpi_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reward_id INTEGER REFERENCES reward_definitions(id),
      kpi_key TEXT NOT NULL,
      target_value REAL NOT NULL,
      current_value REAL DEFAULT 0,
      hit INTEGER NOT NULL DEFAULT 0,
      period TEXT,
      set_by INTEGER,
      evaluated_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Migration: add columns to company_kpi_targets for standalone GM workflow
  try { db.exec(`ALTER TABLE company_kpi_targets ADD COLUMN period TEXT;`); } catch (_) {}
  try { db.exec(`ALTER TABLE company_kpi_targets ADD COLUMN set_by INTEGER;`); } catch (_) {}
  try { db.exec(`ALTER TABLE company_kpi_targets ADD COLUMN created_at TEXT DEFAULT (datetime('now'));`); } catch (_) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS townboard_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reward_id INTEGER NOT NULL REFERENCES reward_definitions(id),
      posted_by INTEGER NOT NULL,
      posted_at TEXT NOT NULL DEFAULT (datetime('now')),
      pinned INTEGER NOT NULL DEFAULT 0,
      removed_at TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS reward_data_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL REFERENCES staff(id),
      reward_id INTEGER,
      event_type TEXT NOT NULL,
      value REAL,
      logged_at TEXT NOT NULL DEFAULT (datetime('now')),
      notes TEXT
    )
  `);

  db.prepare(`
    CREATE TABLE IF NOT EXISTS bot_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // ── reward_definitions v2 — add activity type + recurrence cols ───────────────
  // SQLite cannot ALTER a CHECK constraint, so we recreate the table when the
  // old constraint is still in place (detectable by absence of 'activity' cols).
  const rdCols = db.prepare("PRAGMA table_info(reward_definitions)").all().map(c => c.name);
  if (!rdCols.includes('recurrence_day')) {
    db.exec(`
      BEGIN;
      ALTER TABLE reward_definitions RENAME TO _reward_definitions_old;
      CREATE TABLE reward_definitions (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        reward_type      TEXT NOT NULL CHECK (reward_type IN ('quest', 'cash_kpi', 'company_kpi', 'activity')),
        title            TEXT NOT NULL,
        description      TEXT,
        target_type      TEXT NOT NULL CHECK (target_type IN ('individual', 'group', 'company', 'open')),
        dept_id          TEXT,
        exp_reward       INTEGER NOT NULL DEFAULT 0,
        cash_reward      INTEGER NOT NULL DEFAULT 0,
        item_reward_desc TEXT,
        expires_at       TEXT,
        recurrence_day   TEXT,
        recurrence_time  TEXT,
        created_by       INTEGER NOT NULL,
        created_at       TEXT NOT NULL DEFAULT (datetime('now')),
        is_active        INTEGER NOT NULL DEFAULT 1
      );
      INSERT INTO reward_definitions
        (id, reward_type, title, description, target_type, dept_id,
         exp_reward, cash_reward, item_reward_desc, expires_at,
         created_by, created_at, is_active)
      SELECT
        id, reward_type, title, description, target_type, dept_id,
        exp_reward, cash_reward, item_reward_desc, expires_at,
        created_by, created_at, is_active
      FROM _reward_definitions_old;
      DROP TABLE _reward_definitions_old;
      COMMIT;
    `);
    console.log('[DB] reward_definitions migrated to v2 — activity type + recurrence cols added.');
  }

  console.log('[DB] Migrations complete.');
}

// ─── ESOP/EXP pool migrations ─────────────────────────────────────────────────
// fired_exp: snapshot of EXP at time of /fire — used for 50% retain on rehire
// exp_weekly_snapshot / exp_monthly_snapshot: for leaderboard windows

// ─── Bot config (key/value store) ─────────────────────────────────────────────
// Used for: creator_silent_mode, and any future bot-wide preferences.
// Migration runs in runMigrations() above — table created at boot if missing.

function getStaffByTelegramId(telegramId) {
  return getDb().prepare('SELECT * FROM staff WHERE telegram_id = ?').get(String(telegramId));
}

function getStaffByName(name) {
  return getDb().prepare('SELECT * FROM staff WHERE name LIKE ?').get(`%${name}%`);
}

function getStaffByUsername(username) {
  // Normalise: accept with or without leading @
  const normalised = username.startsWith('@') ? username : `@${username}`;
  return getDb().prepare('SELECT * FROM staff WHERE username = ?').get(normalised);
}

function getAllActiveStaff() {
  return getDb().prepare("SELECT * FROM staff WHERE status = 'active' ORDER BY exp DESC").all();
}

function createStaff({ telegramId, name, role, status, department, classRole, username, fullName }) {
  const stmt = getDb().prepare(`
    INSERT INTO staff (telegram_id, name, role, status, joined_date, promoted_dates, department, class_role, username, full_name)
    VALUES (?, ?, ?, ?, date('now'), ?, ?, ?, ?, ?)
  `);
  const promotedDates = JSON.stringify({ [role]: new Date().toISOString().split('T')[0] });
  return stmt.run(String(telegramId), name, role, status || 'active', promotedDates, department || null, classRole || null, username || null, fullName || null);
}

function updateStaff(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => fields[k]);
  getDb().prepare(`UPDATE staff SET ${setClause} WHERE id = ?`).run(...values, id);
}

function updateStaffStatus(telegramId, status) {
  getDb().prepare('UPDATE staff SET status = ? WHERE telegram_id = ?').run(status, String(telegramId));
}

// ─── EXP Log ─────────────────────────────────────────────────────────────────

function logExp({ staffId, delta, reason, byTelegramId }) {
  const result = getDb().prepare(`
    INSERT INTO exp_log (staff_id, delta, reason, by_telegram_id)
    VALUES (?, ?, ?, ?)
  `).run(staffId, delta, reason, byTelegramId ? String(byTelegramId) : null);

  // Queue to Sheets
  try {
    const { queueRow } = require('./services/sheets_queue');
    const staff = getDb().prepare('SELECT name, department FROM staff WHERE id = ?').get(staffId);
    const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
    queueRow('exp_log', {
      date: today,
      staff_name: staff ? staff.name : staffId,
      department: staff ? (staff.department || '') : '',
      delta,
      reason: reason || '',
      by_telegram_id: byTelegramId || '',
    });
  } catch (e) {
    // non-fatal
  }

  return result;
}

function getExpHistory(staffId, limit = 10) {
  return getDb().prepare(`
    SELECT * FROM exp_log WHERE staff_id = ?
    ORDER BY created_at DESC LIMIT ?
  `).all(staffId, limit);
}

// ─── Checkin Log ─────────────────────────────────────────────────────────────

function getTodayCheckin(staffId, date) {
  return getDb().prepare(`
    SELECT * FROM checkin_log WHERE staff_id = ? AND date = ?
  `).get(staffId, date);
}

function createCheckinLog({ staffId, checkinTime, date, lateMinutes, lat, lng, distanceMeters, locationVerified }) {
  return getDb().prepare(`
    INSERT INTO checkin_log (staff_id, checkin_time, date, late_minutes, lat, lng, distance_meters, location_verified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(staffId, checkinTime, date, lateMinutes || 0, lat || null, lng || null, distanceMeters != null ? distanceMeters : null, locationVerified != null ? locationVerified : 0);
}

function updateCheckout(checkinId, checkoutTime, actualMinutes = null) {
  getDb().prepare(`
    UPDATE checkin_log SET checkout_time = ?, actual_minutes = ? WHERE id = ?
  `).run(checkoutTime, actualMinutes, checkinId);
}

function getOpenCheckin(staffId, date) {
  return getDb().prepare(`
    SELECT * FROM checkin_log WHERE staff_id = ? AND date = ? AND checkout_time IS NULL
  `).get(staffId, date);
}

/**
 * Find any open checkin for a staff member (no checkout_time), regardless of date.
 * Returns the most recent one — handles midnight crossings.
 */
function getAnyOpenCheckin(staffId) {
  return getDb().prepare(`
    SELECT * FROM checkin_log
    WHERE staff_id = ? AND checkout_time IS NULL
    ORDER BY checkin_time DESC
    LIMIT 1
  `).get(staffId);
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

function getLeaderboard(limit = 10) {
  return getDb().prepare(`
    SELECT * FROM staff
    WHERE status = 'active' AND role NOT IN ('gm', 'creator')
    ORDER BY exp DESC
    LIMIT ?
  `).all(limit);
}

// ─── Pending approvals ────────────────────────────────────────────────────────

function getPendingStaff() {
  return getDb().prepare("SELECT * FROM staff WHERE status = 'pending'").all();
}

// ─── Staff by ID ─────────────────────────────────────────────────────────────

function getStaffById(id) {
  return getDb().prepare('SELECT * FROM staff WHERE id = ?').get(id);
}

// ─── Delete ──────────────────────────────────────────────────────────────────

function deleteStaff(staffId) {
  const d = getDb();
  d.prepare('DELETE FROM exp_log WHERE staff_id = ?').run(staffId);
  d.prepare('DELETE FROM checkin_log WHERE staff_id = ?').run(staffId);
  d.prepare('DELETE FROM shift_schedule WHERE staff_id = ?').run(staffId);
  d.prepare('DELETE FROM badges WHERE staff_id = ?').run(staffId);
  d.prepare('DELETE FROM staff WHERE id = ?').run(staffId);
}

// ─── Counts ──────────────────────────────────────────────────────────────────

function getCheckinCount(staffId) {
  const row = getDb().prepare('SELECT COUNT(*) as cnt FROM checkin_log WHERE staff_id = ?').get(staffId);
  return row ? row.cnt : 0;
}

// ─── Referrals ───────────────────────────────────────────────────────────────

function getReferrals(staffId) {
  return getDb().prepare('SELECT * FROM staff WHERE referred_by = ?').all(staffId);
}

// ─── KPI Streak ──────────────────────────────────────────────────────────────

/**
 * Returns count of consecutive months (most recent first) where
 * at least one exp_log entry with reason LIKE '%KPI 100%' exists.
 */
function getConsecutiveMonthsKpi(staffId) {
  const rows = getDb().prepare(`
    SELECT strftime('%Y-%m', created_at) as month
    FROM exp_log
    WHERE staff_id = ? AND reason LIKE '%KPI 100%%'
    GROUP BY month
    ORDER BY month DESC
  `).all(staffId);

  if (!rows.length) return 0;

  let count = 0;
  const now = new Date();
  let checkYear = now.getFullYear();
  let checkMonth = now.getMonth() + 1; // 1-indexed

  for (const row of rows) {
    const [y, m] = row.month.split('-').map(Number);
    if (y === checkYear && m === checkMonth) {
      count++;
      checkMonth--;
      if (checkMonth === 0) { checkMonth = 12; checkYear--; }
    } else {
      break;
    }
  }
  return count;
}

/**
 * Returns number of days since last negative exp_log entry (violation-free streak).
 */
function getCleanSlateDays(staffId) {
  const row = getDb().prepare(`
    SELECT created_at FROM exp_log
    WHERE staff_id = ? AND delta < 0
    ORDER BY created_at DESC LIMIT 1
  `).get(staffId);

  if (!row) {
    // No violations ever — use joined_date
    const staff = getDb().prepare('SELECT joined_date FROM staff WHERE id = ?').get(staffId);
    if (!staff) return 0;
    const joined = new Date(staff.joined_date);
    return Math.floor((Date.now() - joined.getTime()) / (1000 * 60 * 60 * 24));
  }

  const last = new Date(row.created_at);
  return Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Checkins by date ─────────────────────────────────────────────────────────

function getAllCheckinsByDate(date) {
  return getDb().prepare('SELECT * FROM checkin_log WHERE date = ?').all(date);
}

// ─── Shift Schedule ──────────────────────────────────────────────────────────

function getShiftSchedule(staffId, week) {
  return getDb().prepare('SELECT * FROM shift_schedule WHERE staff_id = ? AND week = ?').get(staffId, week);
}

function upsertShiftSchedule(staffId, week, days, submittedBy, shiftDetail) {
  const existing = getShiftSchedule(staffId, week);
  const daysJson = JSON.stringify(days);
  const detailJson = JSON.stringify(shiftDetail || {});
  if (existing) {
    getDb().prepare('UPDATE shift_schedule SET days = ?, submitted_by = ?, shift_detail = ? WHERE staff_id = ? AND week = ?')
      .run(daysJson, submittedBy, detailJson, staffId, week);
  } else {
    getDb().prepare('INSERT INTO shift_schedule (staff_id, week, days, submitted_by, shift_detail) VALUES (?, ?, ?, ?, ?)')
      .run(staffId, week, daysJson, submittedBy, detailJson);
  }
}

function getShiftsByWeek(week) {
  return getDb().prepare(`
    SELECT ss.*, s.name, s.role, s.telegram_id
    FROM shift_schedule ss
    JOIN staff s ON ss.staff_id = s.id
    WHERE ss.week = ?
    ORDER BY s.name ASC
  `).all(week);
}

/**
 * Get staff who have a shift scheduled on a specific day this week.
 * @param {string} weekStr - "YYYY-WNN"
 * @param {string} dayCode - "T2"-"CN"
 */
function getStaffWithShiftToday(weekStr, dayCode) {
  const rows = getDb().prepare(`
    SELECT ss.*, s.name, s.role, s.telegram_id, s.id as staff_id
    FROM shift_schedule ss
    JOIN staff s ON ss.staff_id = s.id
    WHERE ss.week = ? AND s.status = 'active'
  `).all(weekStr);

  return rows.filter(row => {
    try {
      const days = JSON.parse(row.days);
      return days.includes(dayCode);
    } catch {
      return false;
    }
  });
}

// ─── Badges ──────────────────────────────────────────────────────────────────

function getBadges(staffId) {
  return getDb().prepare('SELECT * FROM badges WHERE staff_id = ? ORDER BY earned_at ASC').all(staffId);
}

function hasBadge(staffId, badgeKey) {
  const row = getDb().prepare('SELECT id FROM badges WHERE staff_id = ? AND badge_key = ?').get(staffId, badgeKey);
  return !!row;
}

function awardBadge(staffId, badgeKey) {
  if (hasBadge(staffId, badgeKey)) return false;
  getDb().prepare('INSERT INTO badges (staff_id, badge_key) VALUES (?, ?)').run(staffId, badgeKey);
  return true;
}

// ─── Shift Report ─────────────────────────────────────────────────────────────

function createShiftReport({ staffId, reportType, reportData, date }) {
  return getDb().prepare(`
    INSERT INTO shift_report (staff_id, report_type, report_data, date)
    VALUES (?, ?, ?, ?)
  `).run(staffId, reportType, typeof reportData === 'string' ? reportData : JSON.stringify(reportData), date);
}

function getShiftReports(staffId, reportType, limit = 10) {
  return getDb().prepare(`
    SELECT * FROM shift_report WHERE staff_id = ? AND report_type = ?
    ORDER BY created_at DESC LIMIT ?
  `).all(staffId, reportType, limit);
}

// ─── Procurement Log ──────────────────────────────────────────────────────────

function createProcurementLog({ staffId, itemName, quantity, price, supplier, billFileId, date }) {
  return getDb().prepare(`
    INSERT INTO procurement_log (staff_id, item_name, quantity, price, supplier, bill_file_id, date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(staffId, itemName, quantity, price, supplier || null, billFileId || null, date);
}

function getProcurementLogs(limit = 20) {
  return getDb().prepare(`
    SELECT pl.*, s.name as staff_name
    FROM procurement_log pl
    LEFT JOIN staff s ON pl.staff_id = s.id
    ORDER BY pl.created_at DESC LIMIT ?
  `).all(limit);
}

// ─── Hủy Hàng Log ────────────────────────────────────────────────────────────

function createHuyHangLog({ staffId, item, reason, causedBy, date }) {
  return getDb().prepare(`
    INSERT INTO huy_hang_log (staff_id, item, reason, caused_by, date)
    VALUES (?, ?, ?, ?, ?)
  `).run(staffId, item, reason || null, causedBy || null, date);
}

function getHuyHangLogs(staffId, limit = 20) {
  return getDb().prepare(`
    SELECT * FROM huy_hang_log WHERE staff_id = ?
    ORDER BY created_at DESC LIMIT ?
  `).all(staffId, limit);
}

// ─── Đơn Sai Sót Log ─────────────────────────────────────────────────────────

function createDonSaisotLog({ staffId, orderType, orderId, issue, date }) {
  return getDb().prepare(`
    INSERT INTO don_saisot_log (staff_id, order_type, order_id, issue, date)
    VALUES (?, ?, ?, ?, ?)
  `).run(staffId, orderType, orderId || null, issue || null, date);
}

function getDonSaisotLogs(staffId, limit = 20) {
  return getDb().prepare(`
    SELECT * FROM don_saisot_log WHERE staff_id = ?
    ORDER BY created_at DESC LIMIT ?
  `).all(staffId, limit);
}

// ─── Private Chat ID (Sprint 1 — DM Reminders) ───────────────────────────────

function updatePrivateChatId(telegramId, chatId) {
  getDb().prepare(`
    UPDATE staff SET private_chat_id = ? WHERE telegram_id = ?
  `).run(String(chatId), String(telegramId));
}

function getStaffWithPrivateChatId() {
  return getDb().prepare(`
    SELECT * FROM staff WHERE status = 'active' AND private_chat_id IS NOT NULL AND private_chat_id != ''
  `).all();
}

// ─── EXP helpers (Sprint 1 — EXP Automation) ─────────────────────────────────

/**
 * Add EXP to a staff member and log it.
 * Returns { newExp, leveledUp, newRole }
 */
function addExp(staffId, delta, reason, byTelegramId) {
  const d = getDb();
  const staff = d.prepare('SELECT * FROM staff WHERE id = ?').get(staffId);
  if (!staff) return null;

  const newExp = Math.max(0, (staff.exp || 0) + delta);
  d.prepare('UPDATE staff SET exp = ? WHERE id = ?').run(newExp, staffId);
  d.prepare(`
    INSERT INTO exp_log (staff_id, delta, reason, by_telegram_id)
    VALUES (?, ?, ?, ?)
  `).run(staffId, delta, reason, byTelegramId ? String(byTelegramId) : null);

  // Check role promotion based on EXP thresholds
  // NEVER touch gm/creator roles — they are manually assigned, immune to EXP-based changes
  const { getRoleFromExp } = require('./utils/roles');
  let leveledUp = false;
  const newRole = getRoleFromExp(newExp);
  if (!['gm', 'creator'].includes(staff.role) && newRole && newRole !== staff.role) {
    // Only auto-promote up through progression (not gm/creator)
    const autoPromoteRoles = ['nhanvien', 'kycuu', 'quanly'];
    if (autoPromoteRoles.includes(newRole)) {
      const promotedDates = JSON.parse(staff.promoted_dates || '{}');
      promotedDates[newRole] = new Date().toISOString().split('T')[0];
      d.prepare('UPDATE staff SET role = ?, promoted_dates = ? WHERE id = ?')
        .run(newRole, JSON.stringify(promotedDates), staffId);
      leveledUp = true;
    }
  }

  return { newExp, leveledUp, newRole };
}

/**
 * Get count of distinct days with at least 1 shift_report for streak calculation.
 * Returns array of date strings (most recent first).
 */
function getRecentReportDates(staffId, limit = 14) {
  return getDb().prepare(`
    SELECT DISTINCT date FROM shift_report
    WHERE staff_id = ?
    ORDER BY date DESC
    LIMIT ?
  `).all(staffId, limit).map(r => r.date);
}

/**
 * Get shift_report for a specific type and date (to check if already submitted).
 */
function getShiftReportByDate(staffId, reportType, date) {
  return getDb().prepare(`
    SELECT * FROM shift_report
    WHERE staff_id = ? AND report_type = ? AND date = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(staffId, reportType, date);
}

/**
 * Get the most recent dongca report (for pre-fill inventory).
 */
function getLastDongcaReport(date) {
  return getDb().prepare(`
    SELECT * FROM shift_report
    WHERE report_type = 'dongca' AND date = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(date);
}

// ─── Baocao / Tongquan helpers ────────────────────────────────────────────────

/**
 * All staff who checked in today but have not checked out yet.
 */
function getAllOpenCheckinsToday(date) {
  return getDb().prepare(`
    SELECT cl.*, s.name, s.department, s.role, s.class_role, s.private_chat_id, s.id as staff_id
    FROM checkin_log cl
    JOIN staff s ON cl.staff_id = s.id
    WHERE cl.date = ? AND cl.checkout_time IS NULL AND s.status = 'active'
    ORDER BY cl.checkin_time ASC
  `).all(date);
}

/**
 * All checkin_log rows for a given date, joined with staff name/department/role.
 */
function getTodayCheckins(date) {
  return getDb().prepare(`
    SELECT cl.*, s.name, s.department, s.role, s.id as staff_id
    FROM checkin_log cl
    JOIN staff s ON cl.staff_id = s.id
    WHERE cl.date = ?
    ORDER BY cl.checkin_time ASC
  `).all(date);
}

/**
 * All shift_reports for a given date, joined with staff name.
 */
function getTodayShiftReports(date) {
  return getDb().prepare(`
    SELECT sr.*, s.name, s.department, s.role
    FROM shift_report sr
    JOIN staff s ON sr.staff_id = s.id
    WHERE sr.date = ?
    ORDER BY sr.created_at ASC
  `).all(date);
}

/**
 * All huy_hang_log rows for a given date, joined with staff name.
 */
function getTodayHuyHang(date) {
  return getDb().prepare(`
    SELECT hh.*, s.name
    FROM huy_hang_log hh
    LEFT JOIN staff s ON hh.staff_id = s.id
    WHERE hh.date = ?
    ORDER BY hh.created_at ASC
  `).all(date);
}

/**
 * All don_saisot_log rows for a given date, joined with staff name.
 */
function getTodayDonSaisot(date) {
  return getDb().prepare(`
    SELECT ds.*, s.name
    FROM don_saisot_log ds
    LEFT JOIN staff s ON ds.staff_id = s.id
    WHERE ds.date = ?
    ORDER BY ds.created_at ASC
  `).all(date);
}

/**
 * Parse dongca report_data JSON for a given date and sum revenue fields.
 * Returns { cash, transfer, grab, total }
 */
function getTodayDongcaRevenue(date) {
  const rows = getDb().prepare(`
    SELECT report_data FROM shift_report
    WHERE report_type = 'dongca' AND date = ?
    ORDER BY created_at DESC LIMIT 1
  `).all(date);

  if (!rows.length) return null;

  try {
    const data = JSON.parse(rows[0].report_data || '{}');
    const cash     = parseInt(data.tien_mat    || data.cash     || 0, 10) || 0;
    const transfer = parseInt(data.chuyen_khoan|| data.transfer || 0, 10) || 0;
    const grab     = parseInt(data.grab        || 0, 10) || 0;
    return { cash, transfer, grab, total: cash + transfer + grab };
  } catch {
    return null;
  }
}

/**
 * All active staff (excluding gm/creator system roles).
 */
function getActiveStaff() {
  return getDb().prepare(`
    SELECT * FROM staff
    WHERE status = 'active' AND role NOT IN ('gm', 'creator')
    ORDER BY name ASC
  `).all();
}

/**
 * Top N staff ordered by streak DESC.
 */
function getTopStreaks(limit = 5) {
  return getDb().prepare(`
    SELECT * FROM staff
    WHERE status = 'active' AND streak > 0
    ORDER BY streak DESC
    LIMIT ?
  `).all(limit);
}

// ─── Auto Shift Report Helpers ───────────────────────────────────────────────

/**
 * Check if an auto shift report (auto_moca or auto_dongca) already exists
 * for a given dept + date.
 * @param {string} type - 'auto_moca' or 'auto_dongca'
 * @param {string} dept - 'bep' | 'bar' | 'bida' | 'kho'
 * @param {string} date - 'YYYY-MM-DD'
 */
function hasAutoShiftReport(type, dept, date) {
  if (dept === null || dept === undefined) {
    // Day-level check — any auto_moca for this date
    const row = getDb().prepare(`
      SELECT id FROM shift_report
      WHERE report_type = ? AND date = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(type, date);
    return !!row;
  }
  const row = getDb().prepare(`
    SELECT id FROM shift_report
    WHERE report_type = ? AND date = ?
    AND json_extract(report_data, '$.dept') = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(type, date, dept);
  return !!row;
}

/**
 * Get all staff from a dept who checked in today but NOT yet checked out.
 * @param {string} dept - department code
 * @param {string} date - 'YYYY-MM-DD'
 * @returns {Array} staff rows (joined with checkin_log)
 */
function getDeptActiveCheckins(dept, date) {
  return getDb().prepare(`
    SELECT cl.*, s.name, s.department, s.role, s.id as staff_id
    FROM checkin_log cl
    JOIN staff s ON cl.staff_id = s.id
    WHERE cl.date = ? AND s.department = ? AND cl.checkout_time IS NULL AND s.status = 'active'
    ORDER BY cl.checkin_time ASC
  `).all(date, dept);
}

/**
 * Get all staff from a dept who checked in today (including those who checked out).
 * @param {string} dept - department code
 * @param {string} date - 'YYYY-MM-DD'
 */
function getDeptCheckins(dept, date) {
  return getDb().prepare(`
    SELECT cl.*, s.name, s.department, s.role, s.id as staff_id
    FROM checkin_log cl
    JOIN staff s ON cl.staff_id = s.id
    WHERE cl.date = ? AND s.department = ? AND s.status = 'active'
    ORDER BY cl.checkin_time ASC
  `).all(date, dept);
}

/**
 * Get all BC reports for a dept today.
 */
function getDeptBcReports(dept, date) {
  return getDb().prepare(`
    SELECT sr.*, s.name, s.department
    FROM shift_report sr
    JOIN staff s ON sr.staff_id = s.id
    WHERE sr.date = ? AND sr.report_type = 'bc' AND s.department = ?
    ORDER BY sr.created_at ASC
  `).all(date, dept);
}

// ─── Departments ─────────────────────────────────────────────────────────────

function getAllDepartments() {
  return getDb().prepare('SELECT * FROM departments ORDER BY id').all();
}

// ─── Access grants ────────────────────────────────────────────────────────────

function grantAccess(staffId, accessType, deptId, grantedBy) {
  return getDb().prepare(`
    INSERT INTO staff_access_grants (staff_id, access_type, dept_id, granted_by)
    VALUES (?, ?, ?, ?)
  `).run(staffId, accessType, deptId || null, grantedBy);
}

function revokeAccess(grantId) {
  return getDb().prepare(`
    UPDATE staff_access_grants SET revoked_at = datetime('now') WHERE id = ?
  `).run(grantId);
}

function getAccessGrants(staffId) {
  return getDb().prepare(`
    SELECT * FROM staff_access_grants
    WHERE staff_id = ? AND revoked_at IS NULL
  `).all(staffId);
}

function hasAccess(staffId, accessType, deptId) {
  const row = getDb().prepare(`
    SELECT 1 FROM staff_access_grants
    WHERE staff_id = ? AND access_type = ?
      AND (dept_id IS NULL OR dept_id = ?)
      AND revoked_at IS NULL
    LIMIT 1
  `).get(staffId, accessType, deptId || null);
  return !!row;
}

// ─── ESOP ─────────────────────────────────────────────────────────────────────

function assignEsopSeat(staffId, deptId, sharePct, assignedBy) {
  return getDb().prepare(`
    INSERT OR REPLACE INTO esop_pool
      (staff_id, dept_id, share_pct, vesting_start, assigned_by)
    VALUES (?, ?, ?, date('now'), ?)
  `).run(staffId, deptId, sharePct, assignedBy);
}

function getEsopPoolByDept(deptId) {
  return getDb().prepare(`
    SELECT ep.*, s.name, s.department, s.role
    FROM esop_pool ep
    JOIN staff s ON ep.staff_id = s.id
    WHERE ep.dept_id = ? AND ep.status = 'active'
    ORDER BY ep.share_pct DESC
  `).all(deptId);
}

function getEsopSeat(staffId) {
  return getDb().prepare(`SELECT * FROM esop_pool WHERE staff_id = ? AND status = 'active'`).get(staffId);
}

function updateEsopShares(staffId, sharePct) {
  return getDb().prepare(`UPDATE esop_pool SET share_pct = ? WHERE staff_id = ?`).run(sharePct, staffId);
}

function forfeitEsopSeat(staffId) {
  return getDb().prepare(`UPDATE esop_pool SET status = 'forfeited' WHERE staff_id = ?`).run(staffId);
}

function upsertKpiConfig(deptId, kpiKey, label, weight, setBy) {
  return getDb().prepare(`
    INSERT INTO esop_kpi_config (dept_id, kpi_key, label, weight, set_by)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(dept_id, kpi_key) DO UPDATE SET label=excluded.label, weight=excluded.weight, set_by=excluded.set_by
  `).run(deptId, kpiKey, label, weight, setBy);
}

function getKpiConfig(deptId) {
  return getDb().prepare(`SELECT * FROM esop_kpi_config WHERE dept_id = ? AND active = 1`).all(deptId);
}

function getPendingKpisByDept(deptId) {
  return getDb().prepare(`SELECT * FROM esop_kpi_config WHERE dept_id = ? AND label LIKE '[PENDING]%'`).all(deptId);
}

function approveKpiSuggestions(deptId, approvedBy) {
  return getDb().prepare(`
    UPDATE esop_kpi_config
    SET label = SUBSTR(label, 11), set_by = ?, active = 1
    WHERE dept_id = ? AND label LIKE '[PENDING]%'
  `).run(approvedBy, deptId);
}

function logKpiScore(staffId, deptId, kpiKey, score, period, recordedBy) {
  return getDb().prepare(`
    INSERT INTO esop_kpi_scores (staff_id, dept_id, kpi_key, score, period, recorded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(staffId, deptId, kpiKey, score, period, recordedBy);
}

function getKpiScores(staffId, period) {
  return getDb().prepare(`SELECT * FROM esop_kpi_scores WHERE staff_id = ? AND period = ?`).all(staffId, period);
}

function createCliffRequest(staffId, cliffYear, requestedPct) {
  return getDb().prepare(`
    INSERT INTO esop_cliff_events (staff_id, cliff_year, requested_pct)
    VALUES (?, ?, ?)
  `).run(staffId, cliffYear, requestedPct);
}

function reviewCliffRequest(id, status, reviewedBy, note) {
  return getDb().prepare(`
    UPDATE esop_cliff_events SET status=?, reviewed_by=?, reviewed_at=datetime('now'), note=?
    WHERE id=?
  `).run(status, reviewedBy, note || null, id);
}

function getPendingCliffRequests() {
  return getDb().prepare(`
    SELECT ce.*, s.name, s.department FROM esop_cliff_events ce
    JOIN staff s ON ce.staff_id = s.id
    WHERE ce.status = 'pending' ORDER BY ce.created_at ASC
  `).all();
}

function addEsopCandidate(staffId, deptId, nominatedBy, inheritedPct) {
  return getDb().prepare(`
    INSERT INTO esop_candidates (staff_id, dept_id, nominated_by, inherited_pct)
    VALUES (?, ?, ?, ?)
  `).run(staffId, deptId, nominatedBy, inheritedPct || 0);
}

function getEsopCandidates(deptId) {
  return getDb().prepare(`
    SELECT ec.*, s.name, s.role FROM esop_candidates ec
    JOIN staff s ON ec.staff_id = s.id
    WHERE ec.dept_id = ? AND ec.status = 'racing'
    ORDER BY ec.created_at ASC
  `).all(deptId);
}

// ─── Revenue reporting ────────────────────────────────────────────────────────

function getActiveRevenueReporter() {
  return getDb().prepare(`
    SELECT rra.*, s.name, s.telegram_id, s.private_chat_id
    FROM revenue_reporter_assignment rra
    JOIN staff s ON rra.staff_id = s.id
    WHERE rra.active = 1
    ORDER BY rra.assigned_at DESC LIMIT 1
  `).get();
}

function assignRevenueReporter(staffId, assignedBy) {
  // Deactivate previous
  getDb().prepare(`UPDATE revenue_reporter_assignment SET active=0, revoked_at=datetime('now') WHERE active=1`).run();
  return getDb().prepare(`
    INSERT INTO revenue_reporter_assignment (staff_id, assigned_by) VALUES (?, ?)
  `).run(staffId, assignedBy);
}

function revokeRevenueReporter() {
  return getDb().prepare(`
    UPDATE revenue_reporter_assignment SET active=0, revoked_at=datetime('now') WHERE active=1
  `).run();
}

function getOrCreateRevenueReport(date, reporterId) {
  const existing = getDb().prepare(`SELECT * FROM revenue_reports WHERE date = ?`).get(date);
  if (existing) return existing;
  getDb().prepare(`
    INSERT INTO revenue_reports (date, reporter_id) VALUES (?, ?)
  `).run(date, reporterId);
  return getDb().prepare(`SELECT * FROM revenue_reports WHERE date = ?`).get(date);
}

function updateRevenueReport(date, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const set = keys.map(k => `${k} = ?`).join(', ');
  getDb().prepare(`UPDATE revenue_reports SET ${set} WHERE date = ?`).run(...keys.map(k => fields[k]), date);
}

function getRevenueReport(date) {
  return getDb().prepare(`SELECT * FROM revenue_reports WHERE date = ?`).get(date);
}

function getRevenueHistory(limit = 30) {
  return getDb().prepare(`
    SELECT rr.*, s.name as reporter_name
    FROM revenue_reports rr
    JOIN staff s ON rr.reporter_id = s.id
    WHERE rr.status = 'submitted'
    ORDER BY rr.date DESC LIMIT ?
  `).all(limit);
}

function addRevenueReceipt(reportId, fileId, receiptType) {
  return getDb().prepare(`
    INSERT INTO revenue_receipts (report_id, file_id, receipt_type) VALUES (?, ?, ?)
  `).run(reportId, fileId, receiptType || null);
}

function updateReceiptMatch(id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const set = keys.map(k => `${k} = ?`).join(', ');
  getDb().prepare(`UPDATE revenue_receipts SET ${set} WHERE id = ?`).run(...keys.map(k => fields[k]), id);
}

function getReceiptsByReport(reportId) {
  return getDb().prepare(`SELECT * FROM revenue_receipts WHERE report_id = ?`).all(reportId);
}

// ─── Company KPI Targets ─────────────────────────────────────────────────────

function getCompanyKpiTargets(period) {
  if (period) {
    return getDb().prepare(`
      SELECT * FROM company_kpi_targets WHERE period = ? ORDER BY id
    `).all(period);
  }
  return getDb().prepare(`SELECT * FROM company_kpi_targets ORDER BY id`).all();
}

function getCompanyKpiByKey(kpiKey, period) {
  if (period) {
    return getDb().prepare(`
      SELECT * FROM company_kpi_targets WHERE kpi_key = ? AND period = ?
    `).get(kpiKey, period);
  }
  return getDb().prepare(`
    SELECT * FROM company_kpi_targets WHERE kpi_key = ? ORDER BY id DESC LIMIT 1
  `).get(kpiKey);
}

function upsertCompanyKpi({ kpiKey, targetValue, currentValue, period, setBy }) {
  const existing = period
    ? getDb().prepare(`SELECT id FROM company_kpi_targets WHERE kpi_key = ? AND period = ?`).get(kpiKey, period)
    : getDb().prepare(`SELECT id FROM company_kpi_targets WHERE kpi_key = ?`).get(kpiKey);

  if (existing) {
    return getDb().prepare(`
      UPDATE company_kpi_targets
      SET target_value = ?, current_value = COALESCE(?, current_value), period = COALESCE(?, period), set_by = ?, evaluated_at = datetime('now')
      WHERE id = ?
    `).run(targetValue, currentValue, period, setBy, existing.id);
  }
  return getDb().prepare(`
    INSERT INTO company_kpi_targets (kpi_key, target_value, current_value, period, set_by, hit)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(kpiKey, targetValue, currentValue || 0, period, setBy);
}

function updateCompanyKpiScore(kpiKey, currentValue, period) {
  const target = period
    ? getDb().prepare(`SELECT id, target_value FROM company_kpi_targets WHERE kpi_key = ? AND period = ?`).get(kpiKey, period)
    : getDb().prepare(`SELECT id, target_value FROM company_kpi_targets WHERE kpi_key = ?`).get(kpiKey);

  if (!target) return null;

  const hit = currentValue >= target.target_value ? 1 : 0;
  getDb().prepare(`
    UPDATE company_kpi_targets SET current_value = ?, hit = ?, evaluated_at = datetime('now') WHERE id = ?
  `).run(currentValue, hit, target.id);

  return { id: target.id, kpiKey, targetValue: target.target_value, currentValue, hit: hit === 1 };
}

function deleteCompanyKpi(kpiKey, period) {
  if (period) {
    return getDb().prepare(`DELETE FROM company_kpi_targets WHERE kpi_key = ? AND period = ?`).run(kpiKey, period);
  }
  return getDb().prepare(`DELETE FROM company_kpi_targets WHERE kpi_key = ?`).run(kpiKey);
}

module.exports = {
  initDb,
  getDb,
  getStaffByTelegramId,
  getStaffByName,
  getStaffByUsername,
  getStaffById,
  getAllActiveStaff,
  createStaff,
  updateStaff,
  updateStaffStatus,
  deleteStaff,
  logExp,
  getExpHistory,
  getTodayCheckin,
  createCheckinLog,
  updateCheckout,
  getOpenCheckin,
  getLeaderboard,
  getPendingStaff,
  getCheckinCount,
  getReferrals,
  getConsecutiveMonthsKpi,
  getCleanSlateDays,
  getAllCheckinsByDate,
  getShiftSchedule,
  upsertShiftSchedule,
  getShiftsByWeek,
  getStaffWithShiftToday,
  getBadges,
  hasBadge,
  awardBadge,
  createShiftReport,
  getShiftReports,
  createProcurementLog,
  getProcurementLogs,
  createHuyHangLog,
  getHuyHangLogs,
  createDonSaisotLog,
  getDonSaisotLogs,
  updatePrivateChatId,
  getStaffWithPrivateChatId,
  addExp,
  getRecentReportDates,
  getShiftReportByDate,
  getLastDongcaReport,
  getTodayCheckins,
  getTodayShiftReports,
  getTodayHuyHang,
  getTodayDonSaisot,
  getTodayDongcaRevenue,
  getActiveStaff,
  getTopStreaks,
  hasAutoShiftReport,
  getDeptActiveCheckins,
  getDeptCheckins,
  getDeptBcReports,
  getAllOpenCheckinsToday,
  getAnyOpenCheckin,
  // OT
  createOtRequest: (staffId, date, requestedEnd, reason) =>
    getDb().prepare(`INSERT INTO ot_requests (staff_id, date, requested_end, reason) VALUES (?,?,?,?)`)
      .run(staffId, date, requestedEnd, reason),
  getOtRequest: (staffId, date) =>
    getDb().prepare(`SELECT * FROM ot_requests WHERE staff_id = ? AND date = ? ORDER BY created_at DESC LIMIT 1`)
      .get(staffId, date),
  getPendingOtRequests: () =>
    getDb().prepare(`
      SELECT o.*, s.name, s.department FROM ot_requests o
      JOIN staff s ON o.staff_id = s.id
      WHERE o.status = 'pending' ORDER BY o.created_at ASC
    `).all(),
  approveOtRequest: (otId, reviewerId, status) =>
    getDb().prepare(`UPDATE ot_requests SET status = ?, reviewed_by_id = ?, reviewed_at = datetime('now') WHERE id = ?`)
      .run(status, reviewerId, otId),
  getOtRequestById: (otId) =>
    getDb().prepare(`SELECT o.*, s.name, s.department FROM ot_requests o JOIN staff s ON o.staff_id = s.id WHERE o.id = ?`)
      .get(otId),
  linkOtToCheckin: (checkinId, otRequestId) =>
    getDb().prepare(`UPDATE checkin_log SET ot_request_id = ? WHERE id = ?`).run(otRequestId, checkinId),
  // Departments
  getAllDepartments,
  // Access grants
  grantAccess,
  revokeAccess,
  getAccessGrants,
  hasAccess,
  // ESOP
  assignEsopSeat,
  getEsopPoolByDept,
  getEsopSeat,
  updateEsopShares,
  forfeitEsopSeat,
  upsertKpiConfig,
  getKpiConfig,
  getPendingKpisByDept,
  approveKpiSuggestions,
  logKpiScore,
  getKpiScores,
  createCliffRequest,
  reviewCliffRequest,
  getPendingCliffRequests,
  addEsopCandidate,
  getEsopCandidates,
  // Revenue reporting
  getActiveRevenueReporter,
  assignRevenueReporter,
  revokeRevenueReporter,
  getOrCreateRevenueReport,
  updateRevenueReport,
  getRevenueReport,
  getRevenueHistory,
  addRevenueReceipt,
  updateReceiptMatch,
  getReceiptsByReport,
  // ESOP leaderboard period resets
  resetWeeklyExpSnapshots: () => {
    const ict = new Date(Date.now() + 7 * 3600000).toISOString();
    getDb().prepare(`
      UPDATE staff SET exp_week_start = exp, exp_week_reset_at = ?
      WHERE status = 'active'
    `).run(ict);
  },
  resetMonthlyExpSnapshots: () => {
    const ict = new Date(Date.now() + 7 * 3600000).toISOString();
    getDb().prepare(`
      UPDATE staff SET exp_month_start = exp, exp_month_reset_at = ?
      WHERE status = 'active'
    `).run(ict);
  },
  // Company KPI targets
  getCompanyKpiTargets,
  getCompanyKpiByKey,
  upsertCompanyKpi,
  updateCompanyKpiScore,
  deleteCompanyKpi,
};
