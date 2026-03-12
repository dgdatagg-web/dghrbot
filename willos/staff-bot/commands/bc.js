/**
 * bc.js — /bc command (v3)
 * Bàn giao ca — guided step-by-step, push vào topic 172
 * Config-driven: checklist từ willos/config/bc_checklist.json
 */

'use strict';

const path = require('path');
const { getRoleInfo } = require('../utils/roles');
const { formatDate } = require('../utils/format');
const { queueRow } = require('../services/sheets_queue');
const { broadcastEvent } = require('../utils/groups');

// ─── Config ──────────────────────────────────────────────────────────────────

let _checklistConfig = null;
function getChecklistConfig() {
  if (!_checklistConfig) {
    try {
      const configPath = path.join(__dirname, '..', '..', '..', 'config', 'bc_checklist.json');
      _checklistConfig = require(configPath);
    } catch (e) {
      // Fallback relative path
      try {
        const configPath2 = path.join(__dirname, '..', '..', 'config', 'bc_checklist.json');
        _checklistConfig = require(configPath2);
      } catch (e2) {
        console.error('[bc] ⚠️ bc_checklist.json NOT FOUND — /bc will have no checklist items');
        _checklistConfig = {};
      }
    }
    // Validate: config must have at least one department with items
    const depts = Object.keys(_checklistConfig);
    if (depts.length === 0) {
      console.error('[bc] ⚠️ bc_checklist.json is empty — no departments configured');
    } else {
      const emptyCa = depts.filter(d => !_checklistConfig[d] || Object.keys(_checklistConfig[d]).length === 0);
      if (emptyCa.length > 0) {
        console.error(`[bc] ⚠️ Empty checklist for departments: ${emptyCa.join(', ')}`);
      }
    }
  }
  return _checklistConfig;
}

// Department emoji icons for /bc selection
const CA_ICONS = {
  bep: '🍳',
  prep: '🥗',
  bar: '🍹',
  bida: '🎱',
};

// Department → detect from staff.department
const DEPT_MAP = {
  bep: 'bep',
  'bếp': 'bep',
  prep: 'prep',
  bar: 'bar',
  bida: 'bida',
};

// ─── In-memory session state ──────────────────────────────────────────────────

const pendingBc = new Map();
const TIMEOUT_MS = 15 * 60 * 1000; // 15 phút

function clearExpired() {
  const now = Date.now();
  for (const [k, v] of pendingBc) {
    if (now > v.expiry) pendingBc.delete(k);
  }
}

function setSessionTimeout(bot, telegramId, chatId) {
  return setTimeout(async () => {
    if (pendingBc.has(telegramId)) {
      pendingBc.delete(telegramId);
      bot.sendMessage(chatId, '⏰ Phiên bàn giao ca đã hết hạn (15 phút). Gõ lại /bc để bắt đầu.').catch(() => {});
    }
  }, TIMEOUT_MS);
}

function clearSession(telegramId) {
  const state = pendingBc.get(telegramId);
  if (state && state.timeoutHandle) clearTimeout(state.timeoutHandle);
  pendingBc.delete(telegramId);
}

