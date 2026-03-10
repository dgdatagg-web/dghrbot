/**
 * dangky.js — /dangky command (v3)
 *
 * Syntax:
 *   /dangky [tên]              → đăng ký nhân viên thường (newbie, dept + classrole qua inline keyboard)
 *   /dangky [tên] quanly       → đăng ký + request Quản lý (pending, chờ GM/Creator approve)
 *
 * Rules:
 *   - Bắt buộc có @username Telegram trước khi đăng ký
 *   - Username tự động lưu vào DB
 *   - Sau khi tạo tài khoản → thông báo HQ group (GROUP_CHAT_ID)
 */

const { getRoleInfo } = require('../utils/roles');
const { queueRow } = require('../services/sheets_queue');
const { broadcastEvent } = require('../utils/groups');

function queueStaffRoster(staff) {
  try {
    const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
    queueRow('staff_roster', {
      date: today,
      name: staff.name,
      username: staff.username || '',
      role: staff.role || '',
      department: staff.department || '',
      class_role: staff.class_role || '',
      status: staff.status || 'active',
    });
  } catch (e) { /* non-fatal */ }
}

const pendingDangky = new Map();
const TIMEOUT_MS = 10 * 60 * 1000;

function clearExpired() {
  const now = Date.now();
  for (const [k, v] of pendingDangky) {
    if (now > v.expiry) pendingDangky.delete(k);
  }
}

const DEPT_MAP = {
  'dept_bep':  { key: 'bep',  label: 'Bếp',  icon: '🍳' },
  'dept_bar':  { key: 'bar',  label: 'Bar',   icon: '🍹' },
  'dept_bida': { key: 'bida', label: 'Bida',  icon: '🎱' },
  'dept_kho':  { key: 'kho',  label: 'Kho',   icon: '📦' },
};

const CLASSROLE_MAP = {
  'classrole_truong_ca': { key: 'truong_ca', label: 'Trưởng ca', icon: '👑' },
  'classrole_nhan_vien': { key: 'nhan_vien', label: 'Nhân viên', icon: '⚡' },
};

// Role aliases recognized in /dangky [name] [role]
const ROLE_REQUEST_MAP = {
  'quanly': 'quanly', 'quan ly': 'quanly', 'quản lý': 'quanly', 'manager': 'quanly',
};

/**
 * Notify HQ group about a new staff registration
 */
async function notifyHQ(bot, { name, username, role, dept, classRole, requestedRole }) {
  const roleInfo = getRoleInfo(role);
  const usernameDisplay = username || '(no username)';
  const deptDisplay = dept ? `🏷️ Bộ phận: ${dept}` : '';
  const classRoleDisplay = classRole ? `\n🎖️ Vị trí: ${classRole}` : '';
  const pendingNote = requestedRole === 'quanly'
    ? `\n⏳ Yêu cầu role: Quản lý — chờ GM/Creator duyệt`
    : '';

  const msg =
    `🆕 Nhân viên mới đăng ký!\n\n` +
    `👤 ${name} (${usernameDisplay})\n` +
    `${roleInfo.icon} Role: ${roleInfo.label}\n` +
    (deptDisplay ? `${deptDisplay}${classRoleDisplay}\n` : '') +
    pendingNote +
    `\n\nDùng /staff để xem danh sách đầy đủ.`;

  broadcastEvent(bot, 'dangky', msg).catch(() => {});
}

