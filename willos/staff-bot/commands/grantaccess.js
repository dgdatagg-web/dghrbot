// grantaccess.js
// /grantaccess [tên] [access_type] [dept?]
// Creator only. Grants a named access token to a staff member.
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
      'Cách dùng: /grantaccess [tên] [access_type] [dept tùy chọn]\n' +
      'VD: /grantaccess Minh xemdoanhthu\n' +
      'VD: /grantaccess Minh viewpool dept_bar'
    );
  }

  // Last arg is dept if it starts with 'dept_', otherwise no dept
  let name, accessType, deptId;
  const lastArg = args[args.length - 1];

  if (lastArg.startsWith('dept_') && args.length >= 3) {
    deptId     = lastArg;
    accessType = args[args.length - 2].toLowerCase().trim();
    name       = args.slice(0, args.length - 2).join(' ').trim();
  } else {
    accessType = lastArg.toLowerCase().trim();
    name       = args.slice(0, args.length - 1).join(' ').trim();
    deptId     = null;
  }

  if (!name || !accessType) {
    return bot.sendMessage(chatId, '❌ Thiếu tên hoặc access_type.');
  }

  const target = db.getStaffByName(name);
  if (!target) {
    return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên: ${name}`);
  }

  // Check for existing active grant — skip duplicate
  const existing = db.getDb().prepare(`
    SELECT id FROM staff_access_grants
    WHERE staff_id = ? AND access_type = ?
      AND (dept_id IS NULL OR dept_id = ?)
      AND revoked_at IS NULL
    LIMIT 1
  `).get(target.id, accessType, deptId || null);

  if (existing) {
    return bot.sendMessage(
      chatId,
      `ℹ️ ${target.name} đã có quyền *${accessType}*${deptId ? ` (${deptId})` : ''} rồi.`,
      { parse_mode: 'Markdown' }
    );
  }

  db.grantAccess(target.id, accessType, deptId, actor.id);

  await bot.sendMessage(
    chatId,
    `✅ Đã cấp quyền\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 ${target.name}\n` +
    `🔑 Quyền: *${accessType}*\n` +
    (deptId ? `🏢 Dept: ${deptId}\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Cấp bởi: ${actor.name}`,
    { parse_mode: 'Markdown' }
  );

  if (target.private_chat_id) {
    bot.sendMessage(
      target.private_chat_id,
      `🔑 Bạn đã được cấp quyền *${accessType}*${deptId ? ` (${deptId})` : ''} bởi ${actor.name}.`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }
}

module.exports = { handle };
