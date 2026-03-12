/**
 * setcompanykpi.js — /setcompanykpi
 * GM/Creator sets company-level KPI targets.
 * Interactive flow: select KPI key → set target value → optional period → confirm.
 *
 * Usage:
 *   /setcompanykpi              → interactive flow
 *   /setcompanykpi delete [key] → remove a KPI target
 *
 * Access: creator / gm only
 */

'use strict';

const { broadcastEvent } = require('../utils/groups');

// ── Session store ─────────────────────────────────────────────────────────────
const sessions = new Map();
const TIMEOUT_MS = 5 * 60 * 1000;

function getSession(id)       { return sessions.get(String(id)); }
function setSession(id, data) { sessions.set(String(id), data); }
function clearSession(id)     { sessions.delete(String(id)); }

// ── Suggested KPI keys — common restaurant/ops targets ───────────────────────
const SUGGESTED_KPIS = [
  { key: 'revenue_monthly',     label: 'Doanh thu tháng',        unit: '₫' },
  { key: 'customer_rating',     label: 'Điểm KH trung bình',    unit: '/5' },
  { key: 'staff_retention',     label: 'Tỷ lệ giữ NV',         unit: '%' },
  { key: 'attendance_rate',     label: 'Tỷ lệ đi làm',         unit: '%' },
  { key: 'bc_compliance',       label: 'Tỷ lệ BC đầy đủ',      unit: '%' },
  { key: 'error_rate_target',   label: 'Mục tiêu sai sót',      unit: 'lần/tháng' },
  { key: 'prep_quality',        label: 'Chất lượng prep',        unit: '%' },
];

function fmtVND(n) {
  return Number(n).toLocaleString('vi-VN') + '₫';
}

function formatTarget(key, value) {
  const kpi = SUGGESTED_KPIS.find(k => k.key === key);
  if (kpi && kpi.unit === '₫') return fmtVND(value);
  if (kpi && kpi.unit === '%') return value + '%';
  return String(value) + (kpi ? ' ' + kpi.unit : '');
}

// ── Handle ────────────────────────────────────────────────────────────────────

async function handle(bot, msg, args, db) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);

  const actor = db.getStaffByTelegramId(telegramId);
  if (!actor) return bot.sendMessage(chatId, '❌ Bạn chưa đăng ký.');
  if (!['gm', 'creator'].includes(actor.role)) {
    return bot.sendMessage(chatId, '❌ Chỉ GM và Creator mới dùng được lệnh này.');
  }

  // ── Delete sub-command ──
  if (args && args[0] === 'delete' && args[1]) {
    const key = args.slice(1).join('_').toLowerCase();
    const result = db.deleteCompanyKpi(key);
    if (result.changes > 0) {
      return bot.sendMessage(chatId, `✅ Đã xoá KPI: ${key}`);
    }
    return bot.sendMessage(chatId, `❌ Không tìm thấy KPI: ${key}`);
  }

  // Start interactive flow
  clearSession(telegramId);

  // Show current targets + suggested KPIs
  const current = db.getCompanyKpiTargets();
  let msg_text = '🎯 ĐẶT KPI CÔNG TY\n━━━━━━━━━━━━━━━━━━━━\n';

  if (current.length > 0) {
    msg_text += '\n📊 KPI hiện tại:\n';
    current.forEach((t, i) => {
      const status = t.hit ? '✅' : '⏳';
      msg_text += `${i + 1}. ${status} ${t.kpi_key} — ${formatTarget(t.kpi_key, t.current_value || 0)} / ${formatTarget(t.kpi_key, t.target_value)}`;
      if (t.period) msg_text += ` (${t.period})`;
      msg_text += '\n';
    });
    msg_text += '\n━━━━━━━━━━━━━━━━━━━━\n';
  }

  msg_text += '\nChọn KPI để đặt mục tiêu:';

  // Build inline keyboard — 2 per row
  const rows = [];
  for (let i = 0; i < SUGGESTED_KPIS.length; i += 2) {
    const row = [{ text: SUGGESTED_KPIS[i].label, callback_data: `ckpi_${SUGGESTED_KPIS[i].key}` }];
    if (SUGGESTED_KPIS[i + 1]) {
      row.push({ text: SUGGESTED_KPIS[i + 1].label, callback_data: `ckpi_${SUGGESTED_KPIS[i + 1].key}` });
    }
    rows.push(row);
  }
  rows.push([{ text: '📝 Tự nhập tên KPI', callback_data: 'ckpi_custom' }]);

  setSession(telegramId, {
    step: 'select_kpi',
    data: { actorId: actor.id, actorName: actor.name },
    expiry: Date.now() + TIMEOUT_MS,
  });

  return bot.sendMessage(chatId, msg_text, {
    reply_markup: { inline_keyboard: rows }
  });
}

// ── Callback handler ──────────────────────────────────────────────────────────

