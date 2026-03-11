/**
 * weeklyreport.js — Manager-initiated weekly staff report
 *
 * Flow:
 *   1. Manager/GM/Creator runs /weeklyreport
 *   2. Bot pulls week data from DB, builds summary, shows preview
 *   3. Inline button: [📊 Submit to GM & Creator]
 *   4. On press: sends to BOD group
 *      - Creator silent mode ON → send to BOD (GM sees it), skip Creator DM
 *      - Creator silent mode OFF → send to BOD + notify Creator
 *
 * Silent mode: /silentmode on|off — Creator only. Stored in bot_config table.
 *
 * © 2026 Do Ngoc Minh. All Rights Reserved.
 */

'use strict';

const { canMicroManage } = require('../utils/roles');

const BOD_GROUP_ID   = -1003827938422;   // [DG] BOD GROUP — GM + Creator
const HR_GROUP_ID    = -1003764628939;    // [DG] Nhóm Báo Cáo Công Việc / HR

// ── Helpers ─────────────────────────────────────────────────────────────────

function getWeekRange() {
  const now  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const day  = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const fmt = d => d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
  return {
    start: monday.toISOString().slice(0, 10),
    end:   sunday.toISOString().slice(0, 10),
    label: `${fmt(monday)} – ${fmt(sunday)}`,
  };
}

function isCreatorSilent(db) {
  try {
    const raw = db.getDb();
    const row = raw.prepare(`SELECT value FROM bot_config WHERE key = 'creator_silent_mode'`).get();
    return row?.value === '1';
  } catch {
    return false;
  }
}

