/**
 * approve.js — /approve command
 * Duyệt nhân viên pending (GM/Creator only)
 */

const { canApprove, getRoleInfo } = require('../utils/roles');

function isPrivilegedByEnv(telegramId) {
  const creatorIds = (process.env.CREATOR_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const gmIds = (process.env.GM_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  return creatorIds.includes(String(telegramId)) || gmIds.includes(String(telegramId));
}

async function handle(bot, msg, args, db) {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;

  const sender = db.getStaffByTelegramId(telegramId);
  const privilegedByEnv = isPrivilegedByEnv(telegramId);
  const privilegedByRole = sender && canApprove(sender.role);

  if (!privilegedByEnv && !privilegedByRole) {
    return bot.sendMessage(chatId, `❌ Chỉ GM hoặc Creator mới có quyền duyệt nhân viên.`);
  }

  const nameArg = args[0];

  // If no argument, list all pending
  if (!nameArg) {
    const pending = db.getPendingStaff();
    if (!pending || pending.length === 0) {
      return bot.sendMessage(chatId, `✅ Không có nhân viên nào đang chờ duyệt.`);
    }
    const lines = [`📋 DANH SÁCH CHỜ DUYỆT (${pending.length}):`];
    pending.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.name} (ID: ${s.telegram_id})`);
    });
    lines.push('\nDùng /approve [tên] để duyệt.');
    return bot.sendMessage(chatId, lines.join('\n'));
  }

  // Find by name
  const target = db.getStaffByName(nameArg);
  if (!target) {
    return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên "${nameArg}".`);
  }
  if (target.status === 'active') {
    return bot.sendMessage(chatId, `⚠️ ${target.name} đã được duyệt rồi.`);
  }
  if (target.status !== 'pending') {
    return bot.sendMessage(chatId, `⚠️ ${target.name} không ở trạng thái chờ duyệt (status: ${target.status}).`);
  }

  // Approve
  db.updateStaffStatus(target.telegram_id, 'active');

  // Notify the staff member
  if (target.telegram_id) {
    bot.sendMessage(target.telegram_id,
      `✅ Tài khoản của bạn đã được duyệt!\n` +
      `👤 ${target.name} — Bắt đầu dùng /checkin nhé!`
    ).catch(() => {});
  }

  const role = getRoleInfo(target.role);
  return bot.sendMessage(chatId,
    `✅ Đã duyệt ${target.name}!\n` +
    `${role.icon} Role: ${role.label}\n\n` +
    `${target.name} giờ có thể dùng /checkin để bắt đầu ca.`
  );
}

module.exports = { handle };
