/**
 * setrole.js — /setrole [@username] [role]
 * Creator → có thể assign bất kỳ role nào
 * GM      → có thể assign tối đa quanly (không thể assign gm hoặc creator)
 *
 * Syntax: /setrole [@username] [role]
 * Example:
 *   /setrole @hieu quanly    — GM hoặc Creator assign Manager cho @hieu
 *   /setrole @minh gm        — Creator assign GM cho @minh
 */

const { getRoleInfo } = require('../utils/roles');

const VALID_ROLES = ['newbie', 'nhanvien', 'kycuu', 'quanly', 'gm', 'creator'];

// Roles that GM is allowed to assign
const GM_ASSIGNABLE_ROLES = ['newbie', 'nhanvien', 'kycuu', 'quanly'];

const EXP_MAP = {
  newbie:   0,
  nhanvien: 100,
  kycuu:    500,
  quanly:   1000,
  gm:       1000,
  creator:  9999,
};

async function handle(bot, msg, args, db) {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;

  const creatorIds = (process.env.CREATOR_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const gmIds      = (process.env.GM_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

  const isCreator = creatorIds.includes(telegramId);
  const isGm      = gmIds.includes(telegramId);

  // Must be Creator or GM
  if (!isCreator && !isGm) {
    return bot.sendMessage(chatId, `❌ Lệnh này chỉ dành cho GM hoặc Creator.`);
  }

  // ── Usage guard ────────────────────────────────────────────────────────────
  if (args.length < 2) {
    const allowedRoles = isCreator ? VALID_ROLES : GM_ASSIGNABLE_ROLES;
    return bot.sendMessage(chatId,
      `🛡️ Cách dùng: /setrole [@username] [role]\n\n` +
      `Role được phép: ${allowedRoles.join(' | ')}\n\n` +
      `Ví dụ:\n` +
      `/setrole @hieu quanly\n` +
      `/setrole @minh gm`
    );
  }

  // ── Parse args ─────────────────────────────────────────────────────────────
  // Last arg = role, everything before = username/name
  const targetRole  = args[args.length - 1].toLowerCase();
  const targetInput = args.slice(0, args.length - 1).join(' ').trim();

  // ── Validate role ──────────────────────────────────────────────────────────
  if (!VALID_ROLES.includes(targetRole)) {
    const allowedRoles = isCreator ? VALID_ROLES : GM_ASSIGNABLE_ROLES;
    return bot.sendMessage(chatId,
      `❌ Role không hợp lệ: "${targetRole}"\n` +
      `Role hợp lệ: ${allowedRoles.join(' | ')}`
    );
  }

  // ── GM permission gate ─────────────────────────────────────────────────────
  if (isGm && !isCreator && !GM_ASSIGNABLE_ROLES.includes(targetRole)) {
    return bot.sendMessage(chatId,
      `❌ GM không thể assign role "${targetRole}".\n` +
      `GM chỉ được assign: ${GM_ASSIGNABLE_ROLES.join(' | ')}`
    );
  }

  // ── Find target staff — @username ONLY ────────────────────────────────────
  if (!targetInput.startsWith('@')) {
    return bot.sendMessage(chatId,
      `❌ Phải dùng @username để tránh nhầm lẫn.\n\n` +
      `Ví dụ: /setrole @hieu quanly\n\n` +
      `Nếu nhân viên chưa có @username: nhờ họ vào Telegram Settings → đặt username trước.`
    );
  }

  let target = db.getStaffByUsername(targetInput);

  // ── Auto-register if not found (Creator only, for privileged roles) ────────
  if (!target) {
    if (isCreator && ['gm', 'creator', 'quanly'].includes(targetRole)) {
      db.createStaff({
        telegramId: 'username_' + targetInput.replace('@', '') + '_' + Date.now(),
        name: targetInput,
        role: targetRole,
        status: 'active',
        department: null,
        classRole: null,
        username: targetInput,
        fullName: null,
      });
      target = db.getStaffByUsername(targetInput);
    }

    if (!target) {
      return bot.sendMessage(chatId,
        `❌ Không tìm thấy @username: "${targetInput}"\n` +
        `Người này cần /dangky trước, hoặc kiểm tra lại @username.`
      );
    }
  }

  // ── GM cannot modify a GM or Creator's role ────────────────────────────────
  if (isGm && !isCreator && ['gm', 'creator'].includes(target.role)) {
    return bot.sendMessage(chatId,
      `❌ GM không thể thay đổi role của GM hoặc Creator.`
    );
  }

  const oldRole     = target.role;
  const newExp      = EXP_MAP[targetRole] ?? 0;
  const oldRoleInfo = getRoleInfo(oldRole);
  const newRoleInfo = getRoleInfo(targetRole);

  // ── Update DB ──────────────────────────────────────────────────────────────
  db.getDb()
    .prepare(`UPDATE staff SET role = ?, exp = ?, status = 'active' WHERE telegram_id = ?`)
    .run(targetRole, newExp, target.telegram_id);

  // ── Notify caller ──────────────────────────────────────────────────────────
  const displayName = target.username || target.name;
  await bot.sendMessage(chatId,
    `✅ Đã cập nhật!\n\n` +
    `👤 ${target.name} (${displayName})\n` +
    `${oldRoleInfo.icon} ${oldRoleInfo.label} → ${newRoleInfo.icon} ${newRoleInfo.label}\n` +
    `⭐ EXP: ${newExp}`
  );

  // ── Notify the staff member via DM ─────────────────────────────────────────
  const privateChatId = target.private_chat_id || target.telegram_id;
  if (privateChatId) {
    bot.sendMessage(privateChatId,
      `🎉 Role của bạn vừa được cập nhật!\n\n` +
      `${oldRoleInfo.icon} ${oldRoleInfo.label} → ${newRoleInfo.icon} ${newRoleInfo.label}\n` +
      `⭐ EXP: ${newExp}\n\n` +
      `Dùng /me để xem profile mới nhé.`
    ).catch(() => {}); // Silently fail if bot can't reach them
  }
}

module.exports = { handle };