function buildWeeklyReport(db) {
  const raw   = db.getDb();
  const range = getWeekRange();

  // ── Attendance stats ────────────────────────────────────────────────────
  const totalStaff = raw.prepare(
    `SELECT COUNT(*) as c FROM staff WHERE status = 'active'`
  ).get()?.c || 0;

  const checkins = raw.prepare(
    `SELECT COUNT(DISTINCT staff_id) as c FROM checkin_log
     WHERE checkin_date BETWEEN ? AND ? AND status = 'checked_in'`
  ).get(range.start, range.end)?.c || 0;

  const fullAttendance = raw.prepare(
    `SELECT COUNT(DISTINCT staff_id) as c FROM checkin_log
     WHERE checkin_date BETWEEN ? AND ? AND checkout_time IS NOT NULL`
  ).get(range.start, range.end)?.c || 0;

  // ── EXP gained this week ────────────────────────────────────────────────
  const expRows = raw.prepare(
    `SELECT s.name, SUM(e.amount) as gained
     FROM exp_log e
     JOIN staff s ON s.id = e.staff_id
     WHERE e.created_at BETWEEN ? AND ?
       AND e.amount > 0
     GROUP BY e.staff_id
     ORDER BY gained DESC
     LIMIT 5`
  ).all(range.start + 'T00:00:00', range.end + 'T23:59:59');

  // ── OT this week ────────────────────────────────────────────────────────
  const otApproved = raw.prepare(
    `SELECT COUNT(*) as c FROM ot_requests
     WHERE created_at BETWEEN ? AND ? AND status = 'approved'`
  ).get(range.start + 'T00:00:00', range.end + 'T23:59:59')?.c || 0;

  // ── Missed checkout alerts ───────────────────────────────────────────────
  const missedCheckout = raw.prepare(
    `SELECT COUNT(*) as c FROM checkin_log
     WHERE checkin_date BETWEEN ? AND ?
       AND checkout_time IS NULL
       AND status = 'checked_in'`
  ).get(range.start, range.end)?.c || 0;

  // ── Format ───────────────────────────────────────────────────────────────
  const attendanceRate = totalStaff > 0
    ? Math.round((checkins / (totalStaff * 5)) * 100)  // 5 working days
    : 0;

  const topLines = expRows.length
    ? expRows.map((r, i) => `  ${i + 1}. ${r.name} +${r.gained} EXP`).join('\n')
    : '  (không có dữ liệu)';

  const lines = [
    `📊 BÁO CÁO TUẦN — ${range.label}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `👥 NHÂN SỰ`,
    `  Tổng nhân viên active: ${totalStaff}`,
    `  Lượt checkin tuần: ${checkins}`,
    `  Hoàn thành ca đủ: ${fullAttendance}`,
    `  Tỉ lệ chuyên cần: ${attendanceRate}%`,
    `  Quên checkout: ${missedCheckout} lượt`,
    ``,
    `🏆 TOP EXP TUẦN`,
    topLines,
    ``,
    `⏱ OT được duyệt: ${otApproved} lượt`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ];

  return { text: lines.join('\n'), range };
}

// ── /weeklyreport ────────────────────────────────────────────────────────────

async function handle(bot, msg, db) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);

  // Role gate: Manager / GM / Creator only
  const staff = db.getDb().prepare(
    `SELECT role, class_role FROM staff WHERE telegram_id = ?`
  ).get(userId);

  if (!staff || !canMicroManage(staff.role)) {
    return bot.sendMessage(chatId, '❌ Lệnh này dành cho Quản lý / GM / Creator.');
  }

  try {
    const { text, range } = buildWeeklyReport(db);
    const silent = isCreatorSilent(db);

    const buttonLabel = silent
      ? '📊 Submit to GM'
      : '📊 Submit to GM & Creator';

    await bot.sendMessage(chatId,
      `${text}\n📝 Preview — nhấn nút bên dưới để gửi lên ban lãnh đạo.`,
      {
        reply_markup: {
          inline_keyboard: [[
            {
              text: buttonLabel,
              callback_data: `weeklyreport_submit_${range.start}`,
            }
          ]],
        },
      }
    );
  } catch (err) {
    console.error('[weeklyreport] build error:', err.message);
    bot.sendMessage(chatId, '❌ Lỗi khi tạo báo cáo tuần.');
  }
}

// ── Callback: submit button ──────────────────────────────────────────────────

async function handleCallback(bot, query, db) {
  const callerId = String(query.from.id);
  const data     = query.data || '';
  const chatId   = query.message?.chat?.id;

  if (!data.startsWith('weeklyreport_submit_')) return;

  // Role check — only the submitter's role matters
  const staff = db.getDb().prepare(
    `SELECT role, name, class_role FROM staff WHERE telegram_id = ?`
  ).get(callerId);

  if (!staff || !canMicroManage(staff.role)) {
    return bot.answerCallbackQuery(query.id, { text: '❌ Bạn không có quyền gửi báo cáo này.', show_alert: true });
  }

  try {
    const { text } = buildWeeklyReport(db);
    const submitterName = staff.name || query.from.first_name || 'Manager';
    const message = `${text}\n\n📤 Gửi bởi: ${submitterName}`;

    // Send to BOD group — GM always receives
    await bot.sendMessage(BOD_GROUP_ID, message);
    console.log(`[weeklyreport] submitted to BOD by ${submitterName}`);

    // Update button to show submitted state
    try {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [[{ text: '✅ Đã gửi', callback_data: 'noop' }]] },
        { chat_id: chatId, message_id: query.message.message_id }
      );
    } catch { /* edit can fail if message is too old */ }

    bot.answerCallbackQuery(query.id, { text: '✅ Báo cáo đã gửi lên GM & Creator.' });
  } catch (err) {
    console.error('[weeklyreport] submit error:', err.message);
    bot.answerCallbackQuery(query.id, { text: '❌ Gửi thất bại. Thử lại sau.', show_alert: true });
  }
}

// ── /silentmode — Creator only ───────────────────────────────────────────────

async function handleSilentMode(bot, msg, args, db) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);

  const staff = db.getDb().prepare(
    `SELECT role FROM staff WHERE telegram_id = ?`
  ).get(userId);

  if (!staff || staff.role !== 'creator') {
    return bot.sendMessage(chatId, '❌ Lệnh này chỉ dành cho Creator.');
  }

  const arg = (args[0] || '').toLowerCase();
  if (arg !== 'on' && arg !== 'off') {
    const current = isCreatorSilent(db) ? 'BẬT' : 'TẮT';
    return bot.sendMessage(chatId,
      `📴 Silent mode hiện tại: ${current}\n\nDùng /silentmode on để chỉ nhận báo cáo tháng.\nDùng /silentmode off để nhận cả báo cáo tuần.`
    );
  }

  const value = arg === 'on' ? '1' : '0';
  try {
    const raw = db.getDb();
    raw.prepare(
      `INSERT INTO bot_config (key, value) VALUES ('creator_silent_mode', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(value);
    const label = arg === 'on' ? 'BẬT — chỉ nhận báo cáo tháng' : 'TẮT — nhận cả báo cáo tuần';
    bot.sendMessage(chatId, `✅ Silent mode: ${label}`);
  } catch (err) {
    console.error('[silentmode] error:', err.message);
    bot.sendMessage(chatId, '❌ Lỗi khi cập nhật. Thử lại sau.');
  }
}

module.exports = { handle, handleCallback, handleSilentMode };
