// commands/canceltask.js
// Cancel an active task assignment for a staff member.
//
// Usage: /canceltask <id> <tên nhân viên> [lý do]
//
// Access: creator / gm / quanly only
// Flow:
//   1. Validate assignment exists and is still 'active'
//   2. Mark reward_assignment status → 'cancelled'
//   3. If a payout row exists (task was already completed), reverse EXP
//   4. Log to reward_data_log
//   5. DM staff member
//   6. Confirm to actor

'use strict';

const { getDb } = require('../db');

function ictNow() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString();
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
  // /canceltask <id> <tên> [lý do...]
  if (!args || args.length < 2) {
    return bot.sendMessage(chatId,
      '❌ Usage: /canceltask <id> <tên nhân viên> [lý do]\n' +
      'Ví dụ: /canceltask 3 Hiếu nghỉ phép'
    );
  }

  const rewardId  = parseInt(args[0], 10);
  if (!rewardId || isNaN(rewardId)) {
    return bot.sendMessage(chatId, '❌ ID task không hợp lệ. Usage: /canceltask <id> <tên> [lý do]');
  }

  // Second arg is staff name — could be 1 word or multiple if no reason given.
  // Convention: if 3+ args, last args are reason.
  // We try to resolve name first, fall back to multi-word name if needed.
  const rawDb = getDb();

  let staff      = null;
  let cancelReason = null;

  // Try: args[1] = name, args[2..] = reason
  staff = db.getStaffByName(args[1]);
  if (staff) {
    cancelReason = args.slice(2).join(' ').trim() || null;
  } else {
    // Try: args[1..n-1] = multi-word name, args[n] = reason — walk from longest name
    for (let split = args.length - 1; split >= 2; split--) {
      const namePart   = args.slice(1, split).join(' ');
      const reasonPart = args.slice(split).join(' ');
      const candidate  = db.getStaffByName(namePart);
      if (candidate) {
        staff        = candidate;
        cancelReason = reasonPart || null;
        break;
      }
    }
  }

  if (!staff) {
    return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên: ${args.slice(1).join(' ')}`);
  }

  // ── Fetch active assignment ───────────────────────────────────────────────────
  const assignment = rawDb.prepare(`
    SELECT ra.*, rd.title, rd.exp_reward, rd.cash_reward
    FROM reward_assignments ra
    JOIN reward_definitions rd ON rd.id = ra.reward_id
    WHERE ra.reward_id = ? AND ra.staff_id = ? AND ra.status = 'active'
  `).get(rewardId, staff.id);

  if (!assignment) {
    // Check if it exists but in a different state
    const anyAssignment = rawDb.prepare(`
      SELECT status FROM reward_assignments
      WHERE reward_id = ? AND staff_id = ?
      ORDER BY id DESC LIMIT 1
    `).get(rewardId, staff.id);

    if (!anyAssignment) {
      return bot.sendMessage(chatId, `❌ ${staff.name} chưa join Task #${rewardId}.`);
    }
    return bot.sendMessage(chatId,
      `❌ Assignment của ${staff.name} cho Task #${rewardId} không ở trạng thái active.\n` +
      `Trạng thái hiện tại: *${anyAssignment.status}*`,
      { parse_mode: 'Markdown' }
    );
  }

  const cancelledAt = ictNow();

  // ── Mark assignment cancelled ─────────────────────────────────────────────────
  rawDb.prepare(`
    UPDATE reward_assignments
    SET status = 'cancelled', cancelled_at = ?, cancel_reason = ?
    WHERE id = ?
  `).run(cancelledAt, cancelReason || 'Cancelled by manager', assignment.id);

  // ── Check for existing payout (task was completetask'd — EXP already credited) ─
  const payout = rawDb.prepare(`
    SELECT * FROM reward_payouts
    WHERE assignment_id = ?
    ORDER BY id DESC LIMIT 1
  `).get(assignment.id);

  let expReversed = 0;
  if (payout && payout.exp_credited > 0) {
    expReversed = payout.exp_credited;
    const reason = `Huỷ task: ${assignment.title} (hoàn trả EXP)`;
    db.addExp(staff.id, -expReversed, reason, actor.telegram_id || null);
  }

  // ── Log event ─────────────────────────────────────────────────────────────────
  const notes = JSON.stringify({
    cancelledBy: actor.name,
    assignmentId: assignment.id,
    expReversed,
    reason: cancelReason || null,
  });
  rawDb.prepare(`
    INSERT INTO reward_data_log
      (staff_id, reward_id, event_type, value, notes, logged_at)
    VALUES (?, ?, 'quest_cancel', ?, ?, ?)
  `).run(staff.id, rewardId, expReversed > 0 ? -expReversed : null, notes, cancelledAt);

  // ── DM staff member ───────────────────────────────────────────────────────────
  if (staff.private_chat_id) {
    const dmLines = [
      `⚠️ *Task bị huỷ*`,
      ``,
      `⚔️ ${assignment.title}`,
      cancelReason ? `📝 Lý do: ${cancelReason}` : null,
      expReversed > 0 ? `↩️ -${expReversed} EXP (đã hoàn trả)` : null,
      ``,
      `Xác nhận bởi: ${actor.name}`,
    ].filter(l => l !== null).join('\n');

    await bot.sendMessage(staff.private_chat_id, dmLines, { parse_mode: 'Markdown' })
      .catch(() => {});
  }

  // ── Confirm to actor ──────────────────────────────────────────────────────────
  const confirmLines = [
    `✅ *Task #${rewardId} — ${assignment.title}* — đã huỷ`,
    ``,
    `👤 Nhân viên: ${staff.name}`,
    cancelReason ? `📝 Lý do: ${cancelReason}` : null,
    expReversed > 0 ? `↩️ EXP hoàn trả: -${expReversed}` : null,
    `✍️ Huỷ bởi: ${actor.name}`,
    !staff.private_chat_id ? `\n⚠️ ${staff.name} chưa có private chat — không gửi DM.` : null,
  ].filter(l => l !== null).join('\n');

  await bot.sendMessage(chatId, confirmLines, { parse_mode: 'Markdown' });

  console.log(`[canceltask] #${rewardId} "${assignment.title}" cancelled for ${staff.name} by ${actor.name}${expReversed ? ` (EXP reversed: -${expReversed})` : ''}`);
}

module.exports = { handle };
