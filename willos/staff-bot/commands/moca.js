/**
 * moca.js — /moca command (v2.1 — smart parser)
 * Fix: tự động tách tồn kho / prep khi user gõ 1 block text chứa cả hai
 */

const { getRoleInfo, canSubmitMoca, PERMISSION_DENIED_MSG } = require('../utils/roles');
const { formatDate } = require('../utils/format');
const { queueRow } = require('../services/sheets_queue');
const { broadcastEvent, getPrimaryGroup, GROUPS } = require('../utils/groups');

const pendingMoca = new Map();
const TIMEOUT_MS = 10 * 60 * 1000;

function clearExpired() {
  const now = Date.now();
  for (const [k, v] of pendingMoca) {
    if (now > v.expiry) pendingMoca.delete(k);
  }
}

function setSessionTimeout(bot, telegramId, chatId) {
  return setTimeout(async () => {
    if (pendingMoca.has(telegramId)) {
      pendingMoca.delete(telegramId);
      bot.sendMessage(chatId, '\u23f0 Phi\u00ean b\u00e1o c\u00e1o \u0111\u00e3 h\u1ebft h\u1ea1n. G\u00f5 l\u1ea1i l\u1ec7nh \u0111\u1ec3 b\u1eaft \u0111\u1ea7u.').catch(() => {});
    }
  }, TIMEOUT_MS);
}

function clearSession(telegramId) {
  const state = pendingMoca.get(telegramId);
  if (state && state.timeoutHandle) clearTimeout(state.timeoutHandle);
  pendingMoca.delete(telegramId);
}

function getIctNow() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
}

