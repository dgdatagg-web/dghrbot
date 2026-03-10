// commands/posttask.js
// Interactive flow to post a quest, cash KPI, or activity to the Townboard.
//
// Role gates:
//   creator / gm / manager  →  quest, cash_kpi, activity
//   staff                   →  activity only
//
// After posting: summary announcement sent to HR group with "More Info" deep link.

const { getDb } = require('../db');
const { broadcastEvent } = require('../utils/groups');

// ─── Session store ──────────────────────────────────────────────────────────────
const sessions = new Map();

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ─── Helpers ────────────────────────────────────────────────────────────────────
function getSession(chatId) { return sessions.get(chatId); }
function setSession(chatId, data) { sessions.set(chatId, data); }
function clearSession(chatId) { sessions.delete(chatId); }

function isPrivileged(role) { return ['creator', 'gm', 'manager'].includes(role); }

function formatPreview(s) {
  const lines = [];
  if (s.type === 'quest') {
    lines.push(`⚔️ *Quest: ${s.title}*`);
    if (s.description)    lines.push(`   ${s.description}`);
    lines.push(`   Scope: ${s.target_type}${s.dept_id ? ` · ${s.dept_id}` : ''}`);
    if (s.capacity)       lines.push(`   Capacity: ${s.capacity} staff`);
    const rewards = [
      s.exp_reward    ? `${s.exp_reward} EXP`                   : null,
      s.cash_reward   ? `${Number(s.cash_reward).toLocaleString()}đ` : null,
      s.item_reward   || null,
    ].filter(Boolean).join(' · ');
    lines.push(`   🎁 ${rewards || '—'}`);
    if (s.expires_at) lines.push(`   ⏳ Expires: ${s.expires_at}`);
  } else if (s.type === 'cash_kpi') {
    lines.push(`💰 *Cash KPI: ${s.title}*`);
    if (s.description)    lines.push(`   ${s.description}`);
    lines.push(`   For: ${s.target_name}`);
    lines.push(`   Reward: ${Number(s.cash_reward).toLocaleString()}đ`);
    lines.push(`   Period: ${s.period}`);
  } else if (s.type === 'activity') {
    lines.push(`🏃 *Activity: ${s.title}*`);
    lines.push(`   📅 Every ${s.recurrence_day} · ${s.recurrence_time}`);
    if (s.description)    lines.push(`   ${s.description}`);
    lines.push(`   Open to: All staff`);
  }
  return lines.join('\n');
}

// ─── Group announcement ─────────────────────────────────────────────────────────
function buildAnnouncement(s, rewardId) {
  const typeEmoji = { quest: '⚔️', cash_kpi: '💰', activity: '🏃' };
  const emoji     = typeEmoji[s.type] || '📌';
  const typeLabel = { quest: 'Quest', cash_kpi: 'Cash KPI', activity: 'Activity' };

  const lines = [`${emoji} *${typeLabel[s.type] || s.type}: ${s.title}*`];

  if (s.type === 'quest') {
    const rewards = [
      s.exp_reward  ? `${s.exp_reward} EXP`                       : null,
      s.cash_reward ? `${Number(s.cash_reward).toLocaleString()}đ` : null,
      s.item_reward || null,
    ].filter(Boolean).join(' · ');
    lines.push(`🎁 ${rewards || '—'}`);
    if (s.target_type === 'group') lines.push(`👥 Group quest${s.capacity ? ` · max ${s.capacity}` : ''}`);
    if (s.expires_at) lines.push(`⏳ Expires: ${s.expires_at}`);
  } else if (s.type === 'cash_kpi') {
    lines.push(`👤 For: ${s.target_name}`);
    lines.push(`💵 ${Number(s.cash_reward).toLocaleString()}đ · ${s.period}`);
  } else if (s.type === 'activity') {
    lines.push(`📅 Every ${s.recurrence_day} · ${s.recurrence_time}`);
    if (s.description) lines.push(`📍 ${s.description}`);
    lines.push(`Open to all staff`);
  }

  return lines.join('\n');
}

