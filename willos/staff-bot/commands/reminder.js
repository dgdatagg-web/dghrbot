/**
 * reminder.js — DM Reminder Scheduler (Sprint 1)
 * 3 reminder windows: 08:45, 14:00, 22:00 ICT
 * Uses node-cron (already in package.json)
 */

'use strict';

const cron = require('node-cron');

function getIctNow() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
}

function ictDateStr(d) {
  return d.toISOString().split('T')[0];
}

/**
 * Check if a staff should be reminded for moca:
 * Only truong_ca or role gm/creator
 */
function shouldRemindMoca(staff) {
  return staff.class_role === 'truong_ca' ||
    staff.role === 'gm' ||
    staff.role === 'creator';
}

/**
 * Check if a staff should be reminded for dongca:
 * Only truong_ca or role gm/creator
 */
function shouldRemindDongca(staff) {
  return staff.class_role === 'truong_ca' ||
    staff.role === 'gm' ||
    staff.role === 'creator';
}

/**
 * Check if staff already submitted a report type today
 */
function hasReportToday(db, staffId, reportType, today) {
  const row = db.getDb().prepare(`
    SELECT id FROM shift_report
    WHERE staff_id = ? AND report_type = ? AND date = ?
    LIMIT 1
  `).get(staffId, reportType, today);
  return !!row;
}

/**
 * Send a single reminder DM — catches error if user blocked bot
 */
async function sendReminder(bot, chatId, message) {
  try {
    await bot.sendMessage(chatId, message);
  } catch (err) {
    // User may have blocked the bot — silently ignore
    const errMsg = err && err.message ? err.message : String(err);
    if (!errMsg.includes('bot was blocked') && !errMsg.includes('chat not found') && !errMsg.includes('user is deactivated')) {
      console.error('[Reminder] DM error to', chatId, ':', errMsg);
    }
  }
}

/**
 * Fire the 08:45 reminder — nhắc mở ca (Bếp + Kho — mở sớm)
 */
async function fireReminder0845(bot, db) {
  console.log('[Reminder] 08:45 — check auto_moca (Bếp/Kho)...');
  const ictNow = getIctNow();
  const today = ictDateStr(ictNow);

  const staffList = db.getStaffWithPrivateChatId();
  let sent = 0;

  for (const staff of staffList) {
    if (!['gm', 'creator'].includes(staff.role) && staff.class_role !== 'truong_ca') continue;
    // 08:45 only for Bếp / Kho — Bida and Bar open at 10:00, reminded at 09:45
    const dept = (staff.department || '').toLowerCase();
    if (dept === 'bida' || dept === 'bar') continue;
    if (hasReportToday(db, staff.id, 'auto_moca', today)) continue;

    await sendReminder(bot, staff.private_chat_id,
      `⏰ ${staff.name} ơi, chưa có ai checkin mở ca hôm nay!\nKiểm tra lại nhé 👀`
    );
    sent++;
  }

  console.log(`[Reminder] 08:45 — sent ${sent} moca reminders (Bếp/Kho)`);
}

/**
 * Fire the 09:45 reminder — nhắc mở ca (Bida + Bar — mở muộn)
 */
async function fireReminder0945(bot, db) {
  console.log('[Reminder] 09:45 — check auto_moca (Bida/Bar)...');
  const ictNow = getIctNow();
  const today = ictDateStr(ictNow);

  const staffList = db.getStaffWithPrivateChatId();
  let sent = 0;

  for (const staff of staffList) {
    if (!['gm', 'creator'].includes(staff.role) && staff.class_role !== 'truong_ca') continue;
    const dept = (staff.department || '').toLowerCase();
    if (dept !== 'bida' && dept !== 'bar') continue;
    if (hasReportToday(db, staff.id, 'auto_moca', today)) continue;

    await sendReminder(bot, staff.private_chat_id,
      `⏰ ${staff.name} ơi, chưa có ai checkin mở ca hôm nay!\nKiểm tra lại nhé 👀`
    );
    sent++;
  }

  console.log(`[Reminder] 09:45 — sent ${sent} moca reminders (Bida/Bar)`);
}

