/**
 * nhaphang.js — /nhaphang command
 * Nhập hàng (Chi dùng) — guided flow, push vào topic 174
 * Hỗ trợ upload ảnh bill
 */

const { getRoleInfo, canSubmitNhaphang, PERMISSION_DENIED_MSG } = require('../utils/roles');
const { formatDate } = require('../utils/format');
const { queueRow } = require('../services/sheets_queue');
const { broadcastEvent, broadcastPhoto, getPrimaryGroup, GROUPS } = require('../utils/groups');

// In-memory state
const pendingNhaphang = new Map();
const TIMEOUT_MS = 10 * 60 * 1000; // 10 phút

function clearExpired() {
  const now = Date.now();
  for (const [k, v] of pendingNhaphang) {
    if (now > v.expiry) pendingNhaphang.delete(k);
  }
}

function setSessionTimeout(bot, telegramId, chatId) {
  return setTimeout(async () => {
    if (pendingNhaphang.has(telegramId)) {
      pendingNhaphang.delete(telegramId);
      bot.sendMessage(chatId, '⏰ Phiên nhập hàng đã hết hạn. Gõ lại lệnh để bắt đầu.').catch(() => {});
    }
  }, TIMEOUT_MS);
}

function clearSession(telegramId) {
  const state = pendingNhaphang.get(telegramId);
  if (state && state.timeoutHandle) clearTimeout(state.timeoutHandle);
  pendingNhaphang.delete(telegramId);
}

