'use strict';

/**
 * api/hr.js — HR Engine API Routes
 * WillOS v0.2
 *
 * Routes:
 *   POST /api/hr/event          — log EXP event
 *   GET  /api/hr/staff/:id      — staff profile + snapshot
 *   GET  /api/hr/leaderboard    — weekly ranking
 *   GET  /api/hr/alerts         — active HR alerts
 *   POST /api/hr/staff          — create staff member
 *   POST /api/hr/weekly-reset   — trigger weekly XP reset (owner only)
 */

const { logEvent, recalcSnapshot, weeklyReset } = require('../core/exp_engine');
const logger = require('../core/logger');

function mount(app, db) {

  // ── POST /api/hr/event ────────────────────────────────────────────────────
  // Body: { staff_id, event_type, shift_id?, logged_by? }
  app.post('/api/hr/event', (req, res) => {
    const { staff_id, event_type, shift_id = null, logged_by = 'system' } = req.body;

    if (!staff_id || !event_type) {
      return res.status(400).json({ error: 'staff_id and event_type are required' });
    }

    try {
      // Ensure engine uses the shared DB
      require('../core/exp_engine').setDb(db);
      const result = logEvent(String(staff_id), event_type, shift_id, String(logged_by));

      if (result.skipped) {
        return res.status(200).json({ status: 'skipped', ...result });
      }

      return res.status(201).json({ status: 'ok', ...result });
    } catch (err) {
      logger.error(`[api/hr] POST /event error: ${err.message}`);
      return res.status(400).json({ error: err.message });
    }
  });

  // ── GET /api/hr/staff/:id ─────────────────────────────────────────────────
  // Returns staff profile + current EXP snapshot + recent events
  app.get('/api/hr/staff/:id', (req, res) => {
    const staffId = Number(req.params.id);

    const staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(staffId);
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    const snapshot = db.prepare(
      'SELECT * FROM exp_snapshot WHERE staff_id = ?'
    ).get(staffId);

    const recentEvents = db.prepare(
      `SELECT * FROM exp_events WHERE staff_id = ?
       ORDER BY created_at DESC LIMIT 20`
    ).all(staffId);

    return res.json({ staff, snapshot: snapshot || null, recent_events: recentEvents });
  });

  // ── GET /api/hr/leaderboard ───────────────────────────────────────────────
  // Weekly ranking by weekly_xp DESC
  // Query params: limit (default 10)
  app.get('/api/hr/leaderboard', (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    const rows = db.prepare(
      `SELECT s.id, s.name, s.role,
              COALESCE(e.total_xp, 0) as total_xp,
              COALESCE(e.weekly_xp, 0) as weekly_xp,
              COALESCE(e.level, 0) as level,
              COALESCE(e.performance_ratio, 0) as performance_ratio,
              e.week_start
       FROM staff s
       LEFT JOIN exp_snapshot e ON s.id = e.staff_id
       WHERE s.active = 1
       ORDER BY weekly_xp DESC, total_xp DESC
       LIMIT ?`
    ).all(limit);

    return res.json({
      week_start: rows[0]?.week_start || null,
      count: rows.length,
      leaderboard: rows,
    });
  });

  // ── GET /api/hr/alerts ────────────────────────────────────────────────────
  // Active (unresolved) HR alerts
  // Query params: severity (optional), staff_id (optional), include_resolved (optional)
  app.get('/api/hr/alerts', (req, res) => {
    const { severity, staff_id, include_resolved } = req.query;

    let query = `
      SELECT a.*, s.name as staff_name
      FROM alert_log_hr a
      LEFT JOIN staff s ON a.staff_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (!include_resolved) {
      query += ' AND a.resolved = 0';
    }
    if (severity) {
      query += ' AND a.severity = ?';
      params.push(severity.toUpperCase());
    }
    if (staff_id) {
      query += ' AND a.staff_id = ?';
      params.push(Number(staff_id));
    }

    query += ' ORDER BY a.created_at DESC LIMIT 100';

    const alerts = db.prepare(query).all(...params);
    return res.json({ count: alerts.length, alerts });
  });

  // ── POST /api/hr/staff ────────────────────────────────────────────────────
  // Create a new staff member
  // Body: { id, name, telegram_id?, role?, dept? }
  app.post('/api/hr/staff', (req, res) => {
    const { id, name, telegram_id = null, role = 'staff', dept = null } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!id) return res.status(400).json({ error: 'id (slug) is required e.g. "hieu"' });

    try {
      const result = db.prepare(
        `INSERT INTO staff (id, name, telegram_id, role, dept) VALUES (?, ?, ?, ?, ?)`
      ).run(id, name, telegram_id, role, dept);

      // Init empty snapshot
      require('../core/exp_engine').setDb(db);
      recalcSnapshot(String(id));

      const staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(id);
      return res.status(201).json({ status: 'ok', staff });
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Staff ID or telegram_id already registered' });
      }
      logger.error(`[api/hr] POST /staff error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/hr/weekly-reset ─────────────────────────────────────────────
  // Trigger weekly XP reset (protect with simple token if needed)
  app.post('/api/hr/weekly-reset', (req, res) => {
    try {
      require('../core/exp_engine').setDb(db);
      const result = weeklyReset();
      return res.json({ status: 'ok', ...result });
    } catch (err) {
      logger.error(`[api/hr] weekly-reset error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /api/hr/alerts/:id/resolve ─────────────────────────────────────
  app.patch('/api/hr/alerts/:id/resolve', (req, res) => {
    const alertId = Number(req.params.id);
    const result = db.prepare(
      `UPDATE alert_log_hr SET resolved = 1 WHERE id = ?`
    ).run(alertId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    return res.json({ status: 'ok', resolved: alertId });
  });

  logger.info('HR API routes mounted: /api/hr/*');
}

module.exports = { mount };
