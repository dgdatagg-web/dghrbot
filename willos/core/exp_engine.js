'use strict';

/**
 * exp_engine.js — HR/EXP Core Engine
 * WillOS v0.2 — HR Layer
 *
 * Handles all EXP logic: event logging, snapshot recalc, alert checks, weekly reset.
 *
 * Anti-exploit rules:
 *  - support_teammate: max 5 per shift, diminishing return (10, 8, 5, 5, 5)
 *  - XP loss per shift capped at -60
 *  - 5% random audit flag on every event
 */

const path = require('path');
const Database = require('better-sqlite3');
const logger = require('./logger');

// ─── Constants ────────────────────────────────────────────────────────────────

const EXP_TABLE = {
  // Positive events
  on_time_checkin:      +5,
  task_completed:       +10,
  customer_compliment:  +20,
  support_teammate:     +10,  // base — diminishing return applied in logEvent
  cleanliness_pass:     +10,
  // Negative events
  late_checkin:         -10,
  order_mistake:        -15,
  customer_complaint:   -20,
  conflict_report:      -15,
  no_show:              -50,
};

const POSITIVE_EVENTS = new Set([
  'on_time_checkin', 'task_completed', 'customer_compliment',
  'support_teammate', 'cleanliness_pass',
]);

const NEGATIVE_EVENTS = new Set([
  'late_checkin', 'order_mistake', 'customer_complaint',
  'conflict_report', 'no_show',
]);

// support_teammate diminishing return table by occurrence index (0-based)
const SUPPORT_DIMINISHING = [10, 8, 5, 5, 5]; // capped at 5 total

const XP_LOSS_PER_SHIFT_CAP = 60;  // max total XP loss per shift
const AUDIT_PROBABILITY = 0.05;    // 5%

// ─── DB singleton ─────────────────────────────────────────────────────────────

let _db = null;

function getDb() {
  if (_db) return _db;
  const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'willos.db');
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  return _db;
}

