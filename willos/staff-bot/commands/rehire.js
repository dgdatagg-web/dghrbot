'use strict';

/**
 * rehire.js — /rehire @username [retain]
 *
 * Rehire an archived staff member. GM/Creator only.
 *
 * /rehire @username          → fresh start. EXP = 0. ESOP clock restarts.
 * /rehire @username retain   → special circumstance. EXP = floor(fired_exp × 0.5)
 *
 * Personal data (name, history, badges) is always kept.
 * fired_exp is cleared after rehire.
 */

function isCreator(role, telegramId) {
  const ids = (process.env.CREATOR_IDS || process.env.CREATOR_TELEGRAM_ID || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  return role === 'creator' || ids.includes(String(telegramId));
}

async function handle(bot, msg, args, db) {
  const telegramId = String(msg.from.id);
  const chatId     = msg.chat.id;
  const actor      = db.getStaffByTelegramId(telegramId);
  const creatorCaller = isCreator(actor?.role, telegramId);

  if (!actor && !creatorCaller) {
    return bot.sendMessage(chatId, '❌ Bạn chưa đăng ký trong hệ thống.');
  }

  // Only GM/Creator can rehire
  const isGmCreator = creatorCaller || ['gm', 'creator'].includes(actor?.role);
  if (!isGmCreator) {
    return bot.sendMessage(chatId, '❌ Chỉ GM hoặc Creator mới có quyền rehire.');
  }

  const usernameArg = args[0];
  const retainFlag  = (args[1] || '').toLowerCase() === 'retain';

  if (!usernameArg) {
    return bot.sendMessage(chatId,
      `Cách dùng:\n` +
      `/rehire @username          — fresh start (EXP = 0)\n` +
      `/rehire @username retain   — giữ 50% EXP cũ (đặc biệt, GM/Creator only)`
    );
  }

  if (!usernameArg.startsWith('@')) {
    return bot.sendMessage(chatId, `❌ Phải dùng @username. Ví dụ: /rehire @hieu`);
  }

  const target = db.getStaffByUsername(usernameArg);
  if (!target) {
    return bot.sendMessage(chatId, `❌ Không tìm thấy @username: "${usernameArg}".`);
  }
  if (target.status !== 'archived') {
    return bot.sendMessage(chatId,
      `⚠️ ${target.name} không phải trạng thái archived (hiện: ${target.status}).`
    );
  }

  // Only Creator can grant retain
  if (retainFlag && !creatorCaller) {
    return bot.sendMessage(chatId, '❌ Chỉ Creator mới có thể dùng retain. GM dùng fresh start.');
  }

  const firedExp   = target.fired_exp || 0;
  const restoredExp = retainFlag ? Math.floor(firedExp * 0.5) : 0;

  // Restore: active, reset exp, clear fired_exp, reset streak
  db.getDb().prepare(`
    UPDATE staff
    SET status    = 'active',
        exp       = ?,
        fired_exp = NULL,
        streak    = 0,
        last_checkin = NULL
    WHERE id = ?
  `).run(restoredExp, target.id);

  const retainMsg = retainFlag
    ? `⚡ EXP phục hồi: ${restoredExp} (50% của ${firedExp} EXP cũ)`
    : `⚡ EXP: 0 — bắt đầu lại từ đầu`;

  // Notify the staff member via DM if private_chat_id exists
  if (target.private_chat_id) {
    bot.sendMessage(target.private_chat_id,
      `✅ Tài khoản của bạn đã được khôi phục.\n` +
      `${retainMsg}\n\n` +
      `Dùng /checkin để bắt đầu lại. Chào mừng trở lại! 🎉`
    ).catch(() => {});
  }

  return bot.sendMessage(chatId,
    `✅ Đã rehire ${target.name}.\n` +
    `${retainMsg}\n` +
    `• Streak reset về 0\n` +
    `• Lịch sử ca và dữ liệu cá nhân vẫn giữ nguyên\n` +
    `• ESOP pool share bắt đầu tích lũy lại khi EXP tăng`
  );
}

module.exports = { handle };
