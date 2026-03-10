/**
 * api/exp.js — WillOS EXP System API
 *
 * GET  /api/exp/staff       — all staff with EXP data
 * GET  /api/exp/leaderboard — top 10 by weekly XP
 * POST /api/exp/log         — log 1 XP event (auth: logged_by required)
 * GET  /api/exp/alerts      — active (unresolved) alerts
 *
 * Anti-exploit rules enforced on POST /api/exp/log:
 *   - Max cumulative negative XP per shift: -60
 *   - Same event type capped at 5 per shift
 *   - Diminishing returns: same positive event in same shift → 50% xp_actual
 */

'use strict';

const express = require('express');
const router  = express.Router();

// XP values per event type
const XP_TABLE = {
  checkin_ontime:       5,
  task_complete:        10,
  customer_compliment:  20,
  peer_support:         10,
  hygiene_pass:         10,
  late:                 -10,
  wrong_order:          -15,
  customer_complaint:   -20,
  conflict:             -15,
  no_show:              -50,
};

const POSITIVE_EVENTS = new Set(['checkin_ontime','task_complete','customer_compliment','peer_support','hygiene_pass']);
const NEGATIVE_EVENTS = new Set(['late','wrong_order','customer_complaint','conflict','no_show']);

const MAX_NEGATIVE_XP_PER_SHIFT = -60;
const MAX_SAME_TYPE_PER_SHIFT    = 5;

/**
 * @param {import('express').Express} app
 * @param {import('better-sqlite3').Database} db
 */
