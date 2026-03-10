/**
 * update.js — /update command
 * Cập nhật thông tin nhân viên
 * Access: Creator/GM
 *
 * Usage:
 *   /update @username dob 15/08/1995        — Ngày sinh (DD/MM/YYYY hoặc YYYY-MM-DD)
 *   /update @username nickname Mèo           — Nickname hiển thị
 *   /update @username username @newusername  — Thêm/sửa @username Telegram
 *   /update @username dept Bếp               — Bộ phận (Bếp / Bar / Bida / Kho)
 *   /update @username classrole Trưởng ca    — Vị trí (Trưởng ca / Nhân viên)
 *   /update @username name Tên Mới           — Sửa tên hệ thống
 */

const DEPT_MAP = {
  'bep': 'bep', 'bếp': 'bep', 'kitchen': 'bep',
  'bar': 'bar',
  'bida': 'bida',
  'kho': 'kho', 'kho hàng': 'kho',
};

const CLASSROLE_MAP = {
  'truong_ca': 'truong_ca', 'trưởng ca': 'truong_ca', 'truong ca': 'truong_ca', 'truongca': 'truong_ca',
  'nhan_vien': 'nhan_vien', 'nhân viên': 'nhan_vien', 'nhan vien': 'nhan_vien', 'nhanvien': 'nhan_vien',
};

const DEPT_LABELS = { bep: '🍳 Bếp', bar: '🍹 Bar', bida: '🎱 Bida', kho: '📦 Kho' };
const CLASSROLE_LABELS = { truong_ca: '👑 Trưởng ca', nhan_vien: '⚡ Nhân viên' };

