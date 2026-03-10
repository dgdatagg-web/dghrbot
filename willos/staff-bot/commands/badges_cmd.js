/**
 * badges_cmd.js — /badges command
 * Xem badges earned/unearned của bản thân hoặc người khác
 */

const { BADGE_DEFS, getBadgeDef } = require('../utils/badges');
const { canApprove } = require('../utils/roles');

const SEP = '━━━━━━━━━━━━━━━━━━━━';

async function handle(bot, msg, args, db) {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;

  const sender = db.getStaffByTelegramId(telegramId);

  let target;
  if (args[0]) {
    if (!sender || !canApprove(sender.role)) {
      return bot.sendMessage(chatId, `❌ Chỉ GM/Creator mới có thể xem badges người khác.`);
    }
    target = db.getStaffByName(args[0]);
    if (!target) return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên "${args[0]}".`);
  } else {
    if (!sender) return bot.sendMessage(chatId, `❌ Bạn chưa đăng ký. Dùng /dangky [tên]!`);
    target = sender;
  }

  const badgeRows = db.getBadges(target.id);
  const earnedKeys = new Set(badgeRows.map(b => b.badge_key));
  const earnedCount = earnedKeys.size;

  const lines = [
    `🏅 BADGES — ${target.name}`,
    SEP,
  ];

  for (const def of BADGE_DEFS) {
    const earned = earnedKeys.has(def.key);
    const mark = earned ? '✅' : '⬜';
    lines.push(`${mark} ${def.icon} ${def.name} — ${def.desc}`);
  }

  lines.push(SEP);
  lines.push(`Đã đạt: ${earnedCount}/${BADGE_DEFS.length} badges`);

  return bot.sendMessage(chatId, lines.join('\n'));
}

module.exports = { handle };