function ictTimeStr(d) {
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/**
 * Get yesterday's date string in ICT (YYYY-MM-DD)
 */
function getYesterdayIct() {
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * Query yesterday's dongca inventory for prefill
 * Returns the endInventory string or null
 */
function getYesterdayInventory(db) {
  try {
    const yesterday = getYesterdayIct();
    // Query the most recent dongca report from yesterday
    const row = db.getDb().prepare(`
      SELECT report_data FROM shift_report
      WHERE report_type = 'dongca' AND date = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(yesterday);
    if (!row) return null;
    const data = JSON.parse(row.report_data || '{}');
    // dongca stores inventory as 'inventory' field
    return data.inventory || null;
  } catch (e) {
    return null;
  }
}

function formatInventoryLines(text) {
  if (!text || text.trim() === '') return '(tr\u1ed1ng)';
  return text
    .split(/[\n,]+/)
    .map(s => s.trim().replace(/^[-\u2022*]\s*/, ''))
    .filter(s => s.length > 0)
    .map(s => '\u2022 ' + s)
    .join('\n');
}

/**
 * Smart parser: t\u00e1ch block text th\u00e0nh {inventory, prep}
 * N\u1ebfu t\u00ecm th\u1ea5y d\u00f2ng header ch\u1ee9a keyword prep \u2192 t\u00e1ch l\u00e0m 2 ph\u1ea7n
 */
function parseInventoryAndPrep(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  const prepKeywords = /^(\u0111\u00e3\s*prep|\u0111\u00e3 chu\u1ea9n b\u1ecb|prep\s*h\u00f4m|prep|chu\u1ea9n b\u1ecb)/i;
  let splitIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const clean = lines[i].replace(/^[-\u2022*\s]+/, '');
    if (prepKeywords.test(clean)) {
      splitIdx = i;
      break;
    }
  }

  if (splitIdx === -1) {
    return { inventory: rawText.trim(), prep: null };
  }

  const skipHeaderPattern = /^(m\u1edf\s*b\u1ebfp|t\u1ed3n\s*\d+\/|t\u1ed3n\s*kho|t\u1ed3n\s*ca|t\u1ed3n\s*h\u00f4m|- t\u1ed3n)/i;
  const invLines = lines.slice(0, splitIdx).filter(l => {
    const clean = l.replace(/^[-\u2022*\s]+/, '');
    return !skipHeaderPattern.test(clean);
  });

  const prepLines = lines.slice(splitIdx + 1).filter(Boolean);

  return {
    inventory: invLines.join('\n').trim() || null,
    prep: prepLines.join('\n').trim() || null,
  };
}

async function handle(bot, msg, args, db) {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;
  clearExpired();

  const staff = db.getStaffByTelegramId(telegramId);
  if (!staff) return bot.sendMessage(chatId, '❌ Bạn chưa đăng ký. Dùng /dangky [tên] nhé!');
  if (staff.status !== 'active') return bot.sendMessage(chatId, '⏳ Tài khoản chưa được kích hoạt.');
  if (!canSubmitMoca(staff)) return bot.sendMessage(chatId, PERMISSION_DENIED_MSG);

  const ictNow = getIctNow();
  const today = ictNow.toISOString().split('T')[0];
  const defaultTime = ictTimeStr(ictNow);

  clearSession(telegramId);

  const timeoutHandle = setSessionTimeout(bot, telegramId, chatId);
  pendingMoca.set(telegramId, {
    step: 1,
    data: { today, staffId: staff.id, defaultTime },
    expiry: Date.now() + TIMEOUT_MS,
    timeoutHandle,
    chatId,
  });

  return bot.sendMessage(chatId,
    '\ud83d\udfe2 M\u1ede B\u1ebeP\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\nGi\u1edd m\u1edf b\u1ebfp h\u00f4m nay?\n\nG\u00f5 /huy \u0111\u1ec3 tho\u00e1t',
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '\u2705 B\u00e2y gi\u1edd (' + defaultTime + ')', callback_data: 'moca_time_now' },
          { text: '\ud83d\udcdd Nh\u1eadp tay', callback_data: 'moca_time_manual' },
        ]]
      }
    }
  );
}

/**
 * Send Step 2 inventory prompt — with prefill if available
 */
async function sendStep2Inventory(bot, chatId, state, db) {
  const prefill = getYesterdayInventory(db);

  if (prefill && prefill.trim()) {
    // Show prefill with buttons
    state.data.prefillInventory = prefill;
    const displayLines = prefill
      .split(/[\n,]+/)
      .map(s => s.trim().replace(/^[-•*]\s*/, ''))
      .filter(s => s.length > 0)
      .map(s => `• ${s}`)
      .join('\n');

    await bot.sendMessage(chatId,
      `📦 *Bước 2/3 — Tồn kho từ hôm qua:*\n\n` +
      `📋 Từ đóng ca hôm qua:\n${displayLines}\n\n` +
      `👇 Chọn hoặc gõ /skip để bỏ qua`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Dùng luôn', callback_data: 'moca_inv_keep' },
            { text: '✏️ Sửa lại', callback_data: 'moca_inv_edit' },
          ]]
        }
      }
    );
  } else {
    // No prefill — ask normally
    await bot.sendMessage(chatId,
      '\ud83d\udce6 *B\u01b0\u1edbc 2/3 \u2014 T\u1ed3n kho t\u1eeb h\u00f4m qua:*\n' +
      '(VD: 4p heo, 17p g\u00e0, 13p t\u00f4m)\n\n' +
      '\ud83d\udca1 _Tip: G\u00f5 c\u1ea3 t\u1ed3n kho l\u1eabn prep trong 1 tin c\u0169ng \u0111\u01b0\u1ee3c!_\n' +
      'Ho\u1eb7c g\u00f5 /skip n\u1ebfu kh\u00f4ng c\u00f3',
      { parse_mode: 'Markdown' }
    );
  }
}

async function handleMocaCallback(bot, query, db) {
  const telegramId = String(query.from.id);
  clearExpired();

  const state = pendingMoca.get(telegramId);
  if (!state) {
    return bot.answerCallbackQuery(query.id, { text: '\u23f0 Phi\u00ean \u0111\u00e3 h\u1ebft h\u1ea1n. G\u00f5 /moca \u0111\u1ec3 b\u1eaft \u0111\u1ea7u l\u1ea1i.', show_alert: true });
  }

  if (state.timeoutHandle) clearTimeout(state.timeoutHandle);
  state.expiry = Date.now() + TIMEOUT_MS;
  state.timeoutHandle = setSessionTimeout(bot, telegramId, state.chatId);

  const data = query.data;

  if (state.step === 1) {
    if (data === 'moca_time_now') {
      state.data.openTime = state.data.defaultTime;
      state.step = 2;
      await bot.answerCallbackQuery(query.id);
      await bot.editMessageText(
        '\ud83d\udfe2 M\u1ede B\u1ebeP\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\nGi\u1edd m\u1edf b\u1ebfp: \u2705 ' + state.data.openTime,
        { chat_id: query.message.chat.id, message_id: query.message.message_id }
      ).catch(() => {});
      await sendStep2Inventory(bot, state.chatId, state, db);
      return;
    }
    if (data === 'moca_time_manual') {
      state.step = '1_manual';
      await bot.answerCallbackQuery(query.id);
      await bot.editMessageText(
        '\ud83d\udfe2 M\u1ede B\u1ebeP\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\nNh\u1eadp gi\u1edd m\u1edf b\u1ebfp:',
        { chat_id: query.message.chat.id, message_id: query.message.message_id }
      ).catch(() => {});
      await bot.sendMessage(state.chatId, '\u23f0 Nh\u1eadp gi\u1edd m\u1edf b\u1ebfp:\n(VD: 9h, 9:30, 09:30)');
      return;
    }
  }

  // Feature 3: Pre-fill inventory callbacks
  if (data === 'moca_inv_keep') {
    // User wants to use yesterday's inventory
    if (!state || state.step !== 2) {
      return bot.answerCallbackQuery(query.id, { text: '⏰ Phiên đã hết hạn.', show_alert: true });
    }
    state.data.inventory = state.data.prefillInventory || '';
    state.step = 3;
    await bot.answerCallbackQuery(query.id, { text: '✅ Dùng tồn kho hôm qua!' });
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
    }).catch(() => {});
    await bot.sendMessage(state.chatId,
      '\ud83c\udf73 *B\u01b0\u1edbc 3/3 \u2014 \u0110\u00e3 prep h\u00f4m nay:*\n(VD: 64p heo, 86p g\u00e0)\nHo\u1eb7c /skip',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (data === 'moca_inv_edit') {
    // User wants to type inventory manually
    if (!state || state.step !== 2) {
      return bot.answerCallbackQuery(query.id, { text: '⏰ Phiên đã hết hạn.', show_alert: true });
    }
    state.data.prefillInventory = null; // clear prefill — let them type
    await bot.answerCallbackQuery(query.id, { text: '✏️ Nhập lại tồn kho' });
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
    }).catch(() => {});
    await bot.sendMessage(state.chatId,
      '\ud83d\udce6 *B\u01b0\u1edbc 2/3 \u2014 T\u1ed3n kho:*\n' +
      '(VD: 4p heo, 17p g\u00e0, 13p t\u00f4m)\n\n' +
      '\ud83d\udca1 _Tip: G\u00f5 c\u1ea3 t\u1ed3n kho l\u1eabn prep trong 1 tin c\u0169ng \u0111\u01b0\u1ee3c!_\n' +
      'Ho\u1eb7c g\u00f5 /skip n\u1ebfu kh\u00f4ng c\u00f3',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  await bot.answerCallbackQuery(query.id).catch(() => {});
}

async function handlePendingMoca(bot, msg, db) {
  const telegramId = String(msg.from.id);
  clearExpired();

  if (!pendingMoca.has(telegramId)) return false;

  if (msg.text && (msg.text.trim() === '/cancel' || msg.text.trim() === '/huy')) {
    clearSession(telegramId);
    await bot.sendMessage(msg.chat.id, '\ud83d\udeab \u0110\u00e3 h\u1ee7y m\u1edf ca. G\u00f5 /moca \u0111\u1ec3 b\u1eaft \u0111\u1ea7u l\u1ea1i.');
    return true;
  }

  const state = pendingMoca.get(telegramId);
  if (state.timeoutHandle) clearTimeout(state.timeoutHandle);
  state.expiry = Date.now() + TIMEOUT_MS;
  state.timeoutHandle = setSessionTimeout(bot, telegramId, state.chatId);

  const staff = db.getStaffByTelegramId(telegramId);
  if (!staff) { clearSession(telegramId); return false; }

  const chatId = msg.chat.id;
  const input = (msg.text || '').trim();

  if (state.step === '1_manual') {
    let openTime = state.data.defaultTime;
    const m = input.match(/^(\d{1,2})[:h](\d{0,2})$/);
    if (m) openTime = String(parseInt(m[1])).padStart(2, '0') + ':' + (m[2] || '00').padStart(2, '0');
    else if (/^\d{1,2}$/.test(input)) openTime = String(parseInt(input)).padStart(2, '0') + ':00';
    state.data.openTime = openTime;
    state.step = 2;
    await bot.sendMessage(chatId,
      '\u2705 Gi\u1edd m\u1edf b\u1ebfp: *' + openTime + '*',
      { parse_mode: 'Markdown' }
    );
    await sendStep2Inventory(bot, chatId, state, db);
    return true;
  }

  if (state.step === 2) {
    if (input === '/skip' || input === '') {
      state.data.inventory = '';
      state.step = 3;
      await bot.sendMessage(chatId,
        '\ud83c\udf73 *B\u01b0\u1edbc 3/3 \u2014 \u0110\u00e3 prep h\u00f4m nay:*\n(VD: 64p heo, 86p g\u00e0)\nHo\u1eb7c /skip',
        { parse_mode: 'Markdown' }
      );
      return true;
    }

    const parsed = parseInventoryAndPrep(input);

    if (parsed.prep !== null) {
      // User g\u00f5 c\u1ea3 2 trong 1 block \u2014 skip b\u01b0\u1edbc 3
      state.data.inventory = parsed.inventory || '';
      state.data.prep = parsed.prep;
      clearSession(telegramId);
      await sendMocaReport(bot, msg, staff, state.data.today, state.data.openTime, state.data.inventory, state.data.prep, db);
      return true;
    }

    state.data.inventory = input;
    state.step = 3;
    await bot.sendMessage(chatId,
      '\u2705 T\u1ed3n kho \u0111\u00e3 ghi nh\u1eadn!\n\n' +
      '\ud83c\udf73 *B\u01b0\u1edbc 3/3 \u2014 \u0110\u00e3 prep h\u00f4m nay:*\n(VD: 64p heo, 86p g\u00e0)\nHo\u1eb7c /skip',
      { parse_mode: 'Markdown' }
    );
    return true;
  }

  if (state.step === 3) {
    state.data.prep = (input === '/skip' || input === '') ? '' : input;
    clearSession(telegramId);
    await sendMocaReport(bot, msg, staff, state.data.today, state.data.openTime, state.data.inventory, state.data.prep, db);
    return true;
  }

  return false;
}

async function sendMocaReport(bot, msg, staff, today, openTime, inventory, prep, db) {
  const role = getRoleInfo(staff.role);
  const chatId = msg.chat.id;

  const invLines = formatInventoryLines(inventory);
  const prepLines = formatInventoryLines(prep);

  const deptMap = { bep: '\ud83c\udf73 B\u1ebfp', bar: '\ud83c\udf79 Bar', bida: '\ud83c\udfb1 Bida', kho: '\ud83d\udce6 Kho' };
  const deptLabel = staff.department ? (deptMap[staff.department] || staff.department) : '';

  const reportMsg =
    '\ud83d\udfe2 M\u1ede CA \u2014 ' + formatDate(today) + '\n' +
    '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n' +
    '\ud83d\udc64 ' + role.icon + ' ' + staff.name + (deptLabel ? ' \u2014 ' + deptLabel : '') + '\n' +
    '\u23f0 Gi\u1edd m\u1edf b\u1ebfp: ' + openTime + '\n' +
    '\ud83d\udce6 T\u1ed3n kho (ca tr\u01b0\u1edbc):\n' + invLines + '\n' +
    '\ud83c\udf73 \u0110\u00e3 prep h\u00f4m nay:\n' + prepLines + '\n' +
    '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501';

  if (db.createShiftReport) {
    db.createShiftReport({
      staffId: staff.id,
      reportType: 'moca',
      reportData: JSON.stringify({ openTime, inventory, prep }),
      date: today,
    });
  }

  // Google Sheets queue
  try {
    queueRow('moca_log', {
      date: today,
      staff_name: staff.name,
      department: staff.department || '',
      open_time: openTime,
      inventory: inventory || '',
      prep: prep || '',
    });
  } catch (e) {
    console.error('[moca] queueRow error:', e.message);
  }

  const topicId = 172;
  let topicMsgId = null;
  const sentResults = await broadcastEvent(bot, 'moca', reportMsg, { message_thread_id: topicId });
  if (sentResults[0]) topicMsgId = sentResults[0].message_id;

  // Auto EXP after successful report
  try {
    const { autoExp } = require('../utils/exp_rules');
    await autoExp(bot, db, staff, 'moca', openTime);
  } catch (e) {
    console.error('[moca] autoExp error:', e.message);
  }

  const primaryGroupId = getPrimaryGroup('moca');
  const groupLink = topicMsgId
    ? 'https://t.me/c/' + String(primaryGroupId).replace('-100', '') + '/' + topicMsgId
    : null;

  const confirmMsg =
    '\u2705 \u0110\u00e3 g\u1eedi b\u00e1o c\u00e1o m\u1edf ca!\n' +
    '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n' +
    '\ud83d\udc64 ' + staff.name + ' | \u23f0 ' + openTime + '\n' +
    '\ud83d\udce6 T\u1ed3n kho:\n' + invLines + '\n' +
    '\ud83c\udf73 Prep:\n' + prepLines;

  const opts = {};

  if (msg.chat.type === 'private' || String(chatId) !== String(GROUPS.HR)) {
    await bot.sendMessage(chatId, confirmMsg, opts);
  }
}

module.exports = { handle, handlePendingMoca, handleMocaCallback };