function parsePrice(str) {
  if (!str) return null;
  const cleaned = str.replace(/[.,_\s]/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? null : parsed;
}

function formatCurrency(num) {
  return num.toLocaleString('vi-VN') + '₫';
}

function getIctNow() {
  const now = new Date();
  return new Date(now.getTime() + 7 * 60 * 60 * 1000);
}

async function handle(bot, msg, args, db) {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;

  clearExpired();

  const staff = db.getStaffByTelegramId(telegramId);
  if (!staff) return bot.sendMessage(chatId, `❌ Bạn chưa đăng ký. Dùng /dangky [tên] nhé!`);
  if (staff.status !== 'active') return bot.sendMessage(chatId, `⏳ Tài khoản chưa được kích hoạt.`);
  if (!canSubmitNhaphang(staff)) return bot.sendMessage(chatId, PERMISSION_DENIED_MSG);

  // Start guided flow
  clearSession(telegramId);
  const timeoutHandle = setSessionTimeout(bot, telegramId, chatId);

  const ictNow = getIctNow();
  const today = ictNow.toISOString().split('T')[0];

  pendingNhaphang.set(telegramId, {
    step: 1,
    data: { staffId: staff.id, today },
    expiry: Date.now() + TIMEOUT_MS,
    timeoutHandle,
    chatId,
  });

  return bot.sendMessage(chatId,
    `📦 NHẬP HÀNG\n` +
    `━━━━━━━━━━━━━━━\n` +
    `Tên hàng / nguyên liệu:\n\n` +
    `Gõ /huy để thoát`
  );
}

async function handlePendingNhaphang(bot, msg, db) {
  const telegramId = String(msg.from.id);
  clearExpired();

  if (!pendingNhaphang.has(telegramId)) return false;

  // Cancel
  if (msg.text && (msg.text.trim() === '/cancel' || msg.text.trim() === '/huy')) {
    clearSession(telegramId);
    await bot.sendMessage(msg.chat.id, `🚫 Đã hủy nhập hàng.`);
    return true;
  }

  const state = pendingNhaphang.get(telegramId);
  // Reset timeout
  if (state.timeoutHandle) clearTimeout(state.timeoutHandle);
  state.expiry = Date.now() + TIMEOUT_MS;
  state.timeoutHandle = setSessionTimeout(bot, telegramId, state.chatId);

  const staff = db.getStaffByTelegramId(telegramId);
  if (!staff) {
    clearSession(telegramId);
    return false;
  }

  const chatId = msg.chat.id;
  const input = msg.text ? msg.text.trim() : '';

  // Step 1: Tên hàng
  if (state.step === 1) {
    if (!input) {
      await bot.sendMessage(chatId, `❌ Vui lòng nhập tên hàng.`);
      return true;
    }
    state.data.itemName = input;
    state.step = 2;
    await bot.sendMessage(chatId,
      `✅ Hàng: *${input}*\n\n` +
      `Số lượng + đơn vị:\n` +
      `(VD: 2kg, 5 bịch, 10 hộp)`,
      { parse_mode: 'Markdown' }
    );
    return true;
  }

  // Step 2: Số lượng
  if (state.step === 2) {
    if (!input) {
      await bot.sendMessage(chatId, `❌ Vui lòng nhập số lượng.`);
      return true;
    }
    state.data.quantity = input;
    state.step = 3;
    await bot.sendMessage(chatId,
      `✅ Số lượng: *${input}*\n\n` +
      `Giá tiền (VNĐ):`,
      { parse_mode: 'Markdown' }
    );
    return true;
  }

  // Step 3: Giá tiền
  if (state.step === 3) {
    const price = parsePrice(input);
    if (price === null) {
      await bot.sendMessage(chatId, `❌ Không nhận ra giá tiền. Nhập lại:\nVD: 180000 hoặc 180.000`);
      return true;
    }
    state.data.price = price;
    state.step = 4;
    await bot.sendMessage(chatId,
      `✅ Giá: *${formatCurrency(price)}*\n\n` +
      `Nhà cung cấp:\n(Tên NCC hoặc /skip)`,
      { parse_mode: 'Markdown' }
    );
    return true;
  }

  // Step 4: Nhà cung cấp
  if (state.step === 4) {
    state.data.supplier = (input === '/skip' || input === '') ? null : input;
    state.step = 5;

    await bot.sendMessage(chatId,
      `📎 Ảnh bill / hoá đơn:`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '📷 Chụp ngay', callback_data: 'nhaphang_photo' },
            { text: '⏭️ Bỏ qua', callback_data: 'nhaphang_skip_photo' },
          ]]
        }
      }
    );
    return true;
  }

  // Step 5: Chờ ảnh hoặc text (nhưng user gõ text thay vì dùng button)
  if (state.step === 5) {
    // Nếu user nhập text ở bước chờ ảnh → bỏ qua bill
    state.data.billFileId = null;
    const savedData = { ...state.data };
    clearSession(telegramId);
    await sendNhaphangReport(bot, msg, staff, savedData, db);
    return true;
  }

  // Step 6: Chờ ảnh (sau khi user bấm "Chụp ngay")
  if (state.step === 6) {
    // Nếu user gõ text thay vì gửi ảnh → skip
    state.data.billFileId = null;
    const savedData = { ...state.data };
    clearSession(telegramId);
    await sendNhaphangReport(bot, msg, staff, savedData, db);
    return true;
  }

  return false;
}

async function handleNhaphangPhoto(bot, msg, db) {
  const telegramId = String(msg.from.id);
  clearExpired();

  if (!pendingNhaphang.has(telegramId)) return false;
  const state = pendingNhaphang.get(telegramId);
  if (state.step !== 6) return false;

  // Reset timeout
  if (state.timeoutHandle) clearTimeout(state.timeoutHandle);

  // Get largest photo
  const photo = msg.photo[msg.photo.length - 1];
  state.data.billFileId = photo.file_id;

  const staff = db.getStaffByTelegramId(telegramId);
  const savedData = { ...state.data };
  clearSession(telegramId);

  await sendNhaphangReport(bot, msg, staff, savedData, db);
  return true;
}

