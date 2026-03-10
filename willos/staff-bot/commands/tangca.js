/**
 * tangca.js — /tangca [giờ kết thúc dự kiến] [lý do]
 * Staff requests OT approval BEFORE staying beyond scheduled shift.
 * Usage: /tangca 23:30 dọn dẹp sau sự kiện
 */

'use strict';

async function handle(bot, msg, args, db) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);

  const staff = db.getStaffByTelegramId(telegramId);
  if (!staff) return bot.sendMessage(chatId, '❌ Bạn chưa đăng ký. Dùng /dangky để tham gia.');
  if (staff.status !== 'active') return bot.sendMessage(chatId, '❌ Tài khoản chưa active.');

  if (!args || args.length < 1) {
    return bot.sendMessage(chatId,
      `📋 Cách dùng:\n` +
      `/tangca [giờ kết thúc] [lý do]\n\n` +
      `Ví dụ:\n` +
      `/tangca 23:30 dọn dẹp sau sự kiện\n` +
      `/tangca 01:00 nhận hàng trễ`
    );
  }

  // First arg = requested end time (HH:MM), rest = reason
  const requestedEnd = args[0];
  const reason = args.slice(1).join(' ').trim() || '(không ghi lý do)';

  // Basic time format validation
  if (!/^\d{1,2}:\d{2}$/.test(requestedEnd)) {
    return bot.sendMessage(chatId,
      `❌ Giờ không hợp lệ: "${requestedEnd}"\n` +
      `Dùng format HH:MM — ví dụ: 23:30 hoặc 01:00`
    );
  }

  const now = new Date();
  const ictNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const today = ictNow.toISOString().split('T')[0];

  // Check for duplicate request today
  const existing = db.getOtRequest(staff.id, today);
  if (existing && existing.status === 'pending') {
    return bot.sendMessage(chatId,
      `⏳ Bạn đã có yêu cầu tăng ca đang chờ duyệt hôm nay.\n` +
      `Kết thúc dự kiến: ${existing.requested_end}\n` +
      `Lý do: ${existing.reason}`
    );
  }
  if (existing && existing.status === 'approved') {
    return bot.sendMessage(chatId,
      `✅ Tăng ca hôm nay đã được duyệt rồi.\n` +
      `Kết thúc dự kiến: ${existing.requested_end}`
    );
  }

  // Create OT request
  db.createOtRequest(staff.id, today, requestedEnd, reason);

  // Notify staff
  await bot.sendMessage(chatId,
    `✅ Yêu cầu tăng ca đã gửi!\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 ${staff.name}\n` +
    `📅 ${today}\n` +
    `⏰ Kết thúc dự kiến: ${requestedEnd}\n` +
    `📝 Lý do: ${reason}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Chờ quản lý duyệt. Nếu không được duyệt, giờ OT sẽ không tính vào lương.`
  );

  // Notify GMs and managers with private_chat_id
  try {
    const allStaff = db.getStaffWithPrivateChatId();
    const notifyRoles = ['gm', 'creator', 'quanly'];
    for (const mgr of allStaff) {
      if (!notifyRoles.includes(mgr.role)) continue;
      if (mgr.id === staff.id) continue;
      await bot.sendMessage(mgr.private_chat_id,
        `🔔 YÊU CẦU TĂNG CA\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 ${staff.name} (${staff.department || '—'})\n` +
        `⏰ Kết thúc dự kiến: ${requestedEnd}\n` +
        `📝 ${reason}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Dùng /approveot để duyệt hoặc từ chối.`
      ).catch(() => {});
    }
  } catch (e) {
    console.error('[tangca] notify error:', e.message);
  }
}

module.exports = { handle };
