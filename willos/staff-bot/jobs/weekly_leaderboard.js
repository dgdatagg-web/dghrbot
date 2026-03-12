/**
 * weekly_leaderboard.js — Weekly Leaderboard Job
 * Kai Sprint 1 — DG Group Analytics Pipeline
 *
 * Chạy thứ Hai 08:00 ICT.
 * Post vào topic 172 của GROUP_CHAT_ID.
 */

'use strict';

const { broadcastEvent } = require('../utils/groups');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get current date in ICT (UTC+7) as YYYY-MM-DD
 */
function getIctDate() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
}

/**
 * Get ICT time as { hours, minutes, dayOfWeek }
 * dayOfWeek: 0=Sunday, 1=Monday, ..., 6=Saturday
 */
function getIctTime() {
  const ict = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return {
    hours:     ict.getUTCHours(),
    minutes:   ict.getUTCMinutes(),
    dayOfWeek: ict.getUTCDay(),
  };
}

/**
 * Get ISO week number from a Date object (UTC).
 * Returns "WW" zero-padded.
 */
function getIsoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${String(weekNo).padStart(2, '0')}`;
}

/**
 * Get week label like "09/2026" from ICT now.
 */
function getCurrentWeekLabel() {
  const ict = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const week = getIsoWeekNumber(ict);
  return `${week}/${ict.getUTCFullYear()}`;
}

/**
 * Get date range for the past 7 days (relative to today ICT).
 * Returns { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } where end = yesterday.
 */
function getLast7DayRange() {
  const now = Date.now() + 7 * 60 * 60 * 1000;
  const end   = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // yesterday
  const start = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 7 days ago
  return { start, end };
}

// ─── Leaderboard Builder ──────────────────────────────────────────────────────

/**
 * Build the weekly leaderboard message.
 */
async function buildWeeklyLeaderboardMessage(db) {
  const weekLabel = getCurrentWeekLabel();
  const { start, end } = getLast7DayRange();

  // ── Get all active staff sorted by EXP desc ──
  let staffList = [];
  try {
    staffList = db.prepare("SELECT * FROM staff WHERE status = 'active' AND role NOT IN ('gm', 'creator') ORDER BY exp DESC").all() || [];
  } catch (e) {
    console.error('[Leaderboard] Failed to query staff:', e.message);
    return `🏆 BẢNG XẾP HẠNG TUẦN ${weekLabel}\n━━━━━━━━━━━━━━━━━━━━\n(Lỗi tải dữ liệu)`;
  }

  if (staffList.length === 0) {
    return `🏆 BẢNG XẾP HẠNG TUẦN ${weekLabel}\n━━━━━━━━━━━━━━━━━━━━\n(Chưa có nhân viên nào)`;
  }

  // ── Count reports per staff for last 7 days ──
  // Max possible = 3 types × 7 days = 21 reports
  const reportCountMap = {};
  try {
    const rows = db.prepare(`
      SELECT sr.staff_id, COUNT(*) as cnt
      FROM shift_report sr
      WHERE sr.date >= ? AND sr.date <= ?
      GROUP BY sr.staff_id
    `).all(start, end) || [];
    for (const r of rows) {
      reportCountMap[r.staff_id] = r.cnt;
    }
  } catch (e) {
    console.error('[Leaderboard] Failed to query shift_report:', e.message);
  }

  const MAX_REPORTS = 3 * 7; // 21

  // ── Check zero-waste (no huy_hang in the past 7 days) ──
  const huyHangStaffIds = new Set();
  try {
    const rows = db.prepare(`
      SELECT DISTINCT staff_id FROM huy_hang_log WHERE date >= ? AND date <= ?
    `).all(start, end) || [];
    for (const r of rows) huyHangStaffIds.add(r.staff_id);
  } catch (e) { /* ignore */ }

  // ── EXP gained in the last 7 days per staff ──
  const expGainedMap = {};
  try {
    const rows = db.prepare(`
      SELECT staff_id, SUM(delta) as gained
      FROM exp_log
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY staff_id
    `).all(`${start} 00:00:00`, `${end} 23:59:59`) || [];
    for (const r of rows) {
      expGainedMap[r.staff_id] = r.gained || 0;
    }
  } catch (e) { /* ignore */ }

  // ── Build ranked list ──
  const lines = [];
  lines.push(`🏆 BẢNG XẾP HẠNG TUẦN ${weekLabel}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);

  const medals = ['🥇', '🥈', '🥉'];

  for (let i = 0; i < staffList.length; i++) {
    const s = staffList[i];
    const rank = i + 1;
    const medal = medals[i] || `${rank}.`;
    const streakStr = s.streak > 0
      ? (s.streak >= 5 ? ` | 🔥 ${s.streak} ngày streak` : ` | ${s.streak} ngày streak`)
      : '';
    lines.push(`${medal} ${s.name} — ${s.exp} EXP${streakStr}`);
  }

  // ── Weekly highlights ──
  lines.push('');
  lines.push('📋 TUẦN NÀY:');

  // Most complete reports
  let reportChamp = null;
  let reportChampCount = 0;
  for (const s of staffList) {
    const cnt = reportCountMap[s.id] || 0;
    if (cnt > reportChampCount) {
      reportChampCount = cnt;
      reportChamp = s;
    }
  }
  if (reportChamp) {
    lines.push(`• Báo cáo đầy đủ nhất: ${reportChamp.name} (${reportChampCount}/${MAX_REPORTS})`);
  }

  // Zero waste (no huy_hang)
  const zeroWasteStaff = staffList.filter(s => !huyHangStaffIds.has(s.id));
  if (zeroWasteStaff.length > 0) {
    lines.push(`• Zero waste: ${zeroWasteStaff.map(s => `${s.name} ⭐`).join(', ')}`);
  }

  // Most improved (highest EXP gained this week)
  let mostImproved = null;
  let mostImprovedGain = 0;
  for (const s of staffList) {
    const gained = expGainedMap[s.id] || 0;
    if (gained > mostImprovedGain) {
      mostImprovedGain = gained;
      mostImproved = s;
    }
  }
  if (mostImproved && mostImprovedGain > 0) {
    lines.push(`• Cải thiện nhiều nhất: ${mostImproved.name} +${mostImprovedGain} EXP`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━`);

  return lines.join('\n');
}

// ─── Job Starter ──────────────────────────────────────────────────────────────

/**
 * Start the weekly leaderboard job.
 * Uses setInterval (every minute) to check if it's Monday 08:00 ICT.
 * Uses firedJobs map to prevent double-firing on the same week.
 *
 * @param {TelegramBot} bot
 * @param {object} dbModule - the db module (from require('./db'))
 * @param {Map} [firedJobs] - optional shared Map for job dedup
 */
function startWeeklyLeaderboardJob(bot, dbModule, firedJobs) {
  if (!firedJobs) {
    firedJobs = new Map();
  }

  const TOPIC_ID = 172;

  const TARGET_HOUR      = 8;
  const TARGET_MINUTE    = 0;
  const TARGET_DAYS      = [1, 5]; // Monday + Friday

  setInterval(async () => {
    const { hours, minutes, dayOfWeek } = getIctTime();
    if (!TARGET_DAYS.includes(dayOfWeek) || hours !== TARGET_HOUR || minutes !== TARGET_MINUTE) return;

    const date = getIctDate();
    const jobKey = `weekly_leaderboard_${date}`;
    if (firedJobs.get(jobKey)) return;
    firedJobs.set(jobKey, true);

    console.log(`[JOB] weekly_leaderboard firing for week of ${date}`);

    try {
      const rawDb = dbModule.getDb();
      const message = await buildWeeklyLeaderboardMessage(rawDb);
      await broadcastEvent(bot, 'weekly_leaderboard', message);
      console.log(`[JOB] weekly_leaderboard sent to MANAGERS group`);
    } catch (err) {
      console.error('[JOB] weekly_leaderboard error:', err.message);
      firedJobs.delete(jobKey); // allow retry
    }
  }, 60 * 1000);

  console.log('[JOB] weekly_leaderboard scheduled — fires Mon + Fri 08:00 ICT');
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  startWeeklyLeaderboardJob,
  buildWeeklyLeaderboardMessage,
};