function getIctNow() {
  const now = new Date();
  return new Date(now.getTime() + 7 * 60 * 60 * 1000);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

async function handle(bot, msg, args, db) {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;

  clearExpired();

  const staff = db.getStaffByTelegramId(telegramId);
  if (!staff) return bot.sendMessage(chatId, `❌ Bạn chưa đăng ký. Dùng /dangky [tên] nhé!`);
  if (staff.status !== 'active') return bot.sendMessage(chatId, `⏳ Tài khoản chưa được kích hoạt.`);

  const ictNow = getIctNow();
  const today = ictNow.toISOString().split('T')[0];
  const timeStr = `${String(ictNow.getUTCHours()).padStart(2,'0')}:${String(ictNow.getUTCMinutes()).padStart(2,'0')}`;

  // Early bc guard: warn if < 60 min on shift
  const openCheckin = db.getAnyOpenCheckin(staff.id);
  if (openCheckin && openCheckin.checkin_time) {
    const minutesOnShift = Math.round((Date.now() - new Date(openCheckin.checkin_time).getTime()) / 60000);
    if (minutesOnShift < 60) {
      await bot.sendMessage(chatId,
        `⚠️ Bạn mới vào ca được ${minutesOnShift} phút.\n` +
        `Bàn giao ca thường làm cuối ca — bạn chắc muốn nộp ngay không?\n\n` +
        `Gõ /bc lại để tiếp tục nếu đúng, hoặc bỏ qua nếu nhầm.`
      );
      return;
    }
  }

  // Quick mode: /bc [nội dung có sẵn]
  const noteText = args.join(' ').trim();
  if (noteText) {
    const role = getRoleInfo(staff.role);
    await sendQuickBcReport(bot, msg, staff, role, today, timeStr, noteText, db);
    return;
  }

  // Guided mode — show ca selection
  clearSession(telegramId);
  const timeoutHandle = setSessionTimeout(bot, telegramId, chatId);

  pendingBc.set(telegramId, {
    staffId: staff.id,
    today,
    timeStr,
    expiry: Date.now() + TIMEOUT_MS,
    timeoutHandle,
    chatId,
    step: 'select_ca',         // current step
    caType: null,              // bep/prep/bar/bida
    sectionIndex: 0,           // which section we're on
    answers: {},               // key → value
    checkboxState: null,       // for checkbox type: { items: [...], checked: Set }
    orderIssueSubStep: null,   // for order_issue sub-flow
    orderIssueData: {},        // order issue collected data
  });

  // Detect department suggestion
  const deptRaw = (staff.department || '').toLowerCase().trim();
  const suggestedCa = DEPT_MAP[deptRaw] || null;

  const config = getChecklistConfig();
  const isPrivileged = ['creator', 'gm', 'quanly'].includes(staff.role);

  // Non-privileged staff: only show their own department's ca
  const caKeys = isPrivileged
    ? Object.keys(config)
    : (suggestedCa ? [suggestedCa] : Object.keys(config));

  const caButtons = caKeys.map(k => {
    const label = config[k]?.label || k;
    const icon = CA_ICONS[k] || '📋';
    const hint = (k === suggestedCa) ? ` ◀` : '';
    return [{ text: `${icon} ${label}${hint}`, callback_data: `bc_ca_${k}` }];
  });

  // 2-column layout
  const rows = [];
  for (let i = 0; i < caButtons.length; i += 2) {
    if (caButtons[i + 1]) {
      rows.push([caButtons[i][0], caButtons[i + 1][0]]);
    } else {
      rows.push([caButtons[i][0]]);
    }
  }

  return bot.sendMessage(chatId,
    `🔄 BÀN GIAO CA\n` +
    `━━━━━━━━━━━━━━━\n` +
    `Chọn loại ca:\n` +
    (suggestedCa ? `(${CA_ICONS[suggestedCa]} gợi ý theo phòng ban của bạn)` : ''),
    {
      reply_markup: { inline_keyboard: rows }
    }
  );
}

// ─── Callback query handler ───────────────────────────────────────────────────

async function handleBcCallback(bot, query, db) {
  const telegramId = String(query.from.id);
  const data = query.data || '';
  const chatId = query.message.chat.id;

  clearExpired();

  if (!pendingBc.has(telegramId)) {
    return bot.answerCallbackQuery(query.id, { text: '⏰ Phiên đã hết hạn. Dùng /bc lại nhé.', show_alert: true });
  }

  const state = pendingBc.get(telegramId);

  // ── Ca selection ──
  if (data.startsWith('bc_ca_')) {
    const caType = data.replace('bc_ca_', '');
    const config = getChecklistConfig();
    if (!config[caType]) {
      return bot.answerCallbackQuery(query.id, { text: '❌ Loại ca không hợp lệ.' });
    }

    state.caType = caType;
    state.sectionIndex = 0;
    state.answers = {};
    state.step = 'section';

    await bot.answerCallbackQuery(query.id);

    // Edit the selection message to confirm
    await bot.editMessageText(
      `🔄 BÀN GIAO CA — ${CA_ICONS[caType]} ${config[caType].label}`,
      { chat_id: chatId, message_id: query.message.message_id }
    ).catch(() => {});

    return askSection(bot, chatId, telegramId, state, db);
  }

  // ── Checkbox toggle (bc_chk_0, bc_chk_1, ...) ──
  if (data.startsWith('bc_chk_') && data !== 'bc_chk_confirm') {
    const idx = parseInt(data.replace('bc_chk_', ''), 10);
    if (!state.checkboxState || isNaN(idx)) {
      return bot.answerCallbackQuery(query.id);
    }

    // Toggle checked state
    if (state.checkboxState.checked.has(idx)) {
      state.checkboxState.checked.delete(idx);
    } else {
      state.checkboxState.checked.add(idx);
    }

    await bot.answerCallbackQuery(query.id);
    await updateCheckboxMessage(bot, query.message, state);
    return;
  }

  // ── Checkbox confirm ──
  if (data === 'bc_chk_confirm') {
    if (!state.checkboxState) return bot.answerCallbackQuery(query.id);
    const items = state.checkboxState.items;
    const checked = state.checkboxState.checked;
    const result = {
      done: items.filter((_, i) => checked.has(i)),
      missing: items.filter((_, i) => !checked.has(i)),
    };
    const config = getChecklistConfig();
    const section = config[state.caType].sections[state.sectionIndex];
    state.answers[section.key] = result;
    state.checkboxState = null;

    await bot.answerCallbackQuery(query.id);
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: chatId, message_id: query.message.message_id }
    ).catch(() => {});

    state.sectionIndex++;
    return askSection(bot, chatId, telegramId, state, db);
  }

  // ── Order issue: no issues ──
  if (data === 'bc_oi_none') {
    const config = getChecklistConfig();
    const section = config[state.caType].sections[state.sectionIndex];
    state.answers[section.key] = { hasIssue: false, issues: [] };

    await bot.answerCallbackQuery(query.id, { text: '✅ Không có sai sót' });
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: chatId, message_id: query.message.message_id }
    ).catch(() => {});

    state.sectionIndex++;
    return askSection(bot, chatId, telegramId, state, db);
  }

  // ── Order issue: has issues ──
  if (data === 'bc_oi_has') {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: chatId, message_id: query.message.message_id }
    ).catch(() => {});

    state.orderIssueSubStep = 'type';
    state.orderIssueData = { issues: [] };
    state.step = 'order_issue_type';

    return bot.sendMessage(chatId,
      `🚫 Đơn sai sót — Loại khách:`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📱 Grab', callback_data: 'bc_oi_type_grab' },
              { text: '🏠 Tại quán', callback_data: 'bc_oi_type_tai_quan' },
              { text: '🛍️ Mang về', callback_data: 'bc_oi_type_mang_ve' },
            ]
          ]
        }
      }
    );
  }

  // ── Order issue: select order type ──
  if (data.startsWith('bc_oi_type_')) {
    const orderType = data.replace('bc_oi_type_', '');
    state.orderIssueData.currentType = orderType;

    await bot.answerCallbackQuery(query.id);
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: chatId, message_id: query.message.message_id }
    ).catch(() => {});

    if (orderType === 'grab') {
      state.step = 'order_issue_id';
      return bot.sendMessage(chatId, `📱 Grab — Nhập mã đơn (hoặc /skip):`);
    } else {
      state.step = 'order_issue_desc';
      return bot.sendMessage(chatId, `📝 Vấn đề gì? (hoặc /skip):`);
    }
  }

  return bot.answerCallbackQuery(query.id);
}

