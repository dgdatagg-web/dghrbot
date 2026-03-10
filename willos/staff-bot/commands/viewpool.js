'use strict';

/**
 * viewpool.js — /viewpool
 * GM/Creator: full ESOP EXP pool snapshot.
 * Shows every active staff member's EXP share and equity %.
 */

const {
  getFullPoolSnapshot,
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

  if (!actor || !['gm', 'creator'].includes(actor.role)) {
    return bot.sendMessage(chatId, '❌ Chỉ GM và Creator mới xem được.');
  }

  const snapshot  = getFullPoolSnapshot(db.getDb());
  const valuation = getCompanyValuation(db.getDb());

  if (!snapshot.length) {
    return bot.sendMessage(chatId, '📭 Chưa có nhân viên nào có EXP trong hệ thống.');
  }

  const totalExp = snapshot[0]?.totalExp || 0;
  const SEP = '━━━━━━━━━━━━━━━━━━━━';
  const noteRow = valuation
    ? db.getDb().prepare(`SELECT value FROM bot_settings WHERE key = 'valuation_note'`).get()
    : null;

  const lines = [
    `📊 *ESOP EXP Pool — Toàn Hệ Thống*`,
    SEP,
    `Pool: 1.000.000.000 EXP = ${EQUITY_PCT}% equity`,
    `Tổng EXP đang hoạt động: ${totalExp.toLocaleString('vi-VN')}`,
    valuation ? `Định giá công ty: ${fmtVND(valuation)}` : `Định giá: chưa đặt`,
    SEP,
    ``,
  ];

  const medals = ['🥇', '🥈', '🥉'];

  snapshot.forEach((s, i) => {
    const rank   = medals[i] || `${i + 1}.`;
    const valStr = s.estimatedValue ? ` ≈ ${fmtVND(s.estimatedValue)}` : '';
    lines.push(`${rank} ${s.name}`);
    lines.push(`   ⚡ ${s.exp.toLocaleString('vi-VN')} EXP — ${fmtPct(s.equityPct)} equity${valStr}`);
  });

  lines.push(``);
  lines.push(SEP);
  lines.push(`${snapshot.length} nhân viên đang giữ EXP pool`);
  if (noteRow) lines.push(`\n_⚠️ ${noteRow.value}_`);
  if (!valuation) {
    lines.push(`💡 Dùng /setvaluation [số] để đặt định giá công ty`);
  }

  await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
}

module.exports = { handle };
