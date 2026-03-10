/**
 * staff.js — /staff command
 * List all active staff with clickable inline buttons → view full profile
 * Access: GM, Creator, Quanly
 */

const { getRoleInfo, PERMISSIONS } = require('../utils/roles');

async function handle(bot, msg, args, db) {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;

  const creatorIds = (process.env.CREATOR_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const gmIds      = (process.env.GM_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const isCreator  = creatorIds.includes(telegramId);
  const isGm       = gmIds.includes(telegramId);

  const caller = db.getStaffByTelegramId(telegramId);
  const isQuanly = caller && caller.role === 'quanly';

  if (!isCreator && !isGm && !isQuanly) {
    return bot.sendMessage(chatId, `❌ Lệnh này chỉ dành cho Quản lý, GM hoặc Creator.`);
  }

  const allStaff = db.getDb().prepare(`
    SELECT * FROM staff
    WHERE status IN ('active', 'pending')
    ORDER BY
      CASE role
        WHEN 'creator' THEN 1
        WHEN 'gm' THEN 2
        WHEN 'quanly' THEN 3
        WHEN 'kycuu' THEN 4
        WHEN 'nhanvien' THEN 5
        ELSE 6
      END ASC,
      exp DESC
  `).all();

  if (!allStaff.length) {
    return bot.sendMessage(chatId, `📋 Chưa có nhân viên nào đăng ký.`);
  }

  // Build summary header
  const total    = allStaff.length;
  const pending  = allStaff.filter(s => s.status === 'pending').length;
  const active   = total - pending;

  let header = `👥 Danh sách nhân viên\n`;
  header += `✅ Active: ${active}`;
  if (pending > 0) header += `  ⏳ Chờ duyệt: ${pending}`;
  header += `\n\nChọn tên để xem chi tiết:`;

  // Build inline keyboard — each row = one staff member
  const keyboard = allStaff.map(s => {
    const roleInfo = getRoleInfo(s.role);
    const statusIcon = s.status === 'pending' ? '⏳' : roleInfo.icon;
    const usernameLabel = s.username ? ` (${s.username})` : '';
    return [{ text: `${statusIcon} ${s.name}${usernameLabel}`, callback_data: `staff_view_${s.id}` }];
  });

  return bot.sendMessage(chatId, header, {
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function handleStaffCallback(bot, query, db) {
  const data = query.data;
  if (!data.startsWith('staff_view_')) return false;

  const staffId = parseInt(data.replace('staff_view_', ''), 10);
  const staff = db.getStaffById(staffId);

  if (!staff) {
    await bot.answerCallbackQuery(query.id, { text: '❌ Không tìm thấy nhân viên.', show_alert: true });
    return true;
  }

  const roleInfo   = getRoleInfo(staff.role);
  const statusLabel = staff.status === 'pending' ? '⏳ Chờ duyệt' : '✅ Active';
  const username   = staff.username || '(chưa có username)';
  const dept       = staff.department || '—';
  const classRole  = staff.class_role || '—';
  const joinDate   = staff.joined_date || '—';
  const lastCheckin = staff.last_checkin || 'Chưa check-in';

  const checkinCount = db.getCheckinCount(staffId);

  const profileText =
    `👤 ${staff.name}\n` +
    `📱 ${username}\n` +
    `${roleInfo.icon} ${roleInfo.label} | ${statusLabel}\n\n` +
    `🏷️ Bộ phận: ${dept}\n` +
    `🎖️ Vị trí: ${classRole}\n\n` +
    `⭐ EXP: ${staff.exp}\n` +
    `🔥 Streak: ${staff.streak} ngày\n` +
    `📅 Số ca: ${checkinCount}\n` +
    `🕐 Check-in gần nhất: ${lastCheckin}\n` +
    `📆 Ngày tham gia: ${joinDate}`;

  await bot.answerCallbackQuery(query.id);
  await bot.sendMessage(query.message.chat.id, profileText);
  return true;
}

module.exports = { handle, handleStaffCallback };
