'use strict';

/**
 * esopstatus.js — /esopstatus [tên?]
 *
 * Personal ESOP pool dashboard — green only framing.
 * Staff: sees own share.
 * GM/Creator: can query anyone by name.
 */

const {
  getTotalActiveExp,
  calcPoolShare,
  getCompanyValuation,
  fmtVND,
  fmtPct,
  POOL_TOTAL_EXP,
  EQUITY_PCT,
} = require('../utils/esop');

async function handle(bot, msg, args, db) {
  const chatId     = msg.chat.id;
  const telegramId = String(msg.from.id);
  const actor      = db.getStaffByTelegramId(telegramId);

  if (!actor) return bot.sendMessage(chatId, '❌ Bạn chưa đăng ký.');

  const isPrivileged = ['gm', 'creator'].includes(actor.role);

  // Resolve target
  let target = actor;
  if (args.length > 0 && isPrivileged) {
    const name = args.join(' ').trim();
    target = db.getStaffByName(name);
    if (!target) return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên: ${name}`);
  }

  const totalExp   = getTotalActiveExp(db.getDb());
  const valuation  = getCompanyValuation(db.getDb());
  const { equityPct, sharePct, estimatedValue } = calcPoolShare(target.exp, totalExp, valuation);

  // Weekly gain (current exp - snapshot at week start)
  const weekGain   = Math.max(0, (target.exp || 0) - (target.exp_week_start || 0));
  const monthGain  = Math.max(0, (target.exp || 0) - (target.exp_month_start || 0));

  const SEP = '━━━━━━━━━━━━━━━━━━━━';

  const lines = [
    `🏆 *ESOP Pool — ${target.name}*`,
    SEP,
    ``,
    `⚡ EXP của bạn:    *${(target.exp || 0).toLocaleString('vi-VN')}*`,
    `👥 Tổng EXP hệ thống: ${totalExp.toLocaleString('vi-VN')}`,
    ``,
    `📊 Phần Pool:      *${fmtPct(sharePct)}* / 100% pool`,
    `💎 Cổ phần thực:   *${fmtPct(equityPct)}* của ${EQUITY_PCT}% equity`,
    ``,
  ];

  if (valuation) {
    const noteRow = db.getDb().prepare(`SELECT value FROM bot_settings WHERE key = 'valuation_note'`).get();
    lines.push(`🏢 Định giá hiện tại: ${fmtVND(valuation)}`);
    lines.push(`💰 Giá trị ước tính: *${estimatedValue ? fmtVND(estimatedValue) : '—'}*`);
    if (noteRow) lines.push(`_⚠️ ${noteRow.value}_`);
    lines.push(``);
  } else {
    lines.push(`💰 Giá trị ước tính: Chưa có định giá`);
    lines.push(``);
  }

  lines.push(`📈 *Tích lũy*`);
  lines.push(`   Tuần này:   +${weekGain.toLocaleString('vi-VN')} EXP`);
  lines.push(`   Tháng này:  +${monthGain.toLocaleString('vi-VN')} EXP`);
  lines.push(``);
  lines.push(`🔒 *Lưu ý:* Nếu nghỉ việc, toàn bộ EXP pool sẽ mất.`);
  lines.push(SEP);
  lines.push(`Pool: 1.000.000.000 EXP = ${EQUITY_PCT}% cổ phần công ty`);

  await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
}

module.exports = { handle };