// ─── Ask current section ──────────────────────────────────────────────────────

async function askSection(bot, chatId, telegramId, state, db) {
  const config = getChecklistConfig();
  const caConfig = config[state.caType];
  if (!caConfig) return bot.sendMessage(chatId, '❌ Lỗi cấu hình ca. Vui lòng thử lại.').catch(() => {});
  const sections = caConfig.sections;

  // Done all sections → check if bar needs handover step
  if (state.sectionIndex >= sections.length) {
    // Bar dept: ask handover if not yet collected
    const staff = db.getStaffByTelegramId(telegramId);
    if (staff && staff.department === 'bar' && !state.barHandoverAsked) {
      state.barHandoverAsked = true;
      state.step = 'bar_handover';
      pendingBc.set(telegramId, state);
      return bot.sendMessage(chatId,
        `👤 Bàn giao ca cho ai? (gõ tên hoặc /skip)`
      );
    }
    return finalizeBcReport(bot, chatId, telegramId, state, db);
  }

  const section = sections[state.sectionIndex];
  pendingBc.set(telegramId, state); // persist updated state

  if (section.type === 'checkbox') {
    return askCheckbox(bot, chatId, state, section);
  }
  if (section.type === 'quantities') {
    return askQuantities(bot, chatId, state, section);
  }
  if (section.type === 'cancel_items') {
    return askCancelItems(bot, chatId, state, section);
  }
  if (section.type === 'order_issue') {
    return askOrderIssue(bot, chatId, state, section);
  }
  if (section.type === 'text') {
    return askText(bot, chatId, state, section);
  }

  // Unknown type → skip
  state.sectionIndex++;
  return askSection(bot, chatId, telegramId, state, db);
}

