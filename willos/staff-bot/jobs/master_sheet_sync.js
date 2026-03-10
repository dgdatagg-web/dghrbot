/**
 * master_sheet_sync.js — Nightly consolidated snapshot to Master Sheet
 *
 * Pushes 4 tabs to the Master Sheet (single Google Sheet, multiple tabs):
 *   1. staff_overview   — all active staff, EXP, role, streak, last checkin
 *   2. attendance_today — today's checkin/checkout log
 *   3. exp_movements    — EXP changes in the last 7 days
 *   4. flags            — violations, no-shows, missed BCs in last 7 days
 *
 * Runs nightly at 23:00 ICT via cron in index.js.
 * Can also be run manually: node jobs/master_sheet_sync.js
 *
 * Requires env:
 *   MASTER_SHEET_ID   — Google Sheet ID for BOD/management view
 */

'use strict';

const path      = require('path');
const { execSync } = require('child_process');

const DB_PATH   = path.resolve(__dirname, '..', '..', 'data', 'staff.db');
const ACCOUNT   = 'dgdatagg@gmail.com';

// ─── DB helper (open read-only connection) ────────────────────────────────────

function getDb() {
  const Database = require('better-sqlite3');
  return new Database(DB_PATH, { readonly: true });
}

// ─── ICT helpers ──────────────────────────────────────────────────────────────

function ictNow() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
}

function ictDateStr() {
  return ictNow().toISOString().split('T')[0];
}

function daysAgo(n) {
  const d = ictNow();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// ─── CSV helper ───────────────────────────────────────────────────────────────

function toCSV(headers, rows) {
  const escape = v => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

// ─── Sheet push via gog CLI ───────────────────────────────────────────────────

function pushTab(sheetId, tabName, csvContent) {
  const fs = require('fs');
  const os = require('os');
  const tmpFile = path.join(os.tmpdir(), `master_${tabName}_${Date.now()}.csv`);
  try {
    fs.writeFileSync(tmpFile, csvContent, 'utf8');
    execSync(
      `gog sheets clear --account "${ACCOUNT}" --spreadsheet "${sheetId}" --sheet "${tabName}" && ` +
      `gog sheets append --account "${ACCOUNT}" --spreadsheet "${sheetId}" --sheet "${tabName}" --file "${tmpFile}"`,
      { stdio: 'pipe' }
    );
    console.log(`[master_sheet] ✅ ${tabName} pushed (${csvContent.split('\n').length - 1} rows)`);
  } catch (err) {
    console.error(`[master_sheet] ❌ ${tabName} failed:`, err.message);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

// ─── Tab builders ─────────────────────────────────────────────────────────────

function buildStaffOverview(db) {
  const ROLE_LABEL = { newbie: 'Newbie', nhanvien: 'Nhân viên', kycuu: 'Kỳ cựu', quanly: 'Quản lý', gm: 'GM', creator: 'Creator' };

  // Check if username column exists before selecting it (added in a later migration)
  const columns = db.prepare(`PRAGMA table_info(staff)`).all().map(c => c.name);
  const hasUsername = columns.includes('username');
  const selectUsername = hasUsername ? 'username,' : "'' AS username,";

  const rows = db.prepare(`
    SELECT name, ${selectUsername} role, department, class_role, exp, streak, last_checkin, status
    FROM staff
    WHERE status = 'active' AND role NOT IN ('gm', 'creator')
    ORDER BY exp DESC
  `).all();

  const headers = ['name', 'username', 'role_label', 'department', 'class_role', 'exp', 'streak', 'last_checkin'];
  const mapped = rows.map(r => ({
    name: r.name,
    username: r.username || '',
    role_label: ROLE_LABEL[r.role] || r.role,
    department: r.department || '',
    class_role: r.class_role || '',
    exp: r.exp,
    streak: r.streak,
    last_checkin: r.last_checkin || '',
  }));
  return toCSV(headers, mapped);
}

function buildAttendanceToday(db) {
  const today = ictDateStr();
  const rows = db.prepare(`
    SELECT s.name, s.department, s.class_role,
           cl.checkin_time, cl.checkout_time, cl.late_minutes, cl.location_verified
    FROM checkin_log cl
    JOIN staff s ON s.id = cl.staff_id
    WHERE cl.date = ?
    ORDER BY cl.checkin_time ASC
  `).all(today);

  const headers = ['name', 'department', 'class_role', 'checkin_time', 'checkout_time', 'late_minutes', 'location_verified'];
  const mapped = rows.map(r => ({
    name: r.name,
    department: r.department || '',
    class_role: r.class_role || '',
    checkin_time: r.checkin_time ? r.checkin_time.substring(11, 16) : '',
    checkout_time: r.checkout_time ? r.checkout_time.substring(11, 16) : '',
    late_minutes: r.late_minutes || 0,
    location_verified: r.location_verified ? 'yes' : 'no',
  }));
  return toCSV(headers, mapped);
}

function buildExpMovements(db) {
  const since = daysAgo(7);
  const rows = db.prepare(`
    SELECT s.name, s.department, el.delta, el.reason, el.created_at
    FROM exp_log el
    JOIN staff s ON s.id = el.staff_id
    WHERE DATE(el.created_at) >= ?
    ORDER BY el.created_at DESC
    LIMIT 200
  `).all(since);

  const headers = ['date', 'name', 'department', 'delta', 'reason'];
  const mapped = rows.map(r => ({
    date: r.created_at ? r.created_at.substring(0, 10) : '',
    name: r.name,
    department: r.department || '',
    delta: r.delta,
    reason: r.reason || '',
  }));
  return toCSV(headers, mapped);
}

function buildFlags(db) {
  const since = daysAgo(7);
  // Negative EXP events = violations/flags
  const rows = db.prepare(`
    SELECT s.name, s.department, el.delta, el.reason, el.created_at
    FROM exp_log el
    JOIN staff s ON s.id = el.staff_id
    WHERE el.delta < 0 AND DATE(el.created_at) >= ?
    ORDER BY el.created_at DESC
  `).all(since);

  const headers = ['date', 'name', 'department', 'exp_penalty', 'reason'];
  const mapped = rows.map(r => ({
    date: r.created_at ? r.created_at.substring(0, 10) : '',
    name: r.name,
    department: r.department || '',
    exp_penalty: r.delta,
    reason: r.reason || '',
  }));
  return toCSV(headers, mapped);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runMasterSheetSync() {
  const sheetId = process.env.MASTER_SHEET_ID;
  if (!sheetId) {
    console.error('[master_sheet] MASTER_SHEET_ID not set in .env — skipping');
    return;
  }

  console.log('[master_sheet] Starting sync —', ictDateStr());
  const db = getDb();

  pushTab(sheetId, 'Staff Overview',    buildStaffOverview(db));
  pushTab(sheetId, 'Attendance Today',  buildAttendanceToday(db));
  pushTab(sheetId, 'EXP Movements',     buildExpMovements(db));
  pushTab(sheetId, 'Flags',             buildFlags(db));

  db.close();
  console.log('[master_sheet] Sync complete —', new Date().toISOString());
}

// ─── Export + CLI ─────────────────────────────────────────────────────────────

module.exports = { runMasterSheetSync };

if (require.main === module) {
  runMasterSheetSync().catch(err => {
    console.error('[master_sheet] Fatal:', err.message);
    process.exit(1);
  });
}