async function handle(bot, msg, args, db) {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;

  const tgUsername = msg.from.username ? `@${msg.from.username}` : null;
  const tgFullName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || null;

  clearExpired();

  const creatorIds = (process.env.CREATOR_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const gmIds      = (process.env.GM_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const isCreator  = creatorIds.includes(telegramId);
  const isGm       = gmIds.includes(telegramId);

  // ── Require @username (except Creator/GM who bypass everything) ────────────
  if (!tgUsername && !isCreator && !isGm) {
    return bot.sendMessage(chatId,
      `⚠️ Bạn cần đặt @username Telegram trước khi đăng ký.\n\n` +
      `Cách làm:\n` +
      `1. Vào Settings → chọn Username\n` +
      `2. Đặt username bất kỳ\n` +
      `3. Quay lại đây và /dangky lại`
    );
  }

  // ── Parse args ─────────────────────────────────────────────────────────────
  const normalizedArgs = args.map(a => a.replace(/^—/, '--'));

  // Check for --as test flag (Creator only)
  const asIndex = normalizedArgs.indexOf('--as');
  const testRoleArg = (isCreator && asIndex !== -1) ? normalizedArgs[asIndex + 1] : null;
  const validTestRoles = ['newbie', 'nhanvien', 'quanly', 'gm', 'creator'];
  const forceRole = (testRoleArg && validTestRoles.includes(testRoleArg)) ? testRoleArg : null;

  const cleanArgs = asIndex === -1
    ? normalizedArgs
    : normalizedArgs.filter((_, i) => i !== asIndex && i !== asIndex + 1);

  // Detect role request in last arg: /dangky Hiếu quanly
  const lastArg = cleanArgs[cleanArgs.length - 1]?.toLowerCase() || '';
  const requestedRole = ROLE_REQUEST_MAP[lastArg] || null;
  const nameParts = requestedRole ? cleanArgs.slice(0, -1) : cleanArgs;
  const nameArg = nameParts.join(' ').trim();

  if (!nameArg) {
    return bot.sendMessage(chatId,
      `📝 Cách dùng:\n` +
      `/dangky [tên]            — đăng ký nhân viên thường\n` +
      `/dangky [tên] quanly     — đăng ký + xin role Quản lý\n\n` +
      `Ví dụ: /dangky Hiếu\nVí dụ: /dangky Minh quanly`
    );
  }

  // ── Force role test mode (Creator only) ───────────────────────────────────
  if (forceRole) {
    const existingForce = db.getStaffByTelegramId(telegramId);
    if (existingForce) db.deleteStaff(existingForce.id);
    db.createStaff({ telegramId, name: nameArg, role: forceRole, status: 'active', department: 'bep', classRole: 'nhan_vien', username: tgUsername, fullName: tgFullName });
    const roleInfo = getRoleInfo(forceRole);
    return bot.sendMessage(chatId,
      `🧪 Test mode: ${roleInfo.icon} ${nameArg} — ${roleInfo.label}\n⭐ EXP: 0 | Streak: 0`
    );
  }

  // ── Already registered? ────────────────────────────────────────────────────
  const existing = db.getStaffByTelegramId(telegramId);
  if (existing && (existing.status === 'active' || existing.status === 'pending')) {
    // Auto-update username if it was null before
    if (!existing.username && tgUsername) {
      db.getDb().prepare(`UPDATE staff SET username = ? WHERE telegram_id = ?`).run(tgUsername, telegramId);
    }
    const role = getRoleInfo(existing.role);
    const statusLabel = existing.status === 'pending' ? ' (⏳ Chờ duyệt)' : '';
    return bot.sendMessage(chatId,
      `👤 Bạn đã đăng ký rồi!\n` +
      `${role.icon} ${existing.name} — ${role.label}${statusLabel}\n` +
      `EXP: ${existing.exp} | Streak: ${existing.streak} ngày\n\n` +
      `Dùng /profile để xem chi tiết.`
    );
  }

  if (existing && existing.status === 'archived') {
    db.deleteStaff(existing.id);
  }

  // ── Pre-added by admin (inactive, no telegram_id) ─────────────────────────
  // Check if an admin pre-created a shell record matching this name
  const preAdded = !existing && db.getDb()
    .prepare(`SELECT * FROM staff WHERE name = ? AND status = 'inactive' AND telegram_id IS NULL`)
    .get(nameArg);

  if (preAdded) {
    // Link this user's telegram_id to the pre-created record
    db.getDb().prepare(
      `UPDATE staff SET telegram_id = ?, username = ?, full_name = ?, status = 'active', private_chat_id = ? WHERE id = ?`
    ).run(telegramId, tgUsername, tgFullName, String(chatId), preAdded.id);

    const roleInfo = getRoleInfo(preAdded.role);
    await notifyHQ(bot, { name: nameArg, username: tgUsername, role: preAdded.role, dept: preAdded.department, classRole: preAdded.class_role });
    queueStaffRoster({ name: nameArg, username: tgUsername, role: preAdded.role, department: preAdded.department, class_role: preAdded.class_role, status: 'active' });
    return bot.sendMessage(chatId,
      `✅ Tài khoản đã kích hoạt!\n\n` +
      `${roleInfo.icon} ${nameArg} — ${roleInfo.label}\n` +
      `🏷️ Bộ phận: ${preAdded.department || 'chưa rõ'}\n` +
      `⭐ EXP: ${preAdded.exp} | Streak: ${preAdded.streak} ngày\n\n` +
      `Bắt đầu bằng /checkin khi vào ca nhé.`
    );
  }

  // ── Validate name ──────────────────────────────────────────────────────────
  const RESERVED = ['newbie', 'nhanvien', 'quanly', 'gm', 'creator', 'admin', 'bot', 'all'];
  if (RESERVED.includes(nameArg.toLowerCase())) {
    return bot.sendMessage(chatId, `❌ "${nameArg}" không phải tên hợp lệ. Dùng tên thật của bạn.`);
  }
  if (nameArg.length < 2 || nameArg.length > 30) {
    return bot.sendMessage(chatId, `❌ Tên phải từ 2–30 ký tự.`);
  }

  const nameTaken = db.getStaffByName(nameArg);
  if (nameTaken && nameTaken.telegram_id !== telegramId) {
    return bot.sendMessage(chatId, `❌ Tên "${nameArg}" đã được dùng. Hãy chọn tên khác.`);
  }

  // ── Creator/GM auto-assign top role ───────────────────────────────────────
  if (isCreator || isGm) {
    const assignedRole = isCreator ? 'creator' : 'gm';
    db.createStaff({ telegramId, name: nameArg, role: assignedRole, status: 'active', department: null, classRole: null, username: tgUsername, fullName: tgFullName });
    if (msg.chat.type === 'private') db.updatePrivateChatId(telegramId, chatId);
    const roleInfo = getRoleInfo(assignedRole);
    await notifyHQ(bot, { name: nameArg, username: tgUsername, role: assignedRole });
    queueStaffRoster({ name: nameArg, username: tgUsername, role: assignedRole, department: null, class_role: null, status: 'active' });
    return bot.sendMessage(chatId,
      `✅ ${nameArg} — ${roleInfo.icon} ${roleInfo.label}\n⭐ EXP: 0 | Streak: 0`
    );
  }

  // ── Quanly request path ────────────────────────────────────────────────────
  // Staff requests quanly → pending, GM/Creator approves via /approve
  if (requestedRole === 'quanly') {
    pendingDangky.set(telegramId, {
      step: 'dept',
      data: { name: nameArg, chatId, requestedRole: 'quanly' },
      expiry: Date.now() + TIMEOUT_MS,
    });

    return bot.sendMessage(chatId,
      `📋 Yêu cầu role Quản lý đã ghi nhận.\n` +
      `Bạn thuộc bộ phận nào, ${nameArg}?`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '🍳 Bếp',  callback_data: 'dept_bep' },
            { text: '🍹 Bar',  callback_data: 'dept_bar' },
            { text: '🎱 Bida', callback_data: 'dept_bida' },
            { text: '📦 Kho',  callback_data: 'dept_kho' },
          ]]
        }
      }
    );
  }

  // ── Normal registration — guided flow ─────────────────────────────────────
  pendingDangky.set(telegramId, {
    step: 'dept',
    data: { name: nameArg, chatId },
    expiry: Date.now() + TIMEOUT_MS,
  });

  return bot.sendMessage(chatId,
    `Bạn thuộc bộ phận nào, ${nameArg}?`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '🍳 Bếp',  callback_data: 'dept_bep' },
          { text: '🍹 Bar',  callback_data: 'dept_bar' },
          { text: '🎱 Bida', callback_data: 'dept_bida' },
          { text: '📦 Kho',  callback_data: 'dept_kho' },
        ]]
      }
    }
  );
}

