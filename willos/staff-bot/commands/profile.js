/**
 * profile.js — /profile command
 * Xem character sheet cá nhân hoặc của người khác
 */

const { formatProfile } = require('../utils/format');
const { canApprove } = require('../utils/roles');
const { formatBadges } = require('../utils/badges');

async function handle(bot, msg, args, db) {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;

  const sender = db.getStaffByTelegramId(telegramId);

  let target;
  const nameArg = args[0];

  if (nameArg) {
    // Looking up another person
    if (!sender || !canApprove(sender.role)) {
      return bot.sendMessage(chatId, `❌ Chỉ GM/Creator mới có thể xem profile người khác.`);
    }
    target = db.getStaffByName(nameArg);
    if (!target) {
      return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên "${nameArg}".`);
    }
  } else {
    // Own profile
    if (!sender) {
      return bot.sendMessage(chatId, `❌ Bạn chưa đăng ký. Dùng /dangky [tên] để tham gia!`);
    }
    target = sender;
  }

  // Get badges
  const badgeRows = db.getBadges(target.id);
  const badgeCount = badgeRows.length;
  const badgeIcons = badgeRows.length > 0 ? formatBadges(badgeRows) : 'Chưa có badge';

  let profileText = formatProfile(target);
  profileText += `\n━━━━━━━━━━━━━━━━━━━━\n🏅 BADGES (${badgeCount}/9): ${badgeIcons}`;

  if (target.status === 'pending') {
    profileText = `⏳ [Chờ duyệt]\n` + profileText;
  }

  return bot.sendMessage(chatId, profileText);
}

module.exports = { handle };
