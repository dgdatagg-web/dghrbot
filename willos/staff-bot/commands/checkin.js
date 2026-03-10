/**
 * checkin.js — /checkin command
 * Check in vào ca làm việc (2-step: location verification required)
 */

const { calculateCheckinExp, applyExp, calculateStreak, formatExpBar } = require('../utils/exp');
const { formatCheckin, formatLevelUp } = require('../utils/format');
const { getRoleInfo } = require('../utils/roles');
const { checkAndAwardBadges, formatBadgeAwards } = require('../utils/badges');
const { isWithinVenue } = require('../utils/venue');
const { broadcastEvent } = require('../utils/groups');
const { queueRow } = require('../services/sheets_queue');

// ─── Dept labels ─────────────────────────────────────────────────────────────
const DEPT_LABELS = {
  bep:  '🍳 Bếp',
  bar:  '🍹 Bar',
  bida: '🎱 Bida',
  kho:  '📦 Kho',
};

// ─── Pending checkins (module-level Map) ─────────────────────────────────────
// Key: telegramId (string)
// Value: { staffId, chatId, timestamp }
const pendingCheckins = new Map();
const PENDING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Auto-open shift when the first staff member of the day checks in.
 * Fires async — does NOT block the checkin response.
 */
async function checkAndAutoOpenShift(bot, db, staff) {
  try {
    const now = new Date();
    const ictNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const today = ictNow.toISOString().split('T')[0];

    // Only fire once per day — if any auto_moca already exists, skip
    const alreadyOpened = db.hasAutoShiftReport('auto_moca', null, today);
    if (alreadyOpened) return;

    const hh = String(ictNow.getUTCHours()).padStart(2, '0');
    const mm = String(ictNow.getUTCMinutes()).padStart(2, '0');
    const openTime = `${hh}:${mm}`;
    const dd = String(ictNow.getUTCDate()).padStart(2, '0');
    const mo = String(ictNow.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = ictNow.getUTCFullYear();
    const dateDisplay = `${dd}/${mo}/${yyyy}`;

    db.createShiftReport({
      staffId: staff.id,
      reportType: 'auto_moca',
      reportData: JSON.stringify({ triggeredBy: staff.name, trigger: 'first_checkin', openTime }),
      date: today,
    });

    const msg =
      `🟢 MỞ CA — ${dateDisplay}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⏰ ${openTime} · 👤 ${staff.name}\n` +
      `━━━━━━━━━━━━━━━━━━━━`;

    await broadcastEvent(bot, 'checkin', msg, { message_thread_id: 172 });
  } catch (err) {
    console.error('[auto-open-shift] error:', err.message);
  }
}

/**
 * Complete the actual checkin after location is verified.
 */
async function completeCheckin(bot, chatId, staff, db, lat, lng, distanceResult) {
  const telegramId = String(staff.telegram_id);
  const isGroup = false; // location messages are always in private or group, but we handle in private for location step

  // Get today's date (ICT UTC+7)
  const now = new Date();
  const ictOffset = 7 * 60 * 60 * 1000;
  const ictNow = new Date(now.getTime() + ictOffset);
  const today = ictNow.toISOString().split('T')[0];

  // Calculate late minutes (shift start = 08:00 ICT)
  const shiftStartHour = 8;
  const shiftStartMinute = 0;
  const currentHour = ictNow.getUTCHours();
  const currentMinute = ictNow.getUTCMinutes();
  const totalCurrentMinutes = currentHour * 60 + currentMinute;
  const totalShiftStartMinutes = shiftStartHour * 60 + shiftStartMinute;
  const lateMinutes = Math.max(0, totalCurrentMinutes - totalShiftStartMinutes);

  // Calculate streak
  const newStreak = calculateStreak(staff.last_checkin, today, staff.streak);

  // Calculate EXP
  const expResult = calculateCheckinExp(newStreak - 1, lateMinutes);
  const prevExp = staff.exp;
  const { newExp, newRole, leveledUp } = applyExp(staff.exp, staff.role, expResult.delta);

  // Update staff
  db.updateStaff(staff.id, {
    exp: newExp,
    streak: newStreak,
    last_checkin: today,
    ...(leveledUp ? { role: newRole } : {}),
  });

  // Log EXP
  if (expResult.delta !== 0) {
    db.logExp({
      staffId: staff.id,
      delta: expResult.delta,
      reason: expResult.reason,
      byTelegramId: telegramId,
    });
  }

  // Log checkin with location data
  db.createCheckinLog({
    staffId: staff.id,
    checkinTime: now.toISOString(),
    date: today,
    lateMinutes,
    lat,
    lng,
    distanceMeters: distanceResult.distance,
    locationVerified: distanceResult.ok ? 1 : 0,
  });

  // Check badges
  const updatedStaff = db.getStaffByTelegramId(telegramId);
  const newBadges = checkAndAwardBadges(db, updatedStaff, prevExp);

  // Level-up DM notification
  if (leveledUp && staff.telegram_id) {
    const lvMsg = formatLevelUp(staff.name, staff.role, newRole);
    bot.sendMessage(staff.telegram_id, lvMsg).catch(() => {});
  }

  // ── Auto open shift (fire & forget) ──
  checkAndAutoOpenShift(bot, db, staff).catch(() => {});

  // ── Queue to Sheets ──
  try {
    const timeStr = `${String(ictNow.getUTCHours()).padStart(2,'0')}:${String(ictNow.getUTCMinutes()).padStart(2,'0')}`;
    queueRow('checkin_log', {
      date: today,
      staff_name: staff.name,
      department: staff.department || '',
      class_role: staff.class_role || '',
      checkin_time: timeStr,
      late_minutes: lateMinutes,
      exp_delta: expResult.delta,
      streak: newStreak,
    });
  } catch (e) {
    console.error('[checkin] queueRow error:', e.message);
  }

  // Remove keyboard
  const removeKeyboard = { reply_markup: { remove_keyboard: true } };

  // Build response
  const role = getRoleInfo(updatedStaff.role);
  const timeStr = `${String(ictNow.getUTCHours()).padStart(2,'0')}:${String(ictNow.getUTCMinutes()).padStart(2,'0')}`;
  const expPart = expResult.delta !== 0 ? ` ${expResult.delta > 0 ? '+' : ''}${expResult.delta} EXP` : '';
  const latePart = lateMinutes >= 15 ? ` ⚠️ trễ ${lateMinutes}p` : '';
  const badgePart = newBadges.length > 0 ? ` 🏅x${newBadges.length}` : '';
  const levelPart = leveledUp ? ` 🎉 LEVEL UP!` : '';

  let response = `✅ ${role.icon} ${updatedStaff.name} vào ca ${timeStr}${expPart}${latePart}${badgePart}${levelPart}`;

  if (lateMinutes > 0 && lateMinutes < 15) {
    response += `\n⏰ Trễ +${lateMinutes}p`;
  } else if (lateMinutes >= 15 && lateMinutes <= 30) {
    response += `\n⚠️ Đi trễ ${lateMinutes}p → ${expResult.delta} EXP`;
  } else if (lateMinutes > 30) {
    response += `\n⚠️ Đi trễ ${lateMinutes}p — không có EXP hôm nay`;
  }

  if (newBadges.length > 0) {
    response += formatBadgeAwards(newBadges);
  }

  return bot.sendMessage(chatId, response, removeKeyboard);
}

async function handle(bot, msg, args, db) {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;

  // Get staff record
  const staff = db.getStaffByTelegramId(telegramId);
  if (!staff) {
    return bot.sendMessage(chatId, `❌ Bạn chưa đăng ký. Dùng /dangky [tên] để tham gia nhé!`);
  }
  if (staff.status === 'pending') {
    return bot.sendMessage(chatId, `⏳ Tài khoản của bạn đang chờ duyệt. Hãy liên hệ GM!`);
  }
  if (staff.status === 'archived') {
    return bot.sendMessage(chatId, `❌ Tài khoản của bạn đã bị vô hiệu hóa.`);
  }

  // Get today's date (ICT UTC+7)
  const now = new Date();
  const ictOffset = 7 * 60 * 60 * 1000;
  const ictNow = new Date(now.getTime() + ictOffset);
  const today = ictNow.toISOString().split('T')[0];

  // Check for duplicate checkin
  const existing = db.getTodayCheckin(staff.id, today);
  if (existing) {
    const checkinTime = new Date(existing.checkin_time);
    const ictCheckin = new Date(checkinTime.getTime() + ictOffset);
    const hh = String(ictCheckin.getUTCHours()).padStart(2, '0');
    const mm = String(ictCheckin.getUTCMinutes()).padStart(2, '0');
    return bot.sendMessage(chatId,
      `⚠️ ${staff.name} đã checkin lúc ${hh}:${mm} rồi!\n` +
      `Dùng /checkout khi kết thúc ca.`
    );
  }

  // Store pending checkin for this user (with 5min timeout)
  // Clear any old timeout first
  const existing_pending = pendingCheckins.get(telegramId);
  if (existing_pending && existing_pending._timeout) {
    clearTimeout(existing_pending._timeout);
  }

  const timeout = setTimeout(() => {
    pendingCheckins.delete(telegramId);
    // Try to remove keyboard if timed out
    bot.sendMessage(chatId, '⏰ Checkin đã hết hạn. Gõ /checkin lại nhé.', {
      reply_markup: { remove_keyboard: true }
    }).catch(() => {});
  }, PENDING_TIMEOUT_MS);

  pendingCheckins.set(telegramId, { staffId: staff.id, chatId, timestamp: Date.now(), _timeout: timeout });

  // Step 1: Ask for location
  return bot.sendMessage(chatId,
    `📍 XÁC NHẬN VỊ TRÍ\n` +
    `━━━━━━━━━━━━━━━\n` +
    `Để checkin, bạn cần gửi vị trí hiện tại.\n` +
    `Nhấn nút bên dưới 👇`,
    {
      reply_markup: {
        keyboard: [[
          { text: '📍 Gửi vị trí của tôi', request_location: true },
          { text: '❌ Hủy' },
        ]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }
  );
}

/**
 * Handle incoming location message.
 * Returns true if handled (user had pending checkin), false otherwise.
 */
async function handleLocation(bot, msg, db) {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;
  const pending = pendingCheckins.get(telegramId);

  if (!pending) return false;

  // Clear pending + timeout
  if (pending._timeout) clearTimeout(pending._timeout);
  pendingCheckins.delete(telegramId);

  const lat = msg.location.latitude;
  const lng = msg.location.longitude;

  // Get staff (fresh from DB)
  const staff = db.getStaffByTelegramId(telegramId);
  if (!staff) {
    bot.sendMessage(chatId, '❌ Không tìm thấy thông tin của bạn.', { reply_markup: { remove_keyboard: true } }).catch(() => {});
    return true;
  }

  // Verify location
  const locationResult = isWithinVenue(lat, lng);

  console.log(`[checkin-location] ${staff.name} | lat=${lat} lng=${lng} | dist=${locationResult.distance}m | ok=${locationResult.ok}`);

  if (!locationResult.ok) {
    // Outside venue
    await bot.sendMessage(chatId,
      `❌ Bạn đang ở ngoài quán!\n` +
      `📍 Khoảng cách: ~${locationResult.distance}m (tối đa ${locationResult.radius}m)\n` +
      `Vui lòng checkin tại quán nhé.`,
      { reply_markup: { remove_keyboard: true } }
    ).catch(() => {});
    return true;
  }

  // Within venue — complete checkin
  await completeCheckin(bot, chatId, staff, db, lat, lng, locationResult);
  return true;
}

/**
 * Handle "❌ Hủy" cancel text.
 * Returns true if handled, false otherwise.
 */
async function handleCancel(bot, msg, db) {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;
  const pending = pendingCheckins.get(telegramId);

  if (!pending) return false;

  // Clear pending + timeout
  if (pending._timeout) clearTimeout(pending._timeout);
  pendingCheckins.delete(telegramId);

  await bot.sendMessage(chatId, '↩️ Đã hủy checkin.', {
    reply_markup: { remove_keyboard: true },
  }).catch(() => {});
  return true;
}

module.exports = { handle, handleLocation, handleCancel };
