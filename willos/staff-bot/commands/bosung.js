/**
 * bosung.js — /bosung command
 * Bổ sung hình ảnh/bill cho báo cáo nhập hàng
 * Dành cho: nhân viên kho, quanly, gm, creator
 *
 * Flow:
 * 1. /bosung → hỏi loại bổ sung
 * 2. User chọn loại (nhập hàng / hủy hàng / đơn sai sót)
 * 3. Bot hỏi ghi chú
 * 4. User gửi hình hoặc /skip
 * 5. Bot lưu + push lên topic 174 (Thu Mua / Kho)
 */

'use strict';

const { queueRow } = require('../services/sheets_queue');
const { broadcastEvent, broadcastPhoto } = require('../utils/groups');

const TOPIC_KHO = 174;

const pending = new Map();
const TIMEOUT_MS = 10 * 60 * 1000; // 10 phút

function getIctNow() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
}

function clearSession(telegramId) {
  const s = pending.get(telegramId);
  if (s?.timeout) clearTimeout(s.timeout);
  pending.delete(telegramId);
}

function isAllowed(staff) {
  if (!staff) return false;
  return staff.department === 'kho' || ['quanly', 'gm', 'creator'].includes(staff.role);
}

async function handle(bot, msg, args, db) {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;

  const staff = db.getStaffByTelegramId(telegramId);
  if (!staff || staff.status !== 'active') {
    return bot.sendMessage(chatId, '❌ Bạn chưa đăng ký hoặc tài khoản chưa active.');
  }
  if (!isAllowed(staff)) {
    return bot.sendMessage(chatId, '❌ Lệnh này dành cho bộ phận Kho / Quản lý.');
  }

  clearSession(telegramId);

  const timeout = setTimeout(() => {
    pending.delete(telegramId);
    bot.sendMessage(chatId, '⏰ Phiên bổ sung đã hết hạn. Gõ /bosung để bắt đầu lại.').catch(() => {});
  }, TIMEOUT_MS);

  pending.set(telegramId, { step: 'select_type', chatId, staffId: staff.id, staffName: staff.name, timeout });

  return bot.sendMessage(chatId,
    '📎 BỔ SUNG BÁO CÁO\n━━━━━━━━━━━━━━━\nChọn loại cần bổ sung:',
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📦 Nhập hàng', callback_data: 'bosung_type_nhaphang' },
            { text: '⚠️ Hủy hàng', callback_data: 'bosung_type_huyhang' },
          ],
          [
            { text: '🚫 Đơn sai sót', callback_data: 'bosung_type_saisot' },
          ],
        ]
      }
    }
  );
}

async function handleCallback(bot, query, db) {
  const telegramId = String(query.from.id);
  const data = query.data;
  const chatId = query.message.chat.id;

  if (!pending.has(telegramId)) {
    return bot.answerCallbackQuery(query.id, { text: '⏰ Phiên đã hết hạn. Gõ /bosung lại.', show_alert: true });
  }

  const state = pending.get(telegramId);

  if (data.startsWith('bosung_type_')) {
    const type = data.replace('bosung_type_', '');
    const labels = { nhaphang: '📦 Nhập hàng', huyhang: '⚠️ Hủy hàng', saisot: '🚫 Đơn sai sót' };
    state.type = type;
    state.typeLabel = labels[type] || type;
    state.step = 'note';

    await bot.answerCallbackQuery(query.id);
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id }).catch(() => {});

    return bot.sendMessage(chatId,
      `${state.typeLabel}\n━━━━━━━━━━━━━━━\n📝 Ghi chú ngắn (item, số lượng, lý do...):\n/skip để bỏ qua`
    );
  }

  return bot.answerCallbackQuery(query.id);
}

async function handlePending(bot, msg, db) {
  const telegramId = String(msg.from.id);
  if (!pending.has(telegramId)) return false;

  const state = pending.get(telegramId);
  const chatId = msg.chat.id;
  const text = msg.text?.trim() || '';
  const photo = msg.photo;

  if (text === '/cancel' || text === '/huy') {
    clearSession(telegramId);
    await bot.sendMessage(chatId, '🚫 Đã hủy bổ sung.');
    return true;
  }

  // Step: note
  if (state.step === 'note') {
    state.note = text === '/skip' ? '' : text;
    state.step = 'photo';
    await bot.sendMessage(chatId,
      '📷 Gửi hình bill/chứng từ:\n(Hoặc /skip nếu không có)'
    );
    return true;
  }

  // Step: photo
  if (state.step === 'photo') {
    const ictNow = getIctNow();
    const today = ictNow.toISOString().split('T')[0];
    const timeStr = `${String(ictNow.getUTCHours()).padStart(2,'0')}:${String(ictNow.getUTCMinutes()).padStart(2,'0')}`;
    const hasPhoto = !!(photo && photo.length > 0);
    const skipPhoto = text === '/skip';

    if (!hasPhoto && !skipPhoto) {
      await bot.sendMessage(chatId, '📷 Gửi hình hoặc /skip để bỏ qua.');
      return true;
    }

    // Build report message
    const reportLines = [
      `📎 BỔ SUNG — ${state.typeLabel}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 ${state.staffName} | ⏰ ${timeStr}`,
      state.note ? `📝 ${state.note}` : '',
      hasPhoto ? '🖼 Bill đã đính kèm ✅' : '🖼 Không có hình',
      `━━━━━━━━━━━━━━━━━━━━`,
    ].filter(Boolean).join('\n');

    // Push to MANAGERS group topic 174
    if (hasPhoto) {
      const fileId = photo[photo.length - 1].file_id;
      await broadcastPhoto(bot, 'bosung', fileId, {
        caption: reportLines,
        message_thread_id: TOPIC_KHO,
      });
    } else {
      await broadcastEvent(bot, 'bosung', reportLines, {
        message_thread_id: TOPIC_KHO,
      });
    }

    // Queue to sheets
    try {
      queueRow('bosung_log', {
        date: today,
        staff_name: state.staffName,
        type: state.type,
        note: state.note || '',
        has_photo: hasPhoto ? 'yes' : 'no',
      });
    } catch (e) {
      console.error('[bosung] queueRow error:', e.message);
    }

    clearSession(telegramId);
    await bot.sendMessage(chatId, `✅ Đã bổ sung báo cáo!\n${state.typeLabel} | ${timeStr}`);
    return true;
  }

  return false;
}

module.exports = { handle, handleCallback, handlePending };
