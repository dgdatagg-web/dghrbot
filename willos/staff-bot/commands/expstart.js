/**
 * expstart.js — /expstart [tên] [bulan_thamnien]
 * Set founding EXP for first-batch onboarding staff based on tenure.
 * GM / Creator only.
 *
 * Formula (this batch — role base skipped, tenure-only):
 *   tenure_exp    = months × rate[role]
 *   founding_bonus = min(500, months × 10)
 *   starting_exp  = tenure_exp + founding_bonus
 *
 * Tenure rates by current role:
 *   newbie / nhanvien: 30 EXP/month
 *   kycuu:             60 EXP/month
 *   quanly:           100 EXP/month
 *   gm:               150 EXP/month
 *
 * Usage:
 *   /expstart Hiếu 36        → 36 months tenure, role read from DB
 *   /expstart Hiếu 36 100    → override tenure rate manually
 */

'use strict';

const TENURE_RATE = {
  newbie:   30,
  nhanvien: 30,
  kycuu:    60,
  quanly:   100,
  gm:       150,
};

function calcFoundingExp(months, role, rateOverride) {
  const rate         = rateOverride || TENURE_RATE[role] || 30;
  const tenureExp    = Math.round(months * rate);
  const foundingBonus = Math.min(500, Math.round(months * 10));
  return { tenureExp, foundingBonus, total: tenureExp + foundingBonus, rate };
}

async function handle(bot, msg, args, db) {
  const chatId     = msg.chat.id;
  const telegramId = String(msg.from.id);
  const actor      = db.getStaffByTelegramId(telegramId);

  if (!actor || !['gm', 'creator'].includes(actor.role)) {
    return bot.sendMessage(chatId, '❌ Chỉ GM và Creator mới được dùng lệnh này.');
  }

  if (!args || args.length < 2) {
    return bot.sendMessage(chatId,
      `📋 *Cú pháp:*\n\`/expstart [tên] [tháng thâm niên]\`\n\n` +
      `VD: \`/expstart Hiếu 36\` — Hiếu 3 năm thâm niên\n` +
      `VD: \`/expstart Lan 18\` — Lan 1.5 năm\n\n` +
      `*Hệ số EXP/tháng:*\n` +
      `Nhân viên/Newbie: 30 · Kỳ cựu: 60 · Quản lý: 100 · GM: 150\n\n` +
      `*Founding bonus:* tối đa 500 EXP (tháng × 10)`,
      { parse_mode: 'Markdown' }
    );
  }

  const targetName = args[0];
  const months     = parseInt(args[1], 10);
  const rateOverride = args[2] ? parseInt(args[2], 10) : null;

  if (isNaN(months) || months < 0) {
    return bot.sendMessage(chatId, '⚠️ Số tháng không hợp lệ.');
  }

  const target = db.getStaffByName(targetName);
  if (!target) {
    return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên: ${targetName}`);
  }

  const { tenureExp, foundingBonus, total, rate } = calcFoundingExp(months, target.role, rateOverride);

  // Show calculation breakdown + confirm
  const years   = Math.floor(months / 12);
  const remMonths = months % 12;
  const tenureStr = years > 0
    ? `${years} năm${remMonths > 0 ? ` ${remMonths} tháng` : ''}`
    : `${months} tháng`;

  await bot.sendMessage(chatId,
    `📊 *Tính EXP khởi điểm — ${target.name}*\n\n` +
    `Role hiện tại: ${target.role}\n` +
    `Thâm niên: ${tenureStr} (${months} tháng)\n` +
    `Hệ số: ${rate} EXP/tháng${rateOverride ? ' (override)' : ''}\n\n` +
    `Tenure EXP:     ${tenureExp.toLocaleString()}\n` +
    `Founding bonus: +${foundingBonus} (${months} × 10, cap 500)\n` +
    `─────────────────────\n` +
    `*TỔNG: ${total.toLocaleString()} EXP*\n\n` +
    `EXP hiện tại: ${(target.exp || 0).toLocaleString()}\n\n` +
    `Xác nhận? Nhắn \`/expconfirm ${target.id} ${total}\``,
    { parse_mode: 'Markdown' }
  );
}