// ─── Section renderers ────────────────────────────────────────────────────────

async function askCheckbox(bot, chatId, state, section) {
  const items = section.items || [];
  state.checkboxState = {
    items,
    checked: new Set(), // all unchecked by default
    messageId: null,
  };

  const keyboard = buildCheckboxKeyboard(items, state.checkboxState.checked);

  const sent = await bot.sendMessage(chatId,
    `✅ ${section.label}:\n(Nhấn để tick/bỏ tick — mặc định tất cả ❌)`,
    { reply_markup: { inline_keyboard: keyboard } }
  );
  if (sent) state.checkboxState.messageId = sent.message_id;
}

function buildCheckboxKeyboard(items, checked) {
  const rows = [];
  // Items in rows of 2
  for (let i = 0; i < items.length; i += 2) {
    const row = [];
    row.push({
      text: `${checked.has(i) ? '✅' : '❌'} ${items[i]}`,
      callback_data: `bc_chk_${i}`,
    });
    if (i + 1 < items.length) {
      row.push({
        text: `${checked.has(i + 1) ? '✅' : '❌'} ${items[i + 1]}`,
        callback_data: `bc_chk_${i + 1}`,
      });
    }
    rows.push(row);
  }
  rows.push([{ text: '✅ Xác nhận & tiếp tục', callback_data: 'bc_chk_confirm' }]);
  return rows;
}

async function updateCheckboxMessage(bot, message, state) {
  if (!state.checkboxState) return;
  const items = state.checkboxState.items;
  const keyboard = buildCheckboxKeyboard(items, state.checkboxState.checked);
  await bot.editMessageReplyMarkup(
    { inline_keyboard: keyboard },
    { chat_id: message.chat.id, message_id: message.message_id }
  ).catch(() => {});
}

async function askQuantities(bot, chatId, state, section) {
  const items = section.items || [];
  state.step = 'quantities';
  const itemList = items.map(it => `• ${it}`).join('\n');
  return bot.sendMessage(chatId,
    `📦 ${section.label}:\n` +
    `Nhập số lượng từng loại (theo thứ tự, cách nhau bằng dấu phẩy):\n\n` +
    `${itemList}\n\n` +
    `VD: 30, 4 cặp, 30, 0, 0\n` +
    `Hoặc free-text: Heo 30, Gà 30\n` +
    `/skip để bỏ qua`
  );
}