// Allow caller (e.g. index.js) to inject the shared DB instance
function setDb(db) {
  _db = db;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get Monday of the current week as YYYY-MM-DD string.
 */
function currentWeekStart() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = (day === 0) ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

/**
 * Validate event_type. Returns base xp_delta or throws.
 */
function validateEventType(eventType) {
  if (!(eventType in EXP_TABLE)) {
    const valid = Object.keys(EXP_TABLE).join(', ');
    throw new Error(`Unknown event_type: "${eventType}". Valid: ${valid}`);
  }
  return EXP_TABLE[eventType];
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * logEvent — Insert an EXP event for a staff member.
 *
 * @param {string} staffId — TEXT id (e.g., 'hieu', 'tan')
 * @param {string} eventType
 * @param {string|null} shiftId
 * @param {string} loggedBy — telegram_id or 'system'
 * @returns {{ event_id, xp_delta, audit_flag, snapshot }} or throws
 */
function logEvent(staffId, eventType, shiftId = null, loggedBy = 'system') {
  const db = getDb();

  // Validate event type
  let baseXp = validateEventType(eventType);

  // Verify staff exists
  const staff = db.prepare('SELECT id, active FROM staff WHERE id = ?').get(staffId);
  if (!staff) throw new Error(`Staff ID "${staffId}" not found`);
  if (staff.active === 0) throw new Error(`Staff "${staffId}" is inactive`);

  let xpDelta = baseXp;

  // ── Anti-exploit: support_teammate diminishing return ──
  if (eventType === 'support_teammate' && shiftId) {
    const countInShift = db.prepare(
      `SELECT COUNT(*) as cnt FROM exp_events
       WHERE staff_id = ? AND event_type = 'support_teammate' AND shift_id = ?`
    ).get(staffId, shiftId).cnt;

    if (countInShift >= 5) {
      logger.warn(`[exp_engine] support_teammate cap reached for staff ${staffId} shift ${shiftId}`);
      return { skipped: true, reason: 'support_teammate cap (5/shift) reached' };
    }
    xpDelta = SUPPORT_DIMINISHING[countInShift]; // 0-indexed
  }

  // ── Anti-exploit: XP loss per shift cap ──
  if (NEGATIVE_EVENTS.has(eventType) && shiftId) {
    const currentLoss = db.prepare(
      `SELECT COALESCE(SUM(xp_delta), 0) as total_loss
       FROM exp_events
       WHERE staff_id = ? AND shift_id = ? AND xp_delta < 0`
    ).get(staffId, shiftId).total_loss; // will be negative or 0

    const newTotal = currentLoss + xpDelta;
    if (newTotal < -XP_LOSS_PER_SHIFT_CAP) {
      // Clamp xp_delta so total loss doesn't exceed cap
      xpDelta = Math.max(xpDelta, -(XP_LOSS_PER_SHIFT_CAP + currentLoss));
      if (xpDelta === 0) {
        logger.warn(`[exp_engine] XP loss cap reached for staff ${staffId} shift ${shiftId}`);
        return { skipped: true, reason: 'XP loss cap (-60/shift) reached' };
      }
    }
  }

  // ── 5% random audit flag ──
  const auditFlag = Math.random() < AUDIT_PROBABILITY ? 1 : 0;

  // ── Insert event ──
  const insert = db.prepare(
    `INSERT INTO exp_events (staff_id, event_type, xp_delta, shift_id, logged_by, audit_flag)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const result = insert.run(staffId, eventType, xpDelta, shiftId, loggedBy, auditFlag);
  const eventId = result.lastInsertRowid;

  logger.info(`[exp_engine] Event logged: staff=${staffId} type=${eventType} xp=${xpDelta} shift=${shiftId} audit=${auditFlag}`);

  // ── Update snapshot ──
  const snapshot = recalcSnapshot(staffId);

  // ── Run alert checks ──
  runAlertCheck(staffId, shiftId);

  return { event_id: eventId, xp_delta: xpDelta, audit_flag: auditFlag, snapshot };
}

/**
 * recalcSnapshot — Recompute and upsert exp_snapshot for a staff member.
 *
 * @param {number} staffId
 * @returns {object} snapshot row
 */
function recalcSnapshot(staffId) {
  const db = getDb();
  const weekStart = currentWeekStart();

  // Total XP (lifetime)
  const totalXp = db.prepare(
    `SELECT COALESCE(SUM(xp_delta), 0) as total FROM exp_events WHERE staff_id = ?`
  ).get(staffId).total;

  // Weekly XP
  const weeklyXp = db.prepare(
    `SELECT COALESCE(SUM(xp_delta), 0) as total
     FROM exp_events
     WHERE staff_id = ? AND date(created_at) >= ?`
  ).get(staffId, weekStart).total;

  // Level = floor(total_xp / 100)
  const level = Math.floor(Math.max(0, totalXp) / 100);

  // Performance ratio = positive_events / total_events (exclude meta events)
  const counts = db.prepare(
    `SELECT
       COUNT(*) as total_count,
       SUM(CASE WHEN xp_delta > 0 THEN 1 ELSE 0 END) as positive_count
     FROM exp_events WHERE staff_id = ?
     AND event_type NOT IN ('weekly_reset_archive')`
  ).get(staffId);

  const perfRatio = counts.total_count > 0
    ? counts.positive_count / counts.total_count
    : 0.0;

  // Upsert snapshot
  db.prepare(
    `INSERT INTO exp_snapshot (staff_id, total_xp, weekly_xp, level, performance_ratio, week_start, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(staff_id) DO UPDATE SET
       total_xp = excluded.total_xp,
       weekly_xp = excluded.weekly_xp,
       level = excluded.level,
       performance_ratio = excluded.performance_ratio,
       week_start = excluded.week_start,
       updated_at = excluded.updated_at`
  ).run(staffId, totalXp, weeklyXp, level, perfRatio, weekStart);

  logger.info(`[exp_engine] Snapshot updated: staff=${staffId} total=${totalXp} weekly=${weeklyXp} level=${level} ratio=${perfRatio.toFixed(3)}`);

  return { staff_id: staffId, total_xp: totalXp, weekly_xp: weeklyXp, level, performance_ratio: perfRatio, week_start: weekStart };
}

/**
 * runAlertCheck — Check alert conditions after an event is logged.
 *
 * Conditions:
 *  - 3+ negative events in 1 shift → WARNING: negative_burst
 *  - XP drop > 30 in 24h → WARNING: xp_drop_24h
 *  - 2+ customer_complaint in 1 day → CRITICAL: complaint_critical
 *
 * @param {number} staffId
 * @param {string|null} shiftId
 */
function runAlertCheck(staffId, shiftId = null) {
  const db = getDb();
  const alerts = [];

  // ── Check 1: 3 negative events in 1 shift ──
  if (shiftId) {
    const negativeInShift = db.prepare(
      `SELECT COUNT(*) as cnt FROM exp_events
       WHERE staff_id = ? AND shift_id = ? AND xp_delta < 0`
    ).get(staffId, shiftId).cnt;

    if (negativeInShift >= 3) {
      // Avoid duplicate alert for same shift
      const exists = db.prepare(
        `SELECT id FROM alert_log_hr
         WHERE staff_id = ? AND alert_type = 'negative_burst'
         AND message LIKE ? AND resolved = 0`
      ).get(staffId, `%shift ${shiftId}%`);

      if (!exists) {
        alerts.push({
          staffId, type: 'negative_burst', severity: 'WARNING',
          message: `Staff ${staffId} has ${negativeInShift} negative events in shift ${shiftId}`,
        });
      }
    }
  }

  // ── Check 2: XP drop > 30 in last 24h ──
  const xpLast24h = db.prepare(
    `SELECT COALESCE(SUM(xp_delta), 0) as total
     FROM exp_events
     WHERE staff_id = ? AND created_at >= datetime('now', '-24 hours')`
  ).get(staffId).total;

  if (xpLast24h < -30) {
    const exists = db.prepare(
      `SELECT id FROM alert_log_hr
       WHERE staff_id = ? AND alert_type = 'xp_drop_24h' AND resolved = 0
       AND created_at >= datetime('now', '-6 hours')`
    ).get(staffId);

    if (!exists) {
      alerts.push({
        staffId, type: 'xp_drop_24h', severity: 'WARNING',
        message: `Staff ${staffId} XP dropped ${Math.abs(xpLast24h)} points in last 24h`,
      });
    }
  }

  // ── Check 3: 2+ customer_complaint in 1 day ──
  const complaintsToday = db.prepare(
    `SELECT COUNT(*) as cnt FROM exp_events
     WHERE staff_id = ? AND event_type = 'customer_complaint'
     AND date(created_at) = date('now')`
  ).get(staffId).cnt;

  if (complaintsToday >= 2) {
    const exists = db.prepare(
      `SELECT id FROM alert_log_hr
       WHERE staff_id = ? AND alert_type = 'complaint_critical' AND resolved = 0
       AND date(created_at) = date('now')`
    ).get(staffId);

    if (!exists) {
      alerts.push({
        staffId, type: 'complaint_critical', severity: 'CRITICAL',
        message: `Staff ${staffId} received ${complaintsToday} customer complaints today — CRITICAL`,
      });
    }
  }

  // ── Insert all alerts ──
  const insertAlert = db.prepare(
    `INSERT INTO alert_log_hr (staff_id, alert_type, severity, message)
     VALUES (?, ?, ?, ?)`
  );
  for (const a of alerts) {
    insertAlert.run(a.staffId, a.type, a.severity, a.message);
    logger.warn(`[exp_engine] ALERT [${a.severity}] ${a.message}`);
  }

  return alerts;
}

/**
 * weeklyReset — Reset weekly_xp to 0 for all staff, archive snapshot.
 * Should be called via cron every Monday ~00:01.
 *
 * @returns {{ reset_count, week_archived }}
 */
function weeklyReset() {
  const db = getDb();
  const weekStart = currentWeekStart();

  // Archive current weekly snapshots into exp_events as meta entries
  // (so history is preserved in event log with week markers)
  const snapshots = db.prepare('SELECT * FROM exp_snapshot').all();

  const insertArchive = db.prepare(
    `INSERT INTO exp_events (staff_id, event_type, xp_delta, shift_id, logged_by)
     VALUES (?, 'weekly_reset_archive', 0, ?, 'system')`
  );

  db.transaction(() => {
    for (const snap of snapshots) {
      // Log a zero-delta archive event to mark the week boundary
      insertArchive.run(snap.staff_id, `week_${weekStart}`);
    }

    // Reset weekly_xp in all snapshots
    db.prepare(
      `UPDATE exp_snapshot
       SET weekly_xp = 0, week_start = ?, updated_at = datetime('now')`
    ).run(weekStart);
  })();

  logger.info(`[exp_engine] Weekly reset done. Archived ${snapshots.length} snapshots. New week_start: ${weekStart}`);
  return { reset_count: snapshots.length, week_archived: weekStart };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  setDb,
  getDb,
  logEvent,
  recalcSnapshot,
  runAlertCheck,
  weeklyReset,
  currentWeekStart,
  EXP_TABLE,
  POSITIVE_EVENTS,
  NEGATIVE_EVENTS,
};
