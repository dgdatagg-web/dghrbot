/**
 * checkout.js — /checkout command
 * Kết thúc ca làm việc
 */

const { formatCheckout } = require('../utils/format');
const { queueRow } = require('../services/sheets_queue');
const { broadcastEvent } = require('../utils/groups');

// ─── Dept labels ─────────────────────────────────────────────────────────────
const DEPT_LABELS = {
  bep:  '🍳 Bếp',
  bar:  '🍹 Bar',
  bida: '🎱 Bida',
  kho:  '📦 Kho',
};

/**
 * Format duration between two ISO datetime strings.
 * e.g. "7h30p"
 */
function formatDuration(startIso, endIso) {
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const diffMs = end - start;
    if (diffMs < 0) return '?';
    const diffH = Math.floor(diffMs / (1000 * 60 * 60));
    const diffM = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffH}h${String(diffM).padStart(2, '0')}p`;
  } catch {
    return '?';
  }
}

/**
 * Determine if a staff member should trigger auto close shift.
 * Returns true only for the designated role in each dept.
 */
function shouldTriggerClose(staff) {
  const dept = staff.department;
  const class_role = staff.class_role;
  if (dept === 'bep' || dept === 'kho') return class_role === 'phu_bep';
  if (dept === 'bida') return class_role === 'phuc_vu_toi';
  if (dept === 'bar') return false;
  return false;
}

/**
 * Auto-close shift for a dept when the LAST staff member checks out.
 * Fires async — does NOT block the checkout response.
 */
async function checkAndAutoCloseShift(bot, db, staff) {
  try {
    const dept = staff.department;
    if (!dept) return;

    // Role-aware: only trigger for the designated closer
    if (!shouldTriggerClose(staff)) return;

    const now = new Date();
    const ictNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const today = ictNow.toISOString().split('T')[0];
    const hh = String(ictNow.getUTCHours()).padStart(2, '0');
    const mm = String(ictNow.getUTCMinutes()).padStart(2, '0');
    const closeTime = `${hh}:${mm}`;
    const dd = String(ictNow.getUTCDate()).padStart(2, '0');
    const mo = String(ictNow.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = ictNow.getUTCFullYear();
    const dateDisplay = `${dd}/${mo}/${yyyy}`;

    // Check remaining active staff with same class_role in this dept (excluding current staff who just checked out)
    const remaining = db.getDeptActiveCheckins(dept, today);
    // Filter out the current staff AND only consider same class_role (phu_bep/phuc_vu_toi)
    const stillOnShift = remaining.filter(r => r.staff_id !== staff.id && r.class_role === staff.class_role);
    if (stillOnShift.length > 0) return; // others with same class_role still on shift

    // Check if auto_dongca already fired today for this dept
    const alreadyClosed = db.hasAutoShiftReport('auto_dongca', dept, today);
    if (alreadyClosed) return;

    const deptLabel = DEPT_LABELS[dept] || dept;

    // Get all staff who checked in today for this dept
    const allCheckins = db.getDeptCheckins(dept, today);
    const staffNames = allCheckins.map(c => c.name).filter(Boolean);

    // Calculate total shift duration: first checkin → last checkout (now)
    let totalDuration = '';
    if (allCheckins.length > 0) {
      const firstCheckin = allCheckins[0].checkin_time; // already sorted ASC
      totalDuration = formatDuration(firstCheckin, now.toISOString());
    }

    // Count BC reports submitted
    const bcReports = db.getDeptBcReports(dept, today);
    const bcCount = bcReports.length;
    const totalStaffToday = allCheckins.length;

    // Create shift_report record
    db.createShiftReport({
      staffId: staff.id,
      reportType: 'auto_dongca',
      reportData: JSON.stringify({ triggeredBy: staff.name, dept, closeTime }),
      date: today,
    });

    // Push message to HR group topic 172
    const staffList = staffNames.length > 0 ? staffNames.join(', ') : '—';

    const msg =
      `🔴 ĐÓNG CA TỰ ĐỘNG — ${deptLabel}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📅 ${dateDisplay} | ⏰ ${closeTime}\n` +
      `👤 Người cuối: ${staff.name}\n` +
      `⏱ Tổng ca: ${totalDuration || '—'}\n` +
      `👥 Đã làm hôm nay: ${staffList}\n` +
      `📋 BC đã nộp: ${bcCount}/${totalStaffToday}\n` +
      `━━━━━━━━━━━━━━━━━━━━`;

    await broadcastEvent(bot, 'checkout', msg, { message_thread_id: 172 });
  } catch (err) {
    console.error('[auto-close-shift] error:', err.message);
  }
}

async function handle(bot, msg, args, db) {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;

  const staff = db.getStaffByTelegramId(telegramId);
  if (!staff) {
    return bot.sendMessage(chatId, `❌ Bạn chưa đăng ký. Dùng /dangky [tên] để tham gia nhé!`);
  }
  if (staff.status !== 'active') {
    return bot.sendMessage(chatId, `❌ Tài khoản chưa active. Liên hệ GM!`);
  }

  // Get today's date (ICT UTC+7)
  const now = new Date();
  const ictOffset = 7 * 60 * 60 * 1000;
  const ictNow = new Date(now.getTime() + ictOffset);
  const today = ictNow.toISOString().split('T')[0];

  // Check for open checkin — midnight-aware: also check yesterday
  const openCheckin = db.getAnyOpenCheckin(staff.id);
  if (!openCheckin) {
    const todayCheckin = db.getTodayCheckin(staff.id, today);
    if (todayCheckin && todayCheckin.checkout_time) {
      return bot.sendMessage(chatId,
        `⚠️ Bạn đã checkout rồi hôm nay!\n` +
        `Dùng /checkin để bắt đầu ca mới.`
      );
    }
    return bot.sendMessage(chatId,
      `⚠️ Bạn chưa checkin hôm nay!\n` +
      `Dùng /checkin để bắt đầu ca.`
    );
  }

  // Calculate actual minutes worked
  const checkinTime = openCheckin.checkin_time ? new Date(openCheckin.checkin_time) : null;
  const actualMinutes = checkinTime ? Math.round((now - checkinTime) / 60000) : null;

  // Update checkout — use checkin id (midnight-safe), record actual_minutes
  db.updateCheckout(openCheckin.id, now.toISOString(), actualMinutes);

  // ── Queue to Sheets ──
  try {
    const checkoutTime = now;
    const durationMins = actualMinutes;
    const ictNow2 = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const timeStr = `${String(ictNow2.getUTCHours()).padStart(2,'0')}:${String(ictNow2.getUTCMinutes()).padStart(2,'0')}`;
    queueRow('checkout_log', {
      date: openCheckin.date || today,
      staff_name: staff.name,
      department: staff.department || '',
      checkout_time: timeStr,
      duration_minutes: durationMins !== null ? durationMins : '',
    });
  } catch (e) {
    console.error('[checkout] queueRow error:', e.message);
  }

  // ── Auto close shift (fire & forget, after checkout recorded) ──
  checkAndAutoCloseShift(bot, db, staff).catch(() => {});

  return bot.sendMessage(chatId, formatCheckout(staff, openCheckin.checkin_time));
}

module.exports = { handle };
