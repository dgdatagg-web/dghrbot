// commands/confirmpayout.js
// Confirm cash payment for a completed task.
//
// Usage:
//   /confirmpayout            — list all pending cash payouts
//   /confirmpayout <id>       — confirm payout #id as paid
//
// Access: creator / gm only
// Flow:
//   1. No args → list pending payouts (cash_confirmed=0, cash_amount>0)
//   2. With id → mark cash_confirmed=1, log, DM staff

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
  if (!['creator', 'gm'].includes(actor.role)) {
    return bot.sendMessage(chatId, '❌ Chỉ Creator và GM mới xác nhận thanh toán được.');
  }

  const rawDb = getDb();

  // ── No args → list pending payouts ───────────────────────────────────────────
  if (!args || args.length === 0) {
    const pending = rawDb.prepare(`
      SELECT
        rp.id         AS payout_id,
        rp.cash_amount,
        rp.created_at,
        s.name        AS staff_name,
        rd.title      AS task_title,
        rd.id         AS reward_id
      FROM reward_payouts rp
      JOIN staff s             ON s.id  = rp.staff_id
      JOIN reward_assignments ra ON ra.id = rp.assignment_id
      JOIN reward_definitions rd ON rd.id = ra.reward_id
      WHERE rp.cash_confirmed = 0
        AND rp.cash_amount    > 0
      ORDER BY rp.created_at ASC
    `).all();

    if (!pending.length) {
      return bot.sendMessage(chatId, '✅ Không có khoản tiền thưởng nào đang chờ xác nhận.');
    }

    const lines = pending.map(p =>
      `💵 *#${p.payout_id}* — ${p.staff_name}\n` +
      `   Task: ${p.task_title} (#${p.reward_id})\n` +
      `   ${fmtVND(p.cash_amount)} · ${p.created_at.slice(0, 10)}`
    );

    return bot.sendMessage(
      chatId,
      `💰 *Payouts chờ xác nhận (${pending.length})*\n\n${lines.join('\n\n')}\n\n` +
      `Xác nhận: /confirmpayout <id>`,
      { parse_mode: 'Markdown' }
    );
  }

  // ── With id → confirm payment ─────────────────────────────────────────────────
  const payoutId = parseInt(args[0], 10);
  if (!payoutId || isNaN(payoutId)) {
    return bot.sendMessage(chatId, '❌ ID không hợp lệ. Usage: /confirmpayout <id>');
  }

  const payout = rawDb.prepare(`
    SELECT
      rp.*,
      s.name          AS staff_name,
      s.private_chat_id,
      rd.title        AS task_title,
      rd.id           AS reward_id
    FROM reward_payouts rp
    JOIN staff s             ON s.id  = rp.staff_id
    JOIN reward_assignments ra ON ra.id = rp.assignment_id
    JOIN reward_definitions rd ON rd.id = ra.reward_id
    WHERE rp.id = ?
  `).get(payoutId);

  if (!payout) {
    return bot.sendMessage(chatId, `❌ Payout #${payoutId} không tìm thấy.`);
  }

  if (payout.cash_amount <= 0) {
    return bot.sendMessage(chatId, `❌ Payout #${payoutId} không có tiền mặt.`);
  }

  if (payout.cash_confirmed === 1) {
    return bot.sendMessage(
      chatId,
      `✅ Payout #${payoutId} đã được xác nhận rồi.\n` +
      `Xác nhận lúc: ${payout.cash_confirmed_at?.slice(0, 16) || '—'}`,
      { parse_mode: 'Markdown' }
    );
  }

  const confirmedAt = ictNow();

  // ── Mark confirmed ────────────────────────────────────────────────────────────
  rawDb.prepare(`
    UPDATE reward_payouts
    SET cash_confirmed = 1, cash_confirmed_by = ?, cash_confirmed_at = ?
    WHERE id = ?
  `).run(actor.id, confirmedAt, payoutId);

  // ── Log event ─────────────────────────────────────────────────────────────────
  rawDb.prepare(`
    INSERT INTO reward_data_log
      (staff_id, reward_id, event_type, value, notes, logged_at)
    VALUES (?, ?, 'cash_paid', ?, ?, ?)
  `).run(
    payout.staff_id,
    payout.reward_id,
    payout.cash_amount,
    JSON.stringify({ confirmedBy: actor.name, payoutId }),
    confirmedAt
  );

  // ── DM staff ──────────────────────────────────────────────────────────────────
  if (payout.private_chat_id) {
    await bot.sendMessage(
      payout.private_chat_id,
      `💵 *Tiền thưởng đã thanh toán!*\n\n` +
      `⚔️ ${payout.task_title}\n` +
      `💰 ${fmtVND(payout.cash_amount)}\n` +
      `✍️ Xác nhận bởi: ${actor.name}`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }

  // ── Confirm to actor ──────────────────────────────────────────────────────────
  await bot.sendMessage(
    chatId,
    `✅ *Payout #${payoutId} — đã xác nhận*\n\n` +
    `👤 ${payout.staff_name}\n` +
    `⚔️ ${payout.task_title}\n` +
    `💰 ${fmtVND(payout.cash_amount)}\n` +
    `✍️ Bởi: ${actor.name}` +
    (!payout.private_chat_id ? `\n\n⚠️ ${payout.staff_name} chưa có private chat.` : ''),
    { parse_mode: 'Markdown' }
  );

  console.log(`[confirmpayout] #${payoutId} confirmed — ${payout.staff_name} ${fmtVND(payout.cash_amount)} by ${actor.name}`);
}

module.exports = { handle };
