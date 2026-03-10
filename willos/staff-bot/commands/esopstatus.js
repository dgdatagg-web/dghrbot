// esopstatus.js
// /esopstatus [tên?] — View ESOP status.
// Staff: sees own seat only.
// GM/Creator: can query anyone by name.

'use strict';

async function handle(bot, msg, args, db) {
  const chatId     = msg.chat.id;
  const telegramId = String(msg.from.id);
  const actor      = db.getStaffByTelegramId(telegramId);

  if (!actor) {
    return bot.sendMessage(chatId, '❌ Bạn chưa đăng ký.');
  }

  const isPrivileged = ['gm', 'creator'].includes(actor.role);

  // Resolve target
  let target;
  if (args.length > 0 && isPrivileged) {
    const name = args.join(' ').trim();
    target = db.getStaffByName(name);
    if (!target) return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên: ${name}`);
  } else {
    target = actor;
  }

  const seat = db.getEsopSeat(target.id);
  if (!seat) {
    return bot.sendMessage(
      chatId,
      target.id === actor.id
        ? '📭 Bạn chưa có ESOP seat.'
        : `📭 ${target.name} chưa có ESOP seat.`
    );
  }

  // Current period YYYY-MM
  const now    = new Date(Date.now() + 7 * 3600000);
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // KPI scores joined with labels
  const kpiRows = db.getDb().prepare(`
    SELECT ks.kpi_key, ks.score, ks.period, kc.label, kc.weight
    FROM esop_kpi_scores ks
    LEFT JOIN esop_kpi_config kc
      ON ks.kpi_key = kc.kpi_key AND ks.dept_id = kc.dept_id
    WHERE ks.staff_id = ? AND ks.period = ?
    ORDER BY kc.weight DESC
  `).all(target.id, period) || [];

  const cliffIcon = (unlocked) => unlocked ? '✅ Đã mở' : '🔒 Chưa mở';

  let text =
    `📊 *ESOP — ${target.name}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🏢 Dept: ${seat.dept_id}\n` +
    `📈 Cổ phần: *${seat.share_pct}%*\n` +
    `📅 Vesting từ: ${seat.vesting_start}\n\n` +
    `*Cliff unlock:*\n` +
    `  Năm 1: ${cliffIcon(seat.cliff1_unlocked)}\n` +
    `  Năm 2: ${cliffIcon(seat.cliff2_unlocked)}\n` +
    `  Năm 3: ${cliffIcon(seat.cliff3_unlocked)}\n`;

  if (kpiRows.length) {
    text += `\n*KPI tháng ${period}:*\n`;
    for (const k of kpiRows) {
      const label = k.label || k.kpi_key;
      const weight = k.weight != null ? ` (×${k.weight})` : '';
      text += `  • ${label}${weight}: *${k.score}*\n`;
    }
  } else {
    text += `\n_Chưa có điểm KPI tháng ${period}._\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━`;

  await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

module.exports = { handle };