function isPrivileged(telegramId, senderRole) {
  const creatorIds = (process.env.CREATOR_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const gmIds      = (process.env.GM_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (creatorIds.includes(telegramId) || gmIds.includes(telegramId)) return true;
  return ['creator', 'gm'].includes(senderRole);
}

// Quản lý can update basic info fields only (name changes are GM+)
const MANAGER_ALLOWED_FIELDS = ['dob', 'ngaysinh', 'birthday', 'nickname', 'nick', 'username', 'tgusername', 'dept', 'bophan', 'classrole', 'vitri'];

function isManager(senderRole) {
  return ['quanly', 'gm', 'creator'].includes(senderRole);
}

function parseDob(raw) {
  // Accept DD/MM/YYYY or YYYY-MM-DD
  const ddmmyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  const yyyymmdd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) return raw;
  return null;
}

function formatDob(isoDate) {
  if (!isoDate) return 'chưa có';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

const USAGE = `✏️ Cách dùng /update:

/update @username dob 15/08/1995
/update @username nickname Tên Mèo
/update @username username @newtgusername
/update @username dept Bếp
/update @username classrole Trưởng ca
/update @username name Tên Mới

Nếu nhân viên chưa có @username, dùng tên trực tiếp:
/update Minh Thư username @giannie_9204
/update Minh Thư dob 15/08/1995

Dùng /staff để xem danh sách.`;

// Known field keywords — used to split "name... field value" when no @username
const FIELD_KEYS = ['dob', 'ngaysinh', 'birthday', 'nickname', 'nick', 'username', 'tgusername', 'dept', 'bophan', 'classrole', 'vitri', 'name', 'ten'];

async function handle(bot, msg, args, db) {
  const telegramId = String(msg.from.id);
  const chatId     = msg.chat.id;

  const sender = db.getStaffByTelegramId(telegramId);
  const senderRole = sender?.role || '';

  // Must be at least Quản lý
  if (!isPrivileged(telegramId, senderRole) && !isManager(senderRole)) {
    return bot.sendMessage(chatId, `❌ Lệnh này chỉ dành cho Quản lý trở lên.`);
  }

  if (args.length < 3) {
    return bot.sendMessage(chatId, USAGE);
  }

  let lookupArg, field, value;

  if (args[0].startsWith('@')) {
    // @username lookup
    lookupArg = args[0];
    field     = args[1]?.toLowerCase();
    value     = args.slice(2).join(' ').trim();
  } else {
    // Name lookup — find where the field keyword starts
    let fieldIdx = -1;
    for (let i = 1; i < args.length; i++) {
      if (FIELD_KEYS.includes(args[i].toLowerCase())) {
        fieldIdx = i;
        break;
      }
    }
    if (fieldIdx === -1) {
      return bot.sendMessage(chatId, USAGE);
    }
    lookupArg = args.slice(0, fieldIdx).join(' ');
    field     = args[fieldIdx].toLowerCase();
    value     = args.slice(fieldIdx + 1).join(' ').trim();
  }

  // Strip surrounding quotes (straight or smart) from name lookups
  lookupArg = lookupArg.replace(/^[\u201c\u201d"']+|[\u201c\u201d"']+$/g, '').trim();

  // Find target
  let target;
  if (lookupArg.startsWith('@')) {
    target = db.getStaffByUsername(lookupArg);
    if (!target) {
      return bot.sendMessage(chatId,
        `❌ Không tìm thấy @username: "${lookupArg}".\n\nNếu nhân viên chưa có @username, dùng tên:\n/update ${lookupArg.slice(1)} ${field} ${value}\n\nDùng /staff để xem danh sách.`
      );
    }
  } else {
    target = db.getStaffByName(lookupArg);
    if (!target) {
      return bot.sendMessage(chatId,
        `❌ Không tìm thấy nhân viên tên: "${lookupArg}".\nDùng /staff để xem danh sách.`
      );
    }
  }

  const displayRef = target.username || target.name;

  let column, newValue, displayValue;
  const callerIsGmPlus = isPrivileged(telegramId, senderRole);

  // Managers can only update basic info fields
  if (!callerIsGmPlus && !MANAGER_ALLOWED_FIELDS.includes(field)) {
    return bot.sendMessage(chatId,
      `❌ Quản lý chỉ được cập nhật: dob · nickname · username · dept · classrole\n\nField "${field}" cần quyền GM trở lên.`
    );
  }

  switch (field) {
    case 'dob':
    case 'ngaysinh':
    case 'birthday': {
      const parsed = parseDob(value);
      if (!parsed) {
        return bot.sendMessage(chatId,
          `❌ Định dạng ngày sinh không hợp lệ.\n\nDùng: DD/MM/YYYY hoặc YYYY-MM-DD\nVí dụ: /update ${usernameArg} dob 15/08/1995`
        );
      }
      column = 'date_of_birth';
      newValue = parsed;
      displayValue = formatDob(parsed);
      break;
    }

    case 'nickname':
    case 'nick': {
      if (value.length < 1 || value.length > 30) {
        return bot.sendMessage(chatId, `❌ Nickname phải từ 1–30 ký tự.`);
      }
      column = 'nickname';
      newValue = value;
      displayValue = value;
      break;
    }

    case 'username':
    case 'tgusername': {
      const normalized = value.startsWith('@') ? value : `@${value}`;
  // Check if taken by another person
      const taken = db.getStaffByUsername(normalized);
      if (taken && taken.id !== target.id) {
        return bot.sendMessage(chatId, `❌ @username "${normalized}" đã được dùng bởi ${taken.name}.`);
      }
      column = 'username';
      newValue = normalized;
      displayValue = normalized;
      break;
    }

    case 'dept':
    case 'bophan':
    case 'bộ phận': {
      const deptKey = DEPT_MAP[value.toLowerCase()];
      if (!deptKey) {
        return bot.sendMessage(chatId,
          `❌ Bộ phận không hợp lệ.\nCác bộ phận: Bếp · Bar · Bida · Kho`
        );
      }
      column = 'department';
      newValue = deptKey;
      displayValue = DEPT_LABELS[deptKey];
      break;
    }

    case 'classrole':
    case 'vitri':
    case 'vị trí': {
      const crKey = CLASSROLE_MAP[value.toLowerCase()];
      if (!crKey) {
        return bot.sendMessage(chatId,
          `❌ Vị trí không hợp lệ.\nCác vị trí: Trưởng ca · Nhân viên`
        );
      }
      column = 'class_role';
      newValue = crKey;
      displayValue = CLASSROLE_LABELS[crKey];
      break;
    }

    case 'name':
    case 'ten':
    case 'tên': {
      if (value.length < 2 || value.length > 30) {
        return bot.sendMessage(chatId, `❌ Tên phải từ 2–30 ký tự.`);
      }
      const taken = db.getStaffByName(value);
      if (taken && taken.id !== target.id) {
        return bot.sendMessage(chatId, `❌ Tên "${value}" đã được dùng bởi người khác.`);
      }
      column = 'name';
      newValue = value;
      displayValue = value;
      break;
    }

    default:
      return bot.sendMessage(chatId,
        `❌ Field không hợp lệ: "${field}"\n\n` + USAGE
      );
  }

  // Apply update
  db.getDb().prepare(`UPDATE staff SET ${column} = ? WHERE id = ?`).run(newValue, target.id);

  const oldValue = column === 'date_of_birth'
    ? formatDob(target.date_of_birth)
    : (target[column] || 'chưa có');

  await bot.sendMessage(chatId,
    `✅ Đã cập nhật!\n\n` +
    `👤 ${target.name} (${displayRef})\n` +
    `📝 ${field}: ${oldValue} → ${displayValue}`
  );

  // Notify the staff member if they have a DM channel
  const privateChatId = target.private_chat_id || target.telegram_id;
  if (privateChatId && field !== 'username') {
    bot.sendMessage(privateChatId,
      `✏️ Thông tin của bạn vừa được cập nhật!\n\n${field}: ${displayValue}\n\nDùng /me để xem profile.`
    ).catch(() => {});
  }
}

module.exports = { handle };
