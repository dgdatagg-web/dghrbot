/**
 * dongca.js — /dongca command (v2)
 * Đóng ca cuối ngày — guided step-by-step
 * B1: Tiền mặt → B2: Chuyển khoản → B3: Grab → B4: Tồn kho → B5: Sự cố
 * Push vào topic 172
 */

const { getRoleInfo, canSubmitDongca, canViewRevenue, PERMISSION_DENIED_MSG } = require('../utils/roles');
const { formatDate } = require('../utils/format');
const { queueRow } = require('../services/sheets_queue');
const { broadcastEvent, getPrimaryGroup, GROUPS } = require('../utils/groups');

// In-memory guided state
const pendingDongca = new Map();
const TIMEOUT_MS = 10 * 60 * 1000; // 10 phút

function clearExpired() {
  const now = Date.now();
  for (const [k, v] of pendingDongca) {
    if (now > v.expiry) pendingDongca.delete(k);
  }
}

function setSessionTimeout(bot, telegramId, chatId) {
  return setTimeout(async () => {
    if (pendingDongca.has(telegramId)) {
      pendingDongca.delete(telegramId);
      bot.sendMessage(chatId, '⏰ Phiên báo cáo đã hết hạn. Gõ lại lệnh để bắt đầu.').catch(() => {});
    }
  }, TIMEOUT_MS);
}

function clearSession(telegramId) {
  const state = pendingDongca.get(telegramId);
  if (state && state.timeoutHandle) clearTimeout(state.timeoutHandle);
  pendingDongca.delete(telegramId);
}

function formatCurrency(num) {
  return num.toLocaleString('vi-VN') + '₫';
}

