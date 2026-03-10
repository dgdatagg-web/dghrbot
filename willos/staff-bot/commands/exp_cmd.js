/**
 * exp_cmd.js — /exp command
 * Điều chỉnh EXP thủ công (GM/Creator only)
 */

const { canExpPenalty, canExpReward, getRoleInfo } = require('../utils/roles');
const { applyExp } = require('../utils/exp');
const { formatExpChange } = require('../utils/format');
const { checkAndAwardBadges, formatBadgeAwards } = require('../utils/badges');

async function handle(bot, msg, args, db) {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;

  const sender = db.getStaffByTelegramId(telegramId);

  const canPenalty = sender && canExpPenalty(sender.role);
  const canReward  = sender && canExpReward(sender.role);

  if (!canPenalty) {
    return bot.sendMessage(chatId,
      `❌ Bạn không có quyền điều chỉnh EXP.\n\n` +
      `🛡️ Quản lý: điều chỉnh EXP phạt (số âm)\n` +
      `⚔️ GM / 👾 Creator: toàn quyền EXP`
    );
  }

  // Usage: /exp @username [+/-N] [reason...]
  if (args.length < 2) {
    return bot.sendMessage(chatId,
      `📊 Cách dùng: /exp @username [+/-N] [lý do]\n` +
      `Ví dụ:\n` +
      `/exp @hieu +30 KPI 100% tháng 2\n` +
      `/exp @tan -10 Đi trễ không báo`
    );
  }

  const nameArg = args[0];
  const deltaStr = args[1];
  const reason = args.slice(2).join(' ') || 'Điều chỉnh thủ công';

  // Parse delta
  const delta = parseInt(deltaStr, 10);
  if (isNaN(delta)) {
    return bot.sendMessage(chatId, `❌ Số EXP không hợp lệ: "${deltaStr}". Dùng +30 hoặc -10.`);
  }

  // Find staff — @username only to avoid duplicate name ambiguity
  if (!nameArg.startsWith('@')) {
    return bot.sendMessage(chatId,
      `❌ Phải dùng @username để tránh nhầm lẫn khi có 2 người cùng tên.\n\n` +
      `Ví dụ: /exp @hieu +30 KPI 100%\n\n` +
      `Dùng /staff để xem @username của từng người.`
    );
  }

  const target = db.getStaffByUsername(nameArg);
  if (!target) {
    return bot.sendMessage(chatId,
      `❌ Không tìm thấy @username: "${nameArg}".\n` +
      `Dùng /staff để xem danh sách @username.`
    );
  }
  if (target.status === 'archived') {
    return bot.sendMessage(chatId, `❌ ${target.name} đã bị archive.`);
  }

  const prevExp = target.exp;
  const { newExp, newRole, leveledUp } = applyExp(target.exp, target.role, delta);

  // Update DB
  db.updateStaff(target.id, {
    exp: newExp,
    ...(leveledUp ? { role: newRole } : {}),
  });
  db.logExp({
    staffId: target.id,
    delta,
    reason,
    byTelegramId: telegramId,
  });

  // Check badges
  const updatedStaff = db.getStaffByTelegramId(target.telegram_id) || { ...target, exp: newExp };
  const newBadges = checkAndAwardBadges(db, updatedStaff, prevExp);

  let response = formatExpChange(target.name, delta, reason, newExp, newRole || target.role);

  if (leveledUp) {
    const { formatLevelUp } = require('../utils/format');
    response += '\n\n' + formatLevelUp(target.name, target.role, newRole);
  }

  if (newBadges.length > 0) {
    response += formatBadgeAwards(newBadges);
  }

  return bot.sendMessage(chatId, response);
}

module.exports = { handle };
