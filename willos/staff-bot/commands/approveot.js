/**
 * approveot.js — /approveot [tên hoặc ID] [approve|reject]
 * GM / Quản lý approves or rejects OT requests.
 * Usage:
 *   /approveot              → list all pending
 *   /approveot [tên] approve
 *   /approveot [tên] reject
 */

'use strict';

async function handle(bot, msg, args, db) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);

  const actor = db.getStaffByTelegramId(telegramId);
  if (!actor) return bot.sendMessage(chatId, '❌ Bạn chưa đăng ký.');
  if (!['gm', 'creator', 'quanly'].includes(actor.role)) {
    return bot.sendMessage(chatId, '❌ Chỉ GM và Quản lý mới dùng được lệnh này.');
  }

  const pending = db.getPendingOtRequests();

  // No args → list pending
  if (!args || args.length === 0) {
    if (pending.length === 0) {
      return bot.sendMessage(chatId, '✅ Không có yêu cầu tăng ca nào đang chờ duyệt.');
    }
    const lines = pending.map((r, i) =>
      `${i + 1}. ${r.name} (${r.department || '—'}) — ${r.date} đến ${r.requested_end}\n   📝 ${r.reason}`
    );
    return bot.sendMessage(chatId,
      `📋 TĂNG CA CHỜ DUYỆT (${pending.length})\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      lines.join('\n\n') +
      `\n━━━━━━━━━━━━━━━━━━━━\n` +
      `Dùng /approveot [tên] approve|reject`
    );
  }

  // Args: last arg is action (approve/reject), rest is name
  const lastArg = args[args.length - 1].toLowerCase();
  let action, nameParts;
  if (lastArg === 'approve' || lastArg === 'duyệt' || lastArg === 'ok') {
    action = 'approved';
    nameParts = args.slice(0, -1);
  } else if (lastArg === 'reject' || lastArg === 'từ chối' || lastArg === 'no') {
    action = 'rejected';
    nameParts = args.slice(0, -1);
  } else {
    // No action specified — default to approve
    action = 'approved';
    nameParts = args;
  }

  const targetName = nameParts.join(' ').trim();
  if (!targetName) {
    return bot.sendMessage(chatId, 'Cách dùng: /approveot [tên] [approve|reject]');
  }

  // Find matching pending request
  const match = pending.find(r =>
    r.name.toLowerCase().includes(targetName.toLowerCase())
  );

  if (!match) {
    return bot.sendMessage(chatId,
      `❌ Không tìm thấy yêu cầu tăng ca đang chờ cho: "${targetName}"\n` +
      `Gõ /approveot để xem danh sách.`
    );
  }

  // Apply decision
  db.approveOtRequest(match.id, actor.id, action);

  const actionLabel = action === 'approved' ? '✅ DUYỆT' : '❌ TỪ CHỐI';
  const actionEmoji = action === 'approved' ? '✅' : '❌';

  // Notify actor
  await bot.sendMessage(chatId,
    `${actionLabel} tăng ca\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 ${match.name} (${match.department || '—'})\n` +
    `📅 ${match.date} đến ${match.requested_end}\n` +
    `📝 ${match.reason}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Duyệt bởi: ${actor.name}`
  );

  // DM the staff member if they have private_chat_id
  try {
    const targetStaff = db.getStaffById(match.staff_id);
    if (targetStaff && targetStaff.private_chat_id) {
      await bot.sendMessage(targetStaff.private_chat_id,
        `${actionEmoji} Yêu cầu tăng ca của bạn đã được ${action === 'approved' ? 'DUYỆT' : 'TỪ CHỐI'}.\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📅 ${match.date} đến ${match.requested_end}\n` +
        `👤 Duyệt bởi: ${actor.name}\n` +
        (action === 'approved'
          ? `✅ Giờ làm thêm sẽ được tính vào chấm công tháng này.`
          : `⚠️ Giờ làm thêm hôm nay sẽ không tính vào lương.`)
      ).catch(() => {});
    }
  } catch (e) {
    console.error('[approveot] DM error:', e.message);
  }
}

module.exports = { handle };