function parseRevenue(str) {
  if (!str) return null;
  const cleaned = str.replace(/[.,_\s]/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? null : parsed;
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
  if (!canSubmitDongca(staff)) return bot.sendMessage(chatId, PERMISSION_DENIED_MSG);

  const ictNow = getIctNow();
  const today = ictNow.toISOString().split('T')[0];
  const timeStr = `${String(ictNow.getUTCHours()).padStart(2,'0')}:${String(ictNow.getUTCMinutes()).padStart(2,'0')}`;

  // Check đã checkin chưa
  const checkin = db.getTodayCheckin(staff.id, today);
  if (!checkin) {
    return bot.sendMessage(chatId, `⚠️ Bạn chưa /checkin hôm nay.`);
  }

  // Quick mode: /dongca [doanh thu] [ghi chú?]
  let revenue = null;
  let noteStart = 0;
  if (args.length > 0) {
    revenue = parseRevenue(args[0]);
    if (revenue !== null) noteStart = 1;
  }

  if (revenue !== null) {
    const noteText = args.slice(noteStart).join(' ').trim();
    await sendDongcaReport(bot, msg, staff, today, timeStr, checkin, {
      tienMat: revenue,
      chuyenKhoan: 0,
      grab: 0,
      inventory: '',
      note: noteText,
    }, db);
    return;
  }

  // Guided mode — start at Bước 1: Tiền mặt (nếu có quyền) hoặc Tồn kho (nếu không)
  clearSession(telegramId);
  const timeoutHandle = setSessionTimeout(bot, telegramId, chatId);
  const hasRevenue = canViewRevenue(staff);
  pendingDongca.set(telegramId, {
    step: hasRevenue ? 1 : 4,
    data: { today, timeStr, staffId: staff.id, checkin, tienMat: 0, chuyenKhoan: 0, grab: 0 },
    expiry: Date.now() + TIMEOUT_MS,
    timeoutHandle,
    chatId,
  });

  if (hasRevenue) {
    return bot.sendMessage(chatId,
      `💰 DOANH THU HÔM NAY\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Tiền mặt (VNĐ):\n\n` +
      `Gõ /huy để thoát`
    );
  } else {
    return bot.sendMessage(chatId,
      `📦 Tồn kho cuối ca:\n` +
      `(VD: 2p heo, 5p gà, 0 tôm)\n` +
      `Hoặc /skip\n\n` +
      `Gõ /huy để thoát`
    );
  }
}

async function handlePendingDongca(bot, msg, db) {
  const telegramId = String(msg.from.id);
  clearExpired();

  if (!pendingDongca.has(telegramId)) return false;

  // Cancel
  if (msg.text && (msg.text.trim() === '/cancel' || msg.text.trim() === '/huy')) {
    clearSession(telegramId);
    await bot.sendMessage(msg.chat.id, `🚫 Đã hủy đóng ca.`);
    return true;
  }

  const state = pendingDongca.get(telegramId);
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

  // Step 1: Tiền mặt
  if (state.step === 1) {
    const val = parseRevenue(input);
    if (val === null) {
      await bot.sendMessage(chatId, `❌ Không nhận ra số tiền. Nhập lại:\nVD: 1200000 hoặc 1.200.000`);
      return true;
    }
    state.data.tienMat = val;
    state.step = 2;
    await bot.sendMessage(chatId,
      `✅ Tiền mặt: *${formatCurrency(val)}*\n\n` +
      `Chuyển khoản tại quán (VNĐ):`,
      { parse_mode: 'Markdown' }
    );
    return true;
  }

  // Step 2: Chuyển khoản
  if (state.step === 2) {
    const val = parseRevenue(input);
    if (val === null) {
      await bot.sendMessage(chatId, `❌ Không nhận ra số tiền. Nhập lại:\nVD: 800000 hoặc 0`);
      return true;
    }
    state.data.chuyenKhoan = val;
    state.step = 3;
    await bot.sendMessage(chatId,
      `✅ CK tại quán: *${formatCurrency(val)}*\n\n` +
      `Grab/App (VNĐ):`,
      { parse_mode: 'Markdown' }
    );
    return true;
  }

  // Step 3: Grab/App
  if (state.step === 3) {
    const val = parseRevenue(input);
    if (val === null) {
      await bot.sendMessage(chatId, `❌ Không nhận ra số tiền. Nhập lại:\nVD: 500000 hoặc 0`);
      return true;
    }
    state.data.grab = val;
    state.step = 4;
    await bot.sendMessage(chatId,
      `✅ Grab: *${formatCurrency(val)}*\n\n` +
      `📦 Tồn kho cuối ca:\n` +
      `(VD: 2p heo, 5p gà, 0 tôm)\n` +
      `Hoặc /skip`,
      { parse_mode: 'Markdown' }
    );
    return true;
  }

  // Step 4: Tồn kho cuối ca
  if (state.step === 4) {
    state.data.inventory = (input === '/skip' || input === '') ? '' : input;
    state.step = 5;
    await bot.sendMessage(chatId,
      `⚠️ Sự cố hoặc ghi chú?\n` +
      `(VD: huỷ 1p cá hồi, máy lạnh bị rò)\n` +
      `Hoặc /skip`
    );
    return true;
  }

  // Step 5: Sự cố / ghi chú
  if (state.step === 5) {
    state.data.note = (input === '/skip' || input === '') ? '' : input;
    const savedData = { ...state.data };
    clearSession(telegramId);

    const ictNow = getIctNow();
    const timeStr = `${String(ictNow.getUTCHours()).padStart(2,'0')}:${String(ictNow.getUTCMinutes()).padStart(2,'0')}`;
    savedData.timeStr = timeStr;

    await sendDongcaReport(bot, msg, staff, savedData.today, timeStr, savedData.checkin, savedData, db);
    return true;
  }

  return false;
}

async function sendDongcaReport(bot, msg, staff, today, timeStr, checkin, reportData, db) {
  const role = getRoleInfo(staff.role);
  const chatId = msg.chat.id;
  const { tienMat = 0, chuyenKhoan = 0, grab = 0, inventory = '', note = '' } = reportData;

  // Tính thời gian làm việc
  let durationStr = '';
  if (checkin && checkin.checkin_time) {
    const checkinTime = new Date(checkin.checkin_time);
    const now = new Date();
    const diffMs = now - checkinTime;
    const diffH = Math.floor(diffMs / (1000 * 60 * 60));
    const diffM = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    durationStr = `${diffH}h${String(diffM).padStart(2,'0')}p`;
  }

  const total = tienMat + chuyenKhoan + grab;

  // Determine dept label
  const deptLabel = getDeptLabel(staff);

  const reportMsg =
    `🔴 ĐÓNG CA — ${formatDate(today)}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 ${role.icon} ${staff.name}${deptLabel ? ` | ${deptLabel}` : ''} | ⏰ ${timeStr}${durationStr ? ` (làm ${durationStr})` : ''}\n` +
    (total > 0
      ? `💰 DOANH THU:\n` +
        `• Tiền mặt: ${formatCurrency(tienMat)}\n` +
        `• CK tại quán: ${formatCurrency(chuyenKhoan)}\n` +
        `• Grab: ${formatCurrency(grab)}\n` +
        `• TỔNG: ${formatCurrency(total)}\n`
      : '') +
    (inventory ? `📦 Tồn kho cuối: ${inventory}\n` : '') +
    (note ? `⚠️ Sự cố: ${note}\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━`;

  // Save to shift_report
  if (db && db.createShiftReport) {
    db.createShiftReport({
      staffId: staff.id,
      reportType: 'dongca',
      reportData: JSON.stringify({ timeStr, tienMat, chuyenKhoan, grab, total, inventory, note }),
      date: today,
    });
  }

  // Google Sheets queue — dongca_log
  try {
    queueRow('dongca_log', {
      date: today,
      staff_name: staff.name,
      cash: tienMat,
      transfer: chuyenKhoan,
      grab: grab,
      total: total,
      end_inventory: inventory || '',
      incidents: note || '',
    });
  } catch (e) {
    console.error('[dongca] queueRow error:', e.message);
  }

  // Auto EXP for dongca
  try {
    const { autoExp } = require('../utils/exp_rules');
    const hasRevenue = total > 0;
    const hasInventory = !!(inventory && inventory.trim());
    await autoExp(bot, db, staff, 'dongca', { hasRevenue, hasInventory });
  } catch (e) {
    console.error('[dongca] autoExp error:', e.message);
  }

  const topicId = 172;
  let topicMsgId = null;
  const sentResults = await broadcastEvent(bot, 'dongca', reportMsg, { message_thread_id: topicId });
  if (sentResults[0]) topicMsgId = sentResults[0].message_id;

  const primaryGroupId = getPrimaryGroup('dongca');
  const groupLink = topicMsgId
    ? `https://t.me/c/${String(primaryGroupId).replace('-100', '')}/${topicMsgId}`
    : null;

  const confirmMsg =
    `✅ Đã báo đóng ca!\n` +
    `━━━━━━━━━━━━━━━\n` +
    `👤 ${staff.name} | ⏰ ${timeStr}${durationStr ? ` (${durationStr})` : ''}\n` +
    (total > 0
      ? `💰 Tiền mặt: ${formatCurrency(tienMat)} | CK: ${formatCurrency(chuyenKhoan)} | Grab: ${formatCurrency(grab)}\n` +
        `📊 TỔNG: ${formatCurrency(total)}\n`
      : '') +
    (inventory ? `📦 Tồn kho: ${inventory}\n` : '') +
    (note ? `⚠️ ${note}\n` : '') +
    `━━━━━━━━━━━━━━━`;

  if (msg.chat.type === 'private' || String(chatId) !== String(GROUPS.HR)) {
    await bot.sendMessage(chatId, confirmMsg);
  }
}

function getDeptLabel(staff) {
  if (!staff.department) return '';
  const map = { bep: '🍳 Bếp', bar: '🍹 Bar', bida: '🎱 Bida', kho: '📦 Kho' };
  return map[staff.department] || staff.department;
}

module.exports = { handle, handlePendingDongca, formatCurrency };
