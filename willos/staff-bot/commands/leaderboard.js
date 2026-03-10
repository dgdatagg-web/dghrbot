'use strict';

/**
 * leaderboard.js — /leaderboard [weekly|monthly|alltime]
 *
 * Three windows:
 *   /lb            → weekly (default) — EXP gained since Monday
 *   /lb monthly    → EXP gained since 1st of month
 *   /lb alltime    → total accumulated EXP
 *
 * Excludes GM/Creator from rankings.
 * Active staff only.
 */

const { getRoleInfo } = require('../utils/roles');

const SEP     = '━━━━━━━━━━━━━━━━━━━━';
const MEDALS  = ['🥇', '🥈', '🥉'];
const LIMIT   = 10;

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

  const ict = () => new Date(Date.now() + 7 * 3600000);

  if (isAlltime) {
    staffList = db.getDb().prepare(`
      SELECT id, name, username, role, exp, department
      FROM staff
      WHERE status = 'active' AND role NOT IN ('gm', 'creator') AND exp > 0
      ORDER BY exp DESC LIMIT ?
    `).all(LIMIT);
    title    = '🏆 LEADERBOARD — ALL TIME';
    subtitle = 'Tổng EXP tích lũy từ trước đến nay';

  } else if (isMonthly) {
    staffList = db.getDb().prepare(`
      SELECT id, name, username, role, exp, exp_month_start, department,
             MAX(0, exp - COALESCE(exp_month_start, 0)) AS period_exp
      FROM staff
      WHERE status = 'active' AND role NOT IN ('gm', 'creator')
        AND (exp - COALESCE(exp_month_start, 0)) > 0
      ORDER BY period_exp DESC LIMIT ?
    `).all(LIMIT);
    const now = ict();
    title    = `📅 LEADERBOARD — THÁNG ${now.getMonth() + 1}/${now.getFullYear()}`;
    subtitle = `EXP kiếm từ ngày 1/${now.getMonth() + 1}`;

  } else {
    // Weekly — EXP since Monday
    staffList = db.getDb().prepare(`
      SELECT id, name, username, role, exp, exp_week_start, department,
             MAX(0, exp - COALESCE(exp_week_start, 0)) AS period_exp
      FROM staff
      WHERE status = 'active' AND role NOT IN ('gm', 'creator')
        AND (exp - COALESCE(exp_week_start, 0)) > 0
      ORDER BY period_exp DESC LIMIT ?
    `).all(LIMIT);

    // Get Monday date
    const now   = ict();
    const day   = now.getDay() || 7;
    const mon   = new Date(now);
    mon.setDate(now.getDate() - (day - 1));
    const monStr = mon.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    title    = `📅 LEADERBOARD — TUẦN NÀY`;
    subtitle = `EXP kiếm từ ${monStr} đến hôm nay`;
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
    const suffix = isAlltime ? 'EXP' : 'EXP tuần này';
    lines.push(`${medal} ${role.icon} ${s.name} — ${expVal.toLocaleString('vi-VN')} ${suffix}`);
  });

  lines.push('');
  lines.push(SEP);

  // Tab hint
  const hints = [];
  if (!isWeekly)  hints.push('/lb — tuần');
  if (!isMonthly) hints.push('/lb monthly — tháng');
  if (!isAlltime) hints.push('/lb alltime — all time');
  if (hints.length) lines.push(`💡 ${hints.join('  ·  ')}`);

  return bot.sendMessage(chatId, lines.join('\n'));
}

module.exports = { handle };
