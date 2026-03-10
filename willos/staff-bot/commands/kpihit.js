// commands/kpihit.js
// Confirm that a staff member has hit their cash KPI target.
//
// Usage: /kpihit <assignment_id>
//
// Access: creator / gm / quanly only
// Flow:
//   1. Validate assignment exists, is type 'cash_kpi', status 'active'
//   2. Mark reward_assignment status → 'completed'
//   3. Create reward_payouts row (cash pending, no exp for KPI)
//   4. Create reward_data_log entry (event_type: 'kpi_hit')
//   5. DM staff member — instant notification
//   6. Confirm to actor

'use strict';

const { getDb } = require('../db');

function ictNow() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString();
}

function fmtVND(n) {
  return Number(n).toLocaleString('vi-VN') + '₫';
}

async function handle(bot, msg, args, db) {
  const chatId     = msg.chat.id;
  const telegramId = String(msg.from.id);
  const actor      = db.getStaffByTelegramId(telegramId);

  // ── Access gate ───────────────────────────────────────────────────────────────
  if (!actor) return bot.sendMessage(chatId, '❌ Bạn chưa đăng ký trong hệ thống.');
  if (!['creator', 'gm', 'quanly'].includes(actor.role)) {
    return bot.sendMessage(chatId, '❌ Chỉ Creator, GM và Quản lý mới dùng được lệnh này.');
  }

  // ── Parse args ────────────────────────────────────────────────────────────────
  if (!args || args.length < 1) {
    return bot.sendMessage(
      chatId,
      '❌ Usage: /kpihit <assignment_id>\n\nVí dụ: /kpihit 7\n\nDùng /tb để xem danh sách KPI đang active.'
    );
  }

  const assignmentId = parseInt(args[0], 10);
  if (!assignmentId || isNaN(assignmentId)) {
    return bot.sendMessage(chatId, '❌ Assignment ID không hợp lệ. Usage: /kpihit <id>');
  }

  const rawDb = getDb();

  // ── Fetch assignment + KPI definition + staff in one query ────────────────────
  const row = rawDb.prepare(`
    SELECT
      ra.id           AS assignment_id,
      ra.status       AS assignment_status,
      ra.staff_id,
      rd.id           AS reward_id,
      rd.title,
      rd.reward_type,
      rd.cash_reward,
      rd.exp_reward,
      rd.item_reward_desc,
      rd.is_active,
      s.name          AS staff_name,
      s.private_chat_id
    FROM reward_assignments ra
    JOIN reward_definitions rd ON rd.id = ra.reward_id
    JOIN staff s ON s.id = ra.staff_id
    WHERE ra.id = ?
  `).get(assignmentId);

  // ── Validate ──────────────────────────────────────────────────────────────────
  if (!row) {
    return bot.sendMessage(chatId, `❌ Assignment #${assignmentId} không tìm thấy.`);
  }

  if (row.reward_type !== 'cash_kpi') {
    return bot.sendMessage(
      chatId,
      `❌ Assignment #${assignmentId} không phải Cash KPI.\nDùng /completetask cho quest thông thường.`
    );
  }

  if (!row.is_active) {
    return bot.sendMessage(chatId, `❌ KPI "${row.title}" đã bị đóng.`);
  }

  if (row.assignment_status !== 'active') {
    const statusMap = {
      completed:        '✅ đã hoàn thành',
      cancelled:        '🚫 đã huỷ',
      pending_approval: '⏳ đang chờ duyệt',
      approved:         '✅ đã được duyệt',
    };
    const statusLabel = statusMap[row.assignment_status] || row.assignment_status;
    return bot.sendMessage(
      chatId,
      `❌ Assignment #${assignmentId} không thể xác nhận — trạng thái hiện tại: ${statusLabel}.`
    );
  }

  const cashReward = row.cash_reward || 0;
  const hitAt      = ictNow();

  // ── Mark assignment completed ─────────────────────────────────────────────────
  rawDb.prepare(`
    UPDATE reward_assignments
    SET status = 'completed', completed_at = ?, approved_by = ?
    WHERE id = ?
  `).run(hitAt, actor.name, assignmentId);

  // ── Open payout row ───────────────────────────────────────────────────────────
  // cash_kpi = no exp. Cash pending until /confirmpayout.
  rawDb.prepare(`
    INSERT INTO reward_payouts
      (assignment_id, staff_id, exp_credited, cash_amount, cash_confirmed, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    assignmentId,
    row.staff_id,
    0,            // no exp for cash KPI
    cashReward,
    0,            // cash_confirmed = 0 — pending payment
    hitAt
  );

  // ── Log event ─────────────────────────────────────────────────────────────────
  rawDb.prepare(`
    INSERT INTO reward_data_log
      (staff_id, reward_id, event_type, value, notes, logged_at)
    VALUES (?, ?, 'kpi_hit', ?, ?, ?)
  `).run(
    row.staff_id,
    row.reward_id,
    cashReward,
    JSON.stringify({
      confirmedBy:  actor.name,
      assignmentId: assignmentId,
      cashOwed:     cashReward,
    }),
    hitAt
  );

  // ── DM staff member ───────────────────────────────────────────────────────────
  if (row.private_chat_id) {
    await bot.sendMessage(
      row.private_chat_id,
      `🎯 *KPI đạt!*\n\n` +
      `⚔️ ${row.title}\n` +
      `💵 Thưởng: ${fmtVND(cashReward)}\n\n` +
      `Cash đang chờ xác nhận thanh toán. Dùng /profile để theo dõi.\n\n` +
      `✍️ Xác nhận bởi: ${actor.name}`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }

  // ── Confirm to actor ──────────────────────────────────────────────────────────
  await bot.sendMessage(
    chatId,
    `✅ *KPI Hit — Assignment #${assignmentId}*\n\n` +
    `⚔️ ${row.title}\n` +
    `👤 Nhân viên: ${row.staff_name}\n` +
    `💵 Cash owed: ${fmtVND(cashReward)}\n` +
    `📋 Trạng thái: Payout mở — chờ /confirmpayout\n\n` +
    `✍️ Ghi nhận bởi: ${actor.name}` +
    (!row.private_chat_id ? `\n\n⚠️ ${row.staff_name} chưa có private chat — không gửi DM được.` : ''),
    { parse_mode: 'Markdown' }
  );

  console.log(`[kpihit] assignment #${assignmentId} "${row.title}" KPI hit confirmed for ${row.staff_name} by ${actor.name} — cash owed: ${cashReward}`);
}

module.exports = { handle };
