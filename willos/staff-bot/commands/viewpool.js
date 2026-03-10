// viewpool.js
// /viewpool — GM/Creator: full view of all active ESOP seats across all depts.

'use strict';

async function handle(bot, msg, args, db) {
  const chatId     = msg.chat.id;
  const telegramId = String(msg.from.id);
  const actor      = db.getStaffByTelegramId(telegramId);

  if (!actor || !['gm', 'creator'].includes(actor.role)) {
    return bot.sendMessage(chatId, '❌ Chỉ GM và Creator mới xem được.');
  }

  // Pull all active seats, joined with staff
  const rows = db.getDb().prepare(`
    SELECT ep.*, s.name, s.department, s.role
    FROM esop_pool ep
    JOIN staff s ON ep.staff_id = s.id
    WHERE ep.status = 'active'
    ORDER BY ep.dept_id ASC, ep.share_pct DESC
  `).all() || [];

  if (!rows.length) {
    return bot.sendMessage(chatId, '📭 Chưa có ESOP seat nào được gán.');
  }

  // Group by dept
  const byDept = {};
  for (const r of rows) {
    const dept = r.dept_id || 'unknown';
    if (!byDept[dept]) byDept[dept] = [];
    byDept[dept].push(r);
  }

  const cliffIcon = (unlocked) => unlocked ? '✅' : '🔒';

  let text = `📊 *ESOP Pool*\n━━━━━━━━━━━━━━━━━━━━\n`;

  for (const [dept, members] of Object.entries(byDept)) {
    text += `\n🏢 *${dept.toUpperCase()}*\n`;
    for (const m of members) {
      text += `👤 ${m.name} — ${m.share_pct}%\n`;
      text += `   📅 Vesting: ${m.vesting_start}\n`;
      text += `   Cliff: Y1 ${cliffIcon(m.cliff1_unlocked)} Y2 ${cliffIcon(m.cliff2_unlocked)} Y3 ${cliffIcon(m.cliff3_unlocked)}\n`;
    }
  }

  const total = rows.reduce((s, r) => s + (r.share_pct || 0), 0);
  text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  text += `👥 Tổng: ${rows.length} người — ${total.toFixed(2)}% đã cấp`;

  await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

module.exports = { handle };
