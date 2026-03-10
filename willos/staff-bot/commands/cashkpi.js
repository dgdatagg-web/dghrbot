// commands/cashkpi.js
// Direct shortcut to create a Cash KPI for a specific staff member.
// Faster than /posttask for the most common KPI workflow.
//
// Usage: /cashkpi              — interactive flow
//        /cashkpi <tên>        — pre-fill staff name, skip to title
//
// Access: creator / gm / quanly only
// Flow:
//   1. Staff name
//   2. KPI title (what they must achieve)
//   3. Cash reward amount
//   4. Period (e.g. "March 2026", "this week")
//   5. Preview + confirm
//   → Creates reward_definition (cash_kpi) + auto-assigns to staff
//   → Announces to HR group

'use strict';

const { getDb }         = require('../db');
const { broadcastEvent } = require('../utils/groups');

// ── Session store ─────────────────────────────────────────────────────────────
const sessions = new Map();

function getSession(id)         { return sessions.get(String(id)); }
function setSession(id, data)   { sessions.set(String(id), data); }
function clearSession(id)       { sessions.delete(String(id)); }

function ictNow() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString();
}

function fmtVND(n) {
  return Number(n).toLocaleString('vi-VN') + '₫';
}

function buildPreview(s) {
  return (
    `💰 *Cash KPI: ${s.title}*\n` +
    `👤 Nhân viên: ${s.staff_name}\n` +
    `💵 Thưởng: ${fmtVND(s.cash_reward)}\n` +
    `📅 Kỳ: ${s.period}`
  );
}

// ── DB write ──────────────────────────────────────────────────────────────────
function insertCashKpi(s, actorTelegramId) {
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO reward_definitions
      (reward_type, title, description, target_type, cash_reward, created_by)
    VALUES ('cash_kpi', ?, ?, 'individual', ?, ?)
  `).run(
    s.title,
    `Period: ${s.period}`,
    s.cash_reward,
    actorTelegramId,
  );

  const rewardId = result.lastInsertRowid;

  // Auto-assign to staff
  db.prepare(`
    INSERT INTO reward_assignments (reward_id, staff_id, status)
    VALUES (?, ?, 'active')
  `).run(rewardId, s.staff_id);

  // Post to townboard so /tb shows it
  db.prepare(`
    INSERT INTO townboard_posts (reward_id, posted_by) VALUES (?, ?)
  `).run(rewardId, actorTelegramId);

  return rewardId;
}

// ── Start command ─────────────────────────────────────────────────────────────
async function handle(bot, msg, args, db) {
  const chatId     = msg.chat.id;
  const telegramId = String(msg.from.id);
  const actor      = db.getStaffByTelegramId(telegramId);

  if (!actor) return bot.sendMessage(chatId, '❌ Bạn chưa đăng ký trong hệ thống.');
  if (!['creator', 'gm', 'quanly'].includes(actor.role)) {
    return bot.sendMessage(chatId, '❌ Chỉ Creator, GM và Quản lý mới tạo Cash KPI được.');
  }

  clearSession(chatId);

  // Pre-fill staff name if provided
  if (args && args.length > 0) {
    const staffName = args.join(' ').trim();
    const staff     = db.getStaffByName(staffName);
    if (!staff) {
      return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên: ${staffName}`);
    }
    setSession(chatId, {
      step: 'title',
      staff_id: staff.id,
      staff_name: staff.name,
      actor_telegram_id: telegramId,
    });
    return bot.sendMessage(
      chatId,
      `💰 *Cash KPI cho ${staff.name}*\n\n📝 Tiêu đề KPI là gì?\n_(VD: "Zero lỗi order tháng này")_`,
      { parse_mode: 'Markdown' }
    );
  }

  // No args — start with staff name
  setSession(chatId, { step: 'staff', actor_telegram_id: telegramId });
  return bot.sendMessage(chatId, '💰 *Cash KPI — Nhân viên nào?*', { parse_mode: 'Markdown' });
}