async function handleNhaphangCallback(bot, query, db) {
  const telegramId = String(query.from.id);
  clearExpired();

  const state = pendingNhaphang.get(telegramId);
  if (!state) {
    return bot.answerCallbackQuery(query.id, { text: '⏰ Phiên đã hết hạn. Gõ /nhaphang để bắt đầu lại.', show_alert: true });
  }

  if (state.step !== 5) {
    return bot.answerCallbackQuery(query.id).catch(() => {});
  }

  if (query.data === 'nhaphang_photo') {
    state.step = 6;
    // Reset timeout
    if (state.timeoutHandle) clearTimeout(state.timeoutHandle);
    state.expiry = Date.now() + TIMEOUT_MS;
    state.timeoutHandle = setSessionTimeout(bot, telegramId, state.chatId);

    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(state.chatId, `📷 Gửi ảnh bill vào đây 👇`);
    return;
  }

  if (query.data === 'nhaphang_skip_photo') {
    state.data.billFileId = null;
    const savedData = { ...state.data };
    clearSession(telegramId);

    const staff = db.getStaffByTelegramId(telegramId);
    if (!staff) return bot.answerCallbackQuery(query.id);

    await bot.answerCallbackQuery(query.id);
    const fakeMsg = { chat: { id: state.chatId, type: 'private' } };
    await sendNhaphangReport(bot, fakeMsg, staff, savedData, db);
    return;
  }

  await bot.answerCallbackQuery(query.id).catch(() => {});
}

async function sendNhaphangReport(bot, msg, staff, data, db) {
  const { itemName, quantity, price, supplier, billFileId, today } = data;

  const ictNow = getIctNow();
  const timeStr = `${String(ictNow.getUTCHours()).padStart(2,'0')}:${String(ictNow.getUTCMinutes()).padStart(2,'0')}`;

  // Save to procurement_log
  if (db && db.createProcurementLog) {
    db.createProcurementLog({
      staffId: data.staffId,
      itemName,
      quantity,
      price,
      supplier,
      billFileId,
      date: today,
    });
  }

  // Google Sheets queue — nhaphang_log
  try {
    queueRow('nhaphang_log', {
      date: today,
      staff_name: staff.name,
      item: itemName,
      quantity: quantity,
      price: price,
      supplier: supplier || '',
      has_bill: billFileId ? 'yes' : 'no',
    });
  } catch (e) {
    console.error('[nhaphang] queueRow error:', e.message);
  }

  // Auto EXP for nhaphang
  try {
    const { autoExp } = require('../utils/exp_rules');
    await autoExp(bot, db, staff, 'nhaphang_submit');
  } catch (e) {
    console.error('[nhaphang] autoExp error:', e.message);
  }

  const reportMsg =
    `📦 NHẬP HÀNG — ${formatDate(today)}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 ${staff.name} | ⏰ ${timeStr}\n` +
    `🛒 Hàng: ${itemName}\n` +
    `📏 Số lượng: ${quantity}\n` +
    `💰 Giá: ${formatCurrency(price)}\n` +
    (supplier ? `🏪 NCC: ${supplier}\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━`;

  const topicId = 174; // topic Nhập hàng
  let topicMsgId = null;

  // Broadcast to FINANCE + KANSAI
  if (billFileId) {
    const sentResults = await broadcastPhoto(bot, 'nhaphang', billFileId, {
      caption: reportMsg,
      message_thread_id: topicId,
    });
    if (sentResults[0]) topicMsgId = sentResults[0].message_id;
  } else {
    const sentResults = await broadcastEvent(bot, 'nhaphang', reportMsg, {
      message_thread_id: topicId,
    });
    if (sentResults[0]) topicMsgId = sentResults[0].message_id;
  }

  const primaryGroupId = getPrimaryGroup('nhaphang'); // FINANCE
  const groupLink = topicMsgId
    ? `https://t.me/c/${String(primaryGroupId).replace('-100', '')}/${topicMsgId}`
    : null;

  const confirmMsg =
    `✅ Đã ghi nhận nhập hàng!\n` +
    `━━━━━━━━━━━━━━━\n` +
    `🛒 ${itemName} × ${quantity}\n` +
    `💰 ${formatCurrency(price)}\n` +
    (supplier ? `🏪 ${supplier}\n` : '') +
    (billFileId ? `📎 Bill đã lưu ✅\n` : '') +
    `━━━━━━━━━━━━━━━`;

  const chatId = msg.chat.id;
  if (msg.chat.type === 'private' || String(chatId) !== String(GROUPS.FINANCE)) {
    await bot.sendMessage(chatId, confirmMsg);
  }
}

function hasPendingNhaphang(telegramId) {
  clearExpired();
  return pendingNhaphang.has(String(telegramId));
}

module.exports = { handle, handlePendingNhaphang, handleNhaphangCallback, handleNhaphangPhoto, hasPendingNhaphang };
