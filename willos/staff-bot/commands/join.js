// commands/join.js
// Accept a quest or activity from the Townboard.
// Usage: /join <reward_id>
//
// Individual quest  — claim it (one slot)
// Group quest       — add to acceptors, check capacity
// Activity          — open join, no cap
// Cash KPI          — blocked (assigned directly via /posttask)

const { getDb } = require('../db');

async function handle(bot, msg, args, db) {
  const chatId     = msg.chat.id;
  const telegramId = String(msg.from.id);
  const staff      = db.getStaffByTelegramId(telegramId);

  if (!staff)                    return bot.sendMessage(chatId, '❌ Bạn chưa đăng ký trong hệ thống.');
  if (staff.status !== 'active') return bot.sendMessage(chatId, '❌ Tài khoản chưa được kích hoạt.');

  const rewardId = parseInt(args[0], 10);
  if (!rewardId) return bot.sendMessage(chatId, '❌ Usage: /join <id>\nVí dụ: /join 3');

  // ── Fetch task ───────────────────────────────────────────────────────────────
  const task = getDb().prepare(`
    SELECT rd.*,
      tp.removed_at,
      (
        SELECT COUNT(*) FROM reward_assignments ra
        WHERE ra.reward_id = rd.id AND ra.status = 'active'
      ) AS participants
    FROM reward_definitions rd
    JOIN townboard_posts tp ON tp.reward_id = rd.id
    WHERE rd.id = ?
      AND tp.removed_at IS NULL
      AND rd.is_active = 1
  `).get(rewardId);

  if (!task) {
    return bot.sendMessage(chatId, `❌ #${rewardId} không tìm thấy hoặc đã đóng.`);
  }

  if (task.expires_at && task.expires_at < new Date().toISOString()) {
    return bot.sendMessage(chatId, `❌ Quest #${rewardId} đã hết hạn.`);
  }

  // ── Cash KPI — not joinable manually ────────────────────────────────────────
  if (task.reward_type === 'cash_kpi') {
    return bot.sendMessage(chatId, '❌ Cash KPI được assign trực tiếp, không dùng /join.');
  }

  // ── Already joined ───────────────────────────────────────────────────────────
  const existing = getDb().prepare(`
    SELECT id FROM reward_assignments
    WHERE reward_id = ? AND staff_id = ? AND status != 'cancelled'
  `).get(rewardId, staff.id);

  if (existing) {
    return bot.sendMessage(chatId, `✅ Bạn đã tham gia *${task.title}* rồi.`, { parse_mode: 'Markdown' });
  }

  // ── Capacity check (group quests) ────────────────────────────────────────────
  if (task.target_type === 'group' && task.description) {
    const capMatch = task.description.match(/\[capacity:(\d+)\]/);
    if (capMatch) {
      const capacity = parseInt(capMatch[1], 10);
      if (task.participants >= capacity) {
        return bot.sendMessage(chatId, `❌ Quest đã đủ người (${task.participants}/${capacity}).`);
      }
    }
  }

  // ── Insert assignment ────────────────────────────────────────────────────────
  getDb().prepare(`
    INSERT INTO reward_assignments (reward_id, staff_id, status)
    VALUES (?, ?, 'active')
  `).run(rewardId, staff.id);

  // ── Confirmation message ─────────────────────────────────────────────────────
  const typeEmoji = { quest: '⚔️', activity: '🏃', company_kpi: '🏆' };
  const emoji     = typeEmoji[task.reward_type] || '📌';

  let detail = '';
  if (task.reward_type === 'quest') {
    const rewards = [
      task.exp_reward      ? `${task.exp_reward} EXP`                       : null,
      task.cash_reward     ? `${task.cash_reward.toLocaleString()}đ`         : null,
      task.item_reward_desc || null,
    ].filter(Boolean).join(' · ');
    if (rewards) detail = `\n🎁 ${rewards}`;
    if (task.expires_at)  detail += `\n⏳ Expires: ${task.expires_at.slice(0, 10)}`;
    detail += `\n\nComplete it → /completetask ${rewardId}`;
  } else if (task.reward_type === 'activity') {
    detail = `\n📅 Every ${task.recurrence_day} · ${task.recurrence_time}`;
    if (task.description) {
      const loc = task.description.replace(/\[capacity:\d+\]/, '').trim();
      if (loc) detail += `\n📍 ${loc}`;
    }
    detail += `\n\nSee you there. 👊`;
  }

  return bot.sendMessage(
    chatId,
    `${emoji} *Joined: ${task.title}*${detail}`,
    { parse_mode: 'Markdown' }
  );
}

module.exports = { handle };
