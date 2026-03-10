/**
 * addstaff.js — /addstaff command
 * Creator/GM manually registers a staff member who hasn't done /dangky yet
 * Access: Creator, GM
 *
 * Usage: /addstaff [tên] (then guided inline buttons for dept + classrole)
 *
 * Creates a record with no telegram_id. Staff activates by DMing the bot
 * with /dangky [exact same name] — system detects the unlinked record and
 * links their telegram_id instead of creating a duplicate.
 */

const { getRoleInfo } = require('../utils/roles');

const pendingAddstaff = new Map(); // keyed by caller telegramId
const TIMEOUT_MS = 10 * 60 * 1000;

function clearExpired() {
  const now = Date.now();
  for (const [k, v] of pendingAddstaff) {
    if (now > v.expiry) pendingAddstaff.delete(k);
  }
}

function isPrivileged(telegramId, senderRole) {
  const creatorIds = (process.env.CREATOR_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const gmIds      = (process.env.GM_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (creatorIds.includes(telegramId) || gmIds.includes(telegramId)) return true;
  return ['creator', 'gm'].includes(senderRole);
}

const DEPT_MAP = {
  'dept_bep':  { key: 'bep',  label: 'Bếp',  icon: '🍳' },
  'dept_bar':  { key: 'bar',  label: 'Bar',   icon: '🍹' },
  'dept_bida': { key: 'bida', label: 'Bida',  icon: '🎱' },
  'dept_kho':  { key: 'kho',  label: 'Kho',   icon: '📦' },
};

const CLASSROLE_MAP = {
  'addstaff_truong_ca': { key: 'truong_ca', label: 'Trưởng ca', icon: '👑' },
  'addstaff_nhan_vien': { key: 'nhan_vien', label: 'Nhân viên', icon: '⚡' },
};

async function handle(bot, msg, args, db) {
  const telegramId = String(msg.from.id);
  const chatId     = msg.chat.id;
  clearExpired();

  const sender = db.getStaffByTelegramId(telegramId);
  if (!isPrivileged(telegramId, sender?.role)) {
    return bot.sendMessage(chatId, `❌ Lệnh này chỉ dành cho GM hoặc Creator.`);
  }

  if (!args.length) {
    return bot.sendMessage(chatId,
      `📝 Cách dùng: /addstaff [tên nhân viên]\n\n` +
      `Ví dụ: /addstaff Minh Tuấn\n\n` +
      `Bot sẽ hỏi bộ phận và vai trò. Nhân viên sau đó tự kích hoạt bằng cách nhắn /dangky [tên] trong DM bot.`
    );
  }

  const nameArg = args.join(' ').trim();

  const RESERVED = ['newbie', 'nhanvien', 'quanly', 'gm', 'creator', 'admin', 'bot', 'all'];
  if (RESERVED.includes(nameArg.toLowerCase())) {
    return bot.sendMessage(chatId, `❌ "${nameArg}" không phải tên hợp lệ.`);
  }
  if (nameArg.length < 2 || nameArg.length > 30) {
    return bot.sendMessage(chatId, `❌ Tên phải từ 2–30 ký tự.`);
  }

  // Check if name already exists as active/pending
  const existing = db.getStaffByName(nameArg);
  if (existing && existing.status !== 'archived') {
    return bot.sendMessage(chatId,
      `⚠️ "${nameArg}" đã tồn tại trong hệ thống.\n\n` +
      `Trạng thái: ${existing.status}\n` +
      `Dùng /staff để xem chi tiết.`
    );
  }

  pendingAddstaff.set(telegramId, {
    step: 'dept',
    data: { name: nameArg, chatId },
    expiry: Date.now() + TIMEOUT_MS,
  });

  return bot.sendMessage(chatId,
    `➕ Thêm nhân viên: ${nameArg}\n\nBộ phận?`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '🍳 Bếp',  callback_data: 'addstaff_dept_bep' },
          { text: '🍹 Bar',  callback_data: 'addstaff_dept_bar' },
          { text: '🎱 Bida', callback_data: 'addstaff_dept_bida' },
          { text: '📦 Kho',  callback_data: 'addstaff_dept_kho' },
        ]]
      }
    }
  );
}

async function handleCallback(bot, query, db) {
  const telegramId = String(query.from.id);
  clearExpired();

  const state = pendingAddstaff.get(telegramId);
  if (!state) {
    return bot.answerCallbackQuery(query.id, { text: '⏰ Phiên đã hết hạn. Gõ /addstaff lại.', show_alert: true });
  }

  const data = query.data;
  state.expiry = Date.now() + TIMEOUT_MS;

  // Step 1: chọn bộ phận
  if (state.step === 'dept') {
    const deptKey = data.replace('addstaff_dept_', '');
    const dept = Object.values(DEPT_MAP).find(d => d.key === deptKey);
    if (!dept) return bot.answerCallbackQuery(query.id).catch(() => {});

    state.data.department = dept.key;
    state.data.deptLabel  = dept.label;
    state.data.deptIcon   = dept.icon;
    state.step = 'classrole';

    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(
      `${dept.icon} ${dept.label} ✅\n\nVai trò của ${state.data.name}?`,
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        reply_markup: {
          inline_keyboard: [[
            { text: '👑 Trưởng ca', callback_data: 'addstaff_truong_ca' },
            { text: '⚡ Nhân viên', callback_data: 'addstaff_nhan_vien' },
          ]]
        }
      }
    ).catch(() => {});
    return;
  }

  // Step 2: chọn vai trò
  if (state.step === 'classrole' && CLASSROLE_MAP[data]) {
    const classRole = CLASSROLE_MAP[data];
    const { name, department, deptLabel, deptIcon } = state.data;
    pendingAddstaff.delete(telegramId);

    // Create staff record with no telegram_id (null)
    db.getDb().prepare(`
      INSERT INTO staff (telegram_id, name, role, status, joined_date, department, class_role)
      VALUES (NULL, ?, 'newbie', 'inactive', date('now'), ?, ?)
    `).run(name, department, classRole.key);

    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(
      `✅ Đã thêm ${name}!\n\n` +
      `${deptIcon} ${deptLabel} — ${classRole.label}\n` +
      `⭐ EXP: 0 | Trạng thái: ⏳ Chờ kích hoạt\n\n` +
      `📲 Nhân viên tự kích hoạt bằng cách:\n` +
      `1. Nhắn tin riêng với bot\n` +
      `2. Gõ: /dangky ${name}`,
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
      }
    ).catch(e => bot.sendMessage(state.data.chatId,
      `✅ Đã thêm ${name} — ${deptIcon} ${deptLabel} — ${classRole.label}\n📲 Kích hoạt: /dangky ${name}`
    ).catch(() => {}));

    return;
  }

  await bot.answerCallbackQuery(query.id).catch(() => {});
}

function hasPendingAddstaff(telegramId) {
  clearExpired();
  return pendingAddstaff.has(String(telegramId));
}

module.exports = { handle, handleCallback, hasPendingAddstaff };
