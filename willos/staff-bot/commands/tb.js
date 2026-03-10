// commands/tb.js
const { getDb } = require('../db');

module.exports = async function handleTownboard(bot, msg) {
  const chatId = msg.chat.id;

  const posts = getDb().prepare(`
    SELECT
      rd.id,
      rd.reward_type,
      rd.title,
      rd.description,
      rd.target_type,
      rd.dept_id,
      rd.exp_reward,
      rd.cash_reward,
      rd.item_reward_desc,
      rd.expires_at,
      tp.pinned,
      (
        SELECT COUNT(*) FROM reward_assignments ra
        WHERE ra.reward_id = rd.id AND ra.status = 'active'
      ) AS participants
    FROM townboard_posts tp
    JOIN reward_definitions rd ON rd.id = tp.reward_id
    WHERE tp.removed_at IS NULL
      AND rd.is_active = 1
      AND (rd.expires_at IS NULL OR rd.expires_at > datetime('now'))
    ORDER BY tp.pinned DESC, tp.posted_at DESC
  `).all();

  if (!posts.length) {
    return bot.sendMessage(chatId, '📋 Townboard is empty.');
  }

  const typeEmoji = {
    quest:       '⚔️',
    cash_kpi:    '💰',
    company_kpi: '🏆',
  };

  const targetLabel = {
    individual: 'Individual',
    group:      'Group',
    company:    'Company',
  };

  const lines = posts.map(p => {
    const emoji  = typeEmoji[p.reward_type] || '📌';
    const pin    = p.pinned ? '📌 ' : '';
    const scope  = p.dept_id
      ? `${targetLabel[p.target_type]} · ${p.dept_id}`
      : targetLabel[p.target_type];
    const expiry = p.expires_at
      ? `\n   ⏳ Expires: ${p.expires_at.slice(0, 10)}`
      : '';
    const rewards = [
      p.exp_reward       ? `${p.exp_reward} EXP`                        : null,
      p.cash_reward      ? `${p.cash_reward.toLocaleString()}đ`          : null,
      p.item_reward_desc || null,
    ].filter(Boolean).join(' · ');

    const participantLine = p.target_type !== 'individual'
      ? `\n   👥 ${p.participants} joined`
      : '';

    return [
      `${pin}${emoji} *${p.title}*`,
      `   ${scope}${expiry}`,
      `   🎁 ${rewards || '—'}`,
      p.description ? `   ${p.description}` : null,
      participantLine || null,
      `   /join ${p.id}`,
    ].filter(Boolean).join('\n');
  });

  const header = `📋 *TOWNBOARD*\n${'─'.repeat(20)}\n\n`;
  return bot.sendMessage(chatId, header + lines.join('\n\n'), { parse_mode: 'Markdown' });
};
