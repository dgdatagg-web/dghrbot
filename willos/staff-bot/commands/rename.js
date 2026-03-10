/**
 * rename.js — /rename @username [tên mới]
 * Đổi nickname hiển thị của nhân viên
 * Access: Quản lý, GM, Creator
 */

async function handle(bot, msg, args, db) {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;

  const creatorIds = (process.env.CREATOR_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const gmIds      = (process.env.GM_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const isCreator  = creatorIds.includes(telegramId);
  const isGm       = gmIds.includes(telegramId);
  const caller     = db.getStaffByTelegramId(telegramId);
  const isQuanly   = caller && caller.role === 'quanly';

  if (!isCreator && !isGm && !isQuanly) {
    return bot.sendMessage(chatId, `❌ Lệnh này chỉ dành cho Quản lý, GM hoặc Creator.`);
  }

  // ── Usage ──────────────────────────────────────────────────────────────────
  if (args.length < 2) {
    return bot.sendMessage(chatId,
      `✏️ Cách dùng: /rename @username [tên mới]\n\n` +
      `Ví dụ: /rename @hieu Hiếu Đẹp Trai\n\n` +
      `Dùng /staff để xem @username của từng người.`
    );
  }

  const usernameArg = args[0];
  const newName     = args.slice(1).join(' ').trim();

  // ── Must use @username ─────────────────────────────────────────────────────
  if (!usernameArg.startsWith('@')) {
    return bot.sendMessage(chatId,
      `❌ Phải dùng @username.\n` +
      `Ví dụ: /rename @hieu Hiếu Đẹp Trai`
    );
  }

  // ── Validate new name ──────────────────────────────────────────────────────
  const RESERVED = ['newbie', 'nhanvien', 'quanly', 'gm', 'creator', 'admin', 'bot', 'all'];
  if (RESERVED.includes(newName.toLowerCase())) {
    return bot.sendMessage(chatId, `❌ "${newName}" không phải tên hợp lệ.`);
  }
  if (newName.length < 2 || newName.length > 30) {
    return bot.sendMessage(chatId, `❌ Tên phải từ 2–30 ký tự.`);
  }

  // ── Find target ────────────────────────────────────────────────────────────
  const target = db.getStaffByUsername(usernameArg);
  if (!target) {
    return bot.sendMessage(chatId,
      `❌ Không tìm thấy @username: "${usernameArg}".\n` +
      `Dùng /staff để xem danh sách.`
    );
  }

  // ── Check new name not taken by someone else ───────────────────────────────
  const nameTaken = db.getStaffByName(newName);
  if (nameTaken && nameTaken.telegram_id !== target.telegram_id) {
    return bot.sendMessage(chatId, `❌ Tên "${newName}" đã được dùng bởi người khác.`);
  }

  const oldName = target.name;

  // ── Update DB ──────────────────────────────────────────────────────────────
  db.getDb().prepare(`UPDATE staff SET name = ? WHERE telegram_id = ?`).run(newName, target.telegram_id);

  // ── Notify caller ──────────────────────────────────────────────────────────
  await bot.sendMessage(chatId,
    `✅ Đã đổi tên!\n\n` +
    `👤 ${usernameArg}\n` +
    `${oldName} → ${newName}`
  );

  // ── Notify the staff member ────────────────────────────────────────────────
  const privateChatId = target.private_chat_id || target.telegram_id;
  if (privateChatId) {
    bot.sendMessage(privateChatId,
      `✏️ Nickname của bạn vừa được đổi!\n\n` +
      `${oldName} → ${newName}\n\n` +
      `Dùng /me để xem profile mới.`
    ).catch(() => {});
  }
}

module.exports = { handle };