/**
 * Fire the 14:00 reminder — nhắc bàn giao ca
 * Only remind staff who have checked in today AND haven't submitted BC yet
 */
async function fireReminder1400(bot, db) {
  console.log('[Reminder] 14:00 — check bc...');
  const ictNow = getIctNow();
  const today = ictDateStr(ictNow);

  const staffList = db.getStaffWithPrivateChatId();
  let sent = 0;

  for (const staff of staffList) {
    // Only remind staff who actually checked in today
    const checkin = db.getTodayCheckin(staff.id, today);
    if (!checkin) continue;

    // Skip if already submitted BC today
    if (hasReportToday(db, staff.id, 'bc', today)) continue;

    await sendReminder(bot, staff.private_chat_id,
      `🔄 ${staff.name} ơi, chưa có báo cáo bàn giao ca!\nGõ /bc để báo ngay 👇`
    );
    sent++;
  }

  console.log(`[Reminder] 14:00 — sent ${sent} bc reminders`);
}

/**
 * Fire the 22:00 reminder — nhắc đóng ca
 */
async function fireReminder2200(bot, db) {
  console.log('[Reminder] 22:00 — check dongca (auto, skip)...');
  // Đóng ca đã auto khi nhân viên cuối checkout — không cần nhắc manual nữa
  console.log('[Reminder] 22:00 — skipped (auto shift close enabled)');
}

/**
 * Start the reminder scheduler.
 * All crons use Asia/Ho_Chi_Minh timezone — expressions written in local time.
 */
function startReminderScheduler(bot, db) {
  // Track which reminders have fired today (reset at midnight ICT)
  const firedToday = new Set();

  // Helper: check if this reminder should fire (once per day)
  function shouldFire(key) {
    const ictNow = getIctNow();
    const today = ictDateStr(ictNow);
    const fullKey = `${key}_${today}`;
    if (firedToday.has(fullKey)) return false;
    firedToday.add(fullKey);
    return true;
  }

  // 08:45 ICT — moca reminder (Bếp/Kho)
  cron.schedule('45 8 * * *', async () => {
    if (!shouldFire('moca_bep')) return;
    await fireReminder0845(bot, db).catch(err => {
      console.error('[Reminder] 0845 error:', err.message);
    });
  }, { timezone: 'Asia/Ho_Chi_Minh' });

  // 09:45 ICT — moca reminder (Bida/Bar — mở muộn hơn)
  cron.schedule('45 9 * * *', async () => {
    if (!shouldFire('moca_bida')) return;
    await fireReminder0945(bot, db).catch(err => {
      console.error('[Reminder] 0945 error:', err.message);
    });
  }, { timezone: 'Asia/Ho_Chi_Minh' });

  // 14:00 ICT — bc reminder
  cron.schedule('0 14 * * *', async () => {
    if (!shouldFire('bc')) return;
    await fireReminder1400(bot, db).catch(err => {
      console.error('[Reminder] 1400 error:', err.message);
    });
  }, { timezone: 'Asia/Ho_Chi_Minh' });

  // 22:00 ICT — dongca reminder
  cron.schedule('0 22 * * *', async () => {
    if (!shouldFire('dongca')) return;
    await fireReminder2200(bot, db).catch(err => {
      console.error('[Reminder] 2200 error:', err.message);
    });
  }, { timezone: 'Asia/Ho_Chi_Minh' });

  // Reset firedToday Set at 00:00 ICT
  cron.schedule('0 0 * * *', () => {
    firedToday.clear();
    console.log('[Reminder] firedToday reset for new day');
  }, { timezone: 'Asia/Ho_Chi_Minh' });

  console.log('[Reminder] Scheduler started — 08:45, 14:00, 22:00 ICT');
}

module.exports = {
  startReminderScheduler,
  fireReminder0845,
  fireReminder0945,
  fireReminder1400,
  fireReminder2200,
};