async function announceToGroup(bot, s, rewardId, botUsername) {
  const text = buildAnnouncement(s, rewardId);
  const deepLink = botUsername
    ? `https://t.me/${botUsername}?start=taskinfo_${rewardId}`
    : null;

  const opts = { parse_mode: 'Markdown' };
  if (deepLink) {
    opts.reply_markup = {
      inline_keyboard: [[
        { text: '📋 More Info', url: deepLink },
      ]],
    };
  }

  await broadcastEvent(bot, 'posttask', text, opts)
    .catch(err => console.error('[posttask] announce error:', err.message));
}

// ─── DB writes ──────────────────────────────────────────────────────────────────
function insertPost(s, createdBy) {
  const db = getDb();

  let rewardId;

  if (s.type === 'quest') {
    const result = db.prepare(`
      INSERT INTO reward_definitions
        (reward_type, title, description, target_type, dept_id,
         exp_reward, cash_reward, item_reward_desc, expires_at, created_by)
      VALUES ('quest', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      s.title,
      s.description || null,
      s.target_type,
      s.dept_id     || null,
      s.exp_reward  || 0,
      s.cash_reward || 0,
      s.item_reward || null,
      s.expires_at  || null,
      createdBy,
    );
    rewardId = result.lastInsertRowid;

    if (s.target_type === 'group' && s.capacity) {
      db.prepare(`
        UPDATE reward_definitions SET description = ? WHERE id = ?
      `).run(
        (s.description ? s.description + ` [capacity:${s.capacity}]` : `[capacity:${s.capacity}]`),
        rewardId,
      );
    }

  } else if (s.type === 'cash_kpi') {
    const staff = db.prepare('SELECT id FROM staff WHERE name LIKE ?').get(`%${s.target_name}%`);
    const result = db.prepare(`
      INSERT INTO reward_definitions
        (reward_type, title, description, target_type,
         cash_reward, created_by)
      VALUES ('cash_kpi', ?, ?, 'individual', ?, ?)
    `).run(
      s.title,
      s.description ? `${s.description} | Period: ${s.period}` : `Period: ${s.period}`,
      s.cash_reward || 0,
      createdBy,
    );
    rewardId = result.lastInsertRowid;

    // Auto-assign to target staff
    if (staff) {
      db.prepare(`
        INSERT INTO reward_assignments (reward_id, staff_id, status)
        VALUES (?, ?, 'active')
      `).run(rewardId, staff.id);
    }

  } else if (s.type === 'activity') {
    const result = db.prepare(`
      INSERT INTO reward_definitions
        (reward_type, title, description, target_type,
         recurrence_day, recurrence_time, created_by)
      VALUES ('activity', ?, ?, 'open', ?, ?, ?)
    `).run(
      s.title,
      s.description || null,
      s.recurrence_day,
      s.recurrence_time,
      createdBy,
    );
    rewardId = result.lastInsertRowid;
  }

  // Post to Townboard
  db.prepare(`
    INSERT INTO townboard_posts (reward_id, posted_by)
    VALUES (?, ?)
  `).run(rewardId, createdBy);

  return rewardId;
}

// ─── Start command ──────────────────────────────────────────────────────────────
async function handle(bot, msg, _args, db, botUsername) {
  const chatId     = msg.chat.id;
  const telegramId = String(msg.from.id);
  const staff      = db.getStaffByTelegramId(telegramId);

  if (!staff) return bot.sendMessage(chatId, '❌ Bạn chưa đăng ký trong hệ thống.');

  clearSession(chatId);

  if (isPrivileged(staff.role)) {
    setSession(chatId, { step: 'type', role: staff.role, staff_id: staff.id, telegram_id: staff.telegram_id, _botUsername: botUsername });
    return bot.sendMessage(chatId,
      '📋 *Post to Townboard*\n\nChoose type:\n1. ⚔️ Quest\n2. 💰 Cash KPI\n3. 🏃 Activity',
      { parse_mode: 'Markdown' }
    );
  } else {
    // Staff → activity only
    setSession(chatId, { step: 'act_title', type: 'activity', role: staff.role, staff_id: staff.id, telegram_id: staff.telegram_id, _botUsername: botUsername });
    return bot.sendMessage(chatId,
      '🏃 *Post a Social Activity*\n\nWhat\'s the activity? (e.g. Football, Badminton, Running)',
      { parse_mode: 'Markdown' }
    );
  }
}

// ─── Step handler ───────────────────────────────────────────────────────────────
async function handleStep(bot, msg, db) {
  const chatId = msg.chat.id;
  const text   = (msg.text || '').trim();
  const s      = getSession(chatId);

  if (!s) return; // no active session

  // ── Type selection (privileged only) ─────────────────────────────────────────
  if (s.step === 'type') {
    if (text === '1' || /quest/i.test(text)) {
      setSession(chatId, { ...s, step: 'quest_title', type: 'quest' });
      return bot.sendMessage(chatId, '⚔️ *Quest title:*', { parse_mode: 'Markdown' });
    }
    if (text === '2' || /cash.?kpi|kpi/i.test(text)) {
      setSession(chatId, { ...s, step: 'kpi_title', type: 'cash_kpi' });
      return bot.sendMessage(chatId, '💰 *Cash KPI title:*\n(e.g. "Zero order errors this week")', { parse_mode: 'Markdown' });
    }
    if (text === '3' || /activity|act/i.test(text)) {
      setSession(chatId, { ...s, step: 'act_title', type: 'activity' });
      return bot.sendMessage(chatId, '🏃 *Activity name:*\n(e.g. Football, Badminton)', { parse_mode: 'Markdown' });
    }
    return bot.sendMessage(chatId, '❓ Reply 1, 2, or 3.');
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // QUEST PATH
  // ──────────────────────────────────────────────────────────────────────────────

  if (s.step === 'quest_title') {
    if (!text) return bot.sendMessage(chatId, '❓ Please enter a title.');
    setSession(chatId, { ...s, step: 'quest_desc', title: text });
    return bot.sendMessage(chatId, '📝 *Description* (optional — hit /skip to skip):', { parse_mode: 'Markdown' });
  }

  if (s.step === 'quest_desc') {
    const desc = text === '/skip' ? null : text;
    setSession(chatId, { ...s, step: 'quest_target', description: desc });
    return bot.sendMessage(chatId,
      '🎯 *Target:*\n1. Individual\n2. Group',
      { parse_mode: 'Markdown' }
    );
  }

  if (s.step === 'quest_target') {
    if (text === '1' || /individual/i.test(text)) {
      setSession(chatId, { ...s, step: 'quest_reward_type', target_type: 'individual' });
      return bot.sendMessage(chatId,
        '🎁 *Reward type:*\n1. EXP\n2. Cash\n3. Item\n4. EXP + Cash',
        { parse_mode: 'Markdown' }
      );
    }
    if (text === '2' || /group/i.test(text)) {
      setSession(chatId, { ...s, step: 'quest_capacity', target_type: 'group' });
      return bot.sendMessage(chatId, '👥 *Group capacity* (max participants, or /skip for unlimited):', { parse_mode: 'Markdown' });
    }
    return bot.sendMessage(chatId, '❓ Reply 1 (Individual) or 2 (Group).');
  }

  if (s.step === 'quest_capacity') {
    const cap = text === '/skip' ? null : parseInt(text, 10);
    if (text !== '/skip' && isNaN(cap)) return bot.sendMessage(chatId, '❓ Enter a number or /skip.');
    setSession(chatId, { ...s, step: 'quest_reward_type', capacity: cap });
    return bot.sendMessage(chatId,
      '🎁 *Reward type:*\n1. EXP\n2. Cash\n3. Item\n4. EXP + Cash',
      { parse_mode: 'Markdown' }
    );
  }

  if (s.step === 'quest_reward_type') {
    if (text === '1' || /^exp$/i.test(text)) {
      setSession(chatId, { ...s, step: 'quest_exp', reward_mode: 'exp' });
      return bot.sendMessage(chatId, '⭐ *EXP amount:*', { parse_mode: 'Markdown' });
    }
    if (text === '2' || /^cash$/i.test(text)) {
      setSession(chatId, { ...s, step: 'quest_cash', reward_mode: 'cash' });
      return bot.sendMessage(chatId, '💵 *Cash reward (đ):*', { parse_mode: 'Markdown' });
    }
    if (text === '3' || /^item$/i.test(text)) {
      setSession(chatId, { ...s, step: 'quest_item', reward_mode: 'item' });
      return bot.sendMessage(chatId, '🎁 *Item reward description:*', { parse_mode: 'Markdown' });
    }
    if (text === '4' || /exp.*cash|cash.*exp/i.test(text)) {
      setSession(chatId, { ...s, step: 'quest_exp', reward_mode: 'exp_cash' });
      return bot.sendMessage(chatId, '⭐ *EXP amount:*', { parse_mode: 'Markdown' });
    }
    return bot.sendMessage(chatId, '❓ Reply 1, 2, 3, or 4.');
  }

  if (s.step === 'quest_exp') {
    const exp = parseInt(text, 10);
    if (isNaN(exp) || exp <= 0) return bot.sendMessage(chatId, '❓ Enter a positive number.');
    if (s.reward_mode === 'exp_cash') {
      setSession(chatId, { ...s, step: 'quest_cash', exp_reward: exp });
      return bot.sendMessage(chatId, '💵 *Cash reward (đ):*', { parse_mode: 'Markdown' });
    }
    setSession(chatId, { ...s, step: 'quest_expiry', exp_reward: exp });
    return bot.sendMessage(chatId, '⏳ *Expiry date* (YYYY-MM-DD, or /skip for none):', { parse_mode: 'Markdown' });
  }

  if (s.step === 'quest_cash') {
    const cash = parseInt(text.replace(/[.,\s₫đ]/g, ''), 10);
    if (isNaN(cash) || cash <= 0) return bot.sendMessage(chatId, '❓ Enter a valid amount.');
    setSession(chatId, { ...s, step: 'quest_expiry', cash_reward: cash });
    return bot.sendMessage(chatId, '⏳ *Expiry date* (YYYY-MM-DD, or /skip for none):', { parse_mode: 'Markdown' });
  }

  if (s.step === 'quest_item') {
    if (!text) return bot.sendMessage(chatId, '❓ Describe the item reward.');
    setSession(chatId, { ...s, step: 'quest_expiry', item_reward: text });
    return bot.sendMessage(chatId, '⏳ *Expiry date* (YYYY-MM-DD, or /skip for none):', { parse_mode: 'Markdown' });
  }

  if (s.step === 'quest_expiry') {
    const expiry = text === '/skip' ? null : text;
    if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
      return bot.sendMessage(chatId, '❓ Format: YYYY-MM-DD (e.g. 2026-03-31) or /skip.');
    }
    setSession(chatId, { ...s, step: 'confirm', expires_at: expiry });
    return bot.sendMessage(chatId,
      `*Preview:*\n\n${formatPreview({ ...s, expires_at: expiry })}\n\nPost to Townboard? (yes / no)`,
      { parse_mode: 'Markdown' }
    );
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // CASH KPI PATH
  // ──────────────────────────────────────────────────────────────────────────────

  if (s.step === 'kpi_title') {
    if (!text) return bot.sendMessage(chatId, '❓ Please enter a title.');
    setSession(chatId, { ...s, step: 'kpi_desc', title: text });
    return bot.sendMessage(chatId, '📝 *Description* (optional — /skip to skip):', { parse_mode: 'Markdown' });
  }

  if (s.step === 'kpi_desc') {
    const desc = text === '/skip' ? null : text;
    setSession(chatId, { ...s, step: 'kpi_target', description: desc });
    return bot.sendMessage(chatId, '👤 *Staff name* (who this KPI is for):', { parse_mode: 'Markdown' });
  }

  if (s.step === 'kpi_target') {
    if (!text) return bot.sendMessage(chatId, '❓ Enter the staff member\'s name.');
    setSession(chatId, { ...s, step: 'kpi_cash', target_name: text });
    return bot.sendMessage(chatId, '💵 *Cash reward (đ):*', { parse_mode: 'Markdown' });
  }

  if (s.step === 'kpi_cash') {
    const cash = parseInt(text.replace(/[.,\s₫đ]/g, ''), 10);
    if (isNaN(cash) || cash <= 0) return bot.sendMessage(chatId, '❓ Enter a valid amount.');
    setSession(chatId, { ...s, step: 'kpi_period', cash_reward: cash });
    return bot.sendMessage(chatId, '📅 *Period* (e.g. "March 2026", "this week"):', { parse_mode: 'Markdown' });
  }

  if (s.step === 'kpi_period') {
    if (!text) return bot.sendMessage(chatId, '❓ Enter the period.');
    setSession(chatId, { ...s, step: 'confirm', period: text });
    return bot.sendMessage(chatId,
      `*Preview:*\n\n${formatPreview({ ...s, period: text })}\n\nPost to Townboard? (yes / no)`,
      { parse_mode: 'Markdown' }
    );
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // ACTIVITY PATH
  // ──────────────────────────────────────────────────────────────────────────────

  if (s.step === 'act_title') {
    if (!text) return bot.sendMessage(chatId, '❓ Please enter the activity name.');
    setSession(chatId, { ...s, step: 'act_day', title: text });
    return bot.sendMessage(chatId,
      `📅 *Which day?*\n${DAYS.map((d, i) => `${i + 1}. ${d}`).join('\n')}`,
      { parse_mode: 'Markdown' }
    );
  }

  if (s.step === 'act_day') {
    const idx = parseInt(text, 10) - 1;
    const day = DAYS[idx] || DAYS.find(d => new RegExp(d, 'i').test(text));
    if (!day) return bot.sendMessage(chatId, `❓ Pick a number 1–7 or type the day name.\n${DAYS.map((d, i) => `${i + 1}. ${d}`).join('\n')}`);
    setSession(chatId, { ...s, step: 'act_time', recurrence_day: day });
    return bot.sendMessage(chatId, '🕐 *Time range* (e.g. 7:00–9:00 AM, 13:30–16:00):', { parse_mode: 'Markdown' });
  }

  if (s.step === 'act_time') {
    if (!text) return bot.sendMessage(chatId, '❓ Enter the time range (e.g. 7:00–9:00 AM).');
    setSession(chatId, { ...s, step: 'act_desc', recurrence_time: text });
    return bot.sendMessage(chatId, '📝 *Details / location* (optional — /skip to skip):', { parse_mode: 'Markdown' });
  }

  if (s.step === 'act_desc') {
    const desc = text === '/skip' ? null : text;
    setSession(chatId, { ...s, step: 'confirm', description: desc });
    return bot.sendMessage(chatId,
      `*Preview:*\n\n${formatPreview({ ...s, description: desc })}\n\nPost to Townboard? (yes / no)`,
      { parse_mode: 'Markdown' }
    );
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // CONFIRM
  // ──────────────────────────────────────────────────────────────────────────────

  if (s.step === 'confirm') {
    if (/^(yes|y|có|co|ok|đăng|dang)$/i.test(text)) {
      try {
        const rewardId = insertPost(s, s.telegram_id);
        clearSession(chatId);
        await announceToGroup(bot, s, rewardId, s._botUsername);
        return bot.sendMessage(chatId,
          `✅ *Posted to Townboard!*\n\n${formatPreview(s)}\n\nID: #${rewardId} — staff can view with /tb`,
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        console.error('[posttask] insert error:', err.message);
        clearSession(chatId);
        return bot.sendMessage(chatId, `❌ Failed to post: ${err.message}`);
      }
    }
    if (/^(no|n|không|khong|cancel|huỷ|huy)$/i.test(text)) {
      clearSession(chatId);
      return bot.sendMessage(chatId, '🚫 Cancelled. Nothing posted.');
    }
    return bot.sendMessage(chatId, '❓ Reply *yes* to post or *no* to cancel.', { parse_mode: 'Markdown' });
  }
}

module.exports = { handle, handleStep };