// ── Step handler ──────────────────────────────────────────────────────────────
async function handleStep(bot, msg, db) {
  const chatId = msg.chat.id;
  const text   = (msg.text || '').trim();
  const s      = getSession(chatId);

  if (!s) return;

  // ── Staff ─────────────────────────────────────────────────────────────────────
  if (s.step === 'staff') {
    if (!text) return bot.sendMessage(chatId, '❓ Nhập tên nhân viên.');
    const staff = db.getStaffByName(text);
    if (!staff) return bot.sendMessage(chatId, `❌ Không tìm thấy: ${text}\nNhập lại tên.`);
    setSession(chatId, { ...s, step: 'title', staff_id: staff.id, staff_name: staff.name });
    return bot.sendMessage(
      chatId,
      `👤 *${staff.name}*\n\n📝 Tiêu đề KPI:`,
      { parse_mode: 'Markdown' }
    );
  }

  // ── Title ─────────────────────────────────────────────────────────────────────
  if (s.step === 'title') {
    if (!text) return bot.sendMessage(chatId, '❓ Nhập tiêu đề KPI.');
    setSession(chatId, { ...s, step: 'cash', title: text });
    return bot.sendMessage(chatId, '💵 *Tiền thưởng (đ):*', { parse_mode: 'Markdown' });
  }

  // ── Cash ──────────────────────────────────────────────────────────────────────
  if (s.step === 'cash') {
    const cash = parseInt(text.replace(/[.,\s₫đ]/g, ''), 10);
    if (isNaN(cash) || cash <= 0) return bot.sendMessage(chatId, '❓ Nhập số tiền hợp lệ (VD: 500000).');
    setSession(chatId, { ...s, step: 'period', cash_reward: cash });
    return bot.sendMessage(chatId, '📅 *Kỳ đánh giá:*\n_(VD: "Tháng 3/2026", "Tuần này", "Q1 2026")_', { parse_mode: 'Markdown' });
  }

  // ── Period ────────────────────────────────────────────────────────────────────
  if (s.step === 'period') {
    if (!text) return bot.sendMessage(chatId, '❓ Nhập kỳ đánh giá.');
    const preview = buildPreview({ ...s, period: text });
    setSession(chatId, { ...s, step: 'confirm', period: text });
    return bot.sendMessage(
      chatId,
      `*Preview:*\n\n${preview}\n\nTạo KPI này? (yes / no)`,
      { parse_mode: 'Markdown' }
    );
  }

  // ── Confirm ───────────────────────────────────────────────────────────────────
  if (s.step === 'confirm') {
    if (/^(yes|y|có|co|ok|tạo|tao)$/i.test(text)) {
      try {
        const rewardId = insertCashKpi(s, s.actor_telegram_id);
        clearSession(chatId);

        // Announce to HR group
        const announcement =
          `💰 *Cash KPI mới*\n\n` +
          `👤 ${s.staff_name}\n` +
          `🎯 ${s.title}\n` +
          `💵 ${fmtVND(s.cash_reward)} · ${s.period}`;
        await broadcastEvent(bot, 'posttask', announcement, { parse_mode: 'Markdown' })
          .catch(err => console.error('[cashkpi] announce error:', err.message));

        return bot.sendMessage(
          chatId,
          `✅ *Cash KPI đã tạo! (#${rewardId})*\n\n${buildPreview(s)}\n\nStaff có thể xem qua /tb`,
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        console.error('[cashkpi] insert error:', err.message);
        clearSession(chatId);
        return bot.sendMessage(chatId, `❌ Lỗi: ${err.message}`);
      }
    }
    if (/^(no|n|không|khong|cancel|huỷ|huy)$/i.test(text)) {
      clearSession(chatId);
      return bot.sendMessage(chatId, '🚫 Đã huỷ. Không tạo KPI.');
    }
    return bot.sendMessage(chatId, '❓ Trả lời *yes* để tạo hoặc *no* để huỷ.', { parse_mode: 'Markdown' });
  }
}

module.exports = { handle, handleStep };
