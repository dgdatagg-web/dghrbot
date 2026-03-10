/**
 * lichca.js — /lichca command
 * Quản lý lịch ca tuần (Shift Schedule)
 *
 * Usage:
 *   /lichca                         — xem lịch ca tuần hiện tại
 *   /lichca view [YYYY-WNN]         — xem lịch ca tuần
 *   /lichca [YYYY-WNN]              — xem lịch ca tuần
 *   /lichca [tên]: T2 T3 T5         — submit lịch ca (format cũ)
 *   /lichca [tên] T2:tối T3:9h-13h  — submit inline với shift type
 *
 * Guided mode (sau /lichca start hoặc khi không có tên):
 *   B1: Hỏi tên nhân viên
 *   B2: Nhận block text lịch ca nhiều dòng
 */

const { canApprove, getRoleInfo, PERMISSIONS } = require('../utils/roles');
const { getCurrentWeek } = require('../utils/noshow');

const VALID_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// In-memory guided state
const pendingLichca = new Map();
const TIMEOUT_MS = 5 * 60 * 1000;

function clearExpired() {
  const now = Date.now();
  for (const [k, v] of pendingLichca) {
    if (now > v.expiry) pendingLichca.delete(k);
  }
}

/**
 * Normalize day string → T2/T3/T4/T5/T6/T7/CN
 * Accepts: T2, t2, Thứ 2, thứ hai, Cnhat, CN, Chủ nhật, Sunday, etc.
 */
function normalizeDay(str) {
  const s = str.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/\s+/g, '');

  // CN / Chủ nhật variants
  if (['cn', 'cnhat', 'chunhat', 'chủnhật', 'sunday', 'sun', 'chuhat', 'chũnhật'].includes(s)) return 'CN';

  // T2-T7 direct
  const directMatch = s.match(/^t([2-7])$/);
  if (directMatch) return `T${directMatch[1]}`;

  // "thu2" / "thu 2" / "thứ 2" / "thu hai" etc.
  const ordinal = {
    'hai': '2', 'ba': '3', 'tu': '4', 'tư': '4', 'nam': '5', 'năm': '5',
    'sau': '6', 'sáu': '6', 'bay': '7', 'bảy': '7', 'bay': '7'
  };

  const thuMatch = s.match(/^t[huhưứ]?u?([2-7])$/);
  if (thuMatch) return `T${thuMatch[1]}`;

  // "thứ hai" → strip "thứ" then match
  const wordMatch = s.match(/^t[huhưứ]?u?(.+)$/);
  if (wordMatch) {
    const tail = wordMatch[1].replace(/\s/g, '');
    if (ordinal[tail]) return `T${ordinal[tail]}`;
  }

  return null; // invalid
}

/**
 * Parse week string from args. Returns null if not found.
 */
function parseWeekArg(str) {
  if (!str) return null;
  const match = str.match(/^(\d{4})-W(\d{1,2})$/i);
  if (match) return `${match[1]}-W${String(match[2]).padStart(2, '0')}`;
  return null;
}

/**
 * Check if role can submit shift schedule
 */
function canSubmitShift(role) {
  return ['quanly', 'gm', 'creator'].includes(role);
}

/**
 * Parse a block of text like:
 *   T2 : tối
 *   T3 : 9h-13h
 *   T4: off
 *   Cnhat: tối
 *
 * Returns { days: string[], shiftDetail: Object }
 * days = list of valid day codes that are NOT off/nghỉ
 * shiftDetail = { T2: "tối", T3: "9h-13h", T4: "off", ... }
 */
