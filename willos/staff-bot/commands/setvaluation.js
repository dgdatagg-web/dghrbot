'use strict';

/**
 * setvaluation.js — /setvaluation [số]
 * Creator only. Sets company valuation in VND for ESOP estimated value calculations.
 *
 * /setvaluation 50000000000   → 50 tỷ VND
 * /setvaluation               → view current valuation
 */

const { getCompanyValuation, setCompanyValuation, fmtVND } = require('../utils/esop');

function isCreator(role, telegramId) {
  const ids = (process.env.CREATOR_IDS || process.env.CREATOR_TELEGRAM_ID || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  return role === 'creator' || ids.includes(String(telegramId));
}

async function handle(bot, msg, args, db) {
  const chatId     = msg.chat.id;
  const telegramId = String(msg.from.id);
  const actor      = db.getStaffByTelegramId(telegramId);
  const creatorCaller = isCreator(actor?.role, telegramId);

  if (!creatorCaller) {
    return bot.sendMessage(chatId, '❌ Chỉ Creator mới có thể đặt định giá công ty.');
  }

  // View current
  if (!args || args.length === 0) {
    const current = getCompanyValuation(db.getDb());
    if (!current) return bot.sendMessage(chatId, '📭 Chưa đặt định giá. Dùng /setvaluation [số VND]');
    return bot.sendMessage(chatId, `🏢 Định giá hiện tại: *${fmtVND(current)}*`, { parse_mode: 'Markdown' });
  }

  // Parse value — strip commas, dots, spaces
  const raw = args[0].replace(/[.,\s₫đvnd]/gi, '').trim();
  const val = parseInt(raw, 10);
  if (isNaN(val) || val <= 0) {
    return bot.sendMessage(chatId,
      `❌ Không đọc được số. Ví dụ:\n/setvaluation 50000000000 (50 tỷ VND)`
    );
  }

  setCompanyValuation(db.getDb(), val);

  return bot.sendMessage(chatId,
    `✅ Đã đặt định giá công ty: *${fmtVND(val)}*\n\n` +
    `Tất cả nhân viên sẽ thấy giá trị ESOP ước tính cập nhật trong /esopstatus.`,
    { parse_mode: 'Markdown' }
  );
}

module.exports = { handle };