function mount(app, db) {

  // ── GET /api/exp/staff ──────────────────────────────────────────
  app.get('/api/exp/staff', (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT
          s.id, s.name, s.role, s.dept, s.emoji, s.color, s.active,
          e.total_xp, e.weekly_xp, e.level, e.performance_ratio,
          e.positive_events, e.negative_events, e.updated_at
        FROM staff s
        LEFT JOIN staff_exp e ON s.id = e.staff_id
        WHERE s.active = 1
        ORDER BY e.total_xp DESC
      `).all();
      res.json({ ok: true, data: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── GET /api/exp/leaderboard ────────────────────────────────────
  app.get('/api/exp/leaderboard', (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);
      const rows = db.prepare(`
        SELECT
          s.id, s.name, s.emoji, s.color, s.dept, s.role,
          e.weekly_xp, e.total_xp, e.level, e.performance_ratio
        FROM staff s
        JOIN staff_exp e ON s.id = e.staff_id
        WHERE s.active = 1
        ORDER BY e.weekly_xp DESC
        LIMIT ?
      `).all(limit);
      res.json({ ok: true, data: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── POST /api/exp/log ───────────────────────────────────────────
  app.post('/api/exp/log', (req, res) => {
    const { staff_id, event_type, shift_id, logged_by, note } = req.body || {};

    if (!staff_id)   return res.status(400).json({ ok: false, error: 'staff_id required' });
    if (!event_type) return res.status(400).json({ ok: false, error: 'event_type required' });
    if (!logged_by)  return res.status(400).json({ ok: false, error: 'logged_by required (auth)' });

    const xp_delta = XP_TABLE[event_type];
    if (xp_delta === undefined)
      return res.status(400).json({ ok: false, error: `Unknown event_type: ${event_type}. Valid: ${Object.keys(XP_TABLE).join(', ')}` });

    // Verify staff exists
    const staff = db.prepare('SELECT id FROM staff WHERE id = ? AND active = 1').get(staff_id);
    if (!staff) return res.status(404).json({ ok: false, error: `Staff not found: ${staff_id}` });

    try {
      let xp_actual = xp_delta;

      // Anti-exploit: shift-scoped checks
      if (shift_id) {
        // 1. Max negative XP per shift = -60
        if (NEGATIVE_EVENTS.has(event_type)) {
          const negRow = db.prepare(`
            SELECT COALESCE(SUM(xp_actual), 0) as total
            FROM exp_events
            WHERE staff_id = ? AND shift_id = ? AND xp_actual < 0
          `).get(staff_id, shift_id);
          const currentNeg = negRow.total || 0;
          if (currentNeg <= MAX_NEGATIVE_XP_PER_SHIFT) {
            // Already maxed out, cap to 0
            xp_actual = 0;
          } else {
            // Don't exceed -60 total
            xp_actual = Math.max(xp_delta, MAX_NEGATIVE_XP_PER_SHIFT - currentNeg);
          }
        }

        // 2. Same event type capped at MAX_SAME_TYPE_PER_SHIFT
        const countRow = db.prepare(`
          SELECT COUNT(*) as cnt
          FROM exp_events
          WHERE staff_id = ? AND shift_id = ? AND event_type = ?
        `).get(staff_id, shift_id, event_type);

        if (countRow.cnt >= MAX_SAME_TYPE_PER_SHIFT) {
          return res.status(400).json({
            ok: false,
            error: `Anti-exploit: ${event_type} already logged ${countRow.cnt} times this shift (max ${MAX_SAME_TYPE_PER_SHIFT})`,
            capped: true
          });
        }

        // 3. Diminishing returns: same positive event in same shift → 50% xp
        if (POSITIVE_EVENTS.has(event_type) && countRow.cnt > 0) {
          xp_actual = Math.floor(xp_actual * 0.5);
        }
      }

      // Write event + update staff_exp atomically
      const logAndUpdate = db.transaction(() => {
        // Insert event
        db.prepare(`
          INSERT INTO exp_events (staff_id, event_type, xp_delta, xp_actual, shift_id, logged_by, note)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(staff_id, event_type, xp_delta, xp_actual, shift_id || null, logged_by, note || null);

        const isPos = xp_actual > 0 ? 1 : 0;
        const isNeg = xp_actual < 0 ? 1 : 0;

        // Update staff_exp
        db.prepare(`
          INSERT INTO staff_exp (staff_id, total_xp, weekly_xp, level, positive_events, negative_events, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(staff_id) DO UPDATE SET
            total_xp         = total_xp + excluded.total_xp,
            weekly_xp        = weekly_xp + excluded.weekly_xp,
            level            = (total_xp + excluded.total_xp) / 100,
            positive_events  = positive_events + excluded.positive_events,
            negative_events  = negative_events + excluded.negative_events,
            updated_at       = datetime('now')
        `).run(staff_id, xp_actual, xp_actual, 0, isPos, isNeg);

        // Re-compute performance_ratio
        const expRow = db.prepare('SELECT positive_events, negative_events FROM staff_exp WHERE staff_id = ?').get(staff_id);
        if (expRow) {
          const total = expRow.positive_events + expRow.negative_events;
          const ratio = total > 0 ? expRow.positive_events / total : 1.0;
          db.prepare('UPDATE staff_exp SET performance_ratio = ? WHERE staff_id = ?').run(ratio, staff_id);
        }

        // Check alert triggers
        checkAlerts(db, staff_id, shift_id);

        return db.prepare('SELECT * FROM staff_exp WHERE staff_id = ?').get(staff_id);
      });

      const updated = logAndUpdate();
      res.json({
        ok: true,
        event_type,
        xp_delta,
        xp_actual,
        staff_exp: updated,
        capped: xp_actual !== xp_delta,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── GET /api/exp/alerts ─────────────────────────────────────────
  app.get('/api/exp/alerts', (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT a.*, s.name, s.emoji, s.dept
        FROM exp_alerts a
        JOIN staff s ON a.staff_id = s.id
        WHERE a.resolved = 0
        ORDER BY a.created_at DESC
        LIMIT 50
      `).all();
      res.json({ ok: true, data: rows });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });
}

// ── Alert checker (called after each event log) ────────────────────
function checkAlerts(db, staff_id, shift_id) {
  // 1. 3+ negative events per shift → WARNING
  if (shift_id) {
    const negCount = db.prepare(`
      SELECT COUNT(*) as cnt FROM exp_events
      WHERE staff_id = ? AND shift_id = ? AND xp_actual < 0
    `).get(staff_id, shift_id);
    if (negCount.cnt >= 3) {
      // Only insert if not already have this alert for this shift
      const existing = db.prepare(`
        SELECT id FROM exp_alerts
        WHERE staff_id = ? AND alert_type = 'WARNING' AND reason LIKE ? AND resolved = 0
      `).get(staff_id, `%shift ${shift_id}%`);
      if (!existing) {
        db.prepare(`
          INSERT INTO exp_alerts (staff_id, alert_type, reason)
          VALUES (?, 'WARNING', ?)
        `).run(staff_id, `3+ negative events in shift ${shift_id}`);
      }
    }
  }

  // 2. XP drop > 30 in last 24h → WARNING
  const xpDropRow = db.prepare(`
    SELECT COALESCE(SUM(xp_actual), 0) as total
    FROM exp_events
    WHERE staff_id = ?
      AND xp_actual < 0
      AND timestamp >= datetime('now', '-24 hours')
  `).get(staff_id);
  if (xpDropRow.total <= -30) {
    const existing = db.prepare(`
      SELECT id FROM exp_alerts
      WHERE staff_id = ? AND alert_type = 'WARNING' AND reason LIKE '%XP drop%' AND resolved = 0
        AND created_at >= datetime('now', '-24 hours')
    `).get(staff_id);
    if (!existing) {
      db.prepare(`
        INSERT INTO exp_alerts (staff_id, alert_type, reason)
        VALUES (?, 'WARNING', ?)
      `).run(staff_id, `XP drop > 30 in last 24h (${xpDropRow.total} XP)`);
    }
  }

  // 3. 2+ customer_complaint in 24h → CRITICAL
  const complaintRow = db.prepare(`
    SELECT COUNT(*) as cnt FROM exp_events
    WHERE staff_id = ?
      AND event_type = 'customer_complaint'
      AND timestamp >= datetime('now', '-24 hours')
  `).get(staff_id);
  if (complaintRow.cnt >= 2) {
    const existing = db.prepare(`
      SELECT id FROM exp_alerts
      WHERE staff_id = ? AND alert_type = 'CRITICAL' AND reason LIKE '%complaints%' AND resolved = 0
        AND created_at >= datetime('now', '-24 hours')
    `).get(staff_id);
    if (!existing) {
      db.prepare(`
        INSERT INTO exp_alerts (staff_id, alert_type, reason)
        VALUES (?, 'CRITICAL', ?)
      `).run(staff_id, `${complaintRow.cnt} customer complaints in 24h`);
    }
  }
}

module.exports = { mount };