function parseShiftBlock(text) {
  const lines = text.split(/[\n,]+/).map(l => l.trim()).filter(Boolean);
  const shiftDetail = {};
  const days = [];

  for (const line of lines) {
    // Try to split on colon or space
    // Pattern: "T2 : tối" or "T2:tối" or "T2 tối"
    let dayPart, shiftPart;

    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      dayPart = line.slice(0, colonIdx).trim();
      shiftPart = line.slice(colonIdx + 1).trim();
    } else {
      // Split on first space
      const spaceIdx = line.indexOf(' ');
      if (spaceIdx !== -1) {
        dayPart = line.slice(0, spaceIdx).trim();
        shiftPart = line.slice(spaceIdx + 1).trim();
      } else {
        // Only a day, no shift info — treat as working day, no specific shift
        dayPart = line;
        shiftPart = '';
      }
    }

    const normalizedDay = normalizeDay(dayPart);
    if (!normalizedDay) continue; // skip unrecognized

    const shift = shiftPart.trim().toLowerCase();
    shiftDetail[normalizedDay] = shiftPart || 'làm';

    // Only count as working day if not off/nghỉ
    const isOff = ['off', 'nghi', 'nghỉ', 'ngday off', ''].includes(
      shift.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    );
    if (!isOff) {
      days.push(normalizedDay);
    }
  }

  return { days: [...new Set(days)], shiftDetail };
}

/**
 * Parse inline format: "T2:tối T3:9h-13h T4:off"
 * Returns { days, shiftDetail }
 */
function parseInlineShifts(tokens) {
  const shiftDetail = {};
  const days = [];

  for (const token of tokens) {
    // Token may be "T2:tối" or "T2" alone
    const colonIdx = token.indexOf(':');
    let dayPart, shiftPart;
    if (colonIdx !== -1) {
      dayPart = token.slice(0, colonIdx);
      shiftPart = token.slice(colonIdx + 1);
    } else {
      dayPart = token;
      shiftPart = 'làm';
    }

    const normalizedDay = normalizeDay(dayPart);
    if (!normalizedDay) continue;

    shiftDetail[normalizedDay] = shiftPart || 'làm';
    const isOff = ['off', 'nghi', 'nghỉ'].includes(
      shiftPart.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );
    if (!isOff) days.push(normalizedDay);
  }

  return { days: [...new Set(days)], shiftDetail };
}