async function handleConfirm(bot, msg, args, db) {
  const chatId     = msg.chat.id;
  const telegramId = String(msg.from.id);
  const actor      = db.getStaffByTelegramId(telegramId);

  if (!actor || !['gm', 'creator'].includes(actor.role)) {
    return bot.sendMessage(chatId, '❌ Không có quyền.');
  }

  const staffId = parseInt(args[0], 10);
  const expVal  = parseInt(args[1], 10);

  if (isNaN(staffId) || isNaN(expVal)) {
    return bot.sendMessage(chatId, '⚠️ Tham số không hợp lệ. Dùng /expstart để tính lại.');
  }

  // Get staff by id
  const target = db.getStaffById(staffId);
  if (!target) return bot.sendMessage(chatId, '❌ Không tìm thấy nhân viên.');

  const currentExp = target.exp || 0;
  const delta      = expVal - currentExp;

  // Set EXP — use logExp to write delta, then hard-set
  db.logExp({
    staffId:      target.id,
    delta,
    reason:       `founding_adjustment — khởi điểm thâm niên (${expVal} EXP set by ${actor.name})`,
    byTelegramId: telegramId,
  });
  db.updateStaff(target.id, { exp: expVal });

  await bot.sendMessage(chatId,
    `✅ *EXP khởi điểm đã set cho ${target.name}*\n\n` +
    `Trước: ${currentExp.toLocaleString()} EXP\n` +
    `Sau:   ${expVal.toLocaleString()} EXP\n` +
    `Delta: ${delta >= 0 ? '+' : ''}${delta.toLocaleString()}\n\n` +
    `Đã ghi vào exp_log với lý do founding_adjustment.`,
    { parse_mode: 'Markdown' }
  );

  // Notify staff via DM
  if (target.private_chat_id) {
    await bot.sendMessage(target.private_chat_id,
      `🎖️ EXP khởi điểm của bạn đã được điều chỉnh theo thâm niên thực tế.\n` +
      `EXP hiện tại: *${expVal.toLocaleString()}*\n\n` +
      `Đây là ghi nhận đóng góp từ trước khi hệ thống được triển khai.`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }
}

// /setexp [tên] [số] [lý do...]
async function handleSetExp(bot, msg, args, db) {
  const chatId     = msg.chat.id;
  const telegramId = String(msg.from.id);
  const actor      = db.getStaffByTelegramId(telegramId);

  if (!actor || !['gm', 'creator'].includes(actor.role)) {
    return bot.sendMessage(chatId, '❌ Chỉ GM và Creator.');
  }

  if (!args || args.length < 3) {
    return bot.sendMessage(chatId,
      `*Cú pháp:* \`/setexp [tên] [số EXP] [lý do]\`\n\nVD: \`/setexp Hiếu 3200 founding adjustment 3 năm quản lý\``,
      { parse_mode: 'Markdown' }
    );
  }

  const targetName = args[0];
  const expVal     = parseInt(args[1], 10);
  const reason     = args.slice(2).join(' ');

  if (isNaN(expVal) || expVal < 0) {
    return bot.sendMessage(chatId, '⚠️ Số EXP không hợp lệ.');
  }
  if (!reason || reason.trim().length < 5) {
    return bot.sendMessage(chatId, '⚠️ Lý do quá ngắn — mô tả rõ hơn để log đầy đủ.');
  }

  const target = db.getStaffByName(targetName);
  if (!target) return bot.sendMessage(chatId, `❌ Không tìm thấy: ${targetName}`);

  const currentExp = target.exp || 0;
  const delta      = expVal - currentExp;

  db.logExp({
    staffId:      target.id,
    delta,
    reason:       `manual_setexp — ${reason} (set by ${actor.name})`,
    byTelegramId: telegramId,
  });
  db.updateStaff(target.id, { exp: expVal });

  await bot.sendMessage(chatId,
    `✅ *EXP đã set cho ${target.name}*\n\n` +
    `${currentExp.toLocaleString()} → *${expVal.toLocaleString()} EXP* (${delta >= 0 ? '+' : ''}${delta})\n` +
    `Lý do: ${reason}`,
    { parse_mode: 'Markdown' }
  );

  if (target.private_chat_id) {
    await bot.sendMessage(target.private_chat_id,
      `📊 EXP của bạn vừa được điều chỉnh: *${expVal.toLocaleString()} EXP*\nLý do: ${reason}`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }
}

module.exports = { handle, handleConfirm, handleSetExp, calcFoundingExp };
