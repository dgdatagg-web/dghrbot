// approvekpi.js
// /approvekpi [tên] — GM/Creator approves pending KPI suggestions for a staff member.
// Strips [PENDING] prefix from label, marks active. DMs the staff member.

async function handle(bot, msg, args, db) {
  const chatId     = msg.chat.id;
  const telegramId = String(msg.from.id);
  const actor      = db.getStaffByTelegramId(telegramId);

  if (!actor || !['gm', 'creator'].includes(actor.role)) {
    return bot.sendMessage(chatId, '❌ Chỉ GM và Creator.');
  }

  const name = args.join(' ').trim();
  if (!name) {
    return bot.sendMessage(chatId, 'Cách dùng: /approvekpi [tên nhân viên]');
  }

  const target = db.getStaffByName(name);
  if (!target) {
    return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên: ${name}`);
  }

  const deptId  = target.department || 'dept_ops';
  const pending = db.getPendingKpisByDept(deptId);

  if (!pending.length) {
    return bot.sendMessage(chatId, `📭 Không có KPI nào đang chờ duyệt cho ${target.name}.`);
  }

  const result = db.approveKpiSuggestions(deptId, actor.id);

  const approvedLabels = pending.map(k => `• ${(k.label || '').replace(/^\[PENDING\]\s*/, '')}`).join('\n');

  await bot.sendMessage(chatId,
    `✅ Đã duyệt ${result.changes} KPI cho *${target.name}*:\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    approvedLabels + '\n' +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Duyệt bởi: ${actor.name}`,
    { parse_mode: 'Markdown' }
  );

  // DM staff member
  try {
    if (target.private_chat_id) {
      await bot.sendMessage(target.private_chat_id,
        `🎯 KPI của bạn đã được duyệt bởi ${actor.name}:\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        approvedLabels + '\n' +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Các mục tiêu này sẽ được theo dõi từ tháng này.`
      ).catch(() => {});
    }
  } catch (e) {
    console.error('[approvekpi] DM error:', e.message);
  }
}

module.exports = { handle };
