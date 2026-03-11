'use strict';

/**
 * leaderboard.js — /leaderboard [weekly|monthly|alltime]
 *
 * Three windows:
 *   /lb            → weekly (default) — EXP gained since Monday
 *   /lb monthly    → EXP gained since 1st of month
 *   /lb alltime    → total accumulated EXP
 *
 * Uses exp_log table with date filtering for accurate weekly/monthly.
 * No dependency on snapshot crons — always correct regardless of restarts.
 *
 * Excludes GM/Creator from rankings.
 * Active staff only.
 */

const { getRoleInfo } = require('../utils/roles');

const SEP     = '━━━━━━━━━━━━━━━━━━━━';
const MEDALS  = ['🥇', '🥈', '🥉'];
const LIMIT   = 10;

function getIctNow() {
  return new Date(Date.now() + 7 * 3600000);
}

/**
 * Get start of current week (Monday 00:00 ICT) as ISO string
 */
function getWeekStartISO() {
  const now = getIctNow();
  const day = now.getUTCDay() || 7; // Mon=1, Sun=7
  const mon = new Date(now);
  mon.setUTCDate(now.getUTCDate() - (day - 1));
  mon.setUTCHours(0, 0, 0, 0);
  // Subtract 7h to get UTC equivalent of Monday 00:00 ICT
  const utc = new Date(mon.getTime() - 7 * 3600000);
  return utc.toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Get start of current month (1st 00:00 ICT) as ISO string
 */
function getMonthStartISO() {
  const now = getIctNow();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  // Subtract 7h to get UTC equivalent of 1st 00:00 ICT
  const utc = new Date(first.getTime() - 7 * 3600000);
  return utc.toISOString().replace('T', ' ').slice(0, 19);
}

async function handle(bot, msg, args, db) {
  const chatId = msg.chat.id;
  const mode   = (args[0] || 'weekly').toLowerCase();

  if (!['weekly', 'monthly', 'alltime', 'w', 'm', 'a'].includes(mode)) {
    return bot.sendMessage(chatId,
      `Cách dùng:\n` +
      `/leaderboard          — Tuần này\n` +
      `/leaderboard monthly  — Tháng này\n` +
      `/leaderboard alltime  — All time`
    );
  }

  const isWeekly   = ['weekly', 'w'].includes(mode);
  const isMonthly  = ['monthly', 'm'].includes(mode);
  const isAlltime  = ['alltime', 'a'].includes(mode);

  let staffList;
  let title;
  let subtitle;
  let periodLabel;

  const now = getIctNow();

  if (isAlltime) {
    staffList = db.getDb().prepare(`
      SELECT id, name, username, role, exp, department
      FROM staff
      WHERE status = 'active' AND role NOT IN ('gm', 'creator') AND exp > 0
      ORDER BY exp DESC LIMIT ?
    `).all(LIMIT);
    title      = '🏆 LEADERBOARD — ALL TIME';
    subtitle   = 'Tổng EXP tích lũy';
    periodLabel = 'EXP';

  } else if (isMonthly) {
    const since = getMonthStartISO();
    staffList = db.getDb().prepare(`
      SELECT s.id, s.name, s.username, s.role, s.department,
             COALESCE(SUM(e.delta), 0) AS period_exp
      FROM staff s
      LEFT JOIN exp_log e ON e.staff_id = s.id AND e.created_at >= ?
      WHERE s.status = 'active' AND s.role NOT IN ('gm', 'creator')
      GROUP BY s.id
      HAVING period_exp > 0
      ORDER BY period_exp DESC LIMIT ?
    `).all(since, LIMIT);
    title      = `📅 LEADERBOARD — THÁNG ${now.getUTCMonth() + 1}/${now.getUTCFullYear()}`;
    subtitle   = `EXP kiếm từ ngày 01/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    periodLabel = 'EXP tháng này';

  } else {
    // Weekly — EXP since Monday
    const since = getWeekStartISO();
    staffList = db.getDb().prepare(`
      SELECT s.id, s.name, s.username, s.role, s.department,
             COALESCE(SUM(e.delta), 0) AS period_exp
      FROM staff s
      LEFT JOIN exp_log e ON e.staff_id = s.id AND e.created_at >= ?
      WHERE s.status = 'active' AND s.role NOT IN ('gm', 'creator')
      GROUP BY s.id
      HAVING period_exp > 0
      ORDER BY period_exp DESC LIMIT ?
    `).all(since, LIMIT);

    // Get Monday date for display
    const day   = now.getUTCDay() || 7;
    const mon   = new Date(now);
    mon.setUTCDate(now.getUTCDate() - (day - 1));
    const monStr = `${String(mon.getUTCDate()).padStart(2, '0')}-${String(mon.getUTCMonth() + 1).padStart(2, '0')}`;
    title      = `📅 LEADERBOARD — TUẦN NÀY`;
    subtitle   = `EXP kiếm từ ${monStr} đến hôm nay`;
    periodLabel = 'EXP tuần này';
  }

  if (!staffList || staffList.length === 0) {
    return bot.sendMessage(chatId,
      `${title}\n${SEP}\nChưa có dữ liệu cho kỳ này.\n\n` +
      `Dùng /leaderboard alltime để xem tổng.`
    );
  }

  const lines = [title, subtitle, SEP, ''];

  staffList.forEach((s, i) => {
    const role   = getRoleInfo(s.role);
    const medal  = MEDALS[i] || `${i + 1}.`;
    const expVal = isAlltime ? s.exp : (s.period_exp || 0);
    lines.push(`${medal} ${role.icon} ${s.name} — ${expVal.toLocaleString('vi-VN')} ${periodLabel}`);
  });

  lines.push('');
  lines.push(SEP);

  // Tab hint — tappable commands on separate lines
  lines.push('');
  if (!isMonthly) lines.push(`📅 /lb monthly — xem tháng này`);
  if (!isAlltime) lines.push(`🏆 /lb alltime — xem tổng tích lũy`);
  if (!isWeekly)  lines.push(`📅 /lb — xem tuần này`);

  return bot.sendMessage(chatId, lines.join('\n'));
}

module.exports = { handle };
