// assignesop.js
// /assignesop [tên] [share_%] [dept_optional]
// Creator/GM only. Assigns ESOP seat to staff member.
// Pulls dept from staff record if not provided. Rejects if already has active seat.

'use strict';

async function handle(bot, msg, args, db) {
  const chatId     = msg.chat.id;
  const telegramId = String(msg.from.id);
  const actor      = db.getStaffByTelegramId(telegramId);

  if (!actor || !['gm', 'creator'].includes(actor.role)) {
    return bot.sendMessage(chatId, '❌ Chỉ GM và Creator mới dùng được lệnh này.');
  }

  // Args: [tên, share_pct, dept?]
  // share_pct can be "5" or "5%"
  if (args.length < 2) {
    return bot.sendMessage(chatId, 'Cách dùng: /assignesop [tên] [%] [dept tùy chọn]\nVD: /assignesop Minh 5 bep');
  }

  // Last arg is dept if non-numeric, second-to-last is pct
  let name, sharePctRaw, deptOverride;
  const lastArg = args[args.length - 1];
  const secondLast = args[args.length - 2];

  if (isNaN(parseFloat(lastArg.replace('%', ''))) && args.length >= 3) {
    // Last arg is dept override
    deptOverride = lastArg.toLowerCase().trim();
    sharePctRaw  = secondLast;
    name         = args.slice(0, args.length - 2).join(' ').trim();
  } else {
    sharePctRaw = lastArg;
    name        = args.slice(0, args.length - 1).join(' ').trim();
  }

  const sharePct = parseFloat(sharePctRaw.replace('%', ''));
  if (isNaN(sharePct) || sharePct <= 0 || sharePct > 100) {
    return bot.sendMessage(chatId, '❌ % không hợp lệ. Phải là số từ 0.01 đến 100.');
  }

  if (!name) {
    return bot.sendMessage(chatId, '❌ Thiếu tên nhân viên.');
  }

  const target = db.getStaffByName(name);
  if (!target) {
    return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên: ${name}`);
  }

  // Dept resolution
  const deptId = deptOverride || (target.department || '').toLowerCase().trim() || null;
  if (!deptId) {
    return bot.sendMessage(
      chatId,
      `❌ ${target.name} chưa có phòng ban trong hồ sơ và không có dept truyền vào.\nDùng: /assignesop ${name} ${sharePct} [dept]`
    );
  }

  // Reject if already has active seat
  const existing = db.getEsopSeat(target.id);
  if (existing) {
    return bot.sendMessage(
      chatId,
      `❌ ${target.name} đã có ESOP seat đang hoạt động (${existing.share_pct}% — dept: ${existing.dept_id}).\nDùng lệnh khác để cập nhật %.`
    );
  }

  db.assignEsopSeat(target.id, deptId, sharePct, actor.id);
  db.addEsopCandidate(target.id, deptId, actor.id, 0);

  await bot.sendMessage(
    chatId,
    `✅ ESOP đã được gán\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 ${target.name}\n` +
    `🏢 Dept: ${deptId}\n` +
    `📊 Cổ phần: ${sharePct}%\n` +
    `📅 Vesting bắt đầu: ${new Date(Date.now() + 7 * 3600000).toISOString().split('T')[0]}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Gán bởi: ${actor.name}`,
    { parse_mode: 'Markdown' }
  );

  // DM staff member
  if (target.private_chat_id) {
    bot.sendMessage(
      target.private_chat_id,
      `🎯 Bạn đã được gán ESOP bởi ${actor.name}.\n` +
      `📊 Cổ phần: ${sharePct}%\n` +
      `📅 Vesting bắt đầu từ hôm nay.\n\n` +
      `Dùng /esopstatus để xem chi tiết.`
    ).catch(() => {});
  }
}

module.exports = { handle };
