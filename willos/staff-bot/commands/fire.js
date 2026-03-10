/**
 * fire.js — /fire and /delete commands
 * Archive hoặc xóa nhân viên
 * 
 * /fire [tên]            → GM/Creator → archive (status='archived')
 * /delete [tên]          → Creator ONLY → request confirmation
 * /delete [tên] CONFIRM  → Creator ONLY → hard delete
 */

const { canApprove } = require('../utils/roles');

// Track pending delete confirmations (in-memory, keyed by chatId:staffId)
const pendingDeletes = new Map();
const CONFIRM_TIMEOUT_MS = 60 * 1000; // 1 minute

function isCreator(role, telegramId) {
  if (role === 'creator') return true;
  const ids = (process.env.CREATOR_IDS || process.env.CREATOR_TELEGRAM_ID || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  return ids.includes(String(telegramId));
}

async function handle(bot, msg, args, db) {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;
  const command = msg.text.split(' ')[0].replace('/', '').toLowerCase();

  const sender = db.getStaffByTelegramId(telegramId);
  const callerIsCreator = isCreator(sender?.role, telegramId);

  // Creator can use /fire and /delete even if not registered in the DB
  if (!sender && !callerIsCreator) {
    return bot.sendMessage(chatId, `❌ Bạn chưa đăng ký trong hệ thống.`);
  }

  const nameArg = args[0];
  const confirmArg = args[1];

  if (!nameArg) {
    const usage = command === 'fire'
      ? `/fire @username — Archive nhân viên (giữ data)`
      : `/delete @username — Xóa hoàn toàn nhân viên (không thể khôi phục)`;
    return bot.sendMessage(chatId, `Cách dùng: ${usage}\n\nDùng /staff để xem @username của từng người.`);
  }

  // Find target — @username only
  if (!nameArg.startsWith('@')) {
    return bot.sendMessage(chatId,
      `❌ Phải dùng @username để tránh nhầm lẫn khi có 2 người cùng tên.\n\n` +
      `Ví dụ: /${command} @hieu\n\n` +
      `Dùng /staff để xem @username của từng người.`
    );
  }

  const target = db.getStaffByUsername(nameArg);
  if (!target) {
    return bot.sendMessage(chatId,
      `❌ Không tìm thấy @username: "${nameArg}".\n` +
      `Dùng /staff để xem danh sách.`
    );
  }

  // ── /fire ──
  if (command === 'fire') {
    if (!callerIsCreator && !canApprove(sender?.role)) {
      return bot.sendMessage(chatId, `❌ Chỉ GM hoặc Creator mới có thể archive nhân viên.`);
    }
    if (target.status === 'archived') {
      return bot.sendMessage(chatId, `⚠️ ${target.name} đã bị archive rồi.`);
    }

    db.updateStaffStatus(target.telegram_id, 'archived');

    return bot.sendMessage(chatId,
      `🔴 ${target.name} đã bị archive.\n` +
      `• Status: archived\n` +
      `• Data (exp_log, checkin_log) vẫn được giữ\n` +
      `• Nhân viên này không còn xuất hiện trong leaderboard\n\n` +
      `Để khôi phục: /approve ${target.name}`
    );
  }

  // ── /delete ──
  if (command === 'delete') {
    // Creator ONLY
    if (!callerIsCreator) {
      return bot.sendMessage(chatId, `❌ Chỉ Creator mới có quyền xóa hoàn toàn nhân viên.`);
    }

    const confirmKey = `${chatId}:${target.id}`;

    // Check if this is a confirmation
    if (confirmArg && confirmArg.toUpperCase() === 'CONFIRM') {
      const pending = pendingDeletes.get(confirmKey);
      if (!pending || Date.now() > pending.expiresAt) {
        pendingDeletes.delete(confirmKey);
        return bot.sendMessage(chatId,
          `⚠️ Xác nhận đã hết hạn. Gõ lại /delete ${target.name} để bắt đầu lại.`
        );
      }

      // Execute delete
      pendingDeletes.delete(confirmKey);
      db.deleteStaff(target.id);

      return bot.sendMessage(chatId,
        `🗑️ Đã xóa hoàn toàn ${target.name}.\n` +
        `• Tất cả data (exp_log, checkin_log, badges, shift_schedule) đã bị xóa.\n` +
        `• Hành động này KHÔNG THỂ khôi phục.`
      );
    }

    // Request confirmation
    pendingDeletes.set(confirmKey, {
      staffId: target.id,
      staffName: target.name,
      expiresAt: Date.now() + CONFIRM_TIMEOUT_MS,
    });

    return bot.sendMessage(chatId,
      `⚠️ CẢNH BÁO: Xóa hoàn toàn sẽ XÓA TẤT CẢ data của ${target.name}!\n\n` +
      `• exp_log, checkin_log, badges, shift_schedule — TẤT CẢ bị xóa\n` +
      `• KHÔNG THỂ khôi phục\n\n` +
      `Nếu chắc chắn, gõ trong vòng 60 giây:\n` +
      `/delete ${target.name} CONFIRM\n\n` +
      `💡 Tip: Dùng /fire ${target.name} để archive (an toàn hơn, giữ data).`
    );
  }
}

module.exports = { handle };
