/**
 * roadmap.js — /roadmap command
 * Milestone map cá nhân theo role progression
 */

const { getRoleInfo, ROLE_PROGRESSION } = require('../utils/roles');
const { getBadgeDef, formatBadges } = require('../utils/badges');
const { canApprove } = require('../utils/roles');

const SEP = '━━━━━━━━━━━━━━━━━━━━━━━━';

async function handle(bot, msg, args, db) {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;

  const sender = db.getStaffByTelegramId(telegramId);

  let target;
  if (args[0]) {
    if (!sender || !canApprove(sender.role)) {
      return bot.sendMessage(chatId, `❌ Chỉ GM/Creator mới có thể xem roadmap người khác.`);
    }
    target = db.getStaffByName(args[0]);
    if (!target) return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên "${args[0]}".`);
  } else {
    if (!sender) return bot.sendMessage(chatId, `❌ Bạn chưa đăng ký. Dùng /dangky [tên]!`);
    target = sender;
  }

  const badgeRows = db.getBadges(target.id);
  const earnedBadgeKeys = new Set(badgeRows.map(b => b.badge_key));
  const checkinCount = db.getCheckinCount(target.id);

  // ── Creator / GM — special roadmap ──
  if (['creator', 'gm'].includes(target.role)) {
    const roleInfo = getRoleInfo(target.role);
    const allStaff = db.getAllActiveStaff ? db.getAllActiveStaff() : [];
    const staffCount = allStaff.length;
    const badgeCount = badgeRows.length;
    const badgeIconStr = badgeCount > 0 ? formatBadges(badgeRows) : '(chưa có)';

    const lines = [
      `🗺️ ROADMAP — ${target.name}`,
      SEP,
      `${roleInfo.icon} ${roleInfo.label.toUpperCase()} — Bạn không leo rank. Bạn xây rank cho người khác.`,
      ``,
      target.role === 'creator'
        ? `🏗️ Architect — người thiết kế hệ thống`
        : `⚔️ General — chỉ huy toàn quân`,
      ``,
      `📊 HỆ THỐNG CỦA BẠN:`,
      `  👥 ${staffCount} nhân viên active`,
      `  📋 ${checkinCount} lượt checkin ghi nhận`,
      ``,
      `🎯 MỤC TIÊU CREATOR:`,
      `  ${staffCount >= 5 ? '✅' : '⬜'} 5+ nhân viên active`,
      `  ${staffCount >= 15 ? '✅' : '⬜'} 15+ nhân viên active`,
      `  ${earnedBadgeKeys.has('mentor') ? '✅' : '⬜'} 🎓 Đào tạo 1 Newbie lên Nhân viên`,
      `  ⬜ 🏆 Reward Engine live — quest + cash + ESOP`,
      `  ⬜ 📊 Dashboard — staff performance realtime`,
      ``,
      SEP,
      `🏅 BADGES: ${badgeIconStr}  (${badgeCount}/11)`,
    ];
    return bot.sendMessage(chatId, lines.join('\n'));
  }

  const milestones = buildMilestones(target, earnedBadgeKeys, checkinCount);

  const lines = [
    `🗺️ ROADMAP — ${target.name}`,
    SEP,
  ];

  const roleOrder = ['newbie', 'nhanvien', 'kycuu', 'quanly'];
  const roleData = {
    newbie: {
      header: `🐣 NEWBIE (0–99 EXP)`,
      items: milestones.newbie,
    },
    nhanvien: {
      header: `⚡ NHÂN VIÊN (100–499 EXP)`,
      items: milestones.nhanvien,
    },
    kycuu: {
      header: `🔥 KỲ CỰU (500–999 EXP)`,
      items: milestones.kycuu,
    },
    quanly: {
      header: `🛡️ QUẢN LÝ (1000+ EXP, cần duyệt)`,
      items: milestones.quanly,
    },
  };

  for (const roleKey of roleOrder) {
    const data = roleData[roleKey];
    const isCurrentRole = target.role === roleKey;
    const isSpecialRole = ['gm', 'creator'].includes(target.role);
    const headerSuffix = (isCurrentRole && !isSpecialRole) ? '   ← YOU ARE HERE' : '';
    lines.push(`${data.header}${headerSuffix}`);
    for (const item of data.items) {
      const mark = item.done ? '  ✅' : '  ⬜';
      lines.push(`${mark} ${item.text}`);
    }
    lines.push('');
  }

  lines.push(SEP);

  const badgeCount = badgeRows.length;
  const badgeIconStr = badgeCount > 0 ? formatBadges(badgeRows) : '(chưa có)';
  lines.push(`🏅 BADGES: ${badgeIconStr}  (${badgeCount}/9)`);

  return bot.sendMessage(chatId, lines.join('\n'));
}

function buildMilestones(staff, earnedBadgeKeys, checkinCount) {
  const exp = staff.exp;
  const role = staff.role;
  const roleRank = { newbie: 0, nhanvien: 1, kycuu: 2, quanly: 3, gm: 4, creator: 5 };
  const currentRank = roleRank[role] || 0;

  return {
    newbie: [
      { text: 'Hoàn thành onboarding', done: currentRank >= 0 && checkinCount >= 1 },
      { text: 'Ca đầu tiên 🩸 First Blood', done: earnedBadgeKeys.has('first_blood') },
      { text: 'Đủ 100 EXP → lên Nhân viên', done: currentRank >= 1 },
    ],
    nhanvien: [
      { text: 'Unlock SOP: Xử lý complaint', done: currentRank >= 1 },
      { text: 'Streak 7 ngày 🔥 On Fire', done: earnedBadgeKeys.has('on_fire') },
      { text: '30 ca tích lũy ⚙️ Grinder', done: earnedBadgeKeys.has('grinder') },
      { text: 'Đủ 500 EXP → lên Kỳ cựu', done: currentRank >= 2 },
    ],
    kycuu: [
      { text: 'Unlock: Nhập hàng, Báo cáo ca', done: currentRank >= 2 },
      { text: 'Dạy 1 Newbie 🎓 Mentor', done: earnedBadgeKeys.has('mentor') },
      { text: 'Streak 30 ngày 🌟 Legendary', done: earnedBadgeKeys.has('legendary') },
      { text: 'Đủ 1000 EXP → apply Quản lý', done: currentRank >= 3 },
    ],
    quanly: [
      { text: 'Unlock: /posttask, /completetask, /kpihit, /confirmpayout', done: currentRank >= 3 },
      { text: 'Submit lịch ca hàng tuần /lichca', done: false },
      { text: '3 tháng KPI 100% 👑 KPI King', done: earnedBadgeKeys.has('kpi_king') },
    ],
  };
}

module.exports = { handle };