async function askCancelItems(bot, chatId, state, section) {
  state.step = 'cancel_items';
  return bot.sendMessage(chatId,
    `⚠️ ${section.label}:\n` +
    `Nhập: [item] - [lý do] - [ai gây ra]\n` +
    `VD: 1 trứng chần - Hiếu lấy ra bị bể - Hiếu\n\n` +
    `Có thể nhập nhiều dòng\n` +
    `/skip nếu không có hủy hàng`
  );
}

async function askOrderIssue(bot, chatId, state, section) {
  state.step = 'order_issue';
  return bot.sendMessage(chatId,
    `🚫 ${section.label}:\nCó sai sót không?`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Không có', callback_data: 'bc_oi_none' },
            { text: '⚠️ Có sai sót', callback_data: 'bc_oi_has' },
          ]
        ]
      }
    }
  );
}

async function askText(bot, chatId, state, section) {
  state.step = 'text';
  return bot.sendMessage(chatId,
    `📝 ${section.label}:\n` +
    (section.placeholder ? `VD: ${section.placeholder}\n` : '') +
    `/skip để bỏ qua`
  );
}

// ─── Free-text input handler ──────────────────────────────────────────────────

async function handlePendingBc(bot, msg, db) {
  const telegramId = String(msg.from.id);
  clearExpired();

  if (!pendingBc.has(telegramId)) return false;

  const isCancel = msg.text && (msg.text.trim() === '/cancel' || msg.text.trim() === '/huy');
  if (isCancel) {
    clearSession(telegramId);
    await bot.sendMessage(msg.chat.id, `🚫 Đã hủy bàn giao ca.`);
    return true;
  }

  const state = pendingBc.get(telegramId);
  if (!state || state.step === 'select_ca') return false;

  const text = msg.text ? msg.text.trim() : '';
  const chatId = msg.chat.id;
  const config = getChecklistConfig();
  const sections = config[state.caType]?.sections || [];

  // ── quantities input ──
  if (state.step === 'quantities') {
    const section = sections[state.sectionIndex];
    const isSkip = text === '/skip';
    let result = {};
    if (!isSkip && section) {
      result = parseQuantities(text, section.items || []);
    }
    if (section) state.answers[section.key] = isSkip ? null : result;
    state.step = 'section';
    state.sectionIndex++;
    return askSection(bot, chatId, telegramId, state, db).then(() => true);
  }

  // ── cancel_items input ──
  if (state.step === 'cancel_items') {
    const section = sections[state.sectionIndex];
    const isSkip = text === '/skip';
    let items = [];
    if (!isSkip && text) {
      items = parseCancelItems(text);
      // Log each to DB
      const ictNow = getIctNow();
      const today = state.today;
      for (const it of items) {
        if (db.createHuyHangLog) {
          db.createHuyHangLog({ staffId: state.staffId, item: it.item, reason: it.reason, causedBy: it.person, date: today });
        }
        // Google Sheets queue — huy_hang_log
        try {
          const staff = db.getStaffByTelegramId(String(state.staffId)) || {};
          queueRow('huy_hang_log', {
            date: today,
            staff_name: staff.name || String(state.staffId),
            item: it.item,
            reason: it.reason || '',
            caused_by: it.person || '',
          });
        } catch (e) {
          console.error('[bc] huy_hang queueRow error:', e.message);
        }
      }
    }
    if (section) state.answers[section.key] = isSkip ? [] : items;
    state.step = 'section';
    state.sectionIndex++;
    return askSection(bot, chatId, telegramId, state, db).then(() => true);
  }

  // ── text input ──
  if (state.step === 'text') {
    const section = sections[state.sectionIndex];
    const isSkip = text === '/skip';
    if (section) state.answers[section.key] = isSkip ? null : text;
    state.step = 'section';
    state.sectionIndex++;
    return askSection(bot, chatId, telegramId, state, db).then(() => true);
  }

  // ── order_issue sub-steps ──
  if (state.step === 'order_issue_id') {
    // Grab order ID
    const isSkip = text === '/skip';
    state.orderIssueData.orderId = isSkip ? null : text;
    state.step = 'order_issue_desc';
    await bot.sendMessage(chatId, `📝 Vấn đề gì? (hoặc /skip):`);
    return true;
  }

  if (state.step === 'order_issue_desc') {
    const isSkip = text === '/skip';
    const issue = {
      type: state.orderIssueData.currentType,
      orderId: state.orderIssueData.orderId || null,
      desc: isSkip ? null : text,
    };
    state.orderIssueData.issues.push(issue);

    // Log to DB
    if (db.createDonSaisotLog) {
      db.createDonSaisotLog({
        staffId: state.staffId,
        orderType: issue.type,
        orderId: issue.orderId,
        issue: issue.desc,
        date: state.today,
      });
    }

    // Check if they want to add more
    const section = sections[state.sectionIndex];
    if (section) {
      state.answers[section.key] = {
        hasIssue: true,
        issues: state.orderIssueData.issues,
      };
    }

    state.step = 'section';
    state.sectionIndex++;
    state.orderIssueSubStep = null;
    state.orderIssueData = {};
    return askSection(bot, chatId, telegramId, state, db).then(() => true);
  }

  // ── bar_handover input ──
  if (state.step === 'bar_handover') {
    const isSkip = text === '/skip';
    state.barHandoverTo = isSkip ? null : text;
    state.step = 'section';
    return finalizeBcReport(bot, chatId, telegramId, state, db).then(() => true);
  }

  return false;
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseQuantities(text, items) {
  const result = {};
  // Try comma-separated positional: "30, 4 cặp, 30, 0, 0"
  if (text.includes(',')) {
    const parts = text.split(',').map(s => s.trim());
    items.forEach((item, i) => {
      result[item] = parts[i] || '0';
    });
    return result;
  }
  // Try free-text "Heo 30, Gà 30" or "Heo: 30"
  for (const item of items) {
    const re = new RegExp(`${item}\\s*[:\\s]\\s*([\\w\\s]+)`, 'i');
    const m = text.match(re);
    if (m) result[item] = m[1].trim();
  }
  // Fill remaining
  for (const item of items) {
    if (!result[item]) result[item] = '0';
  }
  return result;
}

function parseCancelItems(text) {
  const lines = text.split('\n').filter(l => l.trim());
  return lines.map(line => {
    const parts = line.split('-').map(s => s.trim());
    return {
      item: parts[0] || line,
      reason: parts[1] || '',
      person: parts[2] || '',
    };
  });
}

// ─── Finalize & send report ───────────────────────────────────────────────────

async function finalizeBcReport(bot, chatId, telegramId, state, db) {
  const staff = db.getStaffByTelegramId(telegramId);
  if (!staff) {
    clearSession(telegramId);
    return bot.sendMessage(chatId, '❌ Lỗi: Không tìm thấy thông tin nhân viên.');
  }

  const config = getChecklistConfig();
  const caConfig = config[state.caType];
  if (!caConfig) return bot.sendMessage(chatId, '❌ Lỗi cấu hình ca. Vui lòng thử lại.').catch(() => {});
  const role = getRoleInfo(staff.role);
  const ictNow = getIctNow();
  const today = state.today;
  const timeStr = `${String(ictNow.getUTCHours()).padStart(2,'0')}:${String(ictNow.getUTCMinutes()).padStart(2,'0')}`;

  // Build report lines
  const lines = [];
  const sections = caConfig.sections;

  let hasUnfilledChecklist = false;
  let unfilledItems = [];
  let hasHuyHang = false;
  let hasSaisot = false;

  for (const section of sections) {
    const val = state.answers[section.key];

    if (section.type === 'checkbox') {
      const done = val?.done || [];
      const missing = val?.missing || section.items || [];
      if (missing.length > 0) {
        hasUnfilledChecklist = true;
        unfilledItems = missing;
      }
      const checkLines = (val?.done || []).map(i => `• ${i} ✅`);
      if (checkLines.length > 0) lines.push(`\n✅ ${section.label.toUpperCase()}:\n${checkLines.join('\n')}`);
      if (missing.length > 0) lines.push(`⚠️ Chưa fill: ${missing.join(', ')}`);
    } else if (section.type === 'quantities') {
      if (val && Object.keys(val).length > 0) {
        const qLines = Object.entries(val)
          .filter(([, v]) => v && v !== '0')
          .map(([k, v]) => `• ${k}: ${v}`);
        if (qLines.length > 0) {
          lines.push(`\n📦 ${section.label.toUpperCase()}:\n${qLines.join('\n')}`);
        } else {
          lines.push(`\n📦 ${section.label.toUpperCase()}: (trống)`);
        }
      }
    } else if (section.type === 'cancel_items') {
      if (val && val.length > 0) {
        hasHuyHang = true;
        const cancelLines = val.map(it => `• ${it.item}${it.reason ? ` — ${it.reason}` : ''}${it.person ? ` (${it.person})` : ''}`);
        lines.push(`\n⚠️ HỦY HÀNG:\n${cancelLines.join('\n')}`);
      } else {
        lines.push(`\n⚠️ HỦY HÀNG: 0`);
      }
    } else if (section.type === 'order_issue') {
      if (val && val.hasIssue && val.issues && val.issues.length > 0) {
        hasSaisot = true;
        const issueLines = val.issues.map(iss => {
          const typeLabel = { grab: '📱 Grab', tai_quan: '🏠 Tại quán', mang_ve: '🛍️ Mang về' }[iss.type] || iss.type;
          return `• ${typeLabel}${iss.orderId ? ` [${iss.orderId}]` : ''}${iss.desc ? `: ${iss.desc}` : ''}`;
        });
        lines.push(`\n🚫 ĐƠN SAI SÓT:\n${issueLines.join('\n')}`);
      } else {
        lines.push(`\n🚫 ĐƠN SAI SÓT: 0`);
      }
    } else if (section.type === 'text') {
      if (val) {
        let prefix = '📝';
        if (section.key === 'com_mi') prefix = '🍚';
        if (section.key === 'nhan_hang') prefix = '📥';
        if (section.key === 'xuat_kho') {
          prefix = section.assign_to ? `📤 XUẤT KHO (@${section.assign_to})` : '📤 XUẤT KHO';
          lines.push(`\n${prefix}: ${val}`);
          continue;
        }
        if (section.key === 'giao_ca') prefix = '🔁 GIAO CA CHO';
        if (section.key === 'can_nhap') prefix = '📋 CẦN NHẬP';
        if (section.key === 'tinh_trang') prefix = '📋 TÌNH TRẠNG CA';
        lines.push(`\n${prefix} ${section.label.toUpperCase()}: ${val}`);
      }
    }
  }

  // Determine prefix
  const prefix = hasSaisot ? '🔴' : '🔄';
  const header = `${prefix} BÀN GIAO CA — ${formatDate(today)}`;
  const subHeader = `👤 ${CA_ICONS[state.caType]} ${staff.name} — ${caConfig.label} | ⏰ ${timeStr}`;
  const separator = '━━━━━━━━━━━━━━━━━━━━';

  // Bar dept: append handover line to report
  const handoverLine = (staff.department === 'bar' && state.barHandoverTo)
    ? `\n👤 Bàn giao cho: ${state.barHandoverTo}`
    : '';

  const reportMsg = [
    header,
    separator,
    subHeader,
    separator,
    ...lines,
    ...(handoverLine ? [handoverLine] : []),
    separator,
  ].join('\n');

  // Save to shift_report
  if (db.createShiftReport) {
    const reportData = { caType: state.caType, timeStr, answers: state.answers };
    // Bar dept: include handover_to
    if (staff.department === 'bar' && state.barHandoverTo !== undefined) {
      reportData.handover_to = state.barHandoverTo || null;
    }
    db.createShiftReport({
      staffId: staff.id,
      reportType: 'bc',
      reportData: JSON.stringify(reportData),
      date: today,
    });
  }

  // Google Sheets queue — bc_log
  try {
    const missingList = unfilledItems.join(', ');
    queueRow('bc_log', {
      date: today,
      staff_name: staff.name,
      ca_type: state.caType,
      sections_json: JSON.stringify(state.answers),
      missing_checklist: missingList || '',
    });
  } catch (e) {
    console.error('[bc] queueRow error:', e.message);
  }

  // Push to HR group (log) + MANAGERS group (follow-up) — topic 172
  const topicId = 172;
  let topicMsgId = null;
  const sentResults = await broadcastEvent(bot, 'bc', reportMsg, { message_thread_id: topicId });
  // Use first result (HR) for link-back
  const sentHR = sentResults[0];
  if (sentHR) topicMsgId = sentHR.message_id;

  // Alert Nova if huy_hang — send to HR only
  if (hasHuyHang) {
    const { GROUPS } = require('../utils/groups');
    bot.sendMessage(GROUPS.HR,
      `⚠️ [Nova alert] Có hủy hàng trong báo cáo của ${staff.name}. Xem báo cáo vừa gửi.`,
      { message_thread_id: topicId }
    ).catch(() => {});
  }

  clearSession(telegramId);

  // Auto EXP for bc submission
  try {
    const { autoExp } = require('../utils/exp_rules');
    await autoExp(bot, db, staff, 'bc_submit');
  } catch (e) {
    console.error('[bc] autoExp error:', e.message);
  }

  // Confirm to user
  const confirmMsg = `✅ Bàn giao ca đã được gửi!\n━━━━━━━━━━━━━━━\n${subHeader}${staff.department === 'bar' && state.barHandoverTo ? `\n📋 Bàn giao cho: ${state.barHandoverTo}` : ''}\n━━━━━━━━━━━━━━━`;
  return bot.sendMessage(chatId, confirmMsg);
}

// ─── Quick mode (fallback) ────────────────────────────────────────────────────

async function sendQuickBcReport(bot, msg, staff, role, today, timeStr, noteText, db) {
  const reportMsg =
    `🔄 BÀN GIAO CA — ${formatDate(today)}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 ${role.icon} ${staff.name}\n` +
    `⏰ Giờ bàn giao: ${timeStr}\n` +
    `📝 Nội dung:\n${noteText}\n` +
    `━━━━━━━━━━━━━━━━━━━━`;

  if (db && db.createShiftReport) {
    db.createShiftReport({
      staffId: staff.id,
      reportType: 'bc',
      reportData: JSON.stringify({ timeStr, noteText }),
      date: today,
    });
  }

  const { GROUPS, broadcastEvent: bcast } = require('../utils/groups');
  const topicId = 172;
  let topicMsgId = null;
  const sentResults2 = await bcast(bot, 'bc', reportMsg, { message_thread_id: topicId });
  if (sentResults2[0]) topicMsgId = sentResults2[0].message_id;

  const confirmMsg =
    `✅ Đã gửi bàn giao ca!\n` +
    `━━━━━━━━━━━━━━━\n` +
    `👤 ${staff.name} | ${timeStr}\n` +
    `📝 Nội dung:\n${noteText}\n` +
    `━━━━━━━━━━━━━━━`;

  if (msg.chat.type === 'private' || String(msg.chat.id) !== String(GROUPS.HR)) {
    return bot.sendMessage(msg.chat.id, confirmMsg);
  }
}

module.exports = { handle, handlePendingBc, handleBcCallback };
