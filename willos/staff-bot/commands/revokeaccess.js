// revokeaccess.js
// /revokeaccess [tên] [access_type]
// Creator only. Soft-deletes active grant by staff name + access_type.
// Migration guard ensures staff_access_grants table exists on first load.

'use strict';

const db = require('../db');

// ─── Migration guard ──────────────────────────────────────────────────────────
db.getDb().exec(`
  CREATE TABLE IF NOT EXISTS staff_access_grants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    access_type TEXT NOT NULL,
    dept_id TEXT DEFAULT NULL,
    granted_by INTEGER NOT NULL,
    granted_at DATETIME DEFAULT (datetime('now')),
    revoked_at DATETIME DEFAULT NULL,
    FOREIGN KEY (staff_id) REFERENCES staff(id)
  )
`);

// ─── Handler ──────────────────────────────────────────────────────────────────

async function handle(bot, msg, args, db) {
  const chatId     = msg.chat.id;
  const telegramId = String(msg.from.id);
  const actor      = db.getStaffByTelegramId(telegramId);

  if (!actor || actor.role !== 'creator') {
    return bot.sendMessage(chatId, '❌ Chỉ Creator mới dùng được lệnh này.');
  }

  if (args.length < 2) {
    return bot.sendMessage(
      chatId,
      'Cách dùng: /revokeaccess [tên] [access_type]\n' +
      'VD: /revokeaccess Minh xemdoanhthu'
    );
  }

  const accessType = args[args.length - 1].toLowerCase().trim();
  const name       = args.slice(0, args.length - 1).join(' ').trim();

  if (!name || !accessType) {
    return bot.sendMessage(chatId, '❌ Thiếu tên hoặc access_type.');
  }

  const target = db.getStaffByName(name);
  if (!target) {
    return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên: ${name}`);
  }

  // Find active grant by staff_id + access_type
  const grant = db.getDb().prepare(`
    SELECT id FROM staff_access_grants
    WHERE staff_id = ? AND access_type = ? AND revoked_at IS NULL
    ORDER BY granted_at DESC
    LIMIT 1
  `).get(target.id, accessType);

  if (!grant) {
    return bot.sendMessage(
      chatId,
      `ℹ️ ${target.name} không có quyền *${accessType}* đang hoạt động.`,
      { parse_mode: 'Markdown' }
    );
  }

  db.revokeAccess(grant.id);

  await bot.sendMessage(
    chatId,
    `🔒 Đã thu hồi quyền\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 ${target.name}\n` +
    `🔑 Quyền: *${accessType}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Thu hồi bởi: ${actor.name}`,
    { parse_mode: 'Markdown' }
  );

  if (target.private_chat_id) {
    bot.sendMessage(
      target.private_chat_id,
      `🔒 Quyền *${accessType}* của bạn đã bị thu hồi bởi ${actor.name}.`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }
}

module.exports = { handle };