async function handle(bot, msg, args, db) {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;

  clearExpired();

  const sender = db.getStaffByTelegramId(telegramId);
  if (!sender || !['active'].includes(sender.status)) {
    return bot.sendMessage(chatId, `❌ Bạn chưa đăng ký hoặc tài khoản chưa active.`);
  }

  // No args → view current week
  if (!args || args.length === 0) {
    const week = getCurrentWeek(new Date());
    return sendWeekView(bot, chatId, db, week);
  }

  // /lichca view [week?]
  if (args[0].toLowerCase() === 'view') {
    const week = parseWeekArg(args[1]) || getCurrentWeek(new Date());
    return sendWeekView(bot, chatId, db, week);
  }

  // /lichca [YYYY-WNN] alone → view
  const weekOnlyArg = parseWeekArg(args[0]);
  if (weekOnlyArg && args.length === 1) {
    return sendWeekView(bot, chatId, db, weekOnlyArg);
  }

  // Submit shift schedule — check permission
  if (!canSubmitShift(sender.role)) {
    return bot.sendMessage(chatId, `❌ Chỉ Quản lý, GM, hoặc Creator mới có thể submit lịch ca.`);
  }

  // Try to detect guided mode trigger: /lichca alone already handled above
  // Check if args[0] is a staff name or starts guided mode
  const fullText = args.join(' ');

  // Pattern A: "tên: T2 T3 T4" or "tên: T2:tối T3:9h-13h"
  const colonIdx = fullText.indexOf(':');
  if (colonIdx !== -1) {
    const staffName = fullText.slice(0, colonIdx).trim();
    const rest = fullText.slice(colonIdx + 1).trim();

    if (!staffName) {
      return bot.sendMessage(chatId, `❌ Thiếu tên nhân viên.`);
    }

    const target = db.getStaffByName(staffName);
    if (!target) {
      return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên "${staffName}".`);
    }

    // Check if rest contains week arg at end
    const tokens = rest.split(/\s+/).filter(Boolean);
    let week = getCurrentWeek(new Date());
    const lastToken = tokens[tokens.length - 1];
    if (parseWeekArg(lastToken)) {
      week = parseWeekArg(lastToken);
      tokens.pop();
    }

    // Detect format: does it look like a block ("T2 tối" style) or simple days list?
    // If any token contains ":" it's inline shift format, otherwise plain days or block
    const hasInlineShift = tokens.some(t => t.includes(':'));
    const isMultiLine = rest.includes('\n');

    let days, shiftDetail;
    if (isMultiLine) {
      ({ days, shiftDetail } = parseShiftBlock(rest));
    } else if (hasInlineShift) {
      ({ days, shiftDetail } = parseInlineShifts(tokens));
    } else {
      // Simple days list: T2 T3 T4
      const result = parseSimpleDays(tokens);
      days = result.days;
      shiftDetail = result.shiftDetail;
    }

    if (days.length === 0 && Object.keys(shiftDetail).length === 0) {
      return bot.sendMessage(chatId, `❌ Chưa nhập ngày làm việc.`);
    }

    return submitShift(bot, chatId, db, target, week, days, shiftDetail, sender.name);
  }

  // Pattern B: /lichca [tên] T2:tối T3:9h-13h (no colon after name, inline shifts)
  // First token = staff name, rest = shifts
  const firstToken = args[0];
  const restTokens = args.slice(1);

  // Check if restTokens look like shift tokens (contain days)
  if (restTokens.length > 0) {
    const firstRestNorm = normalizeDay(restTokens[0].split(':')[0]);
    if (firstRestNorm) {
      // Looks like name + inline shifts
      const target = db.getStaffByName(firstToken);
      if (!target) {
        return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên "${firstToken}".`);
      }

      let week = getCurrentWeek(new Date());
      const lastToken = restTokens[restTokens.length - 1];
      const filteredTokens = [...restTokens];
      if (parseWeekArg(lastToken)) {
        week = parseWeekArg(lastToken);
        filteredTokens.pop();
      }

      const hasInlineShift = filteredTokens.some(t => t.includes(':'));
      let days, shiftDetail;
      if (hasInlineShift) {
        ({ days, shiftDetail } = parseInlineShifts(filteredTokens));
      } else {
        ({ days, shiftDetail } = parseSimpleDays(filteredTokens));
      }

      return submitShift(bot, chatId, db, target, week, days, shiftDetail, sender.name);
    }
  }

  // Guided mode: ask for staff name, then get block text
  pendingLichca.set(telegramId, {
    step: 1,
    data: {},
    expiry: Date.now() + TIMEOUT_MS
  });

  return bot.sendMessage(chatId,
    `📅 SUBMIT LỊCH CA\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `*Bước 1/2: Tên nhân viên?*\n` +
    `Ví dụ: Hiếu\n\n` +
    `Gõ /cancel hoặc /huy để thoát`,
    { parse_mode: 'Markdown' }
  );
}

function parseSimpleDays(tokens) {
  const days = [];
  const shiftDetail = {};
  for (const t of tokens) {
    const d = normalizeDay(t);
    if (d) {
      days.push(d);
      shiftDetail[d] = 'làm';
    }
  }
  return { days: [...new Set(days)], shiftDetail };
}

async function handlePendingLichca(bot, msg, db) {
  const telegramId = String(msg.from.id);
  clearExpired();

  if (!pendingLichca.has(telegramId)) return false;

  // Cancel
  if (msg.text && (msg.text.trim() === '/cancel' || msg.text.trim() === '/huy')) {
    pendingLichca.delete(telegramId);
    await bot.sendMessage(msg.chat.id, `🚫 Đã hủy submit lịch ca.`);
    return true;
  }

  const state = pendingLichca.get(telegramId);
  state.expiry = Date.now() + TIMEOUT_MS;
  const chatId = msg.chat.id;

  const sender = db.getStaffByTelegramId(telegramId);
  if (!sender) {
    pendingLichca.delete(telegramId);
    return false;
  }

  if (state.step === 1) {
    // Expect staff name
    const staffName = msg.text ? msg.text.trim() : '';
    if (!staffName) {
      await bot.sendMessage(chatId, `❌ Vui lòng nhập tên nhân viên.`);
      return true;
    }

    const target = db.getStaffByName(staffName);
    if (!target) {
      await bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên "${staffName}". Thử lại:`);
      return true;
    }

    state.data.target = target;
    state.step = 2;

    await bot.sendMessage(chatId,
      `✅ Nhân viên: *${target.name}*\n\n` +
      `📅 *Bước 2/2: Nhập lịch ca (nhiều dòng):*\n` +
      `Ví dụ:\n` +
      `\`T2 : tối\n` +
      `T3 : 9h-13h\n` +
      `T4: off\n` +
      `T5: 9h-13h\n` +
      `T6: tối\n` +
      `Cnhat: tối\`\n\n` +
      `Hoặc ngắn gọn: \`T2:tối T3:9h-13h T4:off\`\n\n` +
      `Gõ /cancel để thoát`,
      { parse_mode: 'Markdown' }
    );
    return true;
  }

  if (state.step === 2) {
    const text = msg.text ? msg.text.trim() : '';
    if (!text) {
      await bot.sendMessage(chatId, `❌ Chưa có nội dung lịch ca. Nhập lại:`);
      return true;
    }

    pendingLichca.delete(telegramId);

    const week = getCurrentWeek(new Date());
    const { days, shiftDetail } = parseShiftBlock(text);

    await submitShift(bot, chatId, db, state.data.target, week, days, shiftDetail, sender.name);
    return true;
  }

  return false;
}

