// commands/completetask.js
// Mark a task as complete for a staff member.
//
// Usage: /completetask <id> <tên nhân viên>
//
// Access: creator / gm / quanly only
// Flow:
//   1. Validate task exists and staff member joined it
//   2. Mark reward_assignment status → 'completed'
//   3. Create reward_payouts row (exp + cash)
//   4. Credit EXP immediately (if reward has exp)
//   5. Create reward_data_log entry
//   6. DM staff member with result
//   7. Confirm to caller

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
  if (!args || args.length < 2) {
    return bot.sendMessage(chatId, '❌ Usage: /completetask <id> <tên nhân viên>\nVí dụ: /completetask 3 Hiếu');
  }

  const rewardId  = parseInt(args[0], 10);
  const staffName = args.slice(1).join(' ').trim();

  if (!rewardId || isNaN(rewardId)) {
    return bot.sendMessage(chatId, '❌ ID task không hợp lệ. Usage: /completetask <id> <tên>');
  }

  const rawDb = getDb();

  // ── Fetch task ────────────────────────────────────────────────────────────────
  const task = rawDb.prepare(`
    SELECT rd.*, tp.removed_at
    FROM reward_definitions rd
    LEFT JOIN townboard_posts tp ON tp.reward_id = rd.id
    WHERE rd.id = ? AND rd.is_active = 1
  `).get(rewardId);

  if (!task) {
    return bot.sendMessage(chatId, `❌ Task #${rewardId} không tìm thấy hoặc đã bị đóng.`);
  }

  // ── Fetch staff member ────────────────────────────────────────────────────────
  const staff = db.getStaffByName(staffName);
  if (!staff) {
    return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên: ${staffName}`);
  }

  // ── Fetch active assignment ───────────────────────────────────────────────────
  const assignment = rawDb.prepare(`
    SELECT * FROM reward_assignments
    WHERE reward_id = ? AND staff_id = ? AND status = 'active'
  `).get(rewardId, staff.id);

  if (!assignment) {
    return bot.sendMessage(chatId, `❌ ${staff.name} chưa join Task #${rewardId} hoặc đã được xử lý rồi.`);
  }

  // ── Mark assignment completed ─────────────────────────────────────────────────
  const completedAt = ictNow();
  rawDb.prepare(`
    UPDATE reward_assignments
    SET status = 'completed', completed_at = ?, approved_by = ?
    WHERE id = ?
  `).run(completedAt, actor.name, assignment.id);

  // ── Build payout row ──────────────────────────────────────────────────────────
  const expReward  = task.exp_reward  || 0;
  const cashReward = task.cash_reward || 0;
  const itemDesc   = task.item_reward_desc || null;

  rawDb.prepare(`
    INSERT INTO reward_payouts
      (assignment_id, staff_id, exp_credited, cash_amount, cash_confirmed, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    assignment.id,
    staff.id,
    expReward,
    cashReward,
    cashReward > 0 ? 0 : 1,  // cash_confirmed = 0 (pending) if cash owed, 1 (n/a) if no cash
    completedAt
  );

  // ── Credit EXP immediately ────────────────────────────────────────────────────
  if (expReward > 0) {
    const reason = `Hoàn thành task: ${task.title}`;
    db.addExp(staff.id, expReward, reason, actor.telegram_id || null);
  }

  // ── Log event ─────────────────────────────────────────────────────────────────
  const notes = JSON.stringify({
    completedBy: actor.name,
    assignmentId: assignment.id,
    expAwarded: expReward,
    cashOwed: cashReward,
    itemDesc: itemDesc || null,
  });
  rawDb.prepare(`
    INSERT INTO reward_data_log
      (staff_id, reward_id, event_type, value, notes, logged_at)
    VALUES (?, ?, 'quest_complete', ?, ?, ?)
  `).run(staff.id, rewardId, expReward || null, notes, completedAt);

  // ── Build reward summary string ────────────────────────────────────────────────
  const rewardParts = [];
  if (expReward > 0)  rewardParts.push(`+${expReward} EXP`);
  if (cashReward > 0) rewardParts.push(`${cashReward.toLocaleString('vi-VN')}₫ (pending xác nhận)`);
  if (itemDesc)       rewardParts.push(itemDesc);
  const rewardStr = rewardParts.length > 0 ? rewardParts.join(' · ') : '(không có phần thưởng)';

  // ── DM staff member ───────────────────────────────────────────────────────────
  if (staff.private_chat_id) {
    await bot.sendMessage(
      staff.private_chat_id,
      `🎉 *Task hoàn thành!*\n\n` +
      `⚔️ ${task.title}\n` +
      `🎁 Phần thưởng: ${rewardStr}\n\n` +
      (cashReward > 0
        ? `💵 Cash sẽ được xác nhận khi thanh toán. Dùng /profile để xem trạng thái.\n`
        : '') +
      `Xác nhận bởi: ${actor.name}`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }

  // ── Confirm to actor ──────────────────────────────────────────────────────────
  await bot.sendMessage(
    chatId,
    `✅ *Task #${rewardId} — ${task.title}*\n\n` +
    `👤 Nhân viên: ${staff.name}\n` +
    `🎁 Phần thưởng: ${rewardStr}\n` +
    `✍️ Xác nhận bởi: ${actor.name}` +
    (staff.private_chat_id ? '' : `\n\n⚠️ ${staff.name} chưa có private chat — không gửi DM được.`),
    { parse_mode: 'Markdown' }
  );

  console.log(`[completetask] #${rewardId} "${task.title}" completed for ${staff.name} by ${actor.name}`);
}

module.exports = { handle };