async function handleDangkyCallback(bot, query, db) {
  const telegramId = String(query.from.id);
  const tgUsername = query.from.username ? `@${query.from.username}` : null;
  const tgFullName = [query.from.first_name, query.from.last_name].filter(Boolean).join(' ') || null;
  clearExpired();

  const state = pendingDangky.get(telegramId);
  if (!state) {
    return bot.answerCallbackQuery(query.id, { text: '⏰ Phiên đăng ký đã hết hạn. Gõ /dangky lại.', show_alert: true });
  }

  const data = query.data;
  state.expiry = Date.now() + TIMEOUT_MS;

  // Step 1: chọn bộ phận
  if (state.step === 'dept' && DEPT_MAP[data]) {
    const dept = DEPT_MAP[data];
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
            { text: '👑 Trưởng ca', callback_data: 'classrole_truong_ca' },
            { text: '⚡ Nhân viên', callback_data: 'classrole_nhan_vien' },
          ]]
        }
      }
    ).catch(() => {});
    return;
  }

  // Step 2: chọn vai trò (class role)
  if (state.step === 'classrole' && CLASSROLE_MAP[data]) {
    const classRole = CLASSROLE_MAP[data];
    const { name, department, deptLabel, deptIcon, requestedRole } = state.data;
    const crKey = classRole.key;
    pendingDangky.delete(telegramId);

    // Quanly request → status = pending, role = newbie until approved
    const isPendingQuanly = requestedRole === 'quanly';
    const status = isPendingQuanly ? 'pending' : 'active';
    const role   = 'newbie'; // always starts as newbie, role elevated after approval

    db.createStaff({ telegramId, name, role, status, department, classRole: crKey, username: tgUsername, fullName: tgFullName });

    if (query.message.chat.type === 'private') {
      db.updatePrivateChatId(telegramId, query.message.chat.id);
    }

    await bot.answerCallbackQuery(query.id);

    const successMsg = isPendingQuanly
      ? `✅ Đã đăng ký!\n\n${deptIcon} ${deptLabel} — ${classRole.label}\n⭐ EXP: 0\n\n⏳ Yêu cầu role Quản lý đang chờ duyệt.\nGM/Creator sẽ duyệt sớm nhé.`
      : `✅ Xong rồi ${name}!\n\n${deptIcon} ${deptLabel} — ${classRole.label}\n⭐ EXP: 0 | Streak: 0\n\nBắt đầu bằng /checkin khi vào ca nhé.`;

    await bot.editMessageText(successMsg, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
    }).catch(() => {
      bot.sendMessage(query.message.chat.id, successMsg).catch(() => {});
    });

    // HQ notification
    await notifyHQ(bot, { name, username: tgUsername, role, dept: `${deptIcon} ${deptLabel}`, classRole: classRole.label, requestedRole });

    // Sheets roster
    queueStaffRoster({ name, username: tgUsername, role, department: deptKey, class_role: crKey, status });

    // Welcome DM
    if (query.message.chat.type === 'private' && !isPendingQuanly) {
      bot.sendMessage(query.message.chat.id,
        `👋 Chào ${name}! Mình sẽ nhắc bạn báo cáo ca qua đây.\nBật thông báo để không bỏ lỡ nhé! 🔔`
      ).catch(() => {});
    }
    return;
  }

  await bot.answerCallbackQuery(query.id).catch(() => {});
}

function hasPendingDangky(telegramId) {
  clearExpired();
  return pendingDangky.has(String(telegramId));
}

module.exports = { handle, handleDangkyCallback, hasPendingDangky };