async function submitShift(bot, chatId, db, target, week, days, shiftDetail, submittedBy) {
  // Save to DB with shiftDetail
  db.upsertShiftSchedule(target.id, week, days, submittedBy, shiftDetail);

  // Build display with shift types
  const dayLabels = {
    T2: 'Thứ 2', T3: 'Thứ 3', T4: 'Thứ 4',
    T5: 'Thứ 5', T6: 'Thứ 6', T7: 'Thứ 7', CN: 'Chủ nhật'
  };

  // Show all days including off
  const allDays = VALID_DAYS.filter(d => shiftDetail[d] !== undefined);
  const daysDisplay = allDays.length > 0
    ? allDays.map(d => {
        const shift = shiftDetail[d];
        const isOff = ['off', 'nghi', 'nghỉ'].includes(
          (shift || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        );
        return isOff ? `${d}(off)` : `${d}(${shift || 'làm'})`;
      }).join(' ')
    : (days.join(' ') || '(không có ngày nào)');

  return bot.sendMessage(chatId,
    `✅ Đã lưu lịch ca!\n\n` +
    `👤 ${target.name}\n` +
    `📅 Tuần: ${week}\n` +
    `🗓️ Lịch: ${daysDisplay}\n\n` +
    `Dùng /lichca view ${week} để xem toàn bộ lịch tuần.`
  );
}

async function sendWeekView(bot, chatId, db, week) {
  const schedules = db.getShiftsByWeek(week);

  if (!schedules || schedules.length === 0) {
    return bot.sendMessage(chatId,
      `📅 Tuần ${week}\n\n` +
      `Chưa có lịch ca nào được submit.\n` +
      `Dùng /lichca [tên]: T2 T3 T5 để submit.`
    );
  }

  const lines = [`📅 LỊCH CA — ${week}`, '━━━━━━━━━━━━━━━━━━━━'];
  for (const row of schedules) {
    let days;
    let shiftDetail;
    try { days = JSON.parse(row.days); } catch { days = []; }
    try { shiftDetail = row.shift_detail ? JSON.parse(row.shift_detail) : null; } catch { shiftDetail = null; }

    const roleInfo = getRoleInfo(row.role);

    // Build display with shift types if available
    if (shiftDetail && Object.keys(shiftDetail).length > 0) {
      const daysStr = days.map(d => {
        const shift = shiftDetail[d];
        return shift && shift !== 'làm' ? `${d}(${shift})` : d;
      }).join(' ');
      lines.push(`${roleInfo.icon} ${row.name}: ${daysStr || '(nghỉ tuần này)'}`);
    } else {
      lines.push(`${roleInfo.icon} ${row.name}: ${days.join(' ')}`);
    }
  }
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push(`Tổng: ${schedules.length} nhân viên`);

  return bot.sendMessage(chatId, lines.join('\n'));
}

module.exports = { handle, handlePendingLichca, normalizeDay, parseShiftBlock };