async function handleCallback(bot, query, db) {
  const telegramId = String(query.from.id);
  const chatId = query.message.chat.id;
  const data = query.data;

  const session = getSession(telegramId);
  if (!session || Date.now() > session.expiry) {
    clearSession(telegramId);
    return bot.answerCallbackQuery(query.id, { text: '⏰ Hết hạn. Gõ /setcompanykpi lại.' });
  }

  if (session.step === 'select_kpi' && data.startsWith('ckpi_')) {
    const key = data.replace('ckpi_', '');

    if (key === 'custom') {
      session.step = 'custom_key';
      setSession(telegramId, session);
      await bot.answerCallbackQuery(query.id);
      return bot.sendMessage(chatId, '📝 Nhập tên KPI (ví dụ: customer_satisfaction):');
    }

    session.data.kpiKey = key;
    const kpiLabel = SUGGESTED_KPIS.find(k => k.key === key)?.label || key;
    session.data.kpiLabel = kpiLabel;
    session.step = 'set_target';
    setSession(telegramId, session);

    await bot.answerCallbackQuery(query.id);
    return bot.sendMessage(chatId,
      `📊 ${kpiLabel}\n\nNhập mục tiêu (số):\n` +
      `Ví dụ: 500000000 (doanh thu) hoặc 95 (tỷ lệ %)`
    );
  }

  if (session.step === 'confirm' && data === 'ckpi_confirm') {
    const { kpiKey, kpiLabel, targetValue, period, actorId, actorName } = session.data;

    db.upsertCompanyKpi({
      kpiKey,
      targetValue,
      currentValue: 0,
      period: period || null,
      setBy: actorId,
    });

    clearSession(telegramId);
    await bot.answerCallbackQuery(query.id, { text: '✅ Đã lưu!' });

    const confirmMsg =
      `🎯 KPI CÔNG TY — ĐÃ ĐẶT\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 ${kpiLabel || kpiKey}\n` +
      `🎯 Mục tiêu: ${formatTarget(kpiKey, targetValue)}\n` +
      (period ? `📅 Kỳ: ${period}\n` : '') +
      `👤 Đặt bởi: ${actorName}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Dùng /companyscore để xem tiến độ.`;

    await bot.sendMessage(chatId, confirmMsg);

    // Broadcast to MANAGERS
    await broadcastEvent(bot, 'important', confirmMsg).catch(e =>
      console.error('[setcompanykpi] broadcast error:', e.message)
    );
    return;
  }

  if (session.step === 'confirm' && data === 'ckpi_cancel') {
    clearSession(telegramId);
    await bot.answerCallbackQuery(query.id, { text: '❌ Đã huỷ.' });
    return bot.sendMessage(chatId, '❌ Đã huỷ đặt KPI.');
  }
}

// ── Text step handler ─────────────────────────────────────────────────────────

async function handleStep(bot, msg, db) {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  const session = getSession(telegramId);
  if (!session || Date.now() > session.expiry) {
    clearSession(telegramId);
    return false;
  }

  if (session.step === 'custom_key') {
    const key = text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!key || key.length < 2) {
      await bot.sendMessage(chatId, '❌ Tên KPI quá ngắn. Nhập lại:');
      return true;
    }
    session.data.kpiKey = key;
    session.data.kpiLabel = text;
    session.step = 'set_target';
    setSession(telegramId, session);
    await bot.sendMessage(chatId,
      `📊 ${text}\n\nNhập mục tiêu (số):`
    );
    return true;
  }

  if (session.step === 'set_target') {
    const num = parseFloat(text.replace(/[,.\s₫%]/g, ''));
    if (isNaN(num) || num <= 0) {
      await bot.sendMessage(chatId, '❌ Số không hợp lệ. Nhập lại mục tiêu:');
      return true;
    }
    session.data.targetValue = num;
    session.step = 'set_period';
    setSession(telegramId, session);
    await bot.sendMessage(chatId,
      '📅 Kỳ áp dụng? (ví dụ: "Tháng 3/2026", "Q1 2026")\nGõ "skip" để bỏ qua.',
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '⏭ Bỏ qua', callback_data: 'ckpi_period_skip' },
          ]]
        }
      }
    );
    return true;
  }

  if (session.step === 'set_period') {
    if (text.toLowerCase() !== 'skip') {
      session.data.period = text;
    }
    return await showConfirm(bot, chatId, telegramId, session);
  }

  return false;
}

// Handle period skip callback
async function handlePeriodSkip(bot, query) {
  const telegramId = String(query.from.id);
  const chatId = query.message.chat.id;
  const session = getSession(telegramId);

  if (!session || session.step !== 'set_period') {
    return bot.answerCallbackQuery(query.id, { text: '⏰ Hết hạn.' });
  }

  await bot.answerCallbackQuery(query.id);
  return await showConfirm(bot, chatId, telegramId, session);
}

async function showConfirm(bot, chatId, telegramId, session) {
  const { kpiKey, kpiLabel, targetValue, period } = session.data;
  session.step = 'confirm';
  setSession(telegramId, session);

  const preview =
    `📋 XÁC NHẬN KPI\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 ${kpiLabel || kpiKey}\n` +
    `🎯 Mục tiêu: ${formatTarget(kpiKey, targetValue)}\n` +
    (period ? `📅 Kỳ: ${period}\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━`;

  await bot.sendMessage(chatId, preview, {
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Xác nhận', callback_data: 'ckpi_confirm' },
        { text: '❌ Huỷ', callback_data: 'ckpi_cancel' },
      ]]
    }
  });
  return true;
}

// ── Check if a message belongs to this flow ───────────────────────────────────

function hasActiveSession(telegramId) {
  const s = getSession(telegramId);
  return s && Date.now() <= s.expiry && ['custom_key', 'set_target', 'set_period'].includes(s.step);
}

module.exports = { handle, handleCallback, handleStep, handlePeriodSkip, hasActiveSession };
